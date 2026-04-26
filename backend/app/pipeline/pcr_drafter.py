"""PCR Auto-Drafter — pre-pipeline stage.

Consumes already-extracted list[Event] from video_analyzer and audio_analyzer
plus a CADRecord, and synthesizes a PCR in the same plain-text format as
cases/case_01/pcr.md so the existing pcr_parser (Stage 1a) can ingest it
without modification.

One Sonnet call per case. No raw file access — only list[Event] objects.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from app.llm_clients import claude_sonnet
from app.prompts import PCR_DRAFT_SYSTEM, PCR_DRAFT_USER_TEMPLATE
from app.schemas import CADRecord, Event, PCRDraft, PCRDraftStatus

logger = logging.getLogger(__name__)

CALL_TYPE_COMPLAINTS: dict[str, str] = {
    "UNC": "Unconscious person.",
    "CARD": "Cardiac emergency.",
    "ARREST": "Cardiac arrest.",
    "CPR": "Patient in cardiac arrest, CPR in progress.",
    "SEIZR": "Seizure.",
    "DIFFBR": "Difficulty breathing.",
    "TRAUMA": "Traumatic injury.",
    "STAB": "Stab wound.",
    "SHOT": "Gunshot wound.",
    "OD": "Suspected overdose.",
    "DRUG": "Drug-related emergency.",
    "CVA": "Suspected stroke.",
    "INJURY": "Injury.",
}


def _fmt_dt(dt: Optional[datetime], fmt: str = "%m/%d/%Y %H:%M:%S") -> str:
    if dt is None:
        return "[UNCONFIRMED]"
    return dt.strftime(fmt)


def _opt_int(value: Optional[int]) -> str:
    return str(value) if value is not None else "[UNCONFIRMED]"


def _format_cad_summary(cad: Optional[CADRecord]) -> str:
    if cad is None:
        return "No CAD data available — all timing fields unconfirmed."
    return "\n".join([
        f"Incident ID: {cad.cad_incident_id}",
        f"Call Type: {cad.final_call_type} (severity {cad.final_severity_level_code})",
        f"Borough: {cad.borough or '[UNCONFIRMED]'}",
        f"ZIP: {cad.zipcode or '[UNCONFIRMED]'}",
        f"Incident datetime: {_fmt_dt(cad.incident_datetime)}",
        f"First assignment: {_fmt_dt(cad.first_assignment_datetime)}",
        f"Unit activated: {_fmt_dt(cad.first_activation_datetime)}",
        f"On scene: {_fmt_dt(cad.first_on_scene_datetime)}",
        f"Departed scene: {_fmt_dt(cad.first_to_hosp_datetime)}",
        f"Hospital arrival: {_fmt_dt(cad.first_hosp_arrival_datetime)}",
        f"Incident closed: {_fmt_dt(cad.incident_close_datetime)}",
        f"Dispatch response seconds: {_opt_int(cad.dispatch_response_seconds)}",
        f"Incident response seconds: {_opt_int(cad.incident_response_seconds)}",
        f"Travel seconds: {_opt_int(cad.incident_travel_seconds)}",
        f"Disposition code: {cad.incident_disposition_code.value}",
    ])


def _serialize_events(events: list[Event]) -> str:
    return json.dumps(
        [
            {
                "timestamp": e.timestamp,
                "timestamp_seconds": round(e.timestamp_seconds, 1),
                "event_type": e.event_type.value,
                "source": e.source.value,
                "description": e.description,
                "confidence": round(e.confidence, 2),
            }
            for e in events
        ],
        indent=2,
    )


def _count_unconfirmed(text: str) -> int:
    return text.count("[UNCONFIRMED]")


def _fallback_pcr(
    cad: Optional[CADRecord],
    video_events: list[Event],
    audio_events: list[Event],
) -> str:
    """Deterministic fallback PCR when the Sonnet call fails.

    Populates only CAD timing fields. All clinical content marked [UNCONFIRMED].
    Preserves the section format so pcr_parser can still attempt extraction.
    """
    incident_id = cad.cad_incident_id if cad else "[UNCONFIRMED]"
    date_str = _fmt_dt(cad.incident_datetime, "%m/%d/%Y") if cad else "[UNCONFIRMED]"

    all_events = sorted(
        [*video_events, *audio_events],
        key=lambda e: e.timestamp_seconds,
    )
    intervention_lines: list[str] = []
    for e in all_events:
        confirmed = (
            any(
                v.event_type == e.event_type
                and abs(v.timestamp_seconds - e.timestamp_seconds) < 30
                for v in video_events
            )
            and any(
                a.event_type == e.event_type
                and abs(a.timestamp_seconds - e.timestamp_seconds) < 30
                for a in audio_events
            )
        )
        flag = "" if confirmed else " [UNCONFIRMED]"
        intervention_lines.append(f"{e.timestamp}  {e.description}{flag}")
    interventions = "\n\n".join(intervention_lines) if intervention_lines else "[UNCONFIRMED]"

    borough = cad.borough if cad and cad.borough else "[UNCONFIRMED]"
    zipcode = cad.zipcode if cad and cad.zipcode else "[UNCONFIRMED]"
    address = (
        f"{cad.borough}, NY {cad.zipcode}"
        if cad and cad.borough and cad.zipcode
        else "[UNCONFIRMED]"
    )
    initial_call = cad.initial_call_type if cad else "[UNCONFIRMED]"
    initial_severity = str(cad.initial_severity_level_code) if cad else "[UNCONFIRMED]"
    final_call = cad.final_call_type if cad else "[UNCONFIRMED]"
    final_severity = str(cad.final_severity_level_code) if cad else "[UNCONFIRMED]"
    complaint = (
        CALL_TYPE_COMPLAINTS.get(cad.final_call_type, "[UNCONFIRMED]")
        if cad
        else "[UNCONFIRMED]"
    )
    incident_dt = _fmt_dt(cad.incident_datetime) if cad else "[UNCONFIRMED]"
    first_assignment = _fmt_dt(cad.first_assignment_datetime) if cad else "[UNCONFIRMED]"
    first_activation = _fmt_dt(cad.first_activation_datetime) if cad else "[UNCONFIRMED]"
    first_on_scene = _fmt_dt(cad.first_on_scene_datetime) if cad else "[UNCONFIRMED]"
    first_to_hosp = _fmt_dt(cad.first_to_hosp_datetime) if cad else "[UNCONFIRMED]"
    first_hosp_arrival = _fmt_dt(cad.first_hosp_arrival_datetime) if cad else "[UNCONFIRMED]"
    incident_close = _fmt_dt(cad.incident_close_datetime) if cad else "[UNCONFIRMED]"
    dispatch_seconds = _opt_int(cad.dispatch_response_seconds) if cad else "[UNCONFIRMED]"
    incident_seconds = _opt_int(cad.incident_response_seconds) if cad else "[UNCONFIRMED]"
    travel_seconds = _opt_int(cad.incident_travel_seconds) if cad else "[UNCONFIRMED]"
    disposition_code = cad.incident_disposition_code.value if cad else "[UNCONFIRMED]"
    transported = "Yes" if cad and cad.first_to_hosp_datetime else "[UNCONFIRMED]"
    crew_cleared = _fmt_dt(cad.incident_close_datetime) if cad else "[UNCONFIRMED]"

    return f"""PATIENT CARE REPORT
