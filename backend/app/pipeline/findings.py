"""Stage 4 — discrepancy finding generation via Claude Sonnet 4.6.

Takes the reconciled timeline plus the protocol checks and asks Sonnet
to surface findings across five categories (timing_discrepancy,
missing_documentation, phantom_intervention, protocol_deviation,
care_gap). Findings carry evidence_event_ids that map back to real
Event ids in the timeline so the frontend can deep-link to the moment
in the video / PCR.

TODO (QI Case Review follow-up): once the drafting stage's clinical
assessment is real-LLM-driven, surface ClinicalAssessmentItem failures
(status == NOT_MET) here as additional Findings (category =
PROTOCOL_DEVIATION or CARE_GAP, severity proportional to the benchmark
that was missed). Cross-stage integration is deferred until both
stages run live so the dedup logic has real inputs to reason about.
"""

from __future__ import annotations

import json
import uuid

from app.llm_clients import claude_sonnet
from app.prompts import FINDINGS_SYSTEM, FINDINGS_TOOL, FINDINGS_USER_TEMPLATE
from app.schemas import (
    Finding,
    FindingCategory,
    FindingSeverity,
    ProtocolCheck,
    TimelineEntry,
)


def _serialize_timeline(timeline: list[TimelineEntry]) -> str:
    payload = [
        {
            "entry_id": entry.entry_id,
            "canonical_timestamp_seconds": entry.canonical_timestamp_seconds,
            "canonical_description": entry.canonical_description,
            "event_type": entry.event_type.value,
            "match_confidence": entry.match_confidence,
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
    ]
    return json.dumps(payload, indent=2)


def _serialize_checks(checks: list[ProtocolCheck]) -> str:
    payload = [
        {
            "check_id": c.check_id,
            "status": c.status.value,
            "step": {
                "step_id": c.protocol_step.step_id,
                "description": c.protocol_step.description,
                "expected_timing_seconds": c.protocol_step.expected_timing_seconds,
                "required": c.protocol_step.required,
            },
            "evidence_event_ids": list(c.evidence_event_ids),
            "explanation": c.explanation,
        }
        for c in checks
    ]
    return json.dumps(payload, indent=2)


async def generate_findings(
    timeline: list[TimelineEntry],
    checks: list[ProtocolCheck],
) -> list[Finding]:
    if not timeline and not checks:
        return []

    response = await claude_sonnet(
        system=FINDINGS_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": FINDINGS_USER_TEMPLATE.format(
                    timeline_json=_serialize_timeline(timeline),
                    checks_json=_serialize_checks(checks),
                ),
            }
        ],
        tools=[FINDINGS_TOOL],
        max_tokens=4096,
    )

    tool_use = next(
        (b for b in response["content"] if b["type"] == "tool_use"), None
    )
    if tool_use is None:
        raise RuntimeError(
            "Claude did not return a tool_use block for generate_findings"
        )

    valid_event_ids = {
        ev.event_id for entry in timeline for ev in entry.source_events
    }

    findings: list[Finding] = []
    for raw in tool_use["input"]["findings"]:
        evidence_ids = [eid for eid in raw["evidence_event_ids"] if eid in valid_event_ids]
        findings.append(
            Finding(
                finding_id=str(uuid.uuid4()),
                severity=FindingSeverity(raw["severity"]),
                category=FindingCategory(raw["category"]),
                title=raw["title"],
                explanation=raw["explanation"],
                evidence_event_ids=evidence_ids,
                evidence_timestamp_seconds=raw["evidence_timestamp_seconds"],
                pcr_excerpt=raw.get("pcr_excerpt"),
                suggested_review_action=raw["suggested_review_action"],
            )
        )

    findings.sort(key=lambda f: f.evidence_timestamp_seconds)
    return findings
