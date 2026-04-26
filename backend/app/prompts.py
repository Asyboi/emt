"""Centralized LLM prompts and tool schemas.

Phase 4 introduces the PCR parser prompt + tool. Phase 5 adds prompts
for reconciliation, findings, drafting, audio event extraction, and
video event extraction. The QI Case Review update (Step 2) adds the
five drafting sub-call prompts and tools (header/summary, clinical
assessment, documentation quality, recommendations, determination
rationale).
"""

from __future__ import annotations

from typing import Any

from app.schemas import (
    AssessmentStatus,
    ClinicalAssessmentCategory,
    DiscrepancyType,
    EventType,
    FindingCategory,
    FindingSeverity,
    RecommendationAudience,
    RecommendationPriority,
)

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


PCR_DRAFT_SYSTEM = """You are a clinical documentation assistant for EMS quality improvement. \
Your job is to draft a Patient Care Report (PCR) in a specific plain-text format based on \
evidence extracted from bodycam video and radio/on-scene audio analysis.

Rules:
- Write only what is directly evidenced by the video or audio events provided
- Use CAD timestamps as the authoritative source for all unit timing fields
- For any clinical detail not evidenced by video or audio, write [UNCONFIRMED]
- Write in past tense, third person clinical style matching the example format exactly
- Keep intervention timestamps precise to the second where evidence supports it
- Do not invent vital signs, patient demographics, medication lot numbers, or crew identifiers
- Flag every intervention that appears in only one source (video OR audio, not both) \
with [UNCONFIRMED] appended inline
- Interventions confirmed by BOTH video and audio get no flag
- Follow the section headers, separator lines, and formatting exactly as shown in the template
- The output must be plain text — no markdown, no bullet asterisks, no headers with #"""


PCR_DRAFT_USER_TEMPLATE = """Draft a Patient Care Report for this EMS incident using \
the exact format shown below. Replace all placeholder values with evidence from the \
video and audio events. Write [UNCONFIRMED] for anything not evidenced.

CAD DATA:
{cad_summary}

VIDEO EVENTS ({video_count} extracted):
{video_events_json}

AUDIO EVENTS ({audio_count} extracted):
{audio_events_json}

Output the PCR in this exact format — preserve every separator line, every section \
header, every label exactly as shown:

PATIENT CARE REPORT
Report Type: EMS Patient Care Report
CAD Incident ID: {incident_id}
PCR Number: PCR-{pcr_number}
Date of Service: {date_of_service}

============================================================
AGENCY / UNIT INFORMATION
============================================================

EMS Agency: [UNCONFIRMED]
Unit ID: [UNCONFIRMED]
Crew:
- Paramedic: [UNCONFIRMED]
- EMT: [UNCONFIRMED]

Incident Borough: {borough}
Dispatch Area: {dispatch_area}
ZIP Code: {zipcode}
Police Precinct: {precinct}

============================================================
DISPATCH INFORMATION
============================================================

Initial Call Type: {initial_call_type}
Initial Severity Level: {initial_severity}
Final Call Type: {final_call_type}
Final Severity Level: {final_severity}

Dispatch Complaint:
{dispatch_complaint}

Call Notes:
{call_notes}

============================================================
TIMES
============================================================

Incident Date/Time:          {incident_datetime}
First Assignment:            {first_assignment}
Unit Activated:              {first_activation}
Unit Arrived On Scene:       {first_on_scene}
Departed Scene To Hospital:  {first_to_hosp}
Arrived At Hospital:         {first_hosp_arrival}
Incident Closed:             {incident_close}

Dispatch Response Time: {dispatch_seconds} seconds
Incident Response Time: {incident_seconds} seconds
Travel Time To Scene: {travel_seconds} seconds

============================================================
PATIENT INFORMATION
============================================================

Patient Name: [UNCONFIRMED]
Age: [UNCONFIRMED]
Sex: [UNCONFIRMED]
DOB: [UNCONFIRMED]
Address: {borough}, NY {zipcode}
Patient ID: Not available at time of care

============================================================
CHIEF COMPLAINT
============================================================

{chief_complaint}

============================================================
HISTORY OF PRESENT ILLNESS
============================================================

{history_of_present_illness}

============================================================
PAST MEDICAL HISTORY
============================================================

[UNCONFIRMED]

============================================================
MEDICATIONS
============================================================

[UNCONFIRMED]

============================================================
ALLERGIES
============================================================

[UNCONFIRMED]

============================================================
INITIAL ASSESSMENT
============================================================

{initial_assessment}

============================================================
VITAL SIGNS
============================================================

{vital_signs}

============================================================
TREATMENTS / INTERVENTIONS
============================================================

{interventions}

============================================================
MEDICATIONS ADMINISTERED
============================================================

{medications_administered}

============================================================
PROCEDURES
============================================================

{procedures}

============================================================
TRANSPORT INFORMATION
============================================================

Transported: {transported}
Destination: [UNCONFIRMED]
Destination Type: Emergency Department
Transport Priority: Emergency
Patient Position: Supine
Condition During Transport: [UNCONFIRMED]
Condition At Transfer: [UNCONFIRMED]

Reason For Destination: [UNCONFIRMED]

============================================================
TRANSFER OF CARE
============================================================

Care transferred to emergency department staff on arrival.
Verbal report given to ED physician and nursing staff.

Patient transferred with: [UNCONFIRMED]

============================================================
NARRATIVE
============================================================

{narrative}

============================================================
DISPOSITION
============================================================

Incident Disposition Code: {disposition_code}
Patient Disposition: [UNCONFIRMED]
Final Patient Condition: [UNCONFIRMED]
ROSC Achieved: [UNCONFIRMED]
Transported To Hospital: {transported}
Crew Cleared: {incident_close}

============================================================
SIGNATURES
============================================================

Primary Provider: [UNCONFIRMED]
Partner: [UNCONFIRMED]
Receiving Facility Signature: [UNCONFIRMED]
Patient Signature: [UNCONFIRMED]
Report Completed: [UNCONFIRMED]"""


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


