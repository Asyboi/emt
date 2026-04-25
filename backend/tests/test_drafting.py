"""Drafting stage tests.

- compute_adherence_score / compute_determination unit tests run always.
- A fixture-fallback smoke test exercises draft_qi_review end-to-end
  without an API key by relying on the per-sub-call fallback path.
- The full Sonnet integration test is gated on ANTHROPIC_API_KEY.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.config import settings
from app.pipeline.drafting import (
    compute_adherence_score,
    compute_determination,
    draft_qi_review,
)
from app.schemas import (
    AssessmentStatus,
    Case,
    ClinicalAssessmentCategory,
    ClinicalAssessmentItem,
    DocumentationQualityAssessment,
    Event,
    EventSource,
    EventType,
    Finding,
    FindingCategory,
    FindingSeverity,
    ProtocolCheck,
    ProtocolCheckStatus,
    ProtocolStep,
    QICaseReview,
    ReviewerDetermination,
    TimelineEntry,
)


def _step() -> ProtocolStep:
    return ProtocolStep(step_id="s", description="x", required=True)


def _chk(status: ProtocolCheckStatus) -> ProtocolCheck:
    return ProtocolCheck(
        check_id="c",
        protocol_step=_step(),
        status=status,
        evidence_event_ids=[],
        explanation="",
    )


def _ca(status: AssessmentStatus) -> ClinicalAssessmentItem:
    return ClinicalAssessmentItem(
        item_id="ca",
        category=ClinicalAssessmentCategory.CPR_QUALITY,
        benchmark="b",
        status=status,
        notes="",
    )


def _finding(severity: FindingSeverity) -> Finding:
    return Finding(
        finding_id="f",
        severity=severity,
        category=FindingCategory.PROTOCOL_DEVIATION,
        title="t",
        explanation="e",
        evidence_event_ids=[],
        evidence_timestamp_seconds=0.0,
        suggested_review_action="r",
    )


def _doc(issues: list[str] | None = None) -> DocumentationQualityAssessment:
    return DocumentationQualityAssessment(
        completeness_score=1.0,
        accuracy_score=1.0,
        narrative_quality_score=1.0,
        issues=issues or [],
    )


def test_compute_adherence_score_ratio() -> None:
    checks = [
        _chk(ProtocolCheckStatus.ADHERENT),
        _chk(ProtocolCheckStatus.ADHERENT),
        _chk(ProtocolCheckStatus.DEVIATION),
        _chk(ProtocolCheckStatus.NOT_APPLICABLE),
    ]
    assert compute_adherence_score(checks) == pytest.approx(2 / 3)
    assert compute_adherence_score([]) == 1.0
    assert compute_adherence_score([_chk(ProtocolCheckStatus.NOT_APPLICABLE)]) == 1.0


def test_compute_determination_critical_finding_wins() -> None:
    findings = [_finding(FindingSeverity.CRITICAL)]
    assert (
        compute_determination(findings, [], _doc())
        == ReviewerDetermination.CRITICAL_EVENT
    )


def test_compute_determination_two_concerns_is_significant() -> None:
    findings = [_finding(FindingSeverity.CONCERN), _finding(FindingSeverity.CONCERN)]
    assert (
        compute_determination(findings, [], _doc())
        == ReviewerDetermination.SIGNIFICANT_CONCERN
    )


def test_compute_determination_three_not_met_is_significant() -> None:
    clinical = [_ca(AssessmentStatus.NOT_MET) for _ in range(3)]
    assert (
        compute_determination([], clinical, _doc())
        == ReviewerDetermination.SIGNIFICANT_CONCERN
    )


def test_compute_determination_one_concern_is_performance() -> None:
    findings = [_finding(FindingSeverity.CONCERN)]
    assert (
        compute_determination(findings, [], _doc())
        == ReviewerDetermination.PERFORMANCE_CONCERN
    )


def test_compute_determination_one_not_met_is_performance() -> None:
    clinical = [_ca(AssessmentStatus.NOT_MET)]
    assert (
        compute_determination([], clinical, _doc())
        == ReviewerDetermination.PERFORMANCE_CONCERN
    )


def test_compute_determination_doc_only_is_documentation_concern() -> None:
    doc = _doc(issues=["completeness gap"])
    assert (
        compute_determination([], [], doc)
        == ReviewerDetermination.DOCUMENTATION_CONCERN
    )


def test_compute_determination_clean_case_is_no_issues() -> None:
    assert (
        compute_determination([], [], _doc())
        == ReviewerDetermination.NO_ISSUES
    )


# --------------------------------------------------------------------------- #
# Smoke test: draft_qi_review composes a valid QICaseReview even when the
# Sonnet sub-calls fail (no API key) — every sub-call has a fixture fallback.
# --------------------------------------------------------------------------- #


def _sample_inputs() -> tuple[
    Case, list[TimelineEntry], list[Finding], list[ProtocolCheck], str
]:
    arrival = Event(
        event_id="pcr-arrival",
        timestamp="00:00:00",
        timestamp_seconds=0.0,
        source=EventSource.PCR,
        event_type=EventType.ARRIVAL,
        description="Arrived on scene",
        confidence=1.0,
        raw_evidence="Arrived on scene",
    )
    epi = Event(
        event_id="pcr-epi",
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
            source_events=[arrival],
            match_confidence=1.0,
            has_discrepancy=False,
        ),
        TimelineEntry(
            entry_id="t-2",
            canonical_timestamp_seconds=180.0,
            canonical_description="Epinephrine 1mg IV",
            event_type=EventType.MEDICATION,
            source_events=[epi],
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
            explanation="PCR documents epi push but body-cam shows no syringe activity.",
            evidence_event_ids=["pcr-epi"],
            evidence_timestamp_seconds=180.0,
            suggested_review_action="Confirm with the medic that the dose was administered.",
        )
    ]
    checks = [
        ProtocolCheck(
            check_id="c-1",
            protocol_step=ProtocolStep(
                step_id="acls-epi",
                description="Administer epinephrine within 3min of CPR start",
                required=True,
            ),
            status=ProtocolCheckStatus.ADHERENT,
            evidence_event_ids=["pcr-epi"],
            explanation="Within window",
        )
    ]
    case = Case(
        case_id="case_test",
        incident_type="cardiac_arrest",
        incident_date=datetime.now(timezone.utc),
        pcr_path="cases/case_test/pcr.md",
        video_path="cases/case_test/video.mp4",
        audio_path="cases/case_test/audio.mp3",
    )
    return case, timeline, findings, checks, "PCR placeholder."


@pytest.mark.skipif(
    bool(settings.ANTHROPIC_API_KEY),
    reason="Fallback smoke test only meaningful without API key",
)
async def test_draft_qi_review_falls_back_to_fixture_without_api_key() -> None:
    case, timeline, findings, checks, pcr_content = _sample_inputs()

    review = await draft_qi_review(case, timeline, findings, checks, pcr_content)

    assert isinstance(review, QICaseReview)
    assert review.case_id == "case_test"
    assert review.incident_summary, "incident_summary must be populated (fixture fallback)"
    assert review.clinical_assessment, "clinical_assessment must be populated"
    assert review.documentation_quality.completeness_score >= 0.0
    assert review.recommendations, "recommendations must be populated"
    assert review.utstein_data is not None, "cardiac_arrest case should yield utstein_data"
    # 1 CONCERN finding → PERFORMANCE_CONCERN per the rule (no critical findings,
    # fixture clinical_assessment also contributes NOT_MET items, which only
    # reinforces the determination).
    assert review.determination in (
        ReviewerDetermination.PERFORMANCE_CONCERN,
        ReviewerDetermination.SIGNIFICANT_CONCERN,
    )
    assert review.determination_rationale.strip()
    assert review.timeline[0].entry_id == "t-1"
    assert review.findings[0].finding_id == "f-1"


@pytest.mark.skipif(
    not settings.ANTHROPIC_API_KEY,
    reason="ANTHROPIC_API_KEY not set",
)
async def test_draft_qi_review_with_real_sonnet() -> None:
    case, timeline, findings, checks, pcr_content = _sample_inputs()

    review = await draft_qi_review(case, timeline, findings, checks, pcr_content)

    assert review.case_id == "case_test"
    assert len(review.incident_summary.split()) >= 30
    assert len(review.clinical_assessment) >= 3
    assert review.documentation_quality.completeness_score >= 0.0
    assert review.recommendations
    assert review.determination_rationale.strip()
    assert review.adherence_score == pytest.approx(1.0)
    assert review.findings[0].finding_id == "f-1"
    assert review.timeline[0].entry_id == "t-1"
