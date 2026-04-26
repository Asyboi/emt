# Wire Calyx Frontend to Sentinel Backend — Full Integration

## Context

Read these files before writing any code:

```
docs/INTEGRATION_AUDIT.md
docs/COMPONENT_AUDIT.md
docs/BACKEND_AUDIT.md
docs/PROGRESS.md
docs/PLAN.md
backend/app/schemas.py
backend/app/api/pipeline.py
backend/app/api/cases.py
backend/app/case_loader.py
backend/app/config.py
backend/app/main.py
frontend/src/types.ts
frontend/src/data/source.ts
frontend/src/data/hooks.ts
frontend/src/mock/mock_data.ts
frontend/src/app/pages/processing.tsx
frontend/src/app/pages/dashboard.tsx
frontend/src/app/pages/new-report.tsx
frontend/src/app/pages/review.tsx
frontend/src/app/pages/archive.tsx
frontend/src/app/routes.tsx
frontend/vite.config.ts
```

## Design decisions (locked — do not deviate)

1. **IDs:** Backend `case_id` values (`case_01`, `case_02`, etc.) are the canonical IDs everywhere. The frontend drops the `INC-2026-04-...` scheme entirely. Update `mockIncidentList`, route params, and all UI references. The mock data should use `case_01` as the primary fixture ID.

2. **Processing page tile layout:** 8 data-driven cards in two rows, mapping 1:1 to backend `PipelineStage` values:
   - **Row 1 (parallel extraction):** CAD SYNC (`cad_parsing`), ePCR PARSER (`pcr_parsing`), VIDEO ANALYSIS (`video_analysis`), AUDIO ANALYSIS (`audio_analysis`)
   - **Row 2 (sequential):** RECONCILIATION (`reconciliation`), PROTOCOL CHECK (`protocol_check`), FINDINGS (`findings`), REPORT DRAFTER (`drafting`)
   - All 8 cards are data-driven from SSE `progress` events, not hardcoded JSX. Each card shows the stage name, a status indicator (waiting/active/complete/error), and elapsed time once started.
   - The RECONCILIATION card still contains 3 sub-tiles inside it: CLUSTER EVENTS, REVIEW CLUSTERS, CRITIQUE TIMELINE (matching the real 3-agent chain in `reconciliation.py`). For now these animate on a timed sequence when `reconciliation: running` arrives from SSE (we will add sub-stage SSE events later). Keep the sub-tile shape (`AgentTile`) and the `SubTile` component.

3. **`/new-report` gets fully wired** to upload files and start the pipeline. This requires a new backend endpoint (see Step 1).

4. **Local mock data stays functional.** `?local` URL param or `VITE_DATA_SOURCE=local` must still work with updated mock data. The mock IDs change to `case_01` etc. but the shapes stay the same.

---

## Step 1 — Backend: add case-creation endpoint + fix CORS

### 1a. `POST /api/cases` — create a case from uploaded files

File: `backend/app/api/cases.py`

Add a new endpoint that accepts multipart file uploads and creates a case directory:

```
POST /api/cases
Content-Type: multipart/form-data

Fields:
  - title: str (optional, stored in metadata)
  - epcr: UploadedFile (required, .pdf or .xml — save as pcr_source.pdf/.xml)
  - cad: UploadedFile (optional, save as cad.json)
  - videos: list[UploadedFile] (optional, save first as video.mp4)

Response: 201, body = Case JSON
```

Implementation:
- Generate a case_id: `case_{NNNN}` where NNNN is zero-padded next available (scan existing dirs).
- Create `cases/{case_id}/` directory.
- Save uploaded files into it with the names the pipeline expects (`cad.json`, `video.mp4`).
- For the ePCR: if it's a PDF/XML, save the raw file as `pcr_source.{ext}`. Also write a placeholder `pcr.md` (the PCR parser reads markdown — for now just write `"# ePCR\n\nSource file: {filename}\n\n[PCR content to be extracted]"`). A proper PDF→markdown extractor is a later task.
- Build and return a `Case` object via `_build_case`.

File: `backend/app/case_loader.py`
- Add `next_case_id() -> str` that scans `CASES_DIR` for existing `case_*` dirs and returns the next sequential ID.

### 1b. CORS: accept comma-separated origins

File: `backend/app/config.py`
- Rename `FRONTEND_ORIGIN: str` → `FRONTEND_ORIGINS: str` (default `"http://localhost:5173"`).
- Add a property or post-init that splits on `,` to produce a `list[str]`.

File: `backend/app/main.py`
- Change `allow_origins=[settings.FRONTEND_ORIGIN]` → `allow_origins=settings.frontend_origins_list` (or however you expose the split list).

