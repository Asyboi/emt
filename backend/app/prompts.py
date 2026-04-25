"""Centralized LLM prompts and tool schemas.

Phase 4 introduces the PCR parser prompt + tool. Phase 5 adds prompts
for reconciliation, findings, drafting, audio event extraction, and
video event extraction.
"""

from __future__ import annotations

from typing import Any

from app.schemas import EventType, FindingCategory, FindingSeverity

PCR_PARSER_SYSTEM = """You are an expert EMS quality assurance analyst extracting structured events from a Patient Care Report (PCR).

Given a PCR document, identify every clinically significant event and output them as structured data. Each event needs:
- A timestamp (HH:MM:SS format) and timestamp_seconds (offset from incident start, 0 = arrival on scene)
- An event_type from the allowed enum
- A clear description
- Details (medications: name + dose + route; vitals: BP/HR/SpO2/etc; interventions: technique)
- A confidence score (1.0 if explicitly stated, lower if inferred)
- raw_evidence: the exact text from the PCR that supports this event

Be conservative — extract events ONLY if they're documented in the PCR. Do not invent events.
"""

PCR_PARSER_USER_TEMPLATE = """Extract all events from this PCR:

<pcr>
{pcr_content}
</pcr>

Use the extract_pcr_events tool to return your structured output."""

PCR_EVENTS_TOOL: dict[str, Any] = {
    "name": "extract_pcr_events",
    "description": "Extract structured events from a PCR document",
    "input_schema": {
        "type": "object",
        "properties": {
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "timestamp": {
                            "type": "string",
                            "description": "Wall-clock or relative timestamp in HH:MM:SS format",
                        },
                        "timestamp_seconds": {
                            "type": "number",
                            "description": "Seconds offset from incident start (0 = arrival on scene)",
                        },
                        "event_type": {
                            "type": "string",
                            "enum": [e.value for e in EventType],
                        },
                        "description": {"type": "string"},
                        "details": {
                            "type": "object",
                            "description": "Structured details: medications {name, dose, route}; vitals {bp, hr, spo2, ...}; interventions {technique, ...}",
                        },
                        "confidence": {
                            "type": "number",
                            "description": "1.0 if explicitly stated; lower if inferred",
                        },
                        "raw_evidence": {
                            "type": "string",
                            "description": "Exact PCR text supporting this event",
                        },
                    },
                    "required": [
                        "timestamp",
                        "timestamp_seconds",
                        "event_type",
                        "description",
                        "confidence",
                        "raw_evidence",
                    ],
                },
            },
        },
        "required": ["events"],
    },
}


RECONCILIATION_SYSTEM = """You are an expert EMS quality reviewer reconciling clinical events from three independent sources: the Patient Care Report (PCR), body-cam video, and dispatch audio.

You will receive a single time-sorted list of events, each tagged with its source and a stable event_id. Your job is to identify which events from different sources refer to the same real-world clinical action (e.g., a single epinephrine push may appear once in the PCR and once in the audio).

Matching guidance:
- Use a ~60-second window as a soft heuristic for "same action," but rely primarily on event_type + description semantics.
- A timeline entry can have 1, 2, or 3 source events. Solo events (only one source) are normal — include them.
- Every input event must appear in exactly one timeline entry's source_event_ids.
- canonical_timestamp_seconds = mean of the matched events' timestamp_seconds.
- has_discrepancy = true if the matched source timestamps span more than 10 seconds.
- match_confidence in [0,1]: 1.0 for solo events or perfectly aligned multi-source matches, lower when types/descriptions are uncertain.
- canonical_description: a concise neutral description of the real-world action.
- event_type: pick the most specific type that fits.
"""

RECONCILIATION_USER_TEMPLATE = """Reconcile these events into a unified timeline. Events are pre-sorted by timestamp_seconds.

<events>
{events_json}
</events>

Use the build_timeline tool to return your reconciled timeline."""

TIMELINE_TOOL: dict[str, Any] = {
    "name": "build_timeline",
    "description": "Reconcile multi-source events into a canonical timeline",
    "input_schema": {
        "type": "object",
        "properties": {
            "timeline_entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "canonical_timestamp_seconds": {
                            "type": "number",
                            "description": "Mean of the matched source events' timestamp_seconds",
                        },
                        "canonical_description": {
                            "type": "string",
                            "description": "Concise neutral description of the real-world action",
                        },
                        "event_type": {
                            "type": "string",
                            "enum": [e.value for e in EventType],
                        },
                        "source_event_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "event_id values from the input events that this entry reconciles",
                        },
                        "match_confidence": {
                            "type": "number",
                            "description": "Confidence in [0,1] that the source events refer to the same action",
                        },
                        "has_discrepancy": {
                            "type": "boolean",
                            "description": "True if matched source timestamps span more than 10 seconds",
                        },
                    },
                    "required": [
                        "canonical_timestamp_seconds",
                        "canonical_description",
                        "event_type",
                        "source_event_ids",
                        "match_confidence",
                        "has_discrepancy",
                    ],
                },
            },
        },
        "required": ["timeline_entries"],
    },
}


