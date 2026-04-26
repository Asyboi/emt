# COMPONENT AUDIT — frontend internals

Read-only audit of the frontend pages, types, mock data, and hooks needed to wire SSE and a real backend adapter. All references are line-numbered against the working tree on `main` at audit time.

---

## 1. Processing page internals

File: `frontend/src/app/pages/processing.tsx` (845 lines).

### State

| Identifier | Type | Where | Purpose |
|---|---|---|---|
| `incident` (via `useIncident`) | `IncidentReport \| null` (with `loading`, `error`) | line 140 | Single source of pipeline display data; the hook resolves the **hard-coded primary mock id** `PRIMARY_MOCK_INCIDENT_ID`, ignoring any route or query param. |
| `logRef` | `RefObject<HTMLDivElement>` | line 141 | Scroll target for the Audio Analyzer detail drawer log. |
| `autoScroll` | `boolean` (default `true`) | line 143 | Whether the log auto-scrolls to bottom on new entries. |
| `selected` | `string \| null` (default `'audio-analyzer'`) | line 144 | Which compact card or sub-tile is highlighted; opens the detail drawer when value is `'audio-analyzer'`. |
| `cursor` | `boolean` (default `true`) | line 145 | Blink toggle for the cursor character at the bottom of the log. |

No `useReducer`, no other refs, no React Query / SWR / Zustand. No state derived from URL params.

### `agentTiles` — fields actually read by JSX

The page renders two tile components: `SubTile` (the four reconciliation sub-agents inside the Reconciliation card) and a manually authored set of column cards (`CompactCard`, `SeqCard`) with hardcoded names.

`SubTile` (lines 57–136) reads from each `AgentTile`:

| Field | How used |
|---|---|
| `sa.shortName` | Tile title text. |
| `sa.status` | Drives left-border color/style + which icon (`Check` complete / `Loader2` active / `Circle` waiting). |
| `sa.rulesBased` | If true, renders a "RULE-BASED" pill instead of the model name. |
| `sa.model` | Rendered as small mono caption when `rulesBased` is false/absent. |
| `sa.progressPct` | Renders a thin progress bar (only when `status === 'active'`). |
| `sa.statLine` | Rendered as the bottom caption line. |

