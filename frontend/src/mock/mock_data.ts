import type {
  AgentTile,
  CadEvent,
  IncidentReport,
  IncidentSummary,
  PcrMetadata,
  PipelineFinding,
  PipelineLogEntry,
  ReportSection,
  TimelineEvent,
} from '../types';

const PRIMARY_INCIDENT_ID = 'INC-2026-04-0231';

const sections: ReportSection[] = [
  {
    id: 1,
    title: 'INCIDENT SUMMARY',
    status: 'pending',
    preview:
      'OHCA arrest of 67-year-old male at residential address. Initial rhythm VF, converted to NSR after single defibrillation...',
    content:
      'OHCA arrest of 67-year-old male at residential address. Initial rhythm VF, converted to NSR after single defibrillation at 200J. ROSC achieved at 14:38, 6 minutes post-arrest. Patient transported to Regional Medical Center with ongoing ventilatory support and hemodynamic monitoring.',
    citations: [1, 2, 4],
    edits: 3,
  },
  {
    id: 2,
    title: 'TIMELINE RECONSTRUCTION',
    status: 'pending',
    preview:
      '14:32 — Dispatch received for cardiac arrest at 1247 Maple Ave. 14:33 — Unit M-7 en route. 14:36 — Arrival on scene...',
    content:
      '14:32 — Dispatch received for cardiac arrest at 1247 Maple Ave. 14:33 — Unit M-7 en route. 14:36 — Arrival on scene. Initial assessment shows unresponsive male, no pulse, no respirations. CPR initiated, AED applied at 14:36:42. VF identified, single shock delivered at 14:37:08 (200J). ROSC at 14:38:11, BP 98/64. Transport begun 14:42, arrival Regional MC 14:48.',
    citations: [1, 2, 3],
    edits: 1,
  },
  {
    id: 3,
    title: 'PCR DOCUMENTATION CHECK',
    status: 'pending',
    preview:
      'All required PCR fields completed. Patient demographics verified. Chief complaint documented as cardiac arrest...',
    content:
      'All required PCR fields completed. Patient demographics verified. Chief complaint documented as cardiac arrest. Vital signs documented at appropriate intervals (4 sets pre-ROSC, 3 post-ROSC). One discrepancy flagged: PCR records 2 IV access attempts; bodycam audio suggests 3 — recommend reconciliation against crew memory.',
    citations: [1, 4],
  },
  {
    id: 4,
    title: 'PROTOCOL COMPLIANCE REVIEW',
    status: 'pending',
    preview:
      'Crew followed ACLS cardiac arrest protocol. Defibrillation delivered within appropriate timeframe. Medication administration...',
    content:
      'Crew followed ACLS cardiac arrest protocol. Defibrillation delivered within appropriate timeframe (90s from rhythm recognition). Medication administration documented per protocol — epinephrine 1mg IV at 14:37:14, appropriate for refractory VF. No protocol deviations identified.',
    citations: [2, 3],
    edits: 2,
  },
  {
    id: 5,
    title: 'KEY CLINICAL DECISIONS',
    status: 'needs-revision',
    preview:
      'Decision to administer epinephrine at 14:37 appropriate given patient presentation. Single defibrillation strategy...',
    content:
      'Decision to administer epinephrine at 14:37 appropriate given patient presentation. Single defibrillation strategy effective in achieving ROSC without need for repeated shocks. Decision to defer advanced airway in favor of high-quality BVM ventilation supported by short transport time.',
    citations: [2, 3],
    feedback:
      "Epinephrine timing doesn't match CAD timestamp — verify against unit M-7 dispatch log",
  },
  {
    id: 6,
    title: 'COMMUNICATION / SCENE MANAGEMENT',
    status: 'pending',
    preview:
      'Effective crew coordination evident. Clear role assignment. Communication with dispatch maintained throughout...',
    content:
      'Effective crew coordination evident. Clear role assignment between Rodriguez (airway/BVM) and Chen (compressions/medications). Communication with dispatch maintained throughout incident; receiving facility notified at 14:42 with patient status update.',
    citations: [4],
  },
  {
    id: 7,
    title: 'STRENGTHS',
    status: 'pending',
    preview:
      'Rapid response time (4 minutes from dispatch to on-scene). Immediate initiation of high-quality CPR. Appropriate rhythm...',
    content:
      'Rapid response time (4 minutes from dispatch to on-scene). Immediate initiation of high-quality CPR. Appropriate rhythm recognition and prompt defibrillation. Single-shock conversion to NSR. Calm, methodical scene management throughout.',
    citations: [1, 2],
    edits: 1,
  },
  {
    id: 8,
    title: 'AREAS FOR IMPROVEMENT',
    status: 'pending',
    preview:
      'Documentation of initial rhythm interpretation could be more detailed. Consider earlier notification to receiving facility...',
    content:
      'Documentation of initial rhythm interpretation could be more detailed (specify rate, amplitude). Consider earlier notification to receiving facility — current notification at 14:42 leaves limited prep time. IV access attempt count in PCR should match audio narrative.',
    citations: [1, 4],
  },
  {
    id: 9,
    title: 'RECOMMENDED FOLLOW-UP',
    status: 'pending',
    preview:
      'Recommend crew debrief within 48 hours. Consider case review at next QI meeting. Follow up on patient outcome...',
    content:
      'Recommend crew debrief within 48 hours. Consider case review at next QI meeting given the successful single-shock ROSC. Follow up on patient outcome with receiving facility (neurologic status at discharge).',
    citations: [],
  },
];