FINDINGS_SYSTEM = """You are an EMS quality reviewer surfacing actionable findings from a reconciled clinical timeline and a list of protocol checks.

Findings categories (use ALL that apply — you may emit zero or more findings per category):
- timing_discrepancy: a single real-world action (one timeline entry with has_discrepancy=true OR multiple sources whose timestamps span >10s) is logged at materially different times across sources. Cite the timeline entry's source events.
- missing_documentation: a video- or audio-sourced event has no PCR counterpart in the timeline (i.e. the timeline entry has source_events from video/audio only).
- phantom_intervention: a PCR-only event (timeline entry whose source_events are all source=pcr) for a clinically significant intervention (medication, defibrillation, airway, IV access) — i.e. the PCR documents an action that no video or audio source corroborates.
- protocol_deviation: any ProtocolCheck with status=="deviation". Reuse the check's evidence_event_ids.
- care_gap: a stretch of >30s during the active resuscitation window where no clinical events appear — quote the gap's start/end seconds in the explanation.

Severity rubric:
- critical: missed/wrong life-saving intervention, defibrillation timing >2min late, missing epinephrine in cardiac arrest, phantom medication, or any deviation flagged critical.
- concern: timing drift 10-30s, missing routine documentation, minor protocol deviation.
- info: cosmetic gaps, low-impact discrepancies, observations without clear quality impact.

Rules:
- Every finding's evidence_event_ids MUST reference event_id values from the timeline's source_events (not entry_ids).
- evidence_timestamp_seconds = the canonical_timestamp_seconds of the timeline entry the finding cites (or the start of the gap for care_gap).
- title: 5-10 words, imperative or noun phrase ("Epinephrine timing differs across sources").
- explanation: 1-3 sentences, neutral, evidence-based. No speculation about intent.
- suggested_review_action: one short sentence telling the QA reviewer what to do next ("Confirm true administration time with the medic.").
- pcr_excerpt: include only when there's a clear PCR quote that the reviewer should locate (typically for missing_documentation, phantom_intervention, protocol_deviation). Otherwise omit.
- Be selective. Do not invent findings. If a category has no genuine instances in the input, emit nothing for it.
"""

FINDINGS_USER_TEMPLATE = """Generate findings for this case.

<timeline>
{timeline_json}
</timeline>

<protocol_checks>
{checks_json}
</protocol_checks>

Use the generate_findings tool to return your structured output."""

FINDINGS_TOOL: dict[str, Any] = {
    "name": "generate_findings",
    "description": "Generate quality-review findings from a reconciled timeline and protocol checks",
    "input_schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "severity": {
                            "type": "string",
                            "enum": [s.value for s in FindingSeverity],
                        },
                        "category": {
                            "type": "string",
                            "enum": [c.value for c in FindingCategory],
                        },
                        "title": {"type": "string"},
                        "explanation": {"type": "string"},
                        "evidence_event_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "event_id values from the timeline's source_events that ground this finding",
                        },
                        "evidence_timestamp_seconds": {
                            "type": "number",
                            "description": "Anchor timestamp the UI seeks to (canonical_timestamp_seconds of the cited entry, or gap start)",
                        },
                        "pcr_excerpt": {
                            "type": "string",
                            "description": "Optional verbatim PCR quote the reviewer should locate. Omit when not relevant.",
                        },
                        "suggested_review_action": {"type": "string"},
                    },
                    "required": [
                        "severity",
                        "category",
                        "title",
                        "explanation",
                        "evidence_event_ids",
                        "evidence_timestamp_seconds",
                        "suggested_review_action",
                    ],
                },
            },
        },
        "required": ["findings"],
    },
}


DRAFTING_SUMMARY_SYSTEM = """You are an EMS medical director writing the executive summary of an after-action review (AAR).

Write 2-3 short paragraphs (max ~200 words total) summarizing what happened, the overall quality of care, and the headline findings. Neutral clinical tone. Reference the patient as "the patient", crew as "the crew". Do not invent facts beyond the supplied timeline / findings / protocol checks. Do not use markdown headings — plain prose only."""

