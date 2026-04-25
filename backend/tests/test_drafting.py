"""Integration test for the real Claude Sonnet drafting stage.

Skipped when ANTHROPIC_API_KEY is not configured so the suite stays green
without API credentials.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.config import settings
from app.pipeline.drafting import compute_adherence_score, draft_aar
from app.schemas import (
    Case,
    Event,
    EventSource,
    EventType,
    Finding,
    FindingCategory,
    FindingSeverity,
    ProtocolCheck,
    ProtocolCheckStatus,
    ProtocolStep,
    TimelineEntry,
)


def test_compute_adherence_score_ratio() -> None:
    step = ProtocolStep(step_id="s", description="x", required=True)

    def chk(status: ProtocolCheckStatus) -> ProtocolCheck:
        return ProtocolCheck(
            check_id="c",
            protocol_step=step,
            status=status,
            evidence_event_ids=[],
            explanation="",
        )

    checks = [
        chk(ProtocolCheckStatus.ADHERENT),
        chk(ProtocolCheckStatus.ADHERENT),
        chk(ProtocolCheckStatus.DEVIATION),
        chk(ProtocolCheckStatus.NOT_APPLICABLE),
    ]
    assert compute_adherence_score(checks) == pytest.approx(2 / 3)
    assert compute_adherence_score([]) == 1.0
    assert compute_adherence_score([chk(ProtocolCheckStatus.NOT_APPLICABLE)]) == 1.0


@pytest.mark.skipif(
    not settings.ANTHROPIC_API_KEY,
    reason="ANTHROPIC_API_KEY not set",
)
async def test_draft_aar_returns_summary_and_narrative() -> None:
    pcr_arrival = Event(
        event_id="pcr-1",
        timestamp="00:00:00",
        timestamp_seconds=0.0,
        source=EventSource.PCR,
        event_type=EventType.ARRIVAL,
        description="Arrived on scene",
        confidence=1.0,
        raw_evidence="Arrived on scene",
    )
    pcr_epi = Event(
        event_id="pcr-2",
        timestamp="00:03:00",
        timestamp_seconds=180.0,
        source=EventSource.PCR,
        event_type=EventType.MEDICATION,
        description="Epinephrine 1mg IV",
        confidence=1.0,
        raw_evidence="1mg epi IV push",
    )
    timeline = [
        TimelineEntry(
            entry_id="t-1",
            canonical_timestamp_seconds=0.0,
            canonical_description="Arrival on scene",
            event_type=EventType.ARRIVAL,
            source_events=[pcr_arrival],
            match_confidence=1.0,
            has_discrepancy=False,
        ),
        TimelineEntry(
            entry_id="t-2",
            canonical_timestamp_seconds=180.0,
            canonical_description="Epi 1mg IV",
            event_type=EventType.MEDICATION,
            source_events=[pcr_epi],
            match_confidence=1.0,
            has_discrepancy=False,
        ),
    ]

    findings = [
        Finding(
            finding_id="f-1",
            severity=FindingSeverity.CONCERN,
            category=FindingCategory.MISSING_DOCUMENTATION,
            title="No video corroboration of epi push",
            explanation="The PCR documents an epinephrine push but the body-cam shows no syringe activity at that timestamp.",
            evidence_event_ids=["pcr-2"],
            evidence_timestamp_seconds=180.0,
            suggested_review_action="Confirm with the medic that the dose was administered.",
        )
    ]

    step = ProtocolStep(
        step_id="acls-epi",
        description="Administer epinephrine within 3min of CPR start",
        required=True,
    )
    checks = [
        ProtocolCheck(
            check_id="c-1",
            protocol_step=step,
            status=ProtocolCheckStatus.ADHERENT,
            evidence_event_ids=["pcr-2"],
            explanation="Within window",
        ),
    ]

    case = Case(
        case_id="case_test",
        incident_type="Cardiac arrest, OOH",
        incident_date=datetime.now(timezone.utc),
        pcr_path="cases/case_test/pcr.md",
        video_path="cases/case_test/video.mp4",
        audio_path="cases/case_test/audio.mp3",
    )

    aar = await draft_aar(case, timeline, findings, checks)

    assert aar.case_id == "case_test"
    assert aar.summary.strip(), "summary must be non-empty"
    assert aar.narrative.strip(), "narrative must be non-empty"
    assert len(aar.summary.split()) >= 30, "summary should be at least a few sentences"
    assert len(aar.narrative.split()) >= 80, "narrative should be 3-4 paragraphs"
    assert aar.adherence_score == pytest.approx(1.0)
    assert aar.findings[0].finding_id == "f-1"
    assert aar.timeline[0].entry_id == "t-1"
