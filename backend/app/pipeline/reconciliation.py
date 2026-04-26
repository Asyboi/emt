"""Stage 2 — multi-agent timeline reconciliation.

3-agent reconciliation chain:
  Agent 1 (Haiku)  — semantic clustering of all events
  Agent R (Haiku)  — per-cluster combined scoring + canonicalization (parallel)
  Agent 4 (Sonnet) — critic verification pass → list[TimelineEntry]

CAD events: when a CADRecord is supplied, synthetic Event objects are
synthesized for first_on_scene_datetime and (optionally)
first_to_hosp_datetime, using arithmetic against incident_datetime for
timestamp_seconds.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Optional

from app.llm_clients import claude_haiku, claude_sonnet
from app.prompts import (
    ASSEMBLE_VERIFIED_TIMELINE_TOOL,
    CLUSTER_EVENTS_TOOL,
    RECONCILIATION_CLUSTER_SYSTEM,
    RECONCILIATION_CLUSTER_USER_TEMPLATE,
    RECONCILIATION_CRITIC_SYSTEM,
    RECONCILIATION_CRITIC_USER_TEMPLATE,
    RECONCILIATION_REVIEW_SYSTEM,
    RECONCILIATION_REVIEW_USER_TEMPLATE,
    REVIEW_CLUSTER_TOOL,
)
from app.schemas import (
    CADRecord,
    DiscrepancyType,
    DraftTimelineEntry,
    Event,
    EventCluster,
    EventSource,
    EventType,
    ScoredCluster,
    TimelineEntry,
)

logger = logging.getLogger(__name__)

DISCREPANCY_THRESHOLD_SECONDS = 10.0
DISCREPANCY_SCORE_THRESHOLD = 0.15

_CLUSTER_SEM = asyncio.Semaphore(5)


async def _gated(coro):
    async with _CLUSTER_SEM:
        return await coro


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _format_timestamp(seconds: float) -> str:
    s = max(0, int(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def _serialize_events(events: list[Event]) -> str:
    return json.dumps(
        [
            {
                "event_id": e.event_id,
                "source": e.source.value,
                "timestamp": e.timestamp,
                "timestamp_seconds": e.timestamp_seconds,
                "event_type": e.event_type.value,
                "description": e.description,
                "details": e.details,
                "confidence": e.confidence,
            }
            for e in events
        ],
        indent=2,
    )


def _serialize_cluster_events(cluster: EventCluster, by_id: dict[str, Event]) -> str:
    events = [by_id[eid] for eid in cluster.event_ids if eid in by_id]
    return _serialize_events(events)


def _synthesize_cad_events(record: CADRecord) -> list[Event]:
    """Create synthetic Event objects for CAD ground-truth timestamps."""
    base = record.incident_datetime

    def _offset(dt) -> float:
        b = base
        if dt.tzinfo is None and b.tzinfo is not None:
            b = b.replace(tzinfo=None)
        elif dt.tzinfo is not None and b.tzinfo is None:
            dt = dt.replace(tzinfo=None)
        return (dt - b).total_seconds()

    def _make(dt, event_type: EventType, description: str, raw_evidence: str) -> Event:
        secs = _offset(dt)
        return Event(
            event_id=f"cad-{event_type.value}-{record.cad_incident_id}",
            timestamp=_format_timestamp(secs),
            timestamp_seconds=secs,
            source=EventSource.CAD,
            event_type=event_type,
            description=description,
            details={},
            confidence=1.0,
            raw_evidence=raw_evidence,
        )

    events: list[Event] = [
        _make(
            record.first_on_scene_datetime,
            EventType.ARRIVAL,
            f"CAD: first unit on scene (incident {record.cad_incident_id})",
            f"CAD first_on_scene_datetime={record.first_on_scene_datetime.isoformat()}",
        )
    ]

    if record.first_to_hosp_datetime is not None:
        events.append(
            _make(
                record.first_to_hosp_datetime,
                EventType.TRANSPORT_DECISION,
                f"CAD: transport to hospital departed (incident {record.cad_incident_id})",
                f"CAD first_to_hosp_datetime={record.first_to_hosp_datetime.isoformat()}",
            )
        )

    return events


def _build_critic_input(
    scored: list[ScoredCluster],
    drafts: list[DraftTimelineEntry],
) -> str:
    scored_by_id = {s.cluster_id: s for s in scored}
    merged = []
    for draft in drafts:
        sc = scored_by_id.get(draft.cluster_id)
        merged.append(
            {
                "cluster_id": draft.cluster_id,
                "event_ids": draft.event_ids,
                "canonical_timestamp_seconds": draft.canonical_timestamp_seconds,
                "event_type": draft.event_type.value,
                "canonical_description": draft.canonical_description,
                "match_confidence": draft.match_confidence,
                "discrepancy_score": sc.discrepancy_score if sc else 0.0,
                "discrepancy_type": sc.discrepancy_type.value if sc else DiscrepancyType.NONE.value,
                "discrepancy_reasoning": sc.discrepancy_reasoning if sc else "no scoring data",
            }
        )
    return json.dumps(merged, indent=2)


def _hydrate_timeline(
    raw_entries: list[dict],
    by_id: dict[str, Event],
) -> list[TimelineEntry]:
    timeline: list[TimelineEntry] = []
    for entry in raw_entries:
        source_events = [by_id[eid] for eid in entry["source_event_ids"] if eid in by_id]
        if not source_events:
            logger.warning(
                "Critic produced entry with no resolvable source_event_ids: %s", entry
            )
            continue
        timestamps = [e.timestamp_seconds for e in source_events]
        spread = max(timestamps) - min(timestamps) if len(timestamps) > 1 else 0.0
        has_discrepancy = bool(entry["has_discrepancy"]) or spread > DISCREPANCY_THRESHOLD_SECONDS
        timeline.append(
            TimelineEntry(
                entry_id=str(uuid.uuid4()),
                canonical_timestamp_seconds=entry["canonical_timestamp_seconds"],
                canonical_description=entry["canonical_description"],
                event_type=EventType(entry["event_type"]),
                source_events=source_events,
                match_confidence=float(entry["match_confidence"]),
                has_discrepancy=has_discrepancy,
            )
        )
    return sorted(timeline, key=lambda t: t.canonical_timestamp_seconds)


def _assemble_from_drafts(
    scored_clusters: list[ScoredCluster],
    draft_entries: list[DraftTimelineEntry],
    by_id: dict[str, Event],
) -> list[TimelineEntry]:
    scored_by_id = {s.cluster_id: s for s in scored_clusters}
    timeline: list[TimelineEntry] = []
    for draft in draft_entries:
        source_events = [by_id[eid] for eid in draft.event_ids if eid in by_id]
        if not source_events:
            continue
        sc = scored_by_id.get(draft.cluster_id)
        timestamps = [e.timestamp_seconds for e in source_events]
        spread = max(timestamps) - min(timestamps) if len(timestamps) > 1 else 0.0
        has_discrepancy = (
            sc is not None and sc.discrepancy_score >= DISCREPANCY_SCORE_THRESHOLD
        ) or spread > DISCREPANCY_THRESHOLD_SECONDS
        timeline.append(
            TimelineEntry(
                entry_id=str(uuid.uuid4()),
                canonical_timestamp_seconds=draft.canonical_timestamp_seconds,
                canonical_description=draft.canonical_description,
                event_type=draft.event_type,
                source_events=source_events,
                match_confidence=draft.match_confidence,
                has_discrepancy=has_discrepancy,
            )
        )
    return sorted(timeline, key=lambda t: t.canonical_timestamp_seconds)


# ---------------------------------------------------------------------------
# Demo resilience — pure-Python fallbacks for Agents 2 and 3
# ---------------------------------------------------------------------------


def _deterministic_score_fallback(
    cluster: EventCluster,
    by_id: dict[str, Event],
) -> ScoredCluster:
    """Fallback for Agent 2 when Haiku call fails. Scores from timestamp spread only."""
    timestamps = [
        by_id[eid].timestamp_seconds
        for eid in cluster.event_ids
        if eid in by_id
    ]
    spread = max(timestamps) - min(timestamps) if len(timestamps) > 1 else 0.0
    score = min(spread / 120.0, 1.0)
    return ScoredCluster(
        cluster_id=cluster.cluster_id,
        event_ids=cluster.event_ids,
        centroid_timestamp_seconds=cluster.centroid_timestamp_seconds,
        source_types=cluster.source_types,
        discrepancy_score=score,
        discrepancy_type=(
            DiscrepancyType.TIMING if score > DISCREPANCY_SCORE_THRESHOLD
            else DiscrepancyType.NONE
        ),
        discrepancy_reasoning="Fallback: scored from timestamp spread only — LLM unavailable",
    )


def _first_event_fallback(
    cluster: EventCluster,
    by_id: dict[str, Event],
) -> DraftTimelineEntry:
    """Fallback for Agent 3 when Haiku call fails. Uses first member event directly."""
    first = by_id[cluster.event_ids[0]]
    return DraftTimelineEntry(
        cluster_id=cluster.cluster_id,
        event_ids=cluster.event_ids,
        canonical_timestamp_seconds=cluster.centroid_timestamp_seconds,
        event_type=first.event_type,
        canonical_description=first.description[:120],
        match_confidence=0.5,
    )


# ---------------------------------------------------------------------------
# Agent functions
# ---------------------------------------------------------------------------


async def _cluster_events(all_events: list[Event]) -> list[EventCluster]:
    """Agent 1: Haiku groups all events into semantic clusters."""
    response = await claude_haiku(
        system=RECONCILIATION_CLUSTER_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": RECONCILIATION_CLUSTER_USER_TEMPLATE.format(
                    events_json=_serialize_events(all_events)
                ),
            }
        ],
        tools=[CLUSTER_EVENTS_TOOL],
        max_tokens=4096,
    )

    tool_use = next(
        (b for b in response["content"] if b["type"] == "tool_use"), None
    )
    if tool_use is None:
        logger.warning(
            "Agent 1 (cluster_events) returned no tool_use block — falling back to solo clusters"
        )
        return [
            EventCluster(
                cluster_id=f"c{i:03d}",
                event_ids=[e.event_id],
                centroid_timestamp_seconds=e.timestamp_seconds,
                source_types=[e.source],
            )
            for i, e in enumerate(all_events)
        ]

    raw_clusters = tool_use["input"]["clusters"]
    return [
        EventCluster(
            cluster_id=c["cluster_id"],
            event_ids=c["event_ids"],
            centroid_timestamp_seconds=c["centroid_timestamp_seconds"],
            source_types=[EventSource(s) for s in c["source_types"]],
        )
        for c in raw_clusters
        if c["event_ids"]
    ]


async def _review_cluster(
    cluster: EventCluster, by_id: dict[str, Event]
) -> tuple[ScoredCluster, DraftTimelineEntry]:
    """Agent R: one Haiku call that scores AND canonicalizes a cluster."""
    response = await claude_haiku(
        system=RECONCILIATION_REVIEW_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": RECONCILIATION_REVIEW_USER_TEMPLATE.format(
                    cluster_id=cluster.cluster_id,
                    centroid_timestamp_seconds=cluster.centroid_timestamp_seconds,
                    cluster_events_json=_serialize_cluster_events(cluster, by_id),
                ),
            }
        ],
        tools=[REVIEW_CLUSTER_TOOL],
        max_tokens=1024,
    )

    tool_use = next(
        (b for b in response["content"] if b["type"] == "tool_use"), None
    )
    if tool_use is None:
        logger.warning(
            "Agent R (review_cluster) returned no tool_use for cluster %s — using deterministic fallbacks",
            cluster.cluster_id,
        )
        return (
            _deterministic_score_fallback(cluster, by_id),
            _first_event_fallback(cluster, by_id),
        )

    raw = tool_use["input"]
    scored = ScoredCluster(
        cluster_id=cluster.cluster_id,
        event_ids=cluster.event_ids,
        centroid_timestamp_seconds=cluster.centroid_timestamp_seconds,
        source_types=cluster.source_types,
        discrepancy_score=float(raw["discrepancy_score"]),
        discrepancy_type=DiscrepancyType(raw["discrepancy_type"]),
        discrepancy_reasoning=raw["discrepancy_reasoning"],
    )
    draft = DraftTimelineEntry(
        cluster_id=cluster.cluster_id,
        event_ids=cluster.event_ids,
        canonical_timestamp_seconds=float(raw["canonical_timestamp_seconds"]),
        event_type=EventType(raw["event_type"]),
        canonical_description=raw["canonical_description"],
        match_confidence=float(raw["match_confidence"]),
    )
    return scored, draft


async def _critic_pass(
    scored_clusters: list[ScoredCluster],
    draft_entries: list[DraftTimelineEntry],
    all_events: list[Event],
) -> list[TimelineEntry]:
    """Agent 4: Sonnet verifies and corrects the draft timeline."""
    by_id = {e.event_id: e for e in all_events}

    response = await claude_sonnet(
        system=RECONCILIATION_CRITIC_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": RECONCILIATION_CRITIC_USER_TEMPLATE.format(
                    n_clusters=len(draft_entries),
                    all_events_json=_serialize_events(all_events),
                    draft_entries_json=_build_critic_input(scored_clusters, draft_entries),
                ),
            }
        ],
        tools=[ASSEMBLE_VERIFIED_TIMELINE_TOOL],
        max_tokens=8192,
    )

    tool_use = next(
        (b for b in response["content"] if b["type"] == "tool_use"), None
    )
    if tool_use is None:
        logger.warning(
            "Agent 4 (critic) returned no tool_use block — assembling timeline directly from draft entries"
        )
        return _assemble_from_drafts(scored_clusters, draft_entries, by_id)

    return _hydrate_timeline(tool_use["input"]["timeline_entries"], by_id)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def reconcile(
    pcr: list[Event],
    video: list[Event],
    audio: list[Event],
    cad_record: Optional[CADRecord] = None,
) -> list[TimelineEntry]:
    """4-agent reconciliation chain.

    Args:
        pcr:        Events from PCR parser (stage 1a).
        video:      Events from video analyzer (stage 1b).
        audio:      Events from audio analyzer (stage 1c).
        cad_record: Optional CAD data. When provided, synthesizes ground-truth
                    arrival and transport events before clustering.

    Returns:
        Sorted list[TimelineEntry] with every input event_id referenced exactly once.
    """
    cad_events = _synthesize_cad_events(cad_record) if cad_record is not None else []
    all_events = sorted(
        [*pcr, *video, *audio, *cad_events],
        key=lambda e: e.timestamp_seconds,
    )

    if not all_events:
        return []

    by_id: dict[str, Event] = {e.event_id: e for e in all_events}

    # Agent 1 — Semantic Clustering (sequential, Haiku)
    clusters = await _cluster_events(all_events)

    if not clusters:
        logger.warning("Agent 1 returned zero clusters — returning empty timeline")
        return []

    # Agent R — Per-cluster review (parallel, Haiku) — one call per cluster
    # return_exceptions=True so a single cluster failure degrades gracefully
    raw_results = await asyncio.gather(
        *[_gated(_review_cluster(c, by_id)) for c in clusters],
        return_exceptions=True,
    )

    scored_list: list[ScoredCluster] = []
    draft_list: list[DraftTimelineEntry] = []
    for cluster, result in zip(clusters, raw_results):
        if isinstance(result, Exception):
            logger.warning(
                "Agent R review failed for cluster %s — using deterministic fallbacks: %s",
                cluster.cluster_id,
                result,
            )
            scored_list.append(_deterministic_score_fallback(cluster, by_id))
            draft_list.append(_first_event_fallback(cluster, by_id))
        else:
            scored, draft = result
            scored_list.append(scored)
            draft_list.append(draft)

    # Agent 4 — Critic verification pass (sequential, Sonnet)
    try:
        return await _critic_pass(scored_list, draft_list, all_events)
    except Exception as exc:
        logger.warning(
            "Agent 4 (critic) failed — assembling timeline directly from draft entries: %s", exc
        )
        return _assemble_from_drafts(scored_list, draft_list, by_id)