Report Type: EMS Patient Care Report
CAD Incident ID: {incident_id}
PCR Number: PCR-{incident_id}
Date of Service: {date_str}

============================================================
AGENCY / UNIT INFORMATION
============================================================

EMS Agency: [UNCONFIRMED]
Unit ID: [UNCONFIRMED]
Crew:
- Paramedic: [UNCONFIRMED]
- EMT: [UNCONFIRMED]

Incident Borough: {borough}
Dispatch Area: [UNCONFIRMED]
ZIP Code: {zipcode}
Police Precinct: [UNCONFIRMED]

============================================================
DISPATCH INFORMATION
============================================================

Initial Call Type: {initial_call}
Initial Severity Level: {initial_severity}
Final Call Type: {final_call}
Final Severity Level: {final_severity}

Dispatch Complaint:
{complaint}

Call Notes:
[UNCONFIRMED]

============================================================
TIMES
============================================================

Incident Date/Time:          {incident_dt}
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
Address: {address}
Patient ID: Not available at time of care

============================================================
CHIEF COMPLAINT
============================================================

{complaint}

============================================================
HISTORY OF PRESENT ILLNESS
============================================================

[UNCONFIRMED]

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

[UNCONFIRMED]

============================================================
VITAL SIGNS
============================================================

[UNCONFIRMED]

============================================================
TREATMENTS / INTERVENTIONS
============================================================

{interventions}

============================================================
MEDICATIONS ADMINISTERED
============================================================

[UNCONFIRMED]

============================================================
PROCEDURES
============================================================

[UNCONFIRMED]

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

[UNCONFIRMED] — LLM drafting unavailable. All narrative content requires manual entry.

============================================================
DISPOSITION
============================================================

Incident Disposition Code: {disposition_code}
Patient Disposition: [UNCONFIRMED]
Final Patient Condition: [UNCONFIRMED]
ROSC Achieved: [UNCONFIRMED]
Transported To Hospital: {transported}
Crew Cleared: {crew_cleared}

============================================================
SIGNATURES
============================================================