### 1c. Env files

Create `frontend/.env.example`:
```
VITE_DATA_SOURCE=remote
VITE_API_URL=
```

Create `frontend/.env.local` (gitignored):
```
VITE_DATA_SOURCE=local
```

---

## Step 2 — Vite proxy + API base URL

File: `frontend/vite.config.ts`
- Add to the `defineConfig` object:
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

File: new `frontend/src/data/api.ts`
- Export `const API_BASE = import.meta.env.VITE_API_URL || ''`
- This is the prefix for all fetch calls. In dev with the proxy, it's empty string (relative `/api/...` goes through Vite proxy). In production, it's the full backend URL.

**Verify:** `curl http://localhost:5173/api/cases` returns the backend's case list while `npm run dev` and the backend are both running.

---

## Step 3 — Backend types mirrored in TypeScript

File: new `frontend/src/types/backend.ts`

Mirror every Pydantic model from `backend/app/schemas.py` as TypeScript interfaces. Use `string` for `datetime` fields (they arrive as ISO strings). Use string enums for all Python `str, Enum` types. This file is the contract — the frontend never reads raw backend JSON without typing it through these interfaces.

Include at minimum:
- All enums: `EventSource`, `EventType`, `DiscrepancyType`, `ProtocolCheckStatus`, `FindingSeverity`, `FindingCategory`, `ClinicalAssessmentCategory`, `AssessmentStatus`, `RecommendationAudience`, `RecommendationPriority`, `ReviewerDetermination`, `PipelineStage`, `PCRDraftStatus`, `IncidentDisposition`
- All models: `Event`, `TimelineEntry`, `ProtocolStep`, `ProtocolCheck`, `CADRecord`, `GeoPoint`, `Finding`, `CrewMember`, `ClinicalAssessmentItem`, `DocumentationQualityAssessment`, `UtsteinData`, `Recommendation`, `Case`, `PipelineProgress`, `PCRDraft`, `QICaseReview`

Do NOT modify `frontend/src/types.ts` (the existing UI-consumption types). The adapter in Step 4 bridges these two type systems.

---

## Step 4 — Adapter: `QICaseReview` → `IncidentReport`

File: new `frontend/src/data/adapters.ts`

Export `function adaptReview(review: QICaseReview): IncidentReport`

This function converts backend data into the shape the existing UI components consume. Field mapping:

```
review.case_id                          → id
review.incident_date (ISO string)       → date (extract YYYY-MM-DD) + time (extract HH:MM)
review.responding_unit + crew_members   → crew (format: "UNIT / NAME, NAME")
review.human_reviewed                   → status: human_reviewed ? 'finalized' : 'draft'
```

**sections** (9 `ReportSection` items, `id` = 1-9, `status` = 'draft', `citations` = []):

| id | title | content source |
|---|---|---|
| 1 | INCIDENT SUMMARY | `review.incident_summary` |
| 2 | TIMELINE RECONSTRUCTION | Render `review.timeline` entries as formatted prose: one paragraph per entry with timestamp + canonical_description. Note discrepancies. |
| 3 | PCR DOCUMENTATION CHECK | Render `review.documentation_quality.issues` as bullet-pointed text. Include scores as a header line: "Completeness: X, Accuracy: Y, Narrative: Z" |
| 4 | PROTOCOL COMPLIANCE REVIEW | Render `review.protocol_checks` — each check as "Step: {description} — {status}: {explanation}" |
| 5 | KEY CLINICAL DECISIONS | Filter `review.clinical_assessment` to items where `status !== 'not_applicable'`, render each: "{benchmark} — {status}: {notes}" |
| 6 | COMMUNICATION / SCENE MANAGEMENT | Filter `review.clinical_assessment` to categories `scene_management` + `handoff`, render same format |
| 7 | STRENGTHS | Filter `review.clinical_assessment` to `status === 'met'`, render as list |
| 8 | AREAS FOR IMPROVEMENT | Map `review.findings` with severity `concern` or `critical` to prose paragraphs |
| 9 | RECOMMENDED FOLLOW-UP | Render `review.recommendations` grouped by audience, each: "[{priority}] {description}" |

For each section, set `preview` to the first 200 characters of `content`.

**timelineEvents**: Map `review.timeline` entries:
```
entry.canonical_timestamp_seconds → time (format as MM:SS)
entry.canonical_description       → label
entry.event_type                  → category (map EventType to TimelineCategory:
    ARRIVAL/TRANSPORT_DECISION → 'cad'
    anything video-sourced     → 'video'  (check source_events[0].source)
    anything pcr-sourced       → 'pcr'
    VITAL_SIGNS/RHYTHM_CHECK   → 'vitals'
    fallback                   → 'pcr')
```

