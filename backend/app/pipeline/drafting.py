"""Stage 7 — QI Case Review drafting via Claude Haiku 4.5.

Composes the final QICaseReview from upstream pipeline outputs. Broken
into five focused sub-calls so each prompt stays small and one weak
sub-call doesn't poison the rest:

    A. Header + incident summary + Utstein data        (Haiku)
    B. Clinical assessment against per-incident benchmarks  (Haiku)
    C. Documentation quality scoring                    (Haiku)
    D. Recommendations (crew / agency / follow_up)      (Haiku)
    E. Determination (rule-based) + rationale prose     (Haiku)

Each sub-call has a try/except that falls back to fixture-derived data
on failure, so the pipeline still produces a valid QICaseReview when
upstream stages are stubs, an API key is missing, or the model returns
an unparseable response. The fallbacks are clearly logged.

TODO: when every upstream stage is real, tighten the fallbacks (or
remove them entirely) — they are scoped to the bring-up window.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from app.llm_clients import claude_haiku
from app.pipeline._fixture import (
    fixture_clinical_assessment,
    fixture_documentation_quality,
    fixture_qi_review,
    fixture_recommendations,
    fixture_utstein_data,
)
from app.prompts import (
    QI_CLINICAL_ASSESSMENT_SYSTEM,
    QI_CLINICAL_ASSESSMENT_TOOL,
    QI_CLINICAL_ASSESSMENT_USER_TEMPLATE,
    QI_DETERMINATION_RATIONALE_SYSTEM,
    QI_DETERMINATION_RATIONALE_USER_TEMPLATE,
    QI_DOCUMENTATION_QUALITY_SYSTEM,
    QI_DOCUMENTATION_QUALITY_TOOL,
    QI_DOCUMENTATION_QUALITY_USER_TEMPLATE,
    QI_HEADER_SYSTEM,
    QI_HEADER_TOOL,
    QI_HEADER_USER_TEMPLATE,
    QI_RECOMMENDATIONS_SYSTEM,
    QI_RECOMMENDATIONS_TOOL,
    QI_RECOMMENDATIONS_USER_TEMPLATE,
)
from app.schemas import (
    AssessmentStatus,
    Case,
    ClinicalAssessmentCategory,
    ClinicalAssessmentItem,
    CrewMember,
    DocumentationQualityAssessment,
    Finding,
    FindingSeverity,
    ProtocolCheck,
    ProtocolCheckStatus,
    QICaseReview,
    Recommendation,
    RecommendationAudience,
    RecommendationPriority,
    ReviewerDetermination,
    TimelineEntry,
    UtsteinData,
)

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Deterministic helpers
# --------------------------------------------------------------------------- #


def compute_adherence_score(checks: list[ProtocolCheck]) -> float:
    adherent = sum(1 for c in checks if c.status == ProtocolCheckStatus.ADHERENT)
    deviation = sum(1 for c in checks if c.status == ProtocolCheckStatus.DEVIATION)
    denom = adherent + deviation
    if denom == 0:
        return 1.0
    return adherent / denom


def compute_determination(
    findings: list[Finding],
    clinical: list[ClinicalAssessmentItem],
    doc_quality: DocumentationQualityAssessment,
) -> ReviewerDetermination:
    """Rule-based determination per qi_review_update_prompts.md Step 2.

    - Any CRITICAL finding                              → CRITICAL_EVENT
    - >=2 CONCERN findings OR >=3 NOT_MET assessments   → SIGNIFICANT_CONCERN
    - 1 CONCERN finding OR 1-2 NOT_MET assessments      → PERFORMANCE_CONCERN
    - Doc issues but no clinical concerns               → DOCUMENTATION_CONCERN
    - Otherwise                                         → NO_ISSUES
    """

    critical = sum(1 for f in findings if f.severity == FindingSeverity.CRITICAL)
    concern = sum(1 for f in findings if f.severity == FindingSeverity.CONCERN)
    not_met = sum(1 for c in clinical if c.status == AssessmentStatus.NOT_MET)

    if critical > 0:
        return ReviewerDetermination.CRITICAL_EVENT
    if concern >= 2 or not_met >= 3:
        return ReviewerDetermination.SIGNIFICANT_CONCERN
    if concern >= 1 or not_met >= 1:
        return ReviewerDetermination.PERFORMANCE_CONCERN
    if doc_quality.issues:
        return ReviewerDetermination.DOCUMENTATION_CONCERN
    return ReviewerDetermination.NO_ISSUES


# --------------------------------------------------------------------------- #
# Serialization helpers (timeline / findings / clinical)
# --------------------------------------------------------------------------- #


def _serialize_timeline(timeline: list[TimelineEntry]) -> str:
    return json.dumps(
        [
            {
                "entry_id": entry.entry_id,
                "canonical_timestamp_seconds": entry.canonical_timestamp_seconds,
                "canonical_description": entry.canonical_description,
                "event_type": entry.event_type.value,
                "has_discrepancy": entry.has_discrepancy,
                "source_events": [
                    {
                        "event_id": ev.event_id,
                        "source": ev.source.value,
                        "timestamp_seconds": ev.timestamp_seconds,
                        "description": ev.description,
                        "raw_evidence": ev.raw_evidence,
                    }
                    for ev in entry.source_events
                ],
            }
            for entry in timeline
        ],
        indent=2,
    )


def _serialize_findings(findings: list[Finding]) -> str:
    return json.dumps(
        [
            {
                "finding_id": f.finding_id,
                "severity": f.severity.value,
                "category": f.category.value,
                "title": f.title,
                "explanation": f.explanation,
                "evidence_timestamp_seconds": f.evidence_timestamp_seconds,
            }
            for f in findings
        ],
        indent=2,
    )


def _serialize_clinical(items: list[ClinicalAssessmentItem]) -> str:
    return json.dumps(
        [
            {
                "item_id": item.item_id,
                "category": item.category.value,
                "benchmark": item.benchmark,
                "status": item.status.value,
                "notes": item.notes,
            }
            for item in items
        ],
        indent=2,
    )


def _tool_use(response: dict, tool_name: str) -> dict:
    block = next(
        (b for b in response["content"] if b["type"] == "tool_use" and b["name"] == tool_name),
        None,
    )
    if block is None:
        raise RuntimeError(f"Claude did not return a tool_use block named {tool_name!r}")
    return block["input"]


def _extract_text(response: dict) -> str:
    parts = [b["text"] for b in response["content"] if b["type"] == "text"]
    text = "".join(parts).strip()
    if not text:
        raise RuntimeError("Claude returned no text content")
    return text


# --------------------------------------------------------------------------- #
# Sub-call A — header + summary + Utstein
# --------------------------------------------------------------------------- #


class _Header:
    __slots__ = (
        "responding_unit",
        "crew_members",
        "patient_age_range",
        "patient_sex",
        "chief_complaint",
        "incident_summary",
        "utstein_data",
    )

    def __init__(
        self,
        responding_unit: str,
        crew_members: list[CrewMember],
        patient_age_range: str,
        patient_sex: str,
        chief_complaint: str,
        incident_summary: str,
        utstein_data: UtsteinData | None,
    ) -> None:
        self.responding_unit = responding_unit
        self.crew_members = crew_members
        self.patient_age_range = patient_age_range
        self.patient_sex = patient_sex
        self.chief_complaint = chief_complaint
        self.incident_summary = incident_summary
        self.utstein_data = utstein_data


def _fixture_header(case: Case) -> _Header:
    fx = fixture_qi_review()
    return _Header(
        responding_unit=fx.responding_unit,
        crew_members=list(fx.crew_members),
        patient_age_range=fx.patient_age_range,
        patient_sex=fx.patient_sex,
        chief_complaint=fx.chief_complaint,
        incident_summary=fx.incident_summary,
        utstein_data=fixture_utstein_data() if "cardiac" in case.incident_type else None,
    )


async def _draft_header(
    case: Case,
    pcr_content: str,
    timeline: list[TimelineEntry],
) -> _Header:
    try:
        response = await claude_haiku(
            system=QI_HEADER_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": QI_HEADER_USER_TEMPLATE.format(
                        incident_type=case.incident_type,
                        responding_unit=case.metadata.get("responding_unit", "(not in metadata)"),
                        pcr_content=pcr_content[:8000],
                        timeline_json=_serialize_timeline(timeline),
                    ),
                }
            ],
            tools=[QI_HEADER_TOOL],
            max_tokens=2048,
        )
        raw = _tool_use(response, "extract_qi_header")

        crew = [
            CrewMember(role=c["role"], identifier=c["identifier"])
            for c in raw.get("crew_members", [])
        ]
        utstein_raw = raw.get("utstein_data")
        utstein = (
            UtsteinData.model_validate(utstein_raw)
            if isinstance(utstein_raw, dict)
            else None
        )

        sex = raw["patient_sex"]
        if sex not in ("m", "f", "unknown"):
            sex = "unknown"

        return _Header(
            responding_unit=raw["responding_unit"],
            crew_members=crew,
            patient_age_range=raw["patient_age_range"],
            patient_sex=sex,
            chief_complaint=raw["chief_complaint"],
            incident_summary=raw["incident_summary"],
            utstein_data=utstein,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Header sub-call failed (%s); falling back to fixture data.", exc)
        return _fixture_header(case)


# --------------------------------------------------------------------------- #
# Sub-call B — clinical assessment
# --------------------------------------------------------------------------- #


def _ensure_unique_item_ids(items: list[ClinicalAssessmentItem]) -> list[ClinicalAssessmentItem]:
    seen: set[str] = set()
    out: list[ClinicalAssessmentItem] = []
    for item in items:
        item_id = item.item_id
        if item_id in seen:
            item_id = f"{item.item_id}_{uuid.uuid4().hex[:6]}"
        seen.add(item_id)
        if item_id != item.item_id:
            item = item.model_copy(update={"item_id": item_id})
        out.append(item)
    return out


async def _draft_clinical_assessment(
    timeline: list[TimelineEntry],
    incident_type: str,
) -> list[ClinicalAssessmentItem]:
    valid_event_ids = {ev.event_id for entry in timeline for ev in entry.source_events}
    try:
        response = await claude_haiku(
            system=QI_CLINICAL_ASSESSMENT_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": QI_CLINICAL_ASSESSMENT_USER_TEMPLATE.format(
                        incident_type=incident_type,
                        timeline_json=_serialize_timeline(timeline),
                    ),
                }
            ],
            tools=[QI_CLINICAL_ASSESSMENT_TOOL],
            max_tokens=4096,
        )
        raw = _tool_use(response, "assess_clinical_care")
        items: list[ClinicalAssessmentItem] = []
        for entry in raw["items"]:
            evidence = [
                eid for eid in entry.get("evidence_event_ids", []) if eid in valid_event_ids
            ]
            items.append(
                ClinicalAssessmentItem(
                    item_id=entry["item_id"],
                    category=ClinicalAssessmentCategory(entry["category"]),
                    benchmark=entry["benchmark"],
                    status=AssessmentStatus(entry["status"]),
                    notes=entry["notes"],
                    evidence_event_ids=evidence,
                )
            )
        return _ensure_unique_item_ids(items)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Clinical-assessment sub-call failed (%s); falling back to fixture items.", exc
        )
        return fixture_clinical_assessment()


# --------------------------------------------------------------------------- #
# Sub-call C — documentation quality
# --------------------------------------------------------------------------- #


def _clamp_score(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


async def _draft_documentation_quality(
    pcr_content: str,
    timeline: list[TimelineEntry],
) -> DocumentationQualityAssessment:
    try:
        response = await claude_haiku(
            system=QI_DOCUMENTATION_QUALITY_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": QI_DOCUMENTATION_QUALITY_USER_TEMPLATE.format(
                        pcr_content=pcr_content[:8000],
                        timeline_json=_serialize_timeline(timeline),
                    ),
                }
            ],
            tools=[QI_DOCUMENTATION_QUALITY_TOOL],
            max_tokens=2048,
        )
        raw = _tool_use(response, "assess_documentation_quality")
        return DocumentationQualityAssessment(
            completeness_score=_clamp_score(raw["completeness_score"]),
            accuracy_score=_clamp_score(raw["accuracy_score"]),
            narrative_quality_score=_clamp_score(raw["narrative_quality_score"]),
            issues=list(raw.get("issues", [])),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Documentation-quality sub-call failed (%s); falling back to fixture data.", exc
        )
        return fixture_documentation_quality()


# --------------------------------------------------------------------------- #
# Sub-call D — recommendations
# --------------------------------------------------------------------------- #


async def _draft_recommendations(
    findings: list[Finding],
    clinical: list[ClinicalAssessmentItem],
) -> list[Recommendation]:
    valid_finding_ids = {f.finding_id for f in findings}
    try:
        response = await claude_haiku(
            system=QI_RECOMMENDATIONS_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": QI_RECOMMENDATIONS_USER_TEMPLATE.format(
                        findings_json=_serialize_findings(findings),
                        clinical_assessment_json=_serialize_clinical(clinical),
                    ),
                }
            ],
            tools=[QI_RECOMMENDATIONS_TOOL],
            max_tokens=2048,
        )
        raw = _tool_use(response, "generate_recommendations")
        recs: list[Recommendation] = []
        for entry in raw["recommendations"]:
            related = [
                fid
                for fid in entry.get("related_finding_ids", [])
                if fid in valid_finding_ids
            ]
            recs.append(
                Recommendation(
                    recommendation_id=entry["recommendation_id"],
                    audience=RecommendationAudience(entry["audience"]),
                    priority=RecommendationPriority(entry["priority"]),
                    description=entry["description"],
                    related_finding_ids=related,
                )
            )
        return recs
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Recommendations sub-call failed (%s); falling back to fixture data.", exc
        )
        return fixture_recommendations()


# --------------------------------------------------------------------------- #
# Sub-call E — determination rationale (Sonnet writes the prose)
# --------------------------------------------------------------------------- #


async def _draft_determination_rationale(
    determination: ReviewerDetermination,
    findings: list[Finding],
    clinical: list[ClinicalAssessmentItem],
    doc_quality: DocumentationQualityAssessment,
) -> str:
    not_met = [c for c in clinical if c.status == AssessmentStatus.NOT_MET]
    finding_counts = {
        sev.value: sum(1 for f in findings if f.severity == sev) for sev in FindingSeverity
    }
    try:
        response = await claude_haiku(
            system=QI_DETERMINATION_RATIONALE_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": QI_DETERMINATION_RATIONALE_USER_TEMPLATE.format(
                        determination=determination.value,
                        finding_counts=json.dumps(finding_counts),
                        not_met_count=len(not_met),
                        doc_issue_count=len(doc_quality.issues),
                        findings_json=_serialize_findings(findings),
                        not_met_json=_serialize_clinical(not_met),
                    ),
                }
            ],
            max_tokens=512,
        )
        return _extract_text(response)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Determination-rationale sub-call failed (%s); using a deterministic summary.", exc
        )
        return _fallback_rationale(determination, findings, not_met, doc_quality)


def _fallback_rationale(
    determination: ReviewerDetermination,
    findings: list[Finding],
    not_met: list[ClinicalAssessmentItem],
    doc_quality: DocumentationQualityAssessment,
) -> str:
    parts = [f"Determination is {determination.value}."]
    crit = [f for f in findings if f.severity == FindingSeverity.CRITICAL]
    conc = [f for f in findings if f.severity == FindingSeverity.CONCERN]
    if crit:
        parts.append(
            f"Drivers: {len(crit)} critical finding(s) including '{crit[0].title}'."
        )
    elif conc:
        parts.append(
            f"Drivers: {len(conc)} concern-level finding(s) including '{conc[0].title}'."
        )
    if not_met:
        parts.append(
            f"{len(not_met)} clinical benchmark(s) not met (e.g. '{not_met[0].benchmark}')."
        )
    elif doc_quality.issues:
        parts.append(
            f"{len(doc_quality.issues)} documentation issue(s) noted."
        )
    return " ".join(parts)


# --------------------------------------------------------------------------- #
# Top-level entry point
# --------------------------------------------------------------------------- #


async def draft_qi_review(
    case: Case,
    timeline: list[TimelineEntry],
    findings: list[Finding],
    protocol_checks: list[ProtocolCheck],
    pcr_content: str,
) -> QICaseReview:
    """Compose the full QI Case Review from upstream pipeline outputs."""

    header = await _draft_header(case, pcr_content, timeline)
    clinical = await _draft_clinical_assessment(timeline, case.incident_type)
    doc_quality = await _draft_documentation_quality(pcr_content, timeline)
    recommendations = await _draft_recommendations(findings, clinical)

    determination = compute_determination(findings, clinical, doc_quality)
    rationale = await _draft_determination_rationale(
        determination, findings, clinical, doc_quality
    )

    return QICaseReview(
        case_id=case.case_id,
        generated_at=datetime.now(timezone.utc),
        incident_date=case.incident_date,
        incident_type=case.incident_type,
        responding_unit=header.responding_unit,
        crew_members=header.crew_members,
        patient_age_range=header.patient_age_range,
        patient_sex=header.patient_sex,
        chief_complaint=header.chief_complaint,
        incident_summary=header.incident_summary,
        timeline=list(timeline),
        clinical_assessment=clinical,
        documentation_quality=doc_quality,
        findings=list(findings),
        protocol_checks=list(protocol_checks),
        adherence_score=compute_adherence_score(protocol_checks),
        utstein_data=header.utstein_data,
        recommendations=recommendations,
        determination=determination,
        determination_rationale=rationale,
    )