# --------------------------------------------------------------------------- #
# Multi-agent reconciliation chain — 4 agents, each with its own prompt+tool. #
# --------------------------------------------------------------------------- #

RECONCILIATION_CLUSTER_SYSTEM = """You are an EMS timeline analyst. Your sole task is to group a set of cross-source clinical events into mutually exclusive clusters, where each cluster represents a single real-world clinical action that may have been captured by more than one source (PCR, video, audio, or CAD).

Clustering rules:
- Primary signal: semantic similarity of event_type + description. Two events describing the same action (e.g., both say "epinephrine push") belong together even if their timestamps differ by up to 90 seconds.
- Secondary signal: timestamp proximity. Within the same event_type, prefer matching events within a 60-second window.
- A cluster may contain 1–4 events (one per source). A single-event cluster is valid and common.
- Every input event_id must appear in exactly one cluster. Do not drop events.
- CAD-sourced events (source == "cad") represent ground-truth milestones (scene arrival, transport departure). Match them to a pcr/video/audio event only when the description is unambiguous; otherwise let them be solo clusters.
- cluster_id: a short deterministic string, e.g. "c001", "c002", ... in order of centroid_timestamp_seconds.
- centroid_timestamp_seconds: arithmetic mean of the timestamps of the cluster's events.
- source_types: the distinct source values present in the cluster.

Return ONLY what is required by the tool. Do not add commentary."""

RECONCILIATION_CLUSTER_USER_TEMPLATE = """Group these events into clusters. Events are pre-sorted by timestamp_seconds.

<events>
{events_json}
</events>

Use the cluster_events tool to return your structured output."""

CLUSTER_EVENTS_TOOL: dict[str, Any] = {
    "name": "cluster_events",
    "description": "Group cross-source clinical events into clusters representing single real-world actions",
    "input_schema": {
        "type": "object",
        "properties": {
            "clusters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "cluster_id": {
                            "type": "string",
                            "description": "Short unique identifier, e.g. 'c001'",
                        },
                        "event_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "event_id values that belong to this cluster",
                        },
                        "centroid_timestamp_seconds": {
                            "type": "number",
                            "description": "Arithmetic mean of the cluster members' timestamp_seconds",
                        },
                        "source_types": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": ["pcr", "video", "audio", "cad"],
                            },
                            "description": "Distinct source values present in this cluster",
                        },
                    },
                    "required": [
                        "cluster_id",
                        "event_ids",
                        "centroid_timestamp_seconds",
                        "source_types",
                    ],
                },
            },
        },
        "required": ["clusters"],
    },
}