const timelineEvents: TimelineEvent[] = [
  { time: '14:32', label: 'DISPATCH / CARDIAC ARREST', category: 'cad' },
  { time: '14:33', label: 'EN ROUTE M-7', category: 'gps' },
  { time: '14:36', label: 'ON SCENE', category: 'gps' },
  { time: '14:37', label: 'INITIAL RHYTHM VF', category: 'pcr' },
  { time: '14:37', label: 'DEFIB 200J', category: 'pcr' },
  { time: '14:38', label: 'ROSC ACHIEVED', category: 'pcr' },
  { time: '14:38', label: 'BP 98/64', category: 'vitals' },
  { time: '14:42', label: 'TRANSPORTING', category: 'gps' },
  { time: '14:48', label: 'ARRIVAL REGIONAL MC', category: 'cad' },
];

const pcr: PcrMetadata = {
  incidentNumber: '2026-041201',
  unit: 'M-7',
  crew: 'RODRIGUEZ, CHEN',
  chiefComplaint: 'CARDIAC ARREST',
};

const cadLog: CadEvent[] = [
  { time: '14:32:18', message: 'DISPATCH M-7 / CARDIAC ARREST / 1247 MAPLE AVE' },
  { time: '14:33:42', message: 'M-7 EN ROUTE' },
  { time: '14:36:01', message: 'M-7 ON SCENE' },
  { time: '14:42:30', message: 'M-7 TRANSPORTING' },
  { time: '14:48:11', message: 'M-7 ARRIVAL REGIONAL MC' },
];

const agentTiles: AgentTile[] = [
  {
    id: 'cluster',
    shortName: 'CLUSTER EVENTS',
    model: 'Haiku 4.5',
    status: 'complete',
    statLine: '12 event clusters',
  },
  {
    id: 'score',
    shortName: 'SCORE DISCREPANCIES',
    rulesBased: true,
    status: 'complete',
    statLine: '3 flags · 1 gap',
  },
  {
    id: 'canonical',
    shortName: 'BUILD CANONICAL',
    model: 'Haiku 4.5',
    status: 'active',
    statLine: '7/12 entries built',
    progressPct: '58%',
  },
  {
    id: 'critique',
    shortName: 'CRITIQUE TIMELINE',
    model: 'Sonnet 4.6',
    status: 'waiting',
    statLine: 'Confidence scoring',
  },
];

const findings: PipelineFinding[] = [
  {
    type: 'success',
    message: 'Response time 3m 47s — within standard threshold',
    sources: 'CAD + ePCR',
  },
  {
    type: 'success',
    message: 'Defibrillation timing matches ePCR ±1s drift',
    sources: 'ePCR + AUDIO',
  },
  {
    type: 'warning',
    message: 'IV access attempts: PCR says 2, audio suggests 3 — flagged for review',
    sources: 'ePCR + AUDIO',
  },
  {
    type: 'success',
    message: 'Epinephrine appropriate for refractory VF',
    sources: 'ePCR + PROTOCOL',
  },
];

