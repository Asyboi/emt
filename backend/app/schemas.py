from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class EventSource(str, Enum):
    PCR = "pcr"
    VIDEO = "video"
    AUDIO = "audio"


class EventType(str, Enum):
    MEDICATION = "medication"
    INTERVENTION = "intervention"
    VITAL_SIGNS = "vital_signs"
    RHYTHM_CHECK = "rhythm_check"
    CPR_START = "cpr_start"
    CPR_PAUSE = "cpr_pause"
    DEFIBRILLATION = "defibrillation"
    AIRWAY = "airway"
    IV_ACCESS = "iv_access"
    ARRIVAL = "arrival"
    TRANSPORT_DECISION = "transport_decision"
    PATIENT_RESPONSE = "patient_response"
    OTHER = "other"


class Event(BaseModel):
    event_id: str
    timestamp: str
    timestamp_seconds: float
    source: EventSource
    event_type: EventType
    description: str
    details: dict[str, Any] = Field(default_factory=dict)
    confidence: float
    raw_evidence: str


class TimelineEntry(BaseModel):
    entry_id: str
    canonical_timestamp_seconds: float
    canonical_description: str
    event_type: EventType
    source_events: list[Event]
    match_confidence: float
    has_discrepancy: bool


class ProtocolStep(BaseModel):
    step_id: str
    description: str
    expected_timing_seconds: Optional[float] = None
    required: bool


class ProtocolCheckStatus(str, Enum):
    ADHERENT = "adherent"
    DEVIATION = "deviation"
    NOT_APPLICABLE = "not_applicable"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class ProtocolCheck(BaseModel):
    check_id: str
    protocol_step: ProtocolStep
    status: ProtocolCheckStatus
    evidence_event_ids: list[str]
    explanation: str


class FindingSeverity(str, Enum):
    INFO = "info"
    CONCERN = "concern"
    CRITICAL = "critical"


class FindingCategory(str, Enum):
    TIMING_DISCREPANCY = "timing_discrepancy"
    MISSING_DOCUMENTATION = "missing_documentation"
    PHANTOM_INTERVENTION = "phantom_intervention"
    PROTOCOL_DEVIATION = "protocol_deviation"
    CARE_GAP = "care_gap"


class Finding(BaseModel):
    finding_id: str
    severity: FindingSeverity
    category: FindingCategory
    title: str
    explanation: str
    evidence_event_ids: list[str]
    evidence_timestamp_seconds: float
    pcr_excerpt: Optional[str] = None
    suggested_review_action: str


class AARDraft(BaseModel):
    case_id: str
    generated_at: datetime
    summary: str
    timeline: list[TimelineEntry]
    findings: list[Finding]
    protocol_checks: list[ProtocolCheck]
    adherence_score: float
    narrative: str
    reviewer_notes: str = ""


class Case(BaseModel):
    case_id: str
    incident_type: str
    incident_date: datetime
    pcr_path: str
    video_path: str
    audio_path: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class PipelineStage(str, Enum):
    PCR_PARSING = "pcr_parsing"
    VIDEO_ANALYSIS = "video_analysis"
    AUDIO_ANALYSIS = "audio_analysis"
    RECONCILIATION = "reconciliation"
    PROTOCOL_CHECK = "protocol_check"
    FINDINGS = "findings"
    DRAFTING = "drafting"


class PipelineProgress(BaseModel):
    stage: PipelineStage
    status: Literal["pending", "running", "complete", "error"]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