RECONCILIATION_REVIEW_SYSTEM = """You are an EMS quality analyst. Given a cluster of events that all represent the same real-world clinical action, perform two tasks in one pass:

1. Score the cluster for discrepancies a QA reviewer should examine.
2. Produce a canonical description and classification for the timeline.

Discrepancy types:
- timing: agree on WHAT, but timestamps differ by more than 10 seconds across sources.
- clinical: disagree on WHAT — different drug doses, different interventions, conflicting vital values.
- phantom: only one source (typically the PCR) documents an action that should have been observable by another source.
- missing: only non-PCR sources document this action — the PCR has no counterpart.
- none: no discrepancy; sources are consistent.

Scoring rules:
- discrepancy_score in [0.0, 1.0]: 0.0 = none, 1.0 = severe.
  - timing: min(1.0, timestamp_spread_seconds / 120.0).
  - clinical: always >= 0.7.
  - phantom/missing: 0.4 routine; 0.8 for life-saving interventions (defibrillation, epinephrine, airway).
  - none: 0.0.
- discrepancy_reasoning: one neutral sentence citing specific evidence (timestamps or descriptions). No recommendations.

Canonicalization rules:
- canonical_description: concise, neutral, clinically precise; max 120 chars. Include doses if mentioned in any source. If sources conflict on a dose, describe the conflict briefly.
- event_type: most specific EventType that fits; prefer the PCR source's type when in doubt.
- canonical_timestamp_seconds: use the centroid provided. Do not recalculate.
- match_confidence: confidence in [0,1] that all cluster events describe the same action. 1.0 for a solo event or clearly identical multi-source cluster; 0.5–0.8 when descriptions are only approximately similar."""

RECONCILIATION_REVIEW_USER_TEMPLATE = """Review this cluster: score it for discrepancies AND produce its canonical entry.

Cluster ID: {cluster_id}
Centroid timestamp (seconds): {centroid_timestamp_seconds}

<cluster_events>
{cluster_events_json}
</cluster_events>

Use the review_cluster tool to return both outputs in one call."""

REVIEW_CLUSTER_TOOL: dict[str, Any] = {
    "name": "review_cluster",
    "description": "Score a matched event cluster for discrepancies AND produce its canonical timeline entry, in a single call.",
    "input_schema": {
        "type": "object",
        "properties": {
            "cluster_id": {"type": "string", "description": "Echo back the cluster_id."},
            "discrepancy_score": {
                "type": "number",
                "description": "0.0 (none) to 1.0 (severe).",
            },
            "discrepancy_type": {
                "type": "string",
                "enum": [t.value for t in DiscrepancyType],
            },
            "discrepancy_reasoning": {
                "type": "string",
                "description": "One neutral sentence citing specific evidence.",
            },
            "canonical_timestamp_seconds": {
                "type": "number",
                "description": "Use the provided centroid value. Do not recalculate.",
            },
            "event_type": {
                "type": "string",
                "enum": [e.value for e in EventType],
            },
            "canonical_description": {
                "type": "string",
                "description": "Concise neutral clinical description. Max 120 characters.",
            },
            "match_confidence": {
                "type": "number",
                "description": "[0,1] confidence the cluster events describe one action.",
            },
        },
        "required": [
            "cluster_id",
            "discrepancy_score",
            "discrepancy_type",
            "discrepancy_reasoning",
            "canonical_timestamp_seconds",
            "event_type",
            "canonical_description",
            "match_confidence",
        ],
    },
}


RECONCILIATION_CRITIC_SYSTEM = """You are a senior EMS quality review auditor performing a final verification pass on a proposed timeline before it is used for quality improvement review.

You receive a set of draft timeline entries, each paired with discrepancy scoring. Your role is to:
1. Accept entries that are correct as-is.
2. Correct entries where the discrepancy assessment is clearly wrong (e.g., two events from the same source clustered together, or has_discrepancy flagged for a 2-second spread).
3. Flag entries where the canonical_description is misleading (replace it).
4. Split an entry if two clearly unrelated events were incorrectly merged (emit two entries from one cluster_id — use cluster_id suffixed with "_a" and "_b").
5. Merge entries only when you have high confidence (>0.9) that they represent the same action and they were incorrectly separated.

Correction discipline:
- Be conservative. Accept a draft entry unless you have a concrete reason to change it.
- Do not invent new events not present in the input.
- Every source event_id from the input must appear in exactly one output entry's source_event_ids.
- has_discrepancy: true if discrepancy_score >= 0.15 OR timestamp spread across the entry's source events exceeds 10 seconds.
- entry_id: use a placeholder format like "critic-{cluster_id}" — the Python layer replaces with str(uuid.uuid4()).

Output the complete verified timeline via the assemble_verified_timeline tool."""

