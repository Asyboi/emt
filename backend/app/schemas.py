from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class EventSource(str, Enum):
    PCR = "pcr"
    VIDEO = "video"
    AUDIO = "audio"
    CAD = "cad"


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


class EventCluster(BaseModel):
    cluster_id: str
    event_ids: list[str]
    centroid_timestamp_seconds: float
    source_types: list[EventSource]


class DiscrepancyType(str, Enum):
    TIMING = "timing"
    CLINICAL = "clinical"
    PHANTOM = "phantom"
    MISSING = "missing"
    NONE = "none"


class ScoredCluster(BaseModel):
    cluster_id: str
    event_ids: list[str]
    centroid_timestamp_seconds: float
    source_types: list[EventSource]
    discrepancy_score: float
    discrepancy_type: DiscrepancyType
    discrepancy_reasoning: str


class DraftTimelineEntry(BaseModel):
    cluster_id: str
    event_ids: list[str]
    canonical_timestamp_seconds: float
    event_type: EventType
    canonical_description: str
    match_confidence: float


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
    RESPONSE_TIME_VIOLATION = "response_time_violation"


class GeoPoint(BaseModel):
    lat: float
    lng: float
    elevation_m: Optional[float] = None


class IncidentDisposition(str, Enum):
    ALS_TRANSPORT = "82"
    BLS_TRANSPORT = "83"
    PRONOUNCED_DEAD = "84"
    UNFOUNDED = "90"
    REFUSED_TREATMENT = "93"
    NOT_TRANSPORTED = "95"
    GONE_ON_ARRIVAL = "96"
    CANCELLED = "97"
    UNKNOWN = "99"


class CADRecord(BaseModel):
    cad_incident_id: str
    incident_datetime: datetime
    initial_call_type: str
    initial_severity_level_code: int
    final_call_type: str
    final_severity_level_code: int
    first_assignment_datetime: datetime
    first_activation_datetime: datetime
    first_on_scene_datetime: datetime
    first_to_hosp_datetime: Optional[datetime] = None
    first_hosp_arrival_datetime: Optional[datetime] = None
    incident_close_datetime: datetime
    dispatch_response_seconds: Optional[int] = None
    incident_response_seconds: Optional[int] = None
    incident_travel_seconds: Optional[int] = None
    incident_disposition_code: IncidentDisposition = IncidentDisposition.UNKNOWN
    borough: Optional[str] = None
    zipcode: Optional[str] = None
    incident_location: Optional[GeoPoint] = None
    protocol_families: list[str] = Field(default_factory=list)


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


class CrewMember(BaseModel):
    role: Literal[
        "primary_paramedic",
        "secondary_paramedic",
        "emt",
        "driver",
        "supervisor",
        "other",
    ]
    identifier: str


class ClinicalAssessmentCategory(str, Enum):
    SCENE_MANAGEMENT = "scene_management"
    INITIAL_ASSESSMENT = "initial_assessment"
    CPR_QUALITY = "cpr_quality"
    AIRWAY_MANAGEMENT = "airway_management"
    VASCULAR_ACCESS = "vascular_access"
    MEDICATIONS = "medications"
    DEFIBRILLATION = "defibrillation"
    MONITORING = "monitoring"
    TRANSPORT_DECISION = "transport_decision"
    HANDOFF = "handoff"


class AssessmentStatus(str, Enum):
    MET = "met"
    NOT_MET = "not_met"
    NOT_APPLICABLE = "not_applicable"
    INSUFFICIENT_DOCUMENTATION = "insufficient_documentation"


class ClinicalAssessmentItem(BaseModel):
    item_id: str
    category: ClinicalAssessmentCategory
    benchmark: str
    status: AssessmentStatus
    notes: str
    evidence_event_ids: list[str] = Field(default_factory=list)


class DocumentationQualityAssessment(BaseModel):
    completeness_score: float
    accuracy_score: float
    narrative_quality_score: float
    issues: list[str] = Field(default_factory=list)


class UtsteinData(BaseModel):
    """Cardiac-arrest-specific data per the 2024 Utstein registry template.

    All fields optional — only present for cardiac arrest cases.
    """

    witnessed: Optional[bool] = None
    bystander_cpr: Optional[bool] = None
    initial_rhythm: Optional[Literal["vf", "vt", "pea", "asystole", "unknown"]] = None
    time_to_cpr_seconds: Optional[float] = None
    time_to_first_defib_seconds: Optional[float] = None
    rosc_achieved: Optional[bool] = None
    time_to_rosc_seconds: Optional[float] = None
    disposition: Optional[
        Literal[
            "rosc_sustained",
            "transport_with_cpr",
            "pronounced_on_scene",
            "transferred_with_rosc",
        ]
    ] = None


class RecommendationAudience(str, Enum):
    CREW = "crew"
    AGENCY = "agency"
    FOLLOW_UP = "follow_up"


class RecommendationPriority(str, Enum):
    INFORMATIONAL = "informational"
    SUGGESTED = "suggested"
    REQUIRED = "required"


class Recommendation(BaseModel):
    recommendation_id: str
    audience: RecommendationAudience
    priority: RecommendationPriority
    description: str
    related_finding_ids: list[str] = Field(default_factory=list)


class ReviewerDetermination(str, Enum):
    NO_ISSUES = "no_issues"
    DOCUMENTATION_CONCERN = "documentation_concern"
    PERFORMANCE_CONCERN = "performance_concern"
    SIGNIFICANT_CONCERN = "significant_concern"
    CRITICAL_EVENT = "critical_event"


class QICaseReview(BaseModel):
    case_id: str
    generated_at: datetime
    reviewer_id: str = "sentinel_agent_v1"

    # Header
    incident_date: datetime
    incident_type: str
    responding_unit: str
    crew_members: list[CrewMember] = Field(default_factory=list)
    patient_age_range: str
    patient_sex: Literal["m", "f", "unknown"]
    chief_complaint: str

    # Body
    incident_summary: str
    timeline: list[TimelineEntry]
    clinical_assessment: list[ClinicalAssessmentItem]
    documentation_quality: DocumentationQualityAssessment
    findings: list[Finding]
    protocol_checks: list[ProtocolCheck]
    adherence_score: float

    # Cardiac-arrest-specific (optional)
    utstein_data: Optional[UtsteinData] = None

    # Closing
    recommendations: list[Recommendation]
    determination: ReviewerDetermination
    determination_rationale: str

    # Human review state
    reviewer_notes: str = ""
    human_reviewed: bool = False

    # CAD enrichment (optional — absent when no cad.json exists for the case)
    cad_record: Optional[CADRecord] = None


class Case(BaseModel):
    case_id: str
    incident_type: str
    incident_date: datetime
    pcr_path: str
    video_path: str
    audio_path: str
    cad_path: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PipelineStage(str, Enum):
    CAD_PARSING = "cad_parsing"
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