**pcr**: Derive from review fields:
```
incidentNumber: review.case_id
unit: review.responding_unit
crew: crew_members formatted as "LASTNAME, LASTNAME"
chiefComplaint: review.chief_complaint
```

**cadLog**: If `review.cad_record` exists, synthesize `CadEvent[]` from its datetime fields:
```
{ time: format(incident_datetime), message: "INCIDENT CREATED — " + initial_call_type }
{ time: format(first_assignment_datetime), message: "UNIT ASSIGNED" }
{ time: format(first_activation_datetime), message: "UNIT ACTIVATED" }
{ time: format(first_on_scene_datetime), message: "ON SCENE" }
// if first_to_hosp_datetime: { time: ..., message: "EN ROUTE TO HOSPITAL" }
// if first_hosp_arrival_datetime: { time: ..., message: "ARRIVED AT HOSPITAL" }
{ time: format(incident_close_datetime), message: "INCIDENT CLOSED" }
```
If no `cad_record`, return `[]`.

**pipeline**: For a cached/completed review, synthesize defaults:
```
elapsedSeconds: 0
progressPct: 100
agentTiles: []   (these are only meaningful during live processing)
findings: map review.findings to PipelineFinding[] {
  type: severity === 'info' ? 'success' : 'warning',
  message: finding.title + ': ' + finding.explanation,
  sources: finding.evidence_event_ids.join(', ')
}
audioLogs: []    (only meaningful during live processing)
```

Also export `function adaptCaseToSummary(c: Case, hasReview: boolean): IncidentSummary`:
```
id: c.case_id
date: extract YYYY-MM-DD from c.incident_date
crew: c.case_id   (Case doesn't carry crew info — just show the ID; the full crew comes from the review)
status: hasReview ? 'finalized' : 'draft'
```

Write tests in `frontend/src/data/adapters.test.ts`. Load `fixtures/sample_qi_review.json`, pass it through `adaptReview`, and assert the output has all required `IncidentReport` fields with no `undefined` values.

---

## Step 5 — Replace `remoteSource` stubs with real fetch calls

File: `frontend/src/data/source.ts`

Replace both stubs in `remoteSource`:

```ts
const remoteSource: DataSource = {
  mode: 'remote' as const,

  async listIncidents(): Promise<IncidentSummary[]> {
    const cases: Case[] = await fetch(`${API_BASE}/api/cases`).then(r => r.json());
    // For each case, check if a review exists (try fetching, 404 = no review)
    // To avoid N+1, just mark all as 'draft' initially — the review page loads the full data
    return cases.map(c => adaptCaseToSummary(c, false));
  },

  async getIncident(id: string): Promise<IncidentReport> {
    const review: QICaseReview = await fetch(`${API_BASE}/api/cases/${id}/review`)
      .then(r => {
        if (!r.ok) throw new Error(`Review not found for ${id}`);
        return r.json();
      });
    return adaptReview(review);
  },
};
```

Import `API_BASE` from `./api`, adapter functions from `./adapters`, backend types from `../types/backend`.

**Verify:** With the backend running, load `http://localhost:5173/archive?remote` — it should list real cases from `cases/`. Click through to `/review/case_01` — it should render the review from the fixture.

---

## Step 6 — Route params: plumb case ID through processing + dashboard

### 6a. Update routes

File: `frontend/src/app/routes.tsx`
- Change `/processing` → `/processing/:caseId`

### 6b. Update processing page

File: `frontend/src/app/pages/processing.tsx`
- Read `caseId` from `useParams()` instead of hard-coding `PRIMARY_MOCK_INCIDENT_ID`.
- For local mode: still use `useIncident(caseId)` with mock data (the mock should now have `case_01` as primary ID).
- For remote mode: this page will use the SSE hook from Step 7 instead of `useIncident`. But keep `useIncident` as the fallback for local mode.

### 6c. Update dashboard

File: `frontend/src/app/pages/dashboard.tsx`
- The DEMO button should navigate to `/processing/case_01?demo=1` (not `/processing?demo=1`).

### 6d. Update new-report

File: `frontend/src/app/pages/new-report.tsx`
- After successful case creation (Step 8), navigate to `/processing/{newCaseId}`.

### 6e. Processing → Review navigation

File: `frontend/src/app/pages/processing.tsx`
- When the pipeline completes (SSE `complete` event, or in local mode immediately), auto-navigate to `/review/${caseId}` after a short delay (1-2 seconds to let the user see the completed state).