RECONCILIATION_CRITIC_USER_TEMPLATE = """Verify and correct the proposed timeline. Input contains {n_clusters} clusters.

All source events (for reference):
<all_events>
{all_events_json}
</all_events>

Draft timeline entries (one per cluster, with discrepancy scores merged inline):
<draft_entries>
{draft_entries_json}
</draft_entries>

Use the assemble_verified_timeline tool to return the final verified timeline."""

ASSEMBLE_VERIFIED_TIMELINE_TOOL: dict[str, Any] = {
    "name": "assemble_verified_timeline",
    "description": "Return the verified, corrected timeline entries after the critic review pass",
    "input_schema": {
        "type": "object",
        "properties": {
            "timeline_entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "entry_id": {
                            "type": "string",
                            "description": "Placeholder like 'critic-c001'. Python replaces with uuid4.",
                        },
                        "canonical_timestamp_seconds": {"type": "number"},
                        "canonical_description": {
                            "type": "string",
                            "description": "Verified canonical description.",
                        },
                        "event_type": {
                            "type": "string",
                            "enum": [e.value for e in EventType],
                        },
                        "source_event_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "event_id values from the original input events.",
                        },
                        "match_confidence": {"type": "number"},
                        "has_discrepancy": {
                            "type": "boolean",
                            "description": "True if discrepancy_score >= 0.15 or timestamp spread > 10s.",
                        },
                    },
                    "required": [
                        "entry_id",
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


# --------------------------------------------------------------------------- #
# QI Case Review drafting — five sub-calls per qi_review_update_prompts.md.
# --------------------------------------------------------------------------- #


QI_HEADER_SYSTEM = """You are an EMS Quality Improvement reviewer extracting case header information and writing an incident summary from a Patient Care Report and a reconstructed multi-source timeline.

Anonymize patient details — return age in 10-year ranges (e.g. "60-69"), use only m/f/unknown for sex, and omit names or addresses. Identify crew members by anonymized identifiers (P-001, P-002, ...) keyed by role; if the PCR uses real names or unit numbers, replace with anonymized identifiers in your output. The responding_unit field IS allowed to carry the unit number (e.g. "Medic 51") since that's not patient PII.

Write the incident_summary as 2-3 short paragraphs of neutral clinical narrative — what happened, what was done, the disposition. Reference the patient as "the patient" and the crew as "the crew" or by role. Do not include findings or QA judgments in the summary; that's a separate section.

If incident_type contains "cardiac_arrest" (or the PCR/timeline clearly indicates one), populate utstein_data with whatever the sources support; otherwise return utstein_data: null."""


QI_HEADER_USER_TEMPLATE = """Extract the case header, write the incident summary, and (if applicable) populate the Utstein registry data.

Incident type: {incident_type}
Responding unit (from case metadata): {responding_unit}

<pcr>
{pcr_content}
</pcr>

<timeline>
{timeline_json}
</timeline>

Use the extract_qi_header tool to return your structured output."""


QI_HEADER_TOOL: dict[str, Any] = {
    "name": "extract_qi_header",
    "description": "Extract anonymized case header info, incident summary, and (when relevant) Utstein cardiac-arrest data",
    "input_schema": {
        "type": "object",
        "properties": {
            "responding_unit": {
                "type": "string",
                "description": "Unit number / call sign (e.g. 'Medic 51').",
            },
            "crew_members": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {
                            "type": "string",
                            "enum": [
                                "primary_paramedic",
                                "secondary_paramedic",
                                "emt",
                                "driver",
                                "supervisor",
                                "other",
                            ],
                        },
                        "identifier": {
                            "type": "string",
                            "description": "Anonymized identifier such as 'P-001'.",
                        },
                    },
                    "required": ["role", "identifier"],
                },
            },
            "patient_age_range": {
                "type": "string",
                "description": "10-year age band (e.g. '60-69'). Use 'unknown' if not documented.",
            },
            "patient_sex": {
                "type": "string",
                "enum": ["m", "f", "unknown"],
            },
            "chief_complaint": {"type": "string"},
            "incident_summary": {
                "type": "string",
                "description": "2-3 paragraph neutral clinical narrative.",
            },
            "utstein_data": {
                "type": ["object", "null"],
                "description": "Cardiac-arrest registry fields. Set to null for non-arrest cases.",
                "properties": {
                    "witnessed": {"type": ["boolean", "null"]},
                    "bystander_cpr": {"type": ["boolean", "null"]},
                    "initial_rhythm": {
                        "type": ["string", "null"],
                        "enum": ["vf", "vt", "pea", "asystole", "unknown", None],
                    },
                    "time_to_cpr_seconds": {"type": ["number", "null"]},
                    "time_to_first_defib_seconds": {"type": ["number", "null"]},
                    "rosc_achieved": {"type": ["boolean", "null"]},
                    "time_to_rosc_seconds": {"type": ["number", "null"]},
                    "disposition": {
                        "type": ["string", "null"],
                        "enum": [
                            "rosc_sustained",
                            "transport_with_cpr",
                            "pronounced_on_scene",
                            "transferred_with_rosc",
                            None,
                        ],
                    },
                },
            },
        },
        "required": [
            "responding_unit",
            "crew_members",
            "patient_age_range",
            "patient_sex",
            "chief_complaint",
            "incident_summary",
        ],
    },
}


