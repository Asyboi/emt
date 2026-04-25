// Mirrors backend/app/schemas.py — keep in sync. Updated to QICaseReview structure.

export type EventSource = "pcr" | "video" | "audio" | "cad";

export type EventType =
  | "medication"
  | "intervention"
  | "vital_signs"
  | "rhythm_check"
  | "cpr_start"
  | "cpr_pause"
  | "defibrillation"
  | "airway"
  | "iv_access"
  | "arrival"
  | "transport_decision"
  | "patient_response"
  | "other";

export interface Event {
  event_id: string;
  timestamp: string;
  timestamp_seconds: number;
  source: EventSource;
  event_type: EventType;
  description: string;
  details: Record<string, unknown>;
  confidence: number;
  raw_evidence: string;
}

export interface TimelineEntry {
  entry_id: string;
  canonical_timestamp_seconds: number;
  canonical_description: string;
  event_type: EventType;
  source_events: Event[];
  match_confidence: number;
  has_discrepancy: boolean;
}

export interface ProtocolStep {
  step_id: string;
  description: string;
  expected_timing_seconds: number | null;
  required: boolean;
}

export type ProtocolCheckStatus =
  | "adherent"
  | "deviation"
  | "not_applicable"
  | "insufficient_evidence";

export interface ProtocolCheck {
  check_id: string;
  protocol_step: ProtocolStep;
  status: ProtocolCheckStatus;
  evidence_event_ids: string[];
  explanation: string;
}

export type FindingSeverity = "info" | "concern" | "critical";

export type FindingCategory =
  | "timing_discrepancy"
  | "missing_documentation"
  | "phantom_intervention"
  | "protocol_deviation"
  | "care_gap"
  | "response_time_violation";

export interface Finding {
  finding_id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  explanation: string;
  evidence_event_ids: string[];
  evidence_timestamp_seconds: number;
  pcr_excerpt: string | null;
  suggested_review_action: string;
}

export type CrewRole =
  | "primary_paramedic"
  | "secondary_paramedic"
  | "emt"
  | "driver"
  | "supervisor"
  | "other";

export interface CrewMember {
  role: CrewRole;
  identifier: string;
}

export type ClinicalAssessmentCategory =
  | "scene_management"
  | "initial_assessment"
  | "cpr_quality"
  | "airway_management"
  | "vascular_access"
  | "medications"
  | "defibrillation"
  | "monitoring"
  | "transport_decision"
  | "handoff";

export type AssessmentStatus =
  | "met"
  | "not_met"
  | "not_applicable"
  | "insufficient_documentation";

export interface ClinicalAssessmentItem {
  item_id: string;
  category: ClinicalAssessmentCategory;
  benchmark: string;
  status: AssessmentStatus;
  notes: string;
  evidence_event_ids: string[];
}

export interface DocumentationQualityAssessment {
  completeness_score: number;
  accuracy_score: number;
  narrative_quality_score: number;
  issues: string[];
}

export type UtsteinInitialRhythm = "vf" | "vt" | "pea" | "asystole" | "unknown";

export type UtsteinDisposition =
  | "rosc_sustained"
  | "transport_with_cpr"
  | "pronounced_on_scene"
  | "transferred_with_rosc";

export interface UtsteinData {
  witnessed: boolean | null;
  bystander_cpr: boolean | null;
  initial_rhythm: UtsteinInitialRhythm | null;
  time_to_cpr_seconds: number | null;
  time_to_first_defib_seconds: number | null;
  rosc_achieved: boolean | null;
  time_to_rosc_seconds: number | null;
  disposition: UtsteinDisposition | null;
}

export type RecommendationAudience = "crew" | "agency" | "follow_up";

export type RecommendationPriority = "informational" | "suggested" | "required";

export interface Recommendation {
  recommendation_id: string;
  audience: RecommendationAudience;
  priority: RecommendationPriority;
  description: string;
  related_finding_ids: string[];
}

export type ReviewerDetermination =
  | "no_issues"
  | "documentation_concern"
  | "performance_concern"
  | "significant_concern"
  | "critical_event";

export type PatientSex = "m" | "f" | "unknown";

export interface GeoPoint {
  lat: number;
  lng: number;
  elevation_m?: number;
}

export type IncidentDisposition =
  | "82" | "83" | "84" | "90" | "93" | "95" | "96" | "97" | "99";

export interface CADRecord {
  cad_incident_id: string;
  incident_datetime: string;
  initial_call_type: string;
  initial_severity_level_code: number;
  final_call_type: string;
  final_severity_level_code: number;
  first_assignment_datetime: string;
  first_activation_datetime: string;
  first_on_scene_datetime: string;
  first_to_hosp_datetime?: string;
  first_hosp_arrival_datetime?: string;
  incident_close_datetime: string;
  dispatch_response_seconds?: number;
  incident_response_seconds?: number;
  incident_travel_seconds?: number;
  incident_disposition_code: IncidentDisposition;
  borough?: string;
  zipcode?: string;
  incident_location?: GeoPoint;
  protocol_families: string[];
}

export interface QICaseReview {
  case_id: string;
  generated_at: string;
  reviewer_id: string;

  incident_date: string;
  incident_type: string;
  responding_unit: string;
  crew_members: CrewMember[];
  patient_age_range: string;
  patient_sex: PatientSex;
  chief_complaint: string;

  incident_summary: string;
  timeline: TimelineEntry[];
  clinical_assessment: ClinicalAssessmentItem[];
  documentation_quality: DocumentationQualityAssessment;
  findings: Finding[];
  protocol_checks: ProtocolCheck[];
  adherence_score: number;

  utstein_data: UtsteinData | null;

  recommendations: Recommendation[];
  determination: ReviewerDetermination;
  determination_rationale: string;

  reviewer_notes: string;
  human_reviewed: boolean;

  cad_record?: CADRecord;
}

export interface Case {
  case_id: string;
  incident_type: string;
  incident_date: string;
  pcr_path: string;
  video_path: string;
  audio_path: string;
  cad_path?: string;
  metadata: Record<string, unknown>;
}

export type PipelineStage =
  | "cad_parsing"
  | "pcr_parsing"
  | "video_analysis"
  | "audio_analysis"
  | "reconciliation"
  | "protocol_check"
  | "findings"
  | "drafting";

export type PipelineStatus = "pending" | "running" | "complete" | "error";

export interface PipelineProgress {
  stage: PipelineStage;
  status: PipelineStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}
