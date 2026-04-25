"""Stage 2 — timeline reconciliation via Claude Sonnet 4.6.

Takes the per-source Event lists produced by stages 1a/1b/1c and asks
Sonnet to fold them into a canonical TimelineEntry list. The model
matches events that refer to the same real-world action across sources
(typically within a ~60s window) and flags timestamp discrepancies.
"""

from __future__ import annotations

import json
import uuid

from app.llm_clients import claude_sonnet
from app.prompts import (
    RECONCILIATION_SYSTEM,
    RECONCILIATION_USER_TEMPLATE,
    TIMELINE_TOOL,
)
from app.schemas import Event, EventType, TimelineEntry

DISCREPANCY_THRESHOLD_SECONDS = 10.0


def _serialize_events(events: list[Event]) -> str:
    payload = [
        {
            "event_id": e.event_id,
            "source": e.source.value,
            "timestamp": e.timestamp,
            "timestamp_seconds": e.timestamp_seconds,
            "event_type": e.event_type.value,
            "description": e.description,
        }
        for e in events
    ]
    return json.dumps(payload, indent=2)


async def reconcile(
    pcr: list[Event],
    video: list[Event],
    audio: list[Event],
) -> list[TimelineEntry]:
    all_events = sorted(
        [*pcr, *video, *audio], key=lambda e: e.timestamp_seconds
    )
    if not all_events:
        return []

    by_id: dict[str, Event] = {e.event_id: e for e in all_events}

    response = await claude_sonnet(
        system=RECONCILIATION_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": RECONCILIATION_USER_TEMPLATE.format(
                    events_json=_serialize_events(all_events)
                ),
            }
        ],
        tools=[TIMELINE_TOOL],
        max_tokens=4096,
    )

    tool_use = next(
        (b for b in response["content"] if b["type"] == "tool_use"), None
    )
    if tool_use is None:
        raise RuntimeError(
            "Claude did not return a tool_use block for build_timeline"
        )

    raw_entries = tool_use["input"]["timeline_entries"]

    timeline: list[TimelineEntry] = []
    for entry in raw_entries:
        source_events = [by_id[eid] for eid in entry["source_event_ids"] if eid in by_id]
        if not source_events:
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
                match_confidence=entry["match_confidence"],
                has_discrepancy=has_discrepancy,
            )
        )

    timeline.sort(key=lambda t: t.canonical_timestamp_seconds)
    return timeline