QI_CLINICAL_ASSESSMENT_SYSTEM = """You are an EMS QI reviewer evaluating clinical care against established benchmarks. For each benchmark below, assess whether the timeline shows the standard was MET, NOT_MET, NOT_APPLICABLE, or has INSUFFICIENT_DOCUMENTATION.

Cardiac arrest benchmarks (when incident_type=cardiac_arrest):
- Scene management: arrival to patient contact <60s
- Initial assessment: rhythm identified within 30s of patient contact
- CPR quality: chest compressions started within 10s of arrest confirmation (bystander CPR continued is acceptable)
- CPR quality: minimal interruptions, peri-shock pause <10s
- Airway management: BVM ventilation initiated, advanced airway considered after initial CPR cycles
- Vascular access: IV/IO established within first 5 minutes
- Medications: epinephrine 1mg IV/IO every 3-5 minutes
- Defibrillation: VF/pulseless VT shocked within 2 minutes of identification
- Monitoring: continuous ECG, EtCO2 once advanced airway is in place
- Transport decision: appropriate destination + timing
- Handoff: structured handoff to receiving hospital with rhythm history, drug timing, ROSC time

For non-arrest incident types, generalize: scene management, initial assessment, and handoff items always apply; the others are NOT_APPLICABLE unless the timeline shows them.

Rules:
- Cite specific timeline event_ids in evidence_event_ids when an event in the timeline supports the assessment.
- notes: 1-2 sentences referencing the actual timeline events (timestamps welcome).
- item_id: short, lowercased, hyphen-or-underscore (e.g. 'ca_scene_arrival'). Must be unique across the response.
- Emit at least one item per relevant category. Do not invent benchmarks beyond the list above.
"""


QI_CLINICAL_ASSESSMENT_USER_TEMPLATE = """Evaluate clinical performance for this case.

Incident type: {incident_type}

<timeline>
{timeline_json}
</timeline>

Use the assess_clinical_care tool to return your structured output."""


QI_CLINICAL_ASSESSMENT_TOOL: dict[str, Any] = {
    "name": "assess_clinical_care",
    "description": "Evaluate the timeline against per-category clinical benchmarks for the incident type",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "item_id": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": [c.value for c in ClinicalAssessmentCategory],
                        },
                        "benchmark": {"type": "string"},
                        "status": {
                            "type": "string",
                            "enum": [s.value for s in AssessmentStatus],
                        },
                        "notes": {"type": "string"},
                        "evidence_event_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "event_id values from the timeline's source_events that ground the assessment",
                        },
                    },
                    "required": [
                        "item_id",
                        "category",
                        "benchmark",
                        "status",
                        "notes",
                    ],
                },
            },
        },
        "required": ["items"],
    },
}


