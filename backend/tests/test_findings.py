"""Integration test for the real Claude Sonnet findings stage.

Skipped when ANTHROPIC_API_KEY is not configured so the suite stays green
without API credentials.
"""

from __future__ import annotations

import pytest

from app.config import settings
from app.pipeline.findings import generate_findings
from app.schemas import (
    Event,
    EventSource,
    EventType,
    ProtocolCheck,
    ProtocolCheckStatus,
    ProtocolStep,
    TimelineEntry,
)

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


def _entry(
    entry_id: str,
    seconds: float,
    event_type: EventType,
    description: str,
    sources: list[Event],
    has_discrepancy: bool = False,
    match_confidence: float = 1.0,
) -> TimelineEntry:
    return TimelineEntry(
        entry_id=entry_id,
        canonical_timestamp_seconds=seconds,
        canonical_description=description,
        event_type=event_type,
        source_events=sources,
        match_confidence=match_confidence,
        has_discrepancy=has_discrepancy,
    )


async def test_generate_findings_covers_seeded_discrepancies() -> None:
    pcr_arrival = _ev("pcr-1", EventSource.PCR, 0.0, EventType.ARRIVAL, "Arrived on scene")
    vid_arrival = _ev("vid-1", EventSource.VIDEO, 0.0, EventType.ARRIVAL, "Crew enters scene")

    pcr_cpr = _ev("pcr-2", EventSource.PCR, 60.0, EventType.CPR_START, "CPR initiated")
    vid_cpr = _ev("vid-2", EventSource.VIDEO, 62.0, EventType.CPR_START, "Compressions begin")

    # Timing discrepancy: PCR says epi at 180, video at 210 (30s spread).
    pcr_epi = _ev("pcr-3", EventSource.PCR, 180.0, EventType.MEDICATION, "Epinephrine 1mg IV")
    vid_epi = _ev("vid-3", EventSource.VIDEO, 210.0, EventType.MEDICATION, "Epi syringe administered")

    # Phantom intervention: PCR claims defib at 240 with no video corroboration.
    pcr_defib = _ev(
        "pcr-4", EventSource.PCR, 240.0, EventType.DEFIBRILLATION, "Defibrillation 200J biphasic"
    )

    # Missing documentation: video shows airway placement but PCR is silent.
    vid_airway = _ev(
        "vid-4", EventSource.VIDEO, 300.0, EventType.AIRWAY, "Supraglottic airway inserted"
    )

    timeline = [
        _entry("t-1", 0.0, EventType.ARRIVAL, "Arrival on scene", [pcr_arrival, vid_arrival]),
        _entry("t-2", 61.0, EventType.CPR_START, "CPR initiated", [pcr_cpr, vid_cpr]),
        _entry(
            "t-3",
            195.0,
            EventType.MEDICATION,
            "Epinephrine 1mg IV",
            [pcr_epi, vid_epi],
            has_discrepancy=True,
        ),
        _entry("t-4", 240.0, EventType.DEFIBRILLATION, "Defibrillation 200J", [pcr_defib]),
        _entry("t-5", 300.0, EventType.AIRWAY, "Supraglottic airway", [vid_airway]),
    ]

    deviation_step = ProtocolStep(
        step_id="acls-epi-3min",
        description="Administer epinephrine within 3 minutes of CPR start",
        expected_timing_seconds=240.0,
        required=True,
    )
    checks = [
        ProtocolCheck(
            check_id="chk-1",
            protocol_step=deviation_step,
            status=ProtocolCheckStatus.DEVIATION,
            evidence_event_ids=[pcr_epi.event_id],
            explanation="Epi administered ~135s after CPR start, within window — but timing differs across sources.",
        ),
    ]

    findings = await generate_findings(timeline, checks)

    assert findings, "expected at least one finding from a seeded multi-discrepancy case"

    valid_ids = {e.event_id for entry in timeline for e in entry.source_events}
    for f in findings:
        for eid in f.evidence_event_ids:
            assert eid in valid_ids, f"finding cites unknown event_id {eid}"

    categories = {f.category.value for f in findings}
    # We seeded at least timing_discrepancy + (phantom_intervention or missing_documentation)
    # plus a deviation check. Demand at least 2 distinct categories.
    assert len(categories) >= 2, (
        f"expected >=2 distinct finding categories, got {categories}"
    )