Primary Provider: [UNCONFIRMED]
Partner: [UNCONFIRMED]
Receiving Facility Signature: [UNCONFIRMED]
Patient Signature: [UNCONFIRMED]
Report Completed: [UNCONFIRMED]"""


async def draft_pcr(
    case_id: str,
    video_events: list[Event],
    audio_events: list[Event],
    cad_record: Optional[CADRecord] = None,
) -> PCRDraft:
    """Draft a PCR from pre-extracted video and audio events.

    Single Sonnet call. On failure, falls back to a deterministic template
    populated only with CAD timing fields.
    """
    cad = cad_record
    incident_id = cad.cad_incident_id if cad else case_id
    date_of_service = _fmt_dt(cad.incident_datetime, "%m/%d/%Y") if cad else "[UNCONFIRMED]"
    dispatch_area = (
        f"M{cad.zipcode[:2]}" if cad and cad.zipcode else "[UNCONFIRMED]"
    )

    user_message = PCR_DRAFT_USER_TEMPLATE.format(
        cad_summary=_format_cad_summary(cad),
        video_count=len(video_events),
        video_events_json=_serialize_events(video_events),
        audio_count=len(audio_events),
        audio_events_json=_serialize_events(audio_events),
        incident_id=incident_id,
        pcr_number=incident_id,
        date_of_service=date_of_service,
        borough=cad.borough if cad and cad.borough else "[UNCONFIRMED]",
        dispatch_area=dispatch_area,
        zipcode=cad.zipcode if cad and cad.zipcode else "[UNCONFIRMED]",
        precinct="[UNCONFIRMED]",
        initial_call_type=cad.initial_call_type if cad else "[UNCONFIRMED]",
        initial_severity=str(cad.initial_severity_level_code) if cad else "[UNCONFIRMED]",
        final_call_type=cad.final_call_type if cad else "[UNCONFIRMED]",
        final_severity=str(cad.final_severity_level_code) if cad else "[UNCONFIRMED]",
        dispatch_complaint=(
            CALL_TYPE_COMPLAINTS.get(cad.final_call_type, "[UNCONFIRMED]")
            if cad
            else "[UNCONFIRMED]"
        ),
        call_notes="[Draft from audio evidence above]",
        incident_datetime=_fmt_dt(cad.incident_datetime) if cad else "[UNCONFIRMED]",
        first_assignment=_fmt_dt(cad.first_assignment_datetime) if cad else "[UNCONFIRMED]",
        first_activation=_fmt_dt(cad.first_activation_datetime) if cad else "[UNCONFIRMED]",
        first_on_scene=_fmt_dt(cad.first_on_scene_datetime) if cad else "[UNCONFIRMED]",
        first_to_hosp=_fmt_dt(cad.first_to_hosp_datetime) if cad else "[UNCONFIRMED]",
        first_hosp_arrival=_fmt_dt(cad.first_hosp_arrival_datetime) if cad else "[UNCONFIRMED]",
        incident_close=_fmt_dt(cad.incident_close_datetime) if cad else "[UNCONFIRMED]",
        dispatch_seconds=_opt_int(cad.dispatch_response_seconds) if cad else "[UNCONFIRMED]",
        incident_seconds=_opt_int(cad.incident_response_seconds) if cad else "[UNCONFIRMED]",
        travel_seconds=_opt_int(cad.incident_travel_seconds) if cad else "[UNCONFIRMED]",
        chief_complaint=(
            CALL_TYPE_COMPLAINTS.get(cad.final_call_type, "[UNCONFIRMED]")
            if cad
            else "[UNCONFIRMED]"
        ),
        history_of_present_illness="[Draft from video and audio evidence above]",
        initial_assessment="[Draft from video and audio evidence above]",
        vital_signs="[Draft from video and audio evidence above]",
        interventions="[Draft from video and audio evidence above]",
        medications_administered="[Draft from video and audio evidence above]",
        procedures="[Draft from video and audio evidence above]",
        transported="Yes" if cad and cad.first_to_hosp_datetime else "[UNCONFIRMED]",
        narrative="[Draft from video and audio evidence above]",
        disposition_code=cad.incident_disposition_code.value if cad else "[UNCONFIRMED]",
    )

    draft_text = ""
    try:
        response = await claude_sonnet(
            messages=[{"role": "user", "content": user_message}],
            system=PCR_DRAFT_SYSTEM,
            max_tokens=3000,
        )
        for block in response.get("content", []):
            if block.get("type") == "text":
                draft_text += block.get("text", "")

        if not draft_text.strip():
            raise ValueError("Sonnet returned empty response")

    except Exception as exc:
        logger.warning("PCR Sonnet call failed — using fallback: %s", exc)
        draft_text = _fallback_pcr(cad, video_events, audio_events)

    return PCRDraft(
        case_id=case_id,
        generated_at=datetime.now(timezone.utc),
        status=PCRDraftStatus.PENDING_REVIEW,
        video_event_count=len(video_events),
        audio_event_count=len(audio_events),
        total_event_count=len(video_events) + len(audio_events),
        draft_markdown=draft_text,
        unconfirmed_count=_count_unconfirmed(draft_text),
    )
