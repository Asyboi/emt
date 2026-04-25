"""Integration test for the real Claude Sonnet reconciliation stage.

Skipped when ANTHROPIC_API_KEY is not configured so the suite stays green
in environments without API credentials.
"""

from __future__ import annotations

import pytest

from app.config import settings
from app.pipeline.reconciliation import reconcile
from app.schemas import Event, EventSource, EventType

pytestmark = pytest.mark.skipif(
    not settings.ANTHROPIC_API_KEY,
    reason="ANTHROPIC_API_KEY not set",
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