QI_DOCUMENTATION_QUALITY_SYSTEM = """You evaluate Patient Care Report documentation quality against the actual events captured in video and audio sources (visible in the timeline as source-tagged events).

Score each dimension on a 0.0-1.0 scale:
- completeness_score: fraction of clinically relevant timeline events that are documented in the PCR. 1.0 = every multi-source or video/audio event is also in the PCR.
- accuracy_score: where the PCR overlaps with other sources, do they agree on facts (timestamps, doses, interventions)? 1.0 = no discrepancies. Lower for each conflicting fact.
- narrative_quality_score: is the PCR narrative coherent, professional, and complete? 0.5 = readable but missing details; 1.0 = exemplary.

List specific, evidence-grounded issues. Each issue should reference a concrete event or section of the PCR (no abstract complaints)."""


QI_DOCUMENTATION_QUALITY_USER_TEMPLATE = """Evaluate documentation quality for this case.

<pcr>
{pcr_content}
</pcr>

<timeline>
{timeline_json}
</timeline>

Use the assess_documentation_quality tool to return your structured output."""


QI_DOCUMENTATION_QUALITY_TOOL: dict[str, Any] = {
    "name": "assess_documentation_quality",
    "description": "Score PCR completeness, accuracy, and narrative quality against the multi-source timeline",
    "input_schema": {
        "type": "object",
        "properties": {
            "completeness_score": {
                "type": "number",
                "description": "0.0-1.0 — fraction of timeline events also documented in the PCR.",
            },
            "accuracy_score": {
                "type": "number",
                "description": "0.0-1.0 — agreement between PCR and other sources on overlapping events.",
            },
            "narrative_quality_score": {
                "type": "number",
                "description": "0.0-1.0 — coherence, professionalism, completeness of narrative.",
            },
            "issues": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific, evidence-grounded documentation issues.",
            },
        },
        "required": [
            "completeness_score",
            "accuracy_score",
            "narrative_quality_score",
            "issues",
        ],
    },
}


QI_RECOMMENDATIONS_SYSTEM = """Based on the findings and clinical assessment results, generate actionable recommendations.

Categorize each recommendation by audience:
- crew: feedback for the responding providers (technique, charting habits, training).
- agency: systemic issues (equipment, protocol changes, training programs, template updates).
- follow_up: additional review needed, escalation, peer discussion.

Priority ladder:
- required: must be addressed before the chart is signed off (e.g. correct documentation errors that affect QA / billing / handoff).
- suggested: should be addressed in the next training cycle.
- informational: no action required, awareness only.

Use a non-punitive, learning-oriented tone consistent with Just Culture principles. Cite the related finding_ids in related_finding_ids; recommendations may also stand alone (empty list) if motivated by clinical_assessment items without a corresponding finding.

Distribution target: 1-2 crew, 1 agency, 0-1 follow_up. Adjust if the case clearly demands more or less."""


QI_RECOMMENDATIONS_USER_TEMPLATE = """Generate recommendations for this case.

<findings>
{findings_json}
</findings>

<clinical_assessment>
{clinical_assessment_json}
</clinical_assessment>

Use the generate_recommendations tool to return your structured output."""


QI_RECOMMENDATIONS_TOOL: dict[str, Any] = {
    "name": "generate_recommendations",
    "description": "Generate categorized, prioritized recommendations for the case",
    "input_schema": {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "recommendation_id": {"type": "string"},
                        "audience": {
                            "type": "string",
                            "enum": [a.value for a in RecommendationAudience],
                        },
                        "priority": {
                            "type": "string",
                            "enum": [p.value for p in RecommendationPriority],
                        },
                        "description": {"type": "string"},
                        "related_finding_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": [
                        "recommendation_id",
                        "audience",
                        "priority",
                        "description",
                    ],
                },
            },
        },
        "required": ["recommendations"],
    },
}


QI_DETERMINATION_RATIONALE_SYSTEM = """Given a determination classification (no_issues / documentation_concern / performance_concern / significant_concern / critical_event), write a 2-3 sentence rationale that cites the specific findings (by title) and clinical_assessment items (by benchmark) supporting the determination.

Neutral clinical tone. No preamble. Do not propose actions or recommendations — those are a separate section."""


QI_DETERMINATION_RATIONALE_USER_TEMPLATE = """Determination: {determination}

Findings (count by severity): {finding_counts}
Not-met clinical assessments: {not_met_count}
Documentation issues: {doc_issue_count}

<findings>
{findings_json}
</findings>

<clinical_assessment_failures>
{not_met_json}
</clinical_assessment_failures>

Return ONLY the rationale prose (2-3 sentences). No preamble, no headings."""
