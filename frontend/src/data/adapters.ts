// Adapt backend QICaseReview/Case shapes into the UI's IncidentReport/IncidentSummary
// shapes consumed by the existing components. The UI never reads raw backend
// JSON — every payload that crosses the API boundary passes through here.

import type {
  CADRecord,
  Case,
  ClinicalAssessmentItem,
  Finding,
  QICaseReview,
  Recommendation,
  TimelineEntry,
} from '../types/backend';
import type {
  CadEvent,
  IncidentReport,
  IncidentSummary,
  PipelineFinding,
  ReportSection,
  TimelineCategory,
  TimelineEvent,
} from '../types';

// ---------- formatting helpers ----------

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}

function formatHhMmSsFromIso(iso: string): string {
  // ISO format: "2026-04-24T14:32:00Z" — UTC slice avoids local-tz drift.
  return iso.slice(11, 19);
}

function preview(content: string): string {
  return content.length <= 200 ? content : content.slice(0, 200);
}

// ---------- section content builders ----------

function buildIncidentSummary(review: QICaseReview): string {
  return review.incident_summary;
}

function buildTimelineSection(timeline: TimelineEntry[]): string {
  return timeline
    .map((entry) => {
      const ts = formatMmSs(entry.canonical_timestamp_seconds);
      const flag = entry.has_discrepancy ? ' [discrepancy noted]' : '';
      return `${ts} — ${entry.canonical_description}${flag}`;
    })
    .join('\n\n');
}

function buildDocumentationCheck(review: QICaseReview): string {
  const dq = review.documentation_quality;
  const header = `Completeness: ${dq.completeness_score}, Accuracy: ${dq.accuracy_score}, Narrative: ${dq.narrative_quality_score}`;
  if (dq.issues.length === 0) {
    return `${header}\n\nNo issues recorded.`;
  }
  const bullets = dq.issues.map((i) => `- ${i}`).join('\n');
  return `${header}\n\n${bullets}`;
}

function buildProtocolCompliance(review: QICaseReview): string {
  if (review.protocol_checks.length === 0) return 'No protocol checks recorded.';
  return review.protocol_checks
    .map((c) => `Step: ${c.protocol_step.description} — ${c.status}: ${c.explanation}`)
    .join('\n\n');
}

function renderAssessmentItem(item: ClinicalAssessmentItem): string {
  return `${item.benchmark} — ${item.status}: ${item.notes}`;
}

function buildKeyDecisions(items: ClinicalAssessmentItem[]): string {
  const filtered = items.filter((i) => i.status !== 'not_applicable');
  if (filtered.length === 0) return 'No key clinical decisions recorded.';
  return filtered.map(renderAssessmentItem).join('\n\n');
}

function buildSceneAndHandoff(items: ClinicalAssessmentItem[]): string {
  const filtered = items.filter(
    (i) => i.category === 'scene_management' || i.category === 'handoff',
  );
  if (filtered.length === 0) return 'No scene-management or handoff items recorded.';
  return filtered.map(renderAssessmentItem).join('\n\n');
}

function buildStrengths(items: ClinicalAssessmentItem[]): string {
  const filtered = items.filter((i) => i.status === 'met');
  if (filtered.length === 0) return 'No strengths recorded.';
  return filtered.map((i) => `- ${i.benchmark}: ${i.notes}`).join('\n');
}

function buildAreasForImprovement(findings: Finding[]): string {
  const filtered = findings.filter(
    (f) => f.severity === 'concern' || f.severity === 'critical',
  );
  if (filtered.length === 0) return 'No areas for improvement identified.';
  return filtered.map((f) => `${f.title}: ${f.explanation}`).join('\n\n');
}

function buildRecommendations(recs: Recommendation[]): string {
  if (recs.length === 0) return 'No recommendations.';
  const groups: Record<string, Recommendation[]> = {};
  recs.forEach((r) => {
    (groups[r.audience] ??= []).push(r);
  });
  return Object.entries(groups)
    .map(([audience, items]) => {
      const lines = items.map((r) => `[${r.priority}] ${r.description}`).join('\n');
      return `${audience.toUpperCase()}\n${lines}`;
    })
    .join('\n\n');
}

