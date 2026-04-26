import type { PCRDraft } from '../types/backend';

// A reasonably rich mock PCR template — matches the [UNCONFIRMED] highlight
// pattern and the section structure parsed by lib/pcr-highlight.ts.
const TEMPLATE = `============================================================
AGENCY / UNIT INFORMATION
============================================================
Agency:           [UNCONFIRMED]
Unit ID:          MEDIC-12
Crew:             J. Rivera (paramedic), K. Choi (EMT)

============================================================
DISPATCH INFORMATION
============================================================
CAD Incident #:   2026-04-25-0142
Call Type:        CARDIAC ARREST
Dispatch Time:    14:08:32
On Scene Time:    14:14:11
Patient Contact:  14:14:55

============================================================
PATIENT DEMOGRAPHICS
============================================================
Age:              [UNCONFIRMED]
Sex:              M
Chief Complaint:  Witnessed collapse, unresponsive, no pulse

============================================================
INITIAL ASSESSMENT
============================================================
Found patient supine on living-room floor. Bystander CPR in
progress. Patient unresponsive, apneic, no carotid pulse.
Skin pale and diaphoretic. Initial rhythm on monitor:
[UNCONFIRMED] (interpreted as VF on second look at 14:15:42).

============================================================
INTERVENTIONS PERFORMED
============================================================
14:15:10  CPR taken over by crew, high-quality compressions
14:15:42  Defibrillation attempt #1 — 200 J biphasic
14:17:15  IV access established, left AC, 18g
14:17:48  Epinephrine 1 mg IV/IO push
14:19:30  Defibrillation attempt #2 — [UNCONFIRMED] J biphasic
14:21:05  Amiodarone 300 mg IV bolus

============================================================
RESPONSE / DISPOSITION
============================================================
ROSC achieved at:  [UNCONFIRMED]
Transport to:      Mt. Sinai West
Patient handoff:   14:38:20, ED bed 4

============================================================
NARRATIVE
============================================================
Crew responded to a witnessed cardiac arrest. Bystander CPR
was in progress on arrival. ALS care initiated immediately
per ACLS algorithm. Patient was defibrillated twice and
received epinephrine and amiodarone per protocol. ROSC was
achieved en route. Patient was transferred to ED with
sustained pulse and spontaneous respirations.
`;

const TEMPLATE_UNCONFIRMED_COUNT = (TEMPLATE.match(/\[UNCONFIRMED\]/g) ?? []).length;

interface MockPcrOpts {
  confirmed?: boolean;
  generatedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  edits?: boolean;
}

export function buildMockPcrDraft(caseId: string, opts: MockPcrOpts = {}): PCRDraft {
  const confirmed = opts.confirmed ?? false;
  return {
    case_id: caseId,
    generated_at: opts.generatedAt ?? new Date('2026-04-25T15:30:00Z').toISOString(),
    status: confirmed ? 'confirmed' : 'pending_review',
    video_event_count: 12,
    audio_event_count: 8,
    total_event_count: 20,
    draft_markdown: TEMPLATE,
    unconfirmed_count: TEMPLATE_UNCONFIRMED_COUNT,
    confirmed_by: confirmed ? (opts.confirmedBy ?? 'demo-emt') : null,
    confirmed_at: confirmed ? (opts.confirmedAt ?? new Date('2026-04-25T15:42:00Z').toISOString()) : null,
    emt_edits_made: opts.edits ?? false,
    error: null,
  };
}

// Saved-PCR list shown on the Archive page and the New-Report saved-PCR picker.
// Spread across multiple cases so the dropdowns aren't single-item.
export const mockSavedPcrs: PCRDraft[] = [
  buildMockPcrDraft('case_01', {
    confirmed: true,
    generatedAt: '2026-04-25T15:30:00Z',
    confirmedAt: '2026-04-25T15:42:00Z',
    confirmedBy: 'j.rivera',
  }),
  buildMockPcrDraft('case_03', {
    confirmed: true,
    generatedAt: '2026-04-23T09:12:00Z',
    confirmedAt: '2026-04-23T09:31:00Z',
    confirmedBy: 'k.choi',
    edits: true,
  }),
  buildMockPcrDraft('case_05', {
    confirmed: true,
    generatedAt: '2026-04-19T22:04:00Z',
    confirmedAt: '2026-04-19T22:18:00Z',
    confirmedBy: 'm.tanaka',
  }),
];

const savedById = new Map(mockSavedPcrs.map((p) => [p.case_id, p]));

// Resolve a draft for the given case ID. Saved cases return their confirmed
// draft; unknown cases return a fresh pending-review draft re-keyed against
// the requested ID.
export function resolveMockPcrDraft(caseId: string): PCRDraft {
  return savedById.get(caseId) ?? buildMockPcrDraft(caseId);
}