`SubTile` does NOT read `sa.id` directly, but `processing.tsx:450` uses `tile.id` as the React `key=` for the wrapper. So the consumed surface is: **`id`, `shortName`, `status`, `model?`, `rulesBased?`, `progressPct?`, `statLine?`**. The page never references `label` (that's the field name some other UIs use; this codebase uses `shortName`).

The four sub-tiles come straight from `incident.pipeline.agentTiles` (line 169). The bigger column cards (`ePCR PARSER`, `AUDIO ANALYZER`, `CAD SYNC`, `RECONCILIATION`, `PROTOCOL CHECK`, `REPORT DRAFTER`) are **not** data-driven — their names, models, statuses, and stat strings are hard-coded as JSX in lines 556–658.

### `progressPct` and `elapsedSeconds`

Both come from `incident.pipeline` (lines 172–173):

```ts
const elapsed = pipeline.elapsedSeconds;        // 107 in the mock
const progress = pipeline.progressPct;          // 55  in the mock
```

- `elapsed` feeds `hms(elapsed)` (line 175) which is rendered in the header line `ELAPSED: {hms(elapsed)}`.
- `progress` is interpolated as a CSS width: `width: ${progress}%` on the orange progress bar (line 516).

**Neither is animated, incremented, or driven by an interval.** They are static values from `mock_data.ts:259`. The only timer in the file is the cursor blink (line 148):

```ts
useEffect(() => {
  const t = setInterval(() => setCursor((p) => !p), 530);
  return () => clearInterval(t);
}, []);
```

### Navigation flow

**Arrival:**
- `dashboard.tsx:10` → `navigate('/processing?demo=1')` from the **DEMO** button on the QI Review card.
- `new-report.tsx:40` → `navigate('/processing')` from the **GENERATE REPORT** button.
- The shared `DemoNav` floating bar (`components/demo-nav.tsx`) has a `PROCESSING` link that points to `/processing`.

The page reads neither `useParams` nor `useSearchParams`, so the `?demo=1` querystring set by the dashboard is discarded.

**Departure:** there is **no auto-navigation off the page**. No `setTimeout(() => navigate(...))`, no completion handler. The only way out is the `DemoNav` floating bar (REVIEW / FINALIZE / ARCHIVE links) or a manual URL change.

### Animation / transitions

- No `framer-motion` import — `processing.tsx` does not use it. (The package isn't even in `package.json` to my knowledge — none of the audited files import it.)
- Tailwind transitions and Tailwind utility classes only:
  - `animate-spin` on `Loader2` icons (active stages).
  - `animate-pulse` on the pulsing dot inside the Reconciliation card and inside the active `CompactCard`.
  - `transition-all` / `transition-colors` on hover states.
- One JS-driven animation: the cursor blink `setInterval` (530 ms toggle) at line 148.
- Inline `<div className="animate-pulse">`-style elements use Tailwind's keyframe; no custom keyframes are declared in this file.

---

## 2. Dashboard and new-report navigation

### `frontend/src/app/pages/dashboard.tsx`

Three interactive surfaces:

| Element | Action | Params |
|---|---|---|
| `<Link to="/qi-review">` (the whole left card) | Routes to `/qi-review` (the New Report intake page). | none |
| `<button onClick={handleDemo}>` (DEMO chip on QI Review card) | `navigate('/processing?demo=1')` (`dashboard.tsx:10`). | none |
| `<Link to="/archive">` (top bar) | Routes to `/archive`. | none |
| Right card "PCR Generator" | Disabled (`aria-disabled="true"`, `cursor-not-allowed`); just renders a "COMING SOON" badge. | n/a |

**No case ID is selected, entered, or derived.** The demo flow drops onto `/processing` which then ignores `?demo=1` and hard-codes `PRIMARY_MOCK_INCIDENT_ID`.

No file inputs, no form state, no API calls, no `useEffect` data fetches.

### `frontend/src/app/pages/new-report.tsx`

State (`useState` only):

| Identifier | Type | Default | Purpose |
|---|---|---|---|
| `reportTitle` | `string` | `''` | Free-text title. |
| `epcr` | `UploadedFile \| null` (`{name, size}`) | `null` | Single ePCR file. |
| `cad` | `UploadedFile \| null` | `null` | Single CAD export. |
| `videos` | `UploadedFile[]` | `[]` | Multiple video files. |

**File inputs that exist:**

- ePCR — `<input type="file" accept=".pdf,.xml">` (lines 109–113); kept only as `{name, size}` in state.
- CAD — `<input type="file">` (lines 145–148); same shape stored.
- Videos — `<input type="file" accept="video/*" multiple>` (lines 182–187 and 197–202); each push as `{name, size}`.
- Dispatch Audio — visually present but **disabled** (the wrapper has `opacity-40` and `cursor-not-allowed`, no working `<input>` element bound to handlers; lines 213–231).

**Where do the files go?** Nowhere. The handlers (`handleFileUpload`, `handleVideoUpload`, lines 19–31) only call `setEpcr`, `setCad`, or `setVideos` to record the file's `{name, size}`. There is no `FormData`, no `fetch`, no upload to the backend, no IndexedDB, no `URL.createObjectURL` — the actual `File` objects are dropped on the floor as soon as the change handler returns.

**Generate button (`handleGenerate`, line 39):**
```ts
const handleGenerate = () => {
  navigate('/processing');
};
```

Just `navigate('/processing')`. No params, no case id, no upload trigger. Disabled-state requires `reportTitle.trim().length > 0 && epcr && (cad || videos.length > 0)` (line 17), but disabling is purely cosmetic — the click still only navigates.

---

## 3. Route definitions

File: `frontend/src/app/routes.tsx`. Uses `createBrowserRouter` from `react-router` v7.

| Path | Component | Layout | Params |
|---|---|---|---|
| `/` | `Dashboard` | `Layout` (root, `<Outlet/>` only) | — |
| `/qi-review` | `NewReport` | `Layout` → `QIReviewLayout` (adds `<DemoNav />`) | — |
| `/processing` | `Processing` | `Layout` → `QIReviewLayout` | — |
| `/review/:incidentId` | `Review` | `Layout` → `QIReviewLayout` | `incidentId: string` |
| `/finalize/:incidentId` | `Finalize` | `Layout` → `QIReviewLayout` | `incidentId: string` |
| `/archive` | `Archive` | `Layout` → `QIReviewLayout` | — |

No catch-all (`*`) route, no redirect routes, no error elements. Both `Layout` and `QIReviewLayout` are pure `<Outlet/>` wrappers (`QIReviewLayout` also renders the floating `<DemoNav />`).

Notable: `/processing` has no `:caseId` param (today). `Review` and `Finalize` get `:incidentId`, but the param is treated as the frontend `IncidentSummary.id` shape (`INC-2026-04-0231`), not a backend `case_NN` directory name.

---

## 4. The `IncidentReport` type and its full dependency tree

File: `frontend/src/types.ts`. Reproduced verbatim:

```ts
// Shared frontend types for the Sentinel/Calyx UI.
// These describe the shape the UI consumes; remote mode will adapt the backend
// QICaseReview into these shapes.

export type SectionStatus =
  | 'draft'
  | 'edited'
  | 'pending'
  | 'approved'
  | 'needs-revision'
  | 'regenerating';

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
```

Adapter notes (for writing `QICaseReview → IncidentReport`):
- All fields on `IncidentReport` are **required** (no optionals at the top level). The `pipeline` block is required even though the cached review carries no pipeline data — the adapter has to synthesize sensible defaults (e.g., `agentTiles` empty array, `progressPct: 100` for a finished review, etc.).
- `ReportSection.citations` is `number[]`, not `string[]`. Backend has no equivalent — supply `[]` initially.
- `ReportSection.id` is `number`. The adapter must assign stable numeric ids in the section ordering documented in `INTEGRATION_AUDIT.md` step 3.
- `AgentTile.progressPct` is a **string** ("58%"), not a number — already includes the `%`.
- `PipelineLogEntry.timestamp` is a string like `"00:00:20"` (mm:ss:ms display, not ISO).

---

## 5. Mock data shape

File: `frontend/src/mock/mock_data.ts` (300 lines). Single primary fixture for `INC-2026-04-0231`.

### `primaryReport` top-level shape (lines 247–264)

| Key | Value type | Mock value |
|---|---|---|
| `id` | `string` | `'INC-2026-04-0231'` |
| `date` | `string` (`YYYY-MM-DD`) | `'2026-04-12'` |
| `time` | `string` (`HH:MM`) | `'14:32'` |
| `crew` | `string` | `'M-7 / RODRIGUEZ, CHEN'` |
| `status` | `ReportLifecycle` | `'draft'` |
| `sections` | `ReportSection[]` (9 items) | hand-authored in `sections` array, lines 15–112 |
| `timelineEvents` | `TimelineEvent[]` (9 items) | `timelineEvents` array, lines 114–124 |
| `pcr` | `PcrMetadata` | lines 126–131 |
| `cadLog` | `CadEvent[]` (5 items) | lines 133–139 |
| `pipeline` | `{elapsedSeconds, progressPct, agentTiles, findings, audioLogs}` | lines 257–263 |

`pcr` literal:
```ts
{ incidentNumber: '2026-041201', unit: 'M-7', crew: 'RODRIGUEZ, CHEN', chiefComplaint: 'CARDIAC ARREST' }
```

### `agentTiles` array (lines 141–171) — 4 tiles

| Index | `id` | `shortName` (acts as label) | `status` | Other fields |
|---|---|---|---|---|
| 0 | `'cluster'` | `'CLUSTER EVENTS'` | `'complete'` | `model: 'Haiku 4.5'`, `statLine: '12 event clusters'` |
| 1 | `'score'` | `'SCORE DISCREPANCIES'` | `'complete'` | `rulesBased: true`, `statLine: '3 flags · 1 gap'` |
| 2 | `'canonical'` | `'BUILD CANONICAL'` | `'active'` | `model: 'Haiku 4.5'`, `statLine: '7/12 entries built'`, `progressPct: '58%'` |
| 3 | `'critique'` | `'CRITIQUE TIMELINE'` | `'waiting'` | `model: 'Sonnet 4.6'`, `statLine: 'Confidence scoring'` |

Statuses present in the mock: **all three values** (`complete`, `active`, `waiting`). No `error`-equivalent — the type itself doesn't define one.

### `pipeline` object (lines 257–263)

```ts
pipeline: {
  elapsedSeconds: 107,
  progressPct: 55,
  agentTiles,        // the 4-tile array above
  findings,          // 4 PipelineFinding items, lines 173–194
  audioLogs,         // 11 PipelineLogEntry items, lines 196–245
}
```

`findings` (4 items): three `success` entries + one `warning` (the IV access mismatch). Each has `type`, `message`, `sources` (e.g. `'CAD + ePCR'`).

`audioLogs` (11 items): each `{timestamp, type, message}`, types span the full `LogType` union (`system`, `action`, `finding`, `reasoning`, `warning`).

### `buildMockReport(id)` — overrides vs copies

```ts
export function buildMockReport(id: string): IncidentReport {
  if (mockIncidents[id]) return mockIncidents[id];   // INC-2026-04-0231 returns primary as-is
  const summary = mockIncidentList.find((s) => s.id === id);
  return {
    ...primaryReport,
    id,
    date: summary?.date ?? primaryReport.date,
    crew: summary?.crew ?? primaryReport.crew,
    status: summary?.status ?? primaryReport.status,
  };
}
```

**Overridden** when the id isn't the primary: `id`, `date`, `crew`, `status` (taken from the matching `IncidentSummary` in `mockIncidentList`, falling back to primary values).

**Copied (spread) unchanged from primary:** `time`, `sections`, `timelineEvents`, `pcr`, `cadLog`, `pipeline` — including all nested arrays (no deep clone). Anything that mutates these arrays in-place would leak across "different" incident reports.

`mockIncidents` is the lookup map (`{[PRIMARY_INCIDENT_ID]: primaryReport}`). `mockIncidentList` is a 10-item `IncidentSummary[]` (lines 266–277). `PRIMARY_MOCK_INCIDENT_ID` re-exports the constant (line 283).

---

## 6. Hooks

File: `frontend/src/data/hooks.ts` (65 lines).

### `useIncidentList()`

```ts
function useIncidentList(): { data: IncidentSummary[] | null; loading: boolean; error: Error | null }
```

- **Calls** `getDataSource().listIncidents()` (`hooks.ts:20`).
- **Initial state:** `{ data: null, loading: true, error: null }`.
- **Effect:** runs once on mount (`useEffect` with `[]` deps, line 18). Resolves to either `{data, loading:false, error:null}` or `{data:null, loading:false, error}`.
- **Cancellation:** uses a local `cancelled` flag set in cleanup (line 28); a stale promise that resolves after unmount is ignored.
- **No caching, no deduplication, no refetch on focus.** Every `useIncidentList()` mount fires a fresh `listIncidents()` call. There is no shared store and no React Query / SWR — two components mounting it in parallel will trigger two backend calls.

### `useIncident(id)`

```ts
function useIncident(id: string | undefined): { data: IncidentReport | null; loading: boolean; error: Error | null }
```

- **Calls** `getDataSource().getIncident(id)` (`hooks.ts:50`).
- **Initial state:** `{ data: null, loading: true, error: null }`.
- **Empty-id branch:** if `id` is falsy, immediately sets `{data:null, loading:false, error: new Error('No incident id')}` and skips the effect body (lines 44–47).
- **Effect runs on `[id]`:** every id change re-resets to `loading:true` (line 49) and starts a new fetch. The `cancelled` flag in cleanup (line 59) protects against out-of-order resolutions when the id changes rapidly.
- **No caching, no deduplication, no retry.** Same id mounted in two components fetches twice.

### Both hooks share

- The `AsyncState<T>` union: `{data, loading, error}` (declared inline at `hooks.ts:5–9`, not exported).
- Reading the data source per call via `getDataSource()` (resolved each invocation per `source.ts:56–58`), so toggling `?local`/`?remote` between mounts works without reload — but in-flight requests retain whichever source they started with.
- No optimistic updates, no mutation API.

The full set of seams the adapter has to bridge ends here. With this report plus `INTEGRATION_AUDIT.md`, you have everything needed to write `QICaseReview → IncidentReport` and replace the `remoteSource` stubs.