function buildSections(review: QICaseReview): ReportSection[] {
  const specs: { id: number; title: string; content: string }[] = [
    { id: 1, title: 'INCIDENT SUMMARY', content: buildIncidentSummary(review) },
    { id: 2, title: 'TIMELINE RECONSTRUCTION', content: buildTimelineSection(review.timeline) },
    { id: 3, title: 'PCR DOCUMENTATION CHECK', content: buildDocumentationCheck(review) },
    { id: 4, title: 'PROTOCOL COMPLIANCE REVIEW', content: buildProtocolCompliance(review) },
    { id: 5, title: 'KEY CLINICAL DECISIONS', content: buildKeyDecisions(review.clinical_assessment) },
    { id: 6, title: 'COMMUNICATION / SCENE MANAGEMENT', content: buildSceneAndHandoff(review.clinical_assessment) },
    { id: 7, title: 'STRENGTHS', content: buildStrengths(review.clinical_assessment) },
    { id: 8, title: 'AREAS FOR IMPROVEMENT', content: buildAreasForImprovement(review.findings) },
    { id: 9, title: 'RECOMMENDED FOLLOW-UP', content: buildRecommendations(review.recommendations) },
  ];

  return specs.map((s) => ({
    id: s.id,
    title: s.title,
    status: 'draft',
    content: s.content,
    preview: preview(s.content),
    citations: [],
  }));
}

// ---------- timeline events ----------

function categoryFor(entry: TimelineEntry): TimelineCategory {
  if (entry.event_type === 'arrival' || entry.event_type === 'transport_decision') {
    return 'cad';
  }
  if (entry.event_type === 'vital_signs' || entry.event_type === 'rhythm_check') {
    return 'vitals';
  }
  const primarySource = entry.source_events[0]?.source;
  if (primarySource === 'video') return 'video';
  if (primarySource === 'pcr') return 'pcr';
  return 'pcr';
}

function buildTimelineEvents(timeline: TimelineEntry[]): TimelineEvent[] {
  return timeline.map((entry) => ({
    time: formatMmSs(entry.canonical_timestamp_seconds),
    label: entry.canonical_description,
    category: categoryFor(entry),
  }));
}

// ---------- cad log ----------

function buildCadLog(cad: CADRecord | null): CadEvent[] {
  if (!cad) return [];
  const events: CadEvent[] = [
    {
      time: formatHhMmSsFromIso(cad.incident_datetime),
      message: `INCIDENT CREATED — ${cad.initial_call_type}`,
    },
    { time: formatHhMmSsFromIso(cad.first_assignment_datetime), message: 'UNIT ASSIGNED' },
    { time: formatHhMmSsFromIso(cad.first_activation_datetime), message: 'UNIT ACTIVATED' },
    { time: formatHhMmSsFromIso(cad.first_on_scene_datetime), message: 'ON SCENE' },
  ];
  if (cad.first_to_hosp_datetime) {
    events.push({
      time: formatHhMmSsFromIso(cad.first_to_hosp_datetime),
      message: 'EN ROUTE TO HOSPITAL',
    });
  }
  if (cad.first_hosp_arrival_datetime) {
    events.push({
      time: formatHhMmSsFromIso(cad.first_hosp_arrival_datetime),
      message: 'ARRIVED AT HOSPITAL',
    });
  }
  events.push({
    time: formatHhMmSsFromIso(cad.incident_close_datetime),
    message: 'INCIDENT CLOSED',
  });
  return events;
}

// ---------- pipeline scaffold ----------

function mapFindingsToPipeline(findings: Finding[]): PipelineFinding[] {
  return findings.map((f) => ({
    type: f.severity === 'info' ? 'success' : 'warning',
    message: `${f.title}: ${f.explanation}`,
    sources: f.evidence_event_ids.join(', '),
  }));
}

// ---------- public API ----------

export function adaptReview(review: QICaseReview): IncidentReport {
  const crewIdentifiers = review.crew_members.map((m) => m.identifier).join(', ');
  return {
    id: review.case_id,
    date: review.incident_date.slice(0, 10),
    time: review.incident_date.slice(11, 16),
    crew: `${review.responding_unit} / ${crewIdentifiers}`,
    status: review.human_reviewed ? 'finalized' : 'draft',
    sections: buildSections(review),
    timelineEvents: buildTimelineEvents(review.timeline),
    pcr: {
      incidentNumber: review.case_id,
      unit: review.responding_unit,
      crew: crewIdentifiers,
      chiefComplaint: review.chief_complaint,
    },
    cadLog: buildCadLog(review.cad_record),
    pipeline: {
      elapsedSeconds: 0,
      progressPct: 100,
      agentTiles: [],
      findings: mapFindingsToPipeline(review.findings),
      audioLogs: [],
    },
  };
}

export function adaptCaseToSummary(c: Case, hasReview: boolean): IncidentSummary {
  return {
    id: c.case_id,
    date: c.incident_date.slice(0, 10),
    crew: c.case_id,
    status: hasReview ? 'finalized' : 'draft',
  };
}
