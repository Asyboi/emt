// Shared frontend types for the Sentinel/Calyx UI.
// These describe the shape the UI consumes; remote mode will adapt the backend
// QICaseReview into these shapes.

import type {
  ClinicalAssessmentItem,
  DocumentationQualityAssessment,
  Finding,
  ProtocolCheck,
  Recommendation,
  TimelineEntry,
} from './types/backend';

export type SectionStatus =
  | 'draft'
  | 'edited'
  | 'pending'
  | 'approved'
  | 'needs-revision'
  | 'regenerating';

// Structured payload for a report section. When present, the section renderer
// uses a purpose-built view; when absent, the renderer falls back to the flat
// `content` string. Mock data omits `data`; live data attached by adapters.ts.
export type SectionData =
  | { kind: 'incident-summary'; text: string }
  | { kind: 'timeline'; entries: TimelineEntry[] }
  | { kind: 'doc-quality'; quality: DocumentationQualityAssessment }
  | { kind: 'protocol-checks'; checks: ProtocolCheck[] }
  | { kind: 'clinical-assessment'; items: ClinicalAssessmentItem[] }
  | { kind: 'strengths'; items: ClinicalAssessmentItem[] }
  | { kind: 'findings'; findings: Finding[] }
  | { kind: 'recommendations'; recs: Recommendation[] };

export type AgentStatus = 'complete' | 'active' | 'waiting';

export type ReportLifecycle = 'draft' | 'finalized';

export type TimelineCategory = 'cad' | 'gps' | 'video' | 'pcr' | 'vitals';

export type LogType = 'system' | 'action' | 'reasoning' | 'finding' | 'warning';

export type FindingType = 'success' | 'warning';

export interface ReportSection {
  id: number;
  title: string;
  status: SectionStatus;
  preview: string;
  content: string;
  citations: number[];
  edits?: number;
  feedback?: string;
  data?: SectionData;
}

export interface TimelineEvent {
  time: string;
  label: string;
  category: TimelineCategory;
}

export interface AgentTile {
  id: string;
  shortName: string;
  model?: string;
  rulesBased?: boolean;
  status: AgentStatus;
  statLine?: string;
  progressPct?: string;
}

export interface PipelineFinding {
  type: FindingType;
  message: string;
  sources: string;
}

export interface PipelineLogEntry {
  timestamp: string;
  type: LogType;
  message: string;
}

export interface PcrMetadata {
  incidentNumber: string;
  unit: string;
  crew: string;
  chiefComplaint: string;
}

export interface CadEvent {
  time: string;
  message: string;
}

export interface IncidentSummary {
  id: string;
  date: string;
  crew: string;
  status: ReportLifecycle;
}

export interface IncidentReport {
  id: string;
  date: string;
  time: string;
  crew: string;
  status: ReportLifecycle;
  sections: ReportSection[];
  timelineEvents: TimelineEvent[];
  pcr: PcrMetadata;
  cadLog: CadEvent[];
  pipeline: {
    elapsedSeconds: number;
    progressPct: number;
    agentTiles: AgentTile[];
    findings: PipelineFinding[];
    audioLogs: PipelineLogEntry[];
  };
}
