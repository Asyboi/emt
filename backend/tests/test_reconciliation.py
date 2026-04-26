"""Reconciliation tests — unit (deterministic) + integration (LLM-gated)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.config import settings
from app.pipeline import reconciliation as recon
from app.pipeline.reconciliation import _is_disputed, reconcile
from app.schemas import (
    DiscrepancyType,
    DraftTimelineEntry,
    Event,
    EventCluster,
    EventSource,
    EventType,
    ScoredCluster,
)


def _ev(
    event_id: str,
    source: EventSource,
    seconds: float,
    event_type: EventType,
    description: str,
) -> Event:
    mm = int(seconds // 60)
    ss = int(seconds % 60)
    return Event(
        event_id=event_id,
        timestamp=f"00:{mm:02d}:{ss:02d}",
        timestamp_seconds=seconds,
        source=source,
        event_type=event_type,
        description=description,
        details={},
        confidence=1.0,
        raw_evidence=description,
    )


@pytest.mark.skipif(
    not settings.ANTHROPIC_API_KEY,
    reason="ANTHROPIC_API_KEY not set",
)
async def test_reconcile_matches_cross_source_events_and_flags_discrepancy() -> None:
    pcr = [
        _ev("pcr-1", EventSource.PCR, 0.0, EventType.ARRIVAL, "Arrived on scene"),
        _ev("pcr-2", EventSource.PCR, 60.0, EventType.CPR_START, "CPR initiated"),
        _ev("pcr-3", EventSource.PCR, 180.0, EventType.MEDICATION, "Epinephrine 1mg IV"),
    ]
    video = [
        _ev("vid-1", EventSource.VIDEO, 5.0, EventType.ARRIVAL, "Crew enters scene"),
        _ev("vid-2", EventSource.VIDEO, 65.0, EventType.CPR_START, "Compressions begin"),
        _ev("vid-3", EventSource.VIDEO, 210.0, EventType.MEDICATION, "Epi syringe administered"),
    ]
    audio = [
        _ev("aud-1", EventSource.AUDIO, 195.0, EventType.MEDICATION, "Pushing 1mg epi now"),
    ]

    timeline = await reconcile(pcr, video, audio)

    assert len(timeline) >= 3, f"expected >=3 reconciled entries, got {len(timeline)}"

    all_ids = {e.event_id for e in pcr + video + audio}
    referenced = {ev.event_id for entry in timeline for ev in entry.source_events}
    assert referenced.issubset(all_ids), "timeline references unknown event ids"

    assert any(entry.has_discrepancy for entry in timeline), (
        "expected at least one entry with has_discrepancy=True (epi push spans 30s across sources)"
    )

    assert any(len(entry.source_events) >= 2 for entry in timeline), (
        "expected at least one entry to merge events from multiple sources"
    )


# --------------------------------------------------------------------------- #
# Unit tests — conditional escalation classifier and dispatch
# --------------------------------------------------------------------------- #


def _cluster(cluster_id: str, events: list[Event]) -> EventCluster:
    return EventCluster(
        cluster_id=cluster_id,
        event_ids=[e.event_id for e in events],
        centroid_timestamp_seconds=sum(e.timestamp_seconds for e in events) / len(events),
        source_types=list({e.source for e in events}),
    )


def _scored(cluster: EventCluster, score: float) -> ScoredCluster:
    return ScoredCluster(
        cluster_id=cluster.cluster_id,
        event_ids=cluster.event_ids,
        centroid_timestamp_seconds=cluster.centroid_timestamp_seconds,
        source_types=cluster.source_types,
        discrepancy_score=score,
        discrepancy_type=DiscrepancyType.NONE if score < 0.15 else DiscrepancyType.TIMING,
        discrepancy_reasoning="test",
    )


def _draft(
    cluster: EventCluster, event_type: EventType, confidence: float
) -> DraftTimelineEntry:
    return DraftTimelineEntry(
        cluster_id=cluster.cluster_id,
        event_ids=cluster.event_ids,
        canonical_timestamp_seconds=cluster.centroid_timestamp_seconds,
        event_type=event_type,
        canonical_description="test entry",
        match_confidence=confidence,
    )


def test_is_disputed_clean_cluster_passes_through() -> None:
    events = [
        _ev("a", EventSource.PCR, 60.0, EventType.CPR_START, "CPR"),
        _ev("b", EventSource.VIDEO, 62.0, EventType.CPR_START, "compressions"),
    ]
    by_id = {e.event_id: e for e in events}
    cluster = _cluster("c1", events)
    assert _is_disputed(
        cluster, _scored(cluster, 0.05), _draft(cluster, EventType.CPR_START, 0.95), by_id
    ) is False


def test_is_disputed_high_discrepancy_score_flags() -> None:
    events = [_ev("a", EventSource.PCR, 60.0, EventType.CPR_START, "CPR")]
    by_id = {e.event_id: e for e in events}
    cluster = _cluster("c1", events)
    assert _is_disputed(
        cluster, _scored(cluster, 0.6), _draft(cluster, EventType.CPR_START, 0.9), by_id
    ) is True


def test_is_disputed_low_match_confidence_flags() -> None:
    events = [_ev("a", EventSource.PCR, 60.0, EventType.CPR_START, "CPR")]
    by_id = {e.event_id: e for e in events}
    cluster = _cluster("c1", events)
    assert _is_disputed(
        cluster, _scored(cluster, 0.1), _draft(cluster, EventType.CPR_START, 0.5), by_id
    ) is True


def test_is_disputed_wide_timestamp_spread_multi_source_flags() -> None:
    events = [
        _ev("a", EventSource.PCR, 60.0, EventType.CPR_START, "CPR"),
        _ev("b", EventSource.VIDEO, 120.0, EventType.CPR_START, "compressions"),
    ]
    by_id = {e.event_id: e for e in events}
    cluster = _cluster("c1", events)
    assert _is_disputed(
        cluster, _scored(cluster, 0.1), _draft(cluster, EventType.CPR_START, 0.9), by_id
    ) is True


def test_is_disputed_single_source_three_events_flags() -> None:
    events = [
        _ev("a", EventSource.PCR, 60.0, EventType.MEDICATION, "epi 1"),
        _ev("b", EventSource.PCR, 65.0, EventType.MEDICATION, "epi 2"),
        _ev("c", EventSource.PCR, 70.0, EventType.MEDICATION, "epi 3"),
    ]
    by_id = {e.event_id: e for e in events}
    cluster = _cluster("c1", events)
    assert _is_disputed(
        cluster, _scored(cluster, 0.1), _draft(cluster, EventType.MEDICATION, 0.9), by_id
    ) is True


def test_is_disputed_event_type_disagreement_flags() -> None:
    events = [
        _ev("a", EventSource.PCR, 60.0, EventType.CPR_START, "CPR"),
        _ev("b", EventSource.VIDEO, 62.0, EventType.RHYTHM_CHECK, "rhythm check"),
    ]
    by_id = {e.event_id: e for e in events}
    cluster = _cluster("c1", events)
    assert _is_disputed(
        cluster, _scored(cluster, 0.1), _draft(cluster, EventType.CPR_START, 0.9), by_id
    ) is True


async def test_reconcile_no_disputed_skips_critic() -> None:
    """All clean clusters → critic never called, timeline assembled from drafts."""
    pcr = [
        _ev("p1", EventSource.PCR, 0.0, EventType.ARRIVAL, "Arrived on scene"),
        _ev("p2", EventSource.PCR, 60.0, EventType.CPR_START, "CPR initiated"),
    ]
    video = [
        _ev("v1", EventSource.VIDEO, 1.0, EventType.ARRIVAL, "Crew enters scene"),
        _ev("v2", EventSource.VIDEO, 61.0, EventType.CPR_START, "Compressions begin"),
    ]

    fake_clusters = [
        EventCluster(
            cluster_id="c1",
            event_ids=["p1", "v1"],
            centroid_timestamp_seconds=0.5,
            source_types=[EventSource.PCR, EventSource.VIDEO],
        ),
        EventCluster(
            cluster_id="c2",
            event_ids=["p2", "v2"],
            centroid_timestamp_seconds=60.5,
            source_types=[EventSource.PCR, EventSource.VIDEO],
        ),
    ]
    fake_review_results = [
        (
            ScoredCluster(
                cluster_id="c1",
                event_ids=["p1", "v1"],
                centroid_timestamp_seconds=0.5,
                source_types=[EventSource.PCR, EventSource.VIDEO],
                discrepancy_score=0.05,
                discrepancy_type=DiscrepancyType.NONE,
                discrepancy_reasoning="ok",
            ),
            DraftTimelineEntry(
                cluster_id="c1",
                event_ids=["p1", "v1"],
                canonical_timestamp_seconds=0.5,
                event_type=EventType.ARRIVAL,
                canonical_description="Arrival on scene",
                match_confidence=0.95,
            ),
        ),
        (
            ScoredCluster(
                cluster_id="c2",
                event_ids=["p2", "v2"],
                centroid_timestamp_seconds=60.5,
                source_types=[EventSource.PCR, EventSource.VIDEO],
                discrepancy_score=0.05,
                discrepancy_type=DiscrepancyType.NONE,
                discrepancy_reasoning="ok",
            ),
            DraftTimelineEntry(
                cluster_id="c2",
                event_ids=["p2", "v2"],
                canonical_timestamp_seconds=60.5,
                event_type=EventType.CPR_START,
                canonical_description="CPR begins",
                match_confidence=0.95,
            ),
        ),
    ]

    with patch.object(
        recon, "_cluster_events", new=AsyncMock(return_value=fake_clusters)
    ), patch.object(
        recon,
        "_review_cluster",
        new=AsyncMock(side_effect=fake_review_results),
    ), patch.object(
        recon, "_critic_pass", new=AsyncMock()
    ) as mock_critic:
        timeline = await reconcile(pcr, video, [])

    assert mock_critic.call_count == 0, "critic should not be called when no clusters disputed"
    assert len(timeline) == 2
    assert {e.event_id for entry in timeline for e in entry.source_events} == {
        "p1", "p2", "v1", "v2"
    }


async def test_reconcile_partial_disputed_critic_sees_only_subset() -> None:
    """1 disputed + 1 clean → critic called once, with disputed_drafts of length 1."""
    pcr = [
        _ev("p1", EventSource.PCR, 0.0, EventType.ARRIVAL, "Arrived on scene"),
        _ev("p2", EventSource.PCR, 60.0, EventType.CPR_START, "CPR initiated"),
    ]
    video = [
        _ev("v1", EventSource.VIDEO, 1.0, EventType.ARRIVAL, "Crew enters scene"),
        _ev("v2", EventSource.VIDEO, 100.0, EventType.RHYTHM_CHECK, "rhythm check"),
    ]

    fake_clusters = [
        EventCluster(
            cluster_id="clean",
            event_ids=["p1", "v1"],
            centroid_timestamp_seconds=0.5,
            source_types=[EventSource.PCR, EventSource.VIDEO],
        ),
        EventCluster(
            cluster_id="messy",
            event_ids=["p2", "v2"],
            centroid_timestamp_seconds=80.0,
            source_types=[EventSource.PCR, EventSource.VIDEO],
        ),
    ]
    fake_review_results = [
        (
            ScoredCluster(
                cluster_id="clean",
                event_ids=["p1", "v1"],
                centroid_timestamp_seconds=0.5,
                source_types=[EventSource.PCR, EventSource.VIDEO],
                discrepancy_score=0.05,
                discrepancy_type=DiscrepancyType.NONE,
                discrepancy_reasoning="ok",
            ),
            DraftTimelineEntry(
                cluster_id="clean",
                event_ids=["p1", "v1"],
                canonical_timestamp_seconds=0.5,
                event_type=EventType.ARRIVAL,
                canonical_description="Arrival",
                match_confidence=0.95,
            ),
        ),
        (
            # event_type disagreement → flagged disputed
            ScoredCluster(
                cluster_id="messy",
                event_ids=["p2", "v2"],
                centroid_timestamp_seconds=80.0,
                source_types=[EventSource.PCR, EventSource.VIDEO],
                discrepancy_score=0.2,
                discrepancy_type=DiscrepancyType.TIMING,
                discrepancy_reasoning="40s spread + type mismatch",
            ),
            DraftTimelineEntry(
                cluster_id="messy",
                event_ids=["p2", "v2"],
                canonical_timestamp_seconds=80.0,
                event_type=EventType.CPR_START,
                canonical_description="CPR begins",
                match_confidence=0.6,
            ),
        ),
    ]

    captured_disputed_drafts: list[DraftTimelineEntry] = []

    async def fake_critic(scored, drafts, all_events):
        captured_disputed_drafts.extend(drafts)
        # echo back drafts as a minimal valid timeline
        from app.pipeline.reconciliation import _assemble_from_drafts
        by_id = {e.event_id: e for e in all_events}
        return _assemble_from_drafts(scored, drafts, by_id)

    with patch.object(
        recon, "_cluster_events", new=AsyncMock(return_value=fake_clusters)
    ), patch.object(
        recon,
        "_review_cluster",
        new=AsyncMock(side_effect=fake_review_results),
    ), patch.object(
        recon, "_critic_pass", new=AsyncMock(side_effect=fake_critic)
    ) as mock_critic:
        timeline = await reconcile(pcr, video, [])

    assert mock_critic.call_count == 1, "critic should be called exactly once for the disputed cluster"
    assert len(captured_disputed_drafts) == 1
    assert captured_disputed_drafts[0].cluster_id == "messy"
    assert len(timeline) == 2
    assert {e.event_id for entry in timeline for e in entry.source_events} == {
        "p1", "p2", "v1", "v2"
    }
