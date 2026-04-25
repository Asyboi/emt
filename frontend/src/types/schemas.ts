// Mirrors backend/app/schemas.py — keep in sync.

export type EventSource = "pcr" | "video" | "audio";

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
  | "care_gap";

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

export interface AARDraft {
  case_id: string;
  generated_at: string;
  summary: string;
  timeline: TimelineEntry[];
  findings: Finding[];
  protocol_checks: ProtocolCheck[];
  adherence_score: number;
  narrative: string;
  reviewer_notes: string;
}

export interface Case {
  case_id: string;
  incident_type: string;
  incident_date: string;
  pcr_path: string;
  video_path: string;
  audio_path: string;
  metadata: Record<string, unknown>;
}

export type PipelineStage =
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