### 6f. Update mock data

File: `frontend/src/mock/mock_data.ts`
- Change `PRIMARY_MOCK_INCIDENT_ID` from `'INC-2026-04-0231'` to `'case_01'`.
- Update `primaryReport.id` to `'case_01'`.
- Update `mockIncidentList` to use `case_01`, `case_02`, ... `case_10` as IDs.
- Update `buildMockReport` accordingly.

**Verify:** Navigating to `/processing/case_01` loads correctly. The old `/processing` path (no param) should 404 or redirect.

---

## Step 7 — SSE hook for live processing

File: new `frontend/src/data/sse.ts`

Export a hook:

```ts
interface ProcessingState {
  stages: Map<PipelineStage, {
    status: 'pending' | 'running' | 'complete' | 'error';
    startedAt?: string;
    completedAt?: string;
    errorMessage?: string;
  }>;
  review: IncidentReport | null;
  error: string | null;
  isComplete: boolean;
  progressPct: number;       // derived: (completed stages / total stages) * 100
  elapsedSeconds: number;    // derived: wall clock since first 'running' event
}

function useProcessingStream(caseId: string, options?: { demo?: boolean }): ProcessingState
```

Implementation:
1. On mount, `POST ${API_BASE}/api/cases/${caseId}/process` to kick off the pipeline (skip if `demo` is true — demo uses the cached review).
2. Open `new EventSource(${API_BASE}/api/cases/${caseId}/stream${demo ? '?demo=1' : ''})`.
3. Listen for events:
   - `event: progress` → parse `data` as `PipelineProgress`, update the `stages` map.
   - `event: complete` → parse `data`, extract `data.review` as `QICaseReview`, run through `adaptReview()`, set `review` and `isComplete = true`. Close the EventSource.
   - `event: error` → set `error = data.message`. Close the EventSource.
4. Track `elapsedSeconds` with a `setInterval` that starts when the first `running` event arrives and stops on complete/error.
5. Derive `progressPct` from `completed / total * 100` where total = 8 (or 7 in demo since CAD is skipped — detect by checking if `cad_parsing` ever appears in the stage map).
6. On unmount, close the EventSource and clear the interval.

