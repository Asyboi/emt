from __future__ import annotations

from datetime import datetime, timezone

from app.pipeline.pcr_drafter import (
    _count_unconfirmed,
    _fallback_pcr,
)
from app.schemas import Event, EventSource, EventType, PCRDraft, PCRDraftStatus


REQUIRED_HEADERS = [
    "PATIENT CARE REPORT",
    "AGENCY / UNIT INFORMATION",
    "DISPATCH INFORMATION",
    "TIMES",
    "PATIENT INFORMATION",
    "CHIEF COMPLAINT",
    "INITIAL ASSESSMENT",
    "VITAL SIGNS",
    "TREATMENTS / INTERVENTIONS",
    "MEDICATIONS ADMINISTERED",
    "PROCEDURES",
    "TRANSPORT INFORMATION",
    "TRANSFER OF CARE",
    "NARRATIVE",
    "DISPOSITION",
    "SIGNATURES",
]


def _video_event(eid: str, ts_seconds: float, etype: EventType, desc: str) -> Event:
    return Event(
        event_id=eid,
        timestamp="00:00:00",
        timestamp_seconds=ts_seconds,
        source=EventSource.VIDEO,
        event_type=etype,
        description=desc,
        confidence=0.9,
        raw_evidence=f"frame at {ts_seconds}",
    )


def _audio_event(eid: str, ts_seconds: float, etype: EventType, desc: str) -> Event:
    return Event(
        event_id=eid,
        timestamp="00:00:00",
        timestamp_seconds=ts_seconds,
        source=EventSource.AUDIO,
        event_type=etype,
        description=desc,
        confidence=0.9,
        raw_evidence=f"radio t={ts_seconds}",
    )


def test_fallback_pcr_format() -> None:
    """_fallback_pcr emits all canonical section headers and the separator banner."""
    video_events = [
        _video_event("v1", 1297.0, EventType.ARRIVAL, "Unit arrived on scene"),
        _video_event("v2", 1455.0, EventType.DEFIBRILLATION, "AED applied"),
    ]
    audio_events = [
        _audio_event("a1", 1724.0, EventType.MEDICATION, "Epinephrine 1mg IV"),
    ]

    pcr = _fallback_pcr(None, video_events, audio_events)

    for header in REQUIRED_HEADERS:
        assert header in pcr, f"missing section header: {header}"
    assert "============================================================" in pcr


def test_fallback_pcr_no_cad() -> None:
    """_fallback_pcr handles None cad_record without crashing."""
    pcr = _fallback_pcr(None, [], [])
    assert "PATIENT CARE REPORT" in pcr
    assert "[UNCONFIRMED]" in pcr


def test_count_unconfirmed() -> None:
    assert _count_unconfirmed("foo") == 0
    assert _count_unconfirmed("[UNCONFIRMED]") == 1
    assert _count_unconfirmed("[UNCONFIRMED] and [UNCONFIRMED]") == 2


def test_pcr_draft_schema_roundtrip() -> None:
    draft = PCRDraft(
        case_id="case_01",
        generated_at=datetime.now(timezone.utc),
        status=PCRDraftStatus.PENDING_REVIEW,
        video_event_count=2,
        audio_event_count=1,
        total_event_count=3,
        draft_markdown="hello",
        unconfirmed_count=0,
    )
    raw = draft.model_dump_json()
    restored = PCRDraft.model_validate_json(raw)
    assert restored.case_id == "case_01"
    assert restored.status == PCRDraftStatus.PENDING_REVIEW
    assert restored.total_event_count == 3