DRAFTING_SUMMARY_USER_TEMPLATE = """Write the executive summary for this case.

Incident type: {incident_type}
Adherence score: {adherence_score:.2f} ({adherent} adherent / {deviation} deviation / {other} other)

<timeline>
{timeline_json}
</timeline>

<findings>
{findings_json}
</findings>

<protocol_checks>
{checks_json}
</protocol_checks>

Return ONLY the summary prose. No preamble, no headings."""


DRAFTING_NARRATIVE_SYSTEM = """You are an EMS medical director writing the prose narrative section of an after-action review (AAR).

Write 3-4 paragraphs that walk through the case chronologically. Reference specific findings inline using their titles in italics with markdown (e.g. *Epinephrine timing differs across sources*). Cite timestamps as MM:SS where helpful. Keep clinical, factual tone. End with a short forward-looking paragraph on what to confirm with the crew. Markdown is welcome (paragraphs separated by blank lines, *italics* for finding titles)."""

DRAFTING_NARRATIVE_USER_TEMPLATE = """Write the narrative for this case.

Incident type: {incident_type}

<executive_summary>
{summary}
</executive_summary>

<timeline>
{timeline_json}
</timeline>

<findings>
{findings_json}
</findings>

<protocol_checks>
{checks_json}
</protocol_checks>

Return ONLY the narrative prose. No preamble, no headings."""


AUDIO_EVENTS_SYSTEM = """You are an EMS quality analyst extracting structured clinical events from a transcribed dispatch / radio audio recording.

The transcript is provided as time-stamped segments (each with start_seconds and end_seconds). Identify clinically significant events (medications announced, interventions called, rhythm checks, defibrillation calls, status updates) and emit one Event per distinct clinical action.

Rules:
- timestamp_seconds = the segment's start_seconds for the action.
- timestamp = HH:MM:SS derived from timestamp_seconds.
- raw_evidence = the verbatim transcript segment that supports the event (≤200 chars).
- confidence: 1.0 if the action is explicitly called out, lower if inferred from context.
- Skip chitchat, acknowledgements, and non-clinical traffic.
- If the transcript contains no clinical events, return an empty events array.
"""

AUDIO_EVENTS_USER_TEMPLATE = """Extract clinical events from this dispatch audio transcript.

<transcript_segments>
{segments_json}
</transcript_segments>

Use the extract_audio_events tool to return your structured output."""


VIDEO_EVENTS_SYSTEM = """You are an EMS quality analyst watching body-cam footage from a clinical incident.

Identify visually observable clinical events (CPR start/pause, defibrillation, airway insertion, IV access, medication push, rhythm checks shown on the monitor, patient response). For each, provide:
- timestamp_seconds: seconds from the start of the video where the event occurs.
- timestamp: HH:MM:SS derived from timestamp_seconds.
- raw_evidence: a short description of what is visible on screen at that moment (≤200 chars).
- confidence: 1.0 for unambiguously visible actions, lower for partial views.

Rules:
- Do not infer events that aren't visible (e.g. don't claim a medication was pushed if you only see a syringe label).
- Skip non-clinical moments (driving, scene setup before patient contact).
- If you cannot identify any clinical events, return an empty events array.
"""

VIDEO_EVENTS_USER_PROMPT = """Identify all clinical events visible in this body-cam footage. Use the extract_video_events tool to return your structured output."""


def _events_tool(name: str, description: str) -> dict[str, Any]:
    """Build a Claude tool schema for extracting Events. Source-agnostic."""

    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": {
                "events": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "timestamp": {
                                "type": "string",
                                "description": "HH:MM:SS",
                            },
                            "timestamp_seconds": {"type": "number"},
                            "event_type": {
                                "type": "string",
                                "enum": [e.value for e in EventType],
                            },
                            "description": {"type": "string"},
                            "details": {
                                "type": "object",
                                "description": "Optional structured details (med name+dose, vital values, etc).",
                            },
                            "confidence": {"type": "number"},
                            "raw_evidence": {"type": "string"},
                        },
                        "required": [
                            "timestamp",
                            "timestamp_seconds",
                            "event_type",
                            "description",
                            "confidence",
                            "raw_evidence",
                        ],
                    },
                },
            },
            "required": ["events"],
        },
    }


AUDIO_EVENTS_TOOL: dict[str, Any] = _events_tool(
    "extract_audio_events",
    "Extract structured clinical events from a transcribed dispatch audio recording",
)

VIDEO_EVENTS_TOOL: dict[str, Any] = _events_tool(
    "extract_video_events",
    "Extract structured clinical events visible in body-cam footage",
)