const audioLogs: PipelineLogEntry[] = [
  { timestamp: '00:00:20', type: 'system', message: 'Loading audio extraction pipeline' },
  {
    timestamp: '00:00:21',
    type: 'action',
    message: '→ Processing BODYCAM-01.mp4 (1.2 GB) — audio track only',
  },
  { timestamp: '00:00:22', type: 'system', message: 'Extracting audio stream (AAC 48 kHz stereo)' },
  {
    timestamp: '00:00:35',
    type: 'action',
    message: '→ Running speech-to-text inference (Whisper large-v3)',
  },
  {
    timestamp: '00:00:52',
    type: 'finding',
    message: '✓ Audio transcript extracted: 8m 14s of crew communication',
  },
  {
    timestamp: '00:01:04',
    type: 'action',
    message: '→ Identifying clinical keywords and intervention timestamps',
  },
  {
    timestamp: '00:01:12',
    type: 'finding',
    message:
      '✓ Detected: "VF rhythm" (14:37:02), "shock delivered" (14:37:08), "ROSC" (14:38:11)',
  },
  {
    timestamp: '00:01:23',
    type: 'reasoning',
    message: '> Audio 14:37:08 aligns with ePCR log (14:37:09) — 1s drift, acceptable',
  },
  {
    timestamp: '00:01:34',
    type: 'warning',
    message: '! PCR says "two attempts" at IV access; audio suggests three — flagging',
  },
  {
    timestamp: '00:01:45',
    type: 'reasoning',
    message: '> 3 candidate ROSC windows; cross-checking against vital signs',
  },
  {
    timestamp: '00:01:47',
    type: 'action',
    message: '→ Processing BODYCAM-02.mp4 (980 MB) — audio track only',
  },
];

const primaryReport: IncidentReport = {
  id: PRIMARY_INCIDENT_ID,
  date: '2026-04-12',
  time: '14:32',
  crew: 'M-7 / RODRIGUEZ, CHEN',
  status: 'draft',
  sections,
  timelineEvents,
  pcr,
  cadLog,
  pipeline: {
    elapsedSeconds: 107,
    progressPct: 55,
    agentTiles,
    findings,
    audioLogs,
  },
};

export const mockIncidentList: IncidentSummary[] = [
  { id: 'INC-2026-04-0231', date: '2026-04-12', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'finalized' },
  { id: 'INC-2026-04-0228', date: '2026-04-11', crew: 'M-3 / WILLIAMS, KIM', status: 'finalized' },
  { id: 'INC-2026-04-0224', date: '2026-04-10', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'draft' },
  { id: 'INC-2026-04-0219', date: '2026-04-09', crew: 'M-5 / MARTINEZ, PATEL', status: 'finalized' },
  { id: 'INC-2026-04-0215', date: '2026-04-08', crew: 'M-3 / WILLIAMS, KIM', status: 'finalized' },
  { id: 'INC-2026-04-0211', date: '2026-04-07', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'finalized' },
  { id: 'INC-2026-04-0207', date: '2026-04-06', crew: 'M-4 / THOMPSON, LEE', status: 'finalized' },
  { id: 'INC-2026-04-0203', date: '2026-04-05', crew: 'M-5 / MARTINEZ, PATEL', status: 'draft' },
  { id: 'INC-2026-04-0198', date: '2026-04-04', crew: 'M-3 / WILLIAMS, KIM', status: 'finalized' },
  { id: 'INC-2026-04-0194', date: '2026-04-03', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'finalized' },
];

export const mockIncidents: Record<string, IncidentReport> = {
  [PRIMARY_INCIDENT_ID]: primaryReport,
};

export const PRIMARY_MOCK_INCIDENT_ID = PRIMARY_INCIDENT_ID;

// For unknown incident IDs in local mode we synthesize a report by re-keying
// the primary fixture against the requested ID, so every entry in the archive
// is browseable end-to-end.
export function buildMockReport(id: string): IncidentReport {
  if (mockIncidents[id]) return mockIncidents[id];

  const summary = mockIncidentList.find((s) => s.id === id);
  return {
    ...primaryReport,
    id,
    date: summary?.date ?? primaryReport.date,
    crew: summary?.crew ?? primaryReport.crew,
    status: summary?.status ?? primaryReport.status,
  };
}