**Important:** The Vite proxy from Step 2 handles routing `/api/...` to the backend in dev, so `EventSource` URLs should be relative (no `API_BASE` prefix needed if proxy is set — but use `API_BASE` anyway for production builds where the proxy won't exist). If `API_BASE` is non-empty, the EventSource URL must be absolute.

### Wire SSE into processing.tsx

File: `frontend/src/app/pages/processing.tsx`

Major refactor of this page:

- **Data source:** In remote mode, use `useProcessingStream(caseId, { demo })` instead of `useIncident`. In local mode, keep `useIncident` for the static mock display.
- **Stage cards:** Replace the 6 hardcoded column cards with a data-driven grid. Define a `STAGE_CONFIG` array:

```ts
const STAGE_CONFIG: { stage: PipelineStage; label: string; row: 'parallel' | 'sequential' }[] = [
  { stage: 'cad_parsing',    label: 'CAD SYNC',         row: 'parallel' },
  { stage: 'pcr_parsing',    label: 'ePCR PARSER',      row: 'parallel' },
  { stage: 'video_analysis', label: 'VIDEO ANALYSIS',   row: 'parallel' },
  { stage: 'audio_analysis', label: 'AUDIO ANALYSIS',   row: 'parallel' },
  { stage: 'reconciliation', label: 'RECONCILIATION',   row: 'sequential' },
  { stage: 'protocol_check', label: 'PROTOCOL CHECK',   row: 'sequential' },
  { stage: 'findings',       label: 'FINDINGS',         row: 'sequential' },
  { stage: 'drafting',       label: 'REPORT DRAFTER',   row: 'sequential' },
];
```

- Render each card using the stage status from `processingState.stages.get(stage.stage)`. Use the existing visual style (the `CompactCard` / `SeqCard` patterns) but make them data-driven.
- The RECONCILIATION card still gets the 3 sub-tiles inside. When `reconciliation` status is `running`, animate the sub-tiles on a timed sequence:
  - 0-33% of reconciliation time: CLUSTER EVENTS → active, others waiting
  - 33-66%: CLUSTER EVENTS complete, REVIEW CLUSTERS active
  - 66-100%: REVIEW CLUSTERS complete, CRITIQUE TIMELINE active
  - On reconciliation complete: all three complete
  
  Use a simple `useEffect` with `setTimeout` that triggers when reconciliation goes to `running`. The sub-tile IDs should be `cluster`, `review`, `critic`.

- **Progress bar:** Drive from `processingState.progressPct`.
- **Elapsed timer:** Drive from `processingState.elapsedSeconds`.
- **Audio logs:** Keep the existing audio log display from mock data in local mode. In remote mode, leave the log panel empty for now (future: add a log SSE channel). Show a "Logs available after processing" message.
- **Completion:** When `processingState.isComplete`, show a brief "complete" state (all cards green/complete, progress 100%), then navigate to `/review/${caseId}` after 2 seconds.

---

## Step 8 — Wire `/new-report` to upload files and create a case

File: `frontend/src/app/pages/new-report.tsx`

Currently: file inputs store `{name, size}` in state and drop the actual `File` objects. The generate button just navigates.

Changes:
- **Keep the `File` object**, not just `{name, size}`. Change state types:
  ```ts
  const [epcr, setEpcr] = useState<File | null>(null);
  const [cad, setCad] = useState<File | null>(null);
  const [videos, setVideos] = useState<File[]>([]);
  ```
  Update the display to still show name and size from the File object.

- **`handleGenerate`:** In remote mode, build a `FormData`, POST to `/api/cases`, get back the `Case` JSON, navigate to `/processing/${case.case_id}`:

  ```ts
  const handleGenerate = async () => {
    if (getDataSource().mode === 'local') {
      navigate('/processing/case_01');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', reportTitle);
      if (epcr) form.append('epcr', epcr);
      if (cad) form.append('cad', cad);
      videos.forEach(v => form.append('videos', v));
      const res = await fetch(`${API_BASE}/api/cases`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const newCase: Case = await res.json();
      navigate(`/processing/${newCase.case_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };
  ```

- Add `submitting` and `error` state. Show a loading spinner on the button while submitting. Show error messages.

---

## Step 9 — Update the review page video tab

File: `frontend/src/app/pages/review.tsx`

The center column "Context Viewer" has a VIDEO tab. Wire the video source to the backend:

```ts
const videoUrl = `${API_BASE}/api/cases/${caseId}/video`;
```

Use this as the `<video>` element's `src`. The backend serves the file with HTTP Range support, so seeking works. Keep the existing "AUDIO ONLY" default state with the "DISPLAY VIDEO FOOTAGE" button.

---

## Step 10 — Typecheck, build, and verify

After all changes:

```bash
# Backend
cd backend
uv run ruff check app/
uv run pytest tests/ -v

# Frontend
cd frontend
npm run typecheck
npm run build
```

All must pass. Fix any type errors introduced by the refactors.

---

## Update `docs/PROGRESS.md`

Append an entry documenting:
- Frontend-backend integration complete
- Vite proxy restored
- `remoteSource` implemented with real fetch calls
- SSE wiring on processing page
- Case creation endpoint added
- IDs unified to backend `case_*` scheme
- Processing page cards are now data-driven (8 stages)
- Remaining work: sub-stage SSE events for reconciliation, real PCR extraction from PDF uploads, audio log streaming

---

## Acceptance criteria

Run these in order. Each must pass before moving to the next.

1. `cd backend && uvicorn app.main:app --reload` starts without errors
2. `curl http://localhost:8000/api/cases` returns case list JSON
3. `curl -X POST http://localhost:8000/api/cases -F "epcr=@somefile.pdf" -F "title=Test"` creates a new case directory and returns Case JSON with a generated case_id
4. `cd frontend && npm run dev` starts Vite with the proxy active
5. `curl http://localhost:5173/api/cases` returns the same case list (proxied through Vite)
6. Open `http://localhost:5173/?local` — dashboard loads with mock data, DEMO button navigates to `/processing/case_01`
7. Open `http://localhost:5173/archive?remote` — lists real cases from the backend
8. Open `http://localhost:5173/review/case_01?remote` — renders the QI case review from the backend fixture
9. Open `http://localhost:5173/processing/case_01?remote&demo=1` — SSE stream plays, cards transition waiting→active→complete, auto-navigates to review on completion
10. `npm run typecheck` passes
11. `npm run build` produces a clean `dist/`

---

## What NOT to do

- Do NOT modify `backend/app/schemas.py` — the schema contract is locked.
- Do NOT remove `localSource` or break the `?local` flow — mock mode must keep working.
- Do NOT add React Query, SWR, Zustand, or any new state management library. Use the existing `useState` + hooks pattern.
- Do NOT add framer-motion or any animation library. Use Tailwind transitions.
- Do NOT restructure the component file tree beyond what's specified. Add new files, don't move existing ones unless a rename is explicitly called for.
- Do NOT touch pipeline logic (`backend/app/pipeline/*`) — this prompt is integration only.
