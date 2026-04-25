"""Stage 5 — AAR drafting via Claude Sonnet 4.6.

Two-pass generation:
  pass 1 — executive summary (2-3 paragraphs, neutral clinical tone)
  pass 2 — prose narrative referencing findings inline

The adherence_score is computed deterministically from the protocol
checks (ADHERENT / (ADHERENT + DEVIATION)) — we don't ask the model
for it because it's a hard arithmetic invariant.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from app.llm_clients import claude_sonnet
from app.prompts import (
    DRAFTING_NARRATIVE_SYSTEM,
    DRAFTING_NARRATIVE_USER_TEMPLATE,
    DRAFTING_SUMMARY_SYSTEM,
    DRAFTING_SUMMARY_USER_TEMPLATE,
)
from app.schemas import (
    AARDraft,
    Case,
    Finding,
    ProtocolCheck,
    ProtocolCheckStatus,
    TimelineEntry,
)


def compute_adherence_score(checks: list[ProtocolCheck]) -> float:
    adherent = sum(1 for c in checks if c.status == ProtocolCheckStatus.ADHERENT)
    deviation = sum(1 for c in checks if c.status == ProtocolCheckStatus.DEVIATION)
    denom = adherent + deviation
    if denom == 0:
        return 1.0
    return adherent / denom


def _serialize_timeline(timeline: list[TimelineEntry]) -> str:
    return json.dumps(
        [
            {
                "canonical_timestamp_seconds": e.canonical_timestamp_seconds,
                "canonical_description": e.canonical_description,
                "event_type": e.event_type.value,
                "has_discrepancy": e.has_discrepancy,
                "sources": [ev.source.value for ev in e.source_events],
            }
            for e in timeline
        ],
        indent=2,
    )


def _serialize_findings(findings: list[Finding]) -> str:
    return json.dumps(
        [
            {
                "title": f.title,
                "severity": f.severity.value,
                "category": f.category.value,
                "explanation": f.explanation,
                "evidence_timestamp_seconds": f.evidence_timestamp_seconds,
                "suggested_review_action": f.suggested_review_action,
            }
            for f in findings
        ],
        indent=2,
    )


def _serialize_checks(checks: list[ProtocolCheck]) -> str:
    return json.dumps(
        [
            {
                "step": c.protocol_step.description,
                "status": c.status.value,
                "explanation": c.explanation,
            }
            for c in checks
        ],
        indent=2,
    )


def _extract_text(response: dict) -> str:
    parts = [b["text"] for b in response["content"] if b["type"] == "text"]
    text = "".join(parts).strip()
    if not text:
        raise RuntimeError("Claude drafting call returned no text content")
    return text


async def draft_aar(
    case: Case,
    timeline: list[TimelineEntry],
    findings: list[Finding],
    checks: list[ProtocolCheck],
) -> AARDraft:
    adherent = sum(1 for c in checks if c.status == ProtocolCheckStatus.ADHERENT)
    deviation = sum(1 for c in checks if c.status == ProtocolCheckStatus.DEVIATION)
    other = len(checks) - adherent - deviation
    adherence_score = compute_adherence_score(checks)

    timeline_json = _serialize_timeline(timeline)
    findings_json = _serialize_findings(findings)
    checks_json = _serialize_checks(checks)

    summary_response = await claude_sonnet(
        system=DRAFTING_SUMMARY_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": DRAFTING_SUMMARY_USER_TEMPLATE.format(
                    incident_type=case.incident_type,
                    adherence_score=adherence_score,
                    adherent=adherent,
                    deviation=deviation,
                    other=other,
                    timeline_json=timeline_json,
                    findings_json=findings_json,
                    checks_json=checks_json,
                ),
            }
        ],
        max_tokens=1024,
    )
    summary = _extract_text(summary_response)

    narrative_response = await claude_sonnet(
        system=DRAFTING_NARRATIVE_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": DRAFTING_NARRATIVE_USER_TEMPLATE.format(
                    incident_type=case.incident_type,
                    summary=summary,
                    timeline_json=timeline_json,
                    findings_json=findings_json,
                    checks_json=checks_json,
                ),
            }
        ],
        max_tokens=2048,
    )
    narrative = _extract_text(narrative_response)

    return AARDraft(
        case_id=case.case_id,
        generated_at=datetime.now(timezone.utc),
        summary=summary,
        timeline=list(timeline),
        findings=list(findings),
        protocol_checks=list(checks),
        adherence_score=adherence_score,
        narrative=narrative,
    )
