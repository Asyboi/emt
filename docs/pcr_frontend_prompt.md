# Build the PCR Auto-Draft Frontend Flow

## Context

Read these files before writing any code:

```
docs/PCR_FLOW_AUDIT.md
docs/INTEGRATION_AUDIT.md
docs/COMPONENT_AUDIT.md
docs/BACKEND_AUDIT.md
docs/PROGRESS.md
backend/app/schemas.py            (PCRDraft, PCRDraftStatus models)
backend/app/api/pcr_draft.py      (all 3 endpoints)
backend/app/pipeline/pcr_drafter.py (draft_pcr function + template)
backend/app/prompts.py            (PCR_DRAFT_SYSTEM, PCR_DRAFT_USER_TEMPLATE)
backend/app/config.py
frontend/src/types.ts
frontend/src/data/source.ts
frontend/src/data/hooks.ts
frontend/src/app/pages/dashboard.tsx
frontend/src/app/pages/new-report.tsx
frontend/src/app/pages/archive.tsx
frontend/src/app/routes.tsx
frontend/src/mock/mock_data.ts
frontend/vite.config.ts
```

## What we're building

The PCR Auto-Draft is a **self-contained product flow**, separate from the QI Review pipeline. It lets an EMT generate an AI-drafted Patient Care Report from video/audio/CAD evidence, review and edit it with `[UNCONFIRMED]` field highlighting, confirm it, and save it for later use. Confirmed PCRs are stored on the backend and can be browsed, viewed, and selected as input when starting a QI review.

### Architecture overview

**New routes:**
- `/pcr-new` — intake page (upload video/audio/CAD, kick off draft generation)
- `/pcr-draft/:caseId` — draft review + edit + confirm page (the main workhorse)
- `/pcr/:caseId` — read-only display of a confirmed PCR

**Modified routes:**
- `/` (dashboard) — activate the PCR Generator card
- `/archive` — add a PCR tab listing confirmed PCR drafts
- `/qi-review` (new-report) — add a picker to select a previously confirmed PCR instead of uploading an ePCR file

**New backend:**
- `GET /api/pcr-drafts` — list all confirmed PCR drafts across all cases
- `POST /api/cases/{case_id}/pcr-draft/save` — persist a confirmed PCR to a central store
- Storage for saved PCRs (a `pcr_store/` directory with JSON files, or a `pcr_drafts.json` index)

---

## Step 1 — Backend: PCR storage and listing

### 1a. Saved PCR store

The backend needs a place to persist confirmed PCRs that's independent of the case directory and browsable. Create a simple file-based store.

File: new `backend/app/pcr_store.py`

```python
"""
Persistent store for confirmed PCR drafts.
Stores each confirmed PCR as a JSON file in {CASES_DIR}/../pcr_store/{case_id}.json
containing the full PCRDraft model.
"""
```

Functions:
- `save_pcr(draft: PCRDraft) -> None` — write `pcr_store/{draft.case_id}.json` with `draft.model_dump_json(indent=2)`. Create the directory if needed.
- `load_pcr(case_id: str) -> Optional[PCRDraft]` — read and validate, return None if missing.
- `list_saved_pcrs() -> list[PCRDraft]` — scan the directory, load each, return sorted by `confirmed_at` descending. Skip any that fail validation (log a warning).
- `delete_pcr(case_id: str) -> bool` — unlink the file, return whether it existed.

Use `settings.CASES_DIR.parent / "pcr_store"` as the store directory.

### 1b. New API endpoints

File: `backend/app/api/pcr_draft.py` — add to the existing router:

**`GET /api/pcr-drafts`** (note: top-level, not under `/cases/{case_id}`)
- Returns `list[PCRDraft]` — all saved/confirmed PCRs from the store.
- This needs its own router or to be mounted at a different prefix. Simplest: add a second router in `pcr_draft.py` with `prefix=""` and mount it in `main.py` under `/api`.

**Auto-save on confirm:** Modify the existing `PATCH /api/cases/{case_id}/pcr-draft/confirm` handler to also call `save_pcr(updated_draft)` after writing `pcr.md` and `pcr_draft.json`. This way every confirmed PCR automatically appears in the store.

### 1c. Mount the new router

File: `backend/app/main.py`
- Import and include the new router for `GET /api/pcr-drafts`.

**Verify:** `curl http://localhost:8000/api/pcr-drafts` returns `[]` (or a list if any PCRs have been confirmed).

---

## Step 2 — Frontend types and API client

### 2a. PCR types

File: `frontend/src/types/backend.ts` (if it exists from the integration prompt) or `frontend/src/types.ts`

Add the `PCRDraft` interface mirroring the backend model:

```ts
export type PCRDraftStatus = 'pending_review' | 'confirmed' | 'rejected';

export interface PCRDraft {
  case_id: string;
  generated_at: string;          // ISO datetime
  status: PCRDraftStatus;
  video_event_count: number;
  audio_event_count: number;
  total_event_count: number;
  draft_markdown: string;
  unconfirmed_count: number;
  confirmed_by: string | null;
  confirmed_at: string | null;   // ISO datetime
  emt_edits_made: boolean;
  error: string | null;
}
```

### 2b. PCR summary type for lists

```ts
export interface PCRSummary {
  case_id: string;
  confirmed_at: string;
  confirmed_by: string;
  unconfirmed_count: number;
  emt_edits_made: boolean;
  event_count: number;           // total_event_count
}
```

### 2c. API functions

File: new `frontend/src/data/pcr-api.ts`

```ts
import { API_BASE } from './api';
import type { PCRDraft } from '../types/backend';  // adjust import path

export async function createPcrDraft(caseId: string): Promise<PCRDraft> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPcrDraft(caseId: string): Promise<PCRDraft> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmPcrDraft(
  caseId: string,
  editedMarkdown: string,
  confirmedBy: string = 'emt'
): Promise<PCRDraft> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edited_markdown: editedMarkdown, confirmed_by: confirmedBy }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listSavedPcrs(): Promise<PCRDraft[]> {
  const res = await fetch(`${API_BASE}/api/pcr-drafts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### 2d. Polling hook

File: new `frontend/src/data/pcr-hooks.ts`

```ts
export function usePcrDraft(caseId: string | undefined): {
  draft: PCRDraft | null;
  loading: boolean;
  error: Error | null;
  isGenerating: boolean;    // true while draft_markdown is the placeholder
  refetch: () => void;
}
```

Implementation:
- On mount, call `getPcrDraft(caseId)`.
- Detect "still generating" by checking: `draft.draft_markdown === '*Generating PCR draft — please wait...*'` AND `draft.error === null` AND `draft.total_event_count === 0`.
- While `isGenerating` is true, poll every 2 seconds with `setInterval`. Stop polling when the content changes or an error appears.
- Expose `refetch` for manual refresh.
- Clean up interval on unmount.

Also:

```ts
export function useSavedPcrs(): {
  pcrs: PCRDraft[];
  loading: boolean;
  error: Error | null;
}
```

Simple fetch-on-mount hook calling `listSavedPcrs()`.

---

## Step 3 — `/pcr-new` intake page

File: new `frontend/src/app/pages/pcr-new.tsx`

This is the entry point for the PCR draft flow. Similar layout to `/qi-review` (new-report) but tailored for PCR generation.

### Layout

Centered card (max 600px), titled "GENERATE PCR DRAFT" in the existing design language (small caps, tracked, mono).

### Upload slots

Three upload zones (reuse the visual pattern from `new-report.tsx`):

1. **Body-cam Video** — `<input type="file" accept="video/*">` — optional but recommended
2. **Dispatch Audio** — `<input type="file" accept="audio/*">` — optional but recommended  
3. **CAD Export** — `<input type="file" accept=".json">` — optional

Each shows filename + size when uploaded, with an × to remove.

Unlike `/new-report`, there is NO ePCR upload here — the whole point is that we're *generating* the PCR.

### State

```ts
const [video, setVideo] = useState<File | null>(null);
const [audio, setAudio] = useState<File | null>(null);
const [cad, setCad] = useState<File | null>(null);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Keep the actual `File` objects (not just `{name, size}`).

### Generate button

"GENERATE PCR DRAFT" — enabled when at least one file is uploaded (video or audio — CAD alone isn't enough for a useful draft).

On click:
1. Set `submitting = true`.
2. Create the case via `POST /api/cases` with the uploaded files (using the same endpoint from the integration prompt — FormData with `videos`, `cad` fields). No `epcr` field.
3. On success, get back the `Case` with `case_id`.
4. Call `createPcrDraft(case.case_id)` — `POST /api/cases/{case_id}/pcr-draft`.
5. Navigate to `/pcr-draft/${case.case_id}`.

### Footer text

Muted: "The AI will draft a PCR from your evidence. You'll review and confirm before it's saved."

### Route

Add to `routes.tsx`: `{ path: '/pcr-new', element: <PcrNew />, layout: QIReviewLayout }`

---

## Step 4 — `/pcr-draft/:caseId` — the main draft review page

File: new `frontend/src/app/pages/pcr-draft.tsx`

This is the workhorse. It has **four states** driven by the `usePcrDraft` hook:

### State 1: Generating (polling)

When `isGenerating` is true (background task still running).

Show:
- Case ID in header
- A centered status display with the existing design language:
  - "GENERATING PCR DRAFT" header
  - Four stage indicators (reuse the compact card / status pill aesthetic):
    - "Reading CAD data" — complete immediately if CAD was uploaded
    - "Analyzing video" — show as active
    - "Analyzing audio" — show as active  
    - "Drafting with Sonnet" — show as waiting
  - These are cosmetic (the backend doesn't report sub-stage progress for PCR drafting). Animate them on a timed sequence: CAD completes at 2s, video/audio complete at 60% of elapsed time, Sonnet goes active then completes when the draft arrives.
- A thin progress bar (indeterminate/pulsing — we don't know the real progress)
- Muted footer: "This typically takes 30 seconds to 2 minutes depending on video length."

Transition: when `usePcrDraft` returns a draft with real content (not placeholder), transition to State 2. If `error` is set, transition to State 3.

### State 2: Review & Edit

Two-column layout:

**Left column (~65%) — PCR Editor**

- Header: "PCR DRAFT" + status pill showing `unconfirmed_count` remaining (e.g. "12 UNCONFIRMED")
- The full PCR text in a `<textarea>` (or `contentEditable` div) with:
  - Monospace font (the PCR is fixed-width plain text with aligned columns)
  - Full height (scrollable, min 600px tall)
  - Pre-populated with `draft.draft_markdown`
  - `[UNCONFIRMED]` tokens highlighted with amber/yellow background. Since this is plain text in a textarea, the simplest approach is:
    - Use a **layered display**: a read-only `<pre>` with highlighted spans overlaid on top of a `<textarea>` for editing. The `<pre>` layer handles highlighting, the `<textarea>` handles input. Sync them on every keystroke.
    - OR: use a `contentEditable` `<pre>` with `[UNCONFIRMED]` wrapped in `<span class="bg-amber-200">`. Parse and re-render on changes.
    - Pick whichever is simpler to implement — the key requirement is that `[UNCONFIRMED]` is visually distinct while the user can edit freely.
  - Track whether edits have been made: compare current text to `draft.draft_markdown`.

**Right column (~35%) — Info Panel**

- **Evidence Stats** card:
  - Video events: `draft.video_event_count`
  - Audio events: `draft.audio_event_count`  
  - Total events: `draft.total_event_count`
  - Generated: format `draft.generated_at`

- **Unconfirmed Fields** card:
  - Count: live-computed from the current editor text (`text.split('[UNCONFIRMED]').length - 1`)
  - A legend: "[UNCONFIRMED] marks fields the AI couldn't verify from your evidence. Replace with real values or leave for later review."

- **Section Quick-Nav** (optional but nice): clickable list of the 18-19 PCR section headers (`AGENCY / UNIT INFORMATION`, `DISPATCH INFORMATION`, etc.) that scroll the editor to that section. Detect sections by scanning for the `============` separator lines.

### Bottom bar (sticky)

- Left: "REGENERATE" button (secondary/ghost) — warns "This will discard your edits and re-run the AI draft. Continue?" → on confirm, calls `createPcrDraft(caseId)` and resets to State 1. Disabled while generating.
- Right: "CONFIRM PCR" button (primary) — calls `confirmPcrDraft(caseId, editorText)`. On success, transition to State 4.
- If edits were made, show a small "Edited" indicator next to the confirm button.
- If `unconfirmed_count > 0` in the current text, show a warning below the confirm button: "X unconfirmed fields remaining — these will be preserved as-is."

### State 3: Error

When `draft.error` is not null.

Show:
- Error banner: "PCR draft generation failed" + `draft.error` message
- Two actions:
  - "REGENERATE" — re-POSTs `/pcr-draft`, resets to State 1
  - "WRITE MANUALLY" — transitions to State 2 but with an empty PCR template in the editor (use the section headers from the template — pull them from a constant, don't hardcode HTML). The user writes from scratch.

### State 4: Confirmed (brief transition)

After successful PATCH confirm. Show for 2-3 seconds then navigate to `/pcr/${caseId}`.

- Green check icon
- "PCR CONFIRMED"
- Confirmed by: `draft.confirmed_by`
- Confirmed at: formatted `draft.confirmed_at`
- Edits made: yes/no
- Remaining unconfirmed: `draft.unconfirmed_count`

### Route

Add to `routes.tsx`: `{ path: '/pcr-draft/:caseId', element: <PcrDraft /> }`

Read `caseId` from `useParams()`.

---

## Step 5 — `/pcr/:caseId` — read-only PCR display

File: new `frontend/src/app/pages/pcr-view.tsx`

A clean, read-only view of a confirmed PCR. Accessible from the archive and via direct URL.

### Data

Fetch via `getPcrDraft(caseId)` — the confirmed draft in `pcr_draft.json` has all the info. If the draft status is not `confirmed`, show a message: "This PCR has not been confirmed yet" with a link to `/pcr-draft/${caseId}`.

### Layout

Single centered column (max 800px):

**Header:**
- "PATIENT CARE REPORT" title
- Case ID + confirmed date + confirmed by
- Status badges: "CONFIRMED" (green), "X UNCONFIRMED REMAINING" (amber, if > 0), "EMT EDITED" (blue, if `emt_edits_made`)
- Evidence stats: video/audio/total event counts

**Body:**
- The full PCR text rendered as `<pre>` with monospace font
- `[UNCONFIRMED]` tokens highlighted in amber (same highlighting as the editor, but not editable)
- Section headers (`===...===` lines) rendered with subtle visual separation (e.g. a top border or extra margin)

**Actions:**
- "EDIT" button → navigates to `/pcr-draft/${caseId}` (re-enters the edit flow; re-confirming will update the saved PCR)
- "BACK TO ARCHIVE" → navigates to `/archive`
- "PRINT" / "COPY" → `navigator.clipboard.writeText(draft.draft_markdown)` or `window.print()` with a print-friendly CSS

### Route

Add to `routes.tsx`: `{ path: '/pcr/:caseId', element: <PcrView /> }`

---

## Step 6 — Dashboard: activate PCR Generator card

File: `frontend/src/app/pages/dashboard.tsx`

The right card is currently disabled with "COMING SOON". Activate it:

- Remove `aria-disabled`, `cursor-not-allowed`, `opacity-40`
- Make the card a `<Link to="/pcr-new">`
- Change the badge from "COMING SOON" to "NEW" (or remove it)
- Add a "DEMO" button (like the QI card has) that navigates to `/pcr-draft/case_01?demo=1`. For demo mode, the PCR draft page should detect `?demo=1` and load the draft from the fixture/seeded `case_01` data instead of polling. If `case_01` has no `pcr_draft.json`, show State 2 with the fixture review's incident_summary as a stand-in (or skip demo for now and just wire the live flow — your call, but the card should be active either way).

---

## Step 7 — Archive: PCR tab

File: `frontend/src/app/pages/archive.tsx`

Add a tab bar at the top of the archive page: "QI REVIEWS" | "PCR REPORTS"

### QI Reviews tab (existing)

The current archive list — no changes except wrapping it in the tab.

### PCR Reports tab

- Fetch via `useSavedPcrs()` hook
- Render a table/list with columns:
  - Case ID
  - Confirmed date (formatted)
  - Confirmed by
  - Events used (total_event_count)
  - Unconfirmed remaining
  - EMT edited (yes/no badge)
- Each row is clickable → navigates to `/pcr/${case_id}`
- Empty state: "No confirmed PCR reports yet. Generate one from the dashboard."

---

## Step 8 — QI Review: PCR picker on `/new-report`

File: `frontend/src/app/pages/new-report.tsx`

The ePCR upload slot currently accepts a PDF/XML file. Add an alternative: selecting a previously confirmed PCR from the store.

### UI change

Replace the single ePCR upload zone with a choice:

```
ePCR SOURCE
┌─────────────────────────────────────────┐
│  ○ Upload ePCR file (PDF/XML)           │
│    [upload zone, same as today]         │
│                                         │
│  ○ Use saved PCR report                 │
│    [dropdown: select from confirmed     │
│     PCRs — show case_id + date]         │
└─────────────────────────────────────────┘
```

- Radio toggle between "Upload file" and "Use saved PCR"
- When "Use saved PCR" is selected, fetch the list via `listSavedPcrs()` and show a dropdown
- The selected PCR's `case_id` is stored in state: `selectedPcrCaseId`
- The Generate button validation changes: require either `epcr` file OR `selectedPcrCaseId` (plus at least one other source)

### Backend integration

When the user selects a saved PCR and clicks Generate:
- The `POST /api/cases` call (case creation) should include a field indicating which PCR to use
- Add a new optional field to the case creation endpoint: `pcr_source_case_id: str` (optional form field)
- If provided, the backend copies `pcr_store/{pcr_source_case_id}.json`'s `draft_markdown` content into the new case's `pcr.md` file (so the QI pipeline's PCR parser can read it)
- This way the existing pipeline works unchanged — it just reads `pcr.md` from the case directory

File: `backend/app/api/cases.py` — modify `POST /api/cases`:
- Accept optional `pcr_source_case_id` form field
- If provided, call `pcr_store.load_pcr(pcr_source_case_id)`, write its `draft_markdown` to `cases/{new_id}/pcr.md`
- If both `epcr` file and `pcr_source_case_id` are provided, prefer the saved PCR (or reject — your call, but pick one)

---

## Step 9 — `[UNCONFIRMED]` highlighting utility

File: new `frontend/src/lib/pcr-highlight.ts`

Shared utility used by both the editor (State 2) and the read-only view:

```ts
/**
 * Parses plain text PCR content and returns React elements
 * with [UNCONFIRMED] tokens wrapped in highlight spans.
 */
export function highlightUnconfirmed(text: string): React.ReactNode[]

/**
 * Counts [UNCONFIRMED] occurrences in text.
 */
export function countUnconfirmed(text: string): number

/**
 * Splits PCR text into sections based on === separator lines.
 * Returns array of { header: string, content: string, startLine: number }
 */
export function parsePcrSections(text: string): PcrSection[]
```

`highlightUnconfirmed` splits on `[UNCONFIRMED]` and interleaves plain text spans with highlighted `<span className="bg-amber-200/60 text-amber-900 px-0.5 rounded">` spans.

`parsePcrSections` finds lines that are all `=` characters (60+ chars), treats the preceding non-empty line as the section header, and groups content between headers.

---

## Step 10 — PCR template constant for manual writing

File: new `frontend/src/lib/pcr-template.ts`

Export a constant `PCR_BLANK_TEMPLATE: string` containing the empty PCR section structure (all 19 section headers with `===` separators, field labels with `[UNCONFIRMED]` placeholders). This is used when the user clicks "Write manually" after an error.

Derive the template from the section headers documented in `PCR_FLOW_AUDIT.md` §5. Keep it as a plain template string — no logic.

---

## Step 11 — Typecheck and verify

```bash
cd frontend
npm run typecheck   # tsc --noEmit
npm run build       # vite build
npm test            # vitest (if available)

cd ../backend
uv run ruff check app/
uv run pytest tests/ -v
```

All must pass.

---

## Update `docs/PROGRESS.md`

Append an entry:
- PCR Auto-Draft frontend flow complete
- New routes: /pcr-new, /pcr-draft/:caseId, /pcr/:caseId
- Dashboard PCR Generator card activated
- Archive page has PCR tab
- QI Review /new-report has saved PCR picker
- Backend: pcr_store for persisting confirmed PCRs, GET /api/pcr-drafts endpoint, auto-save on confirm
- Remaining work: sub-stage progress for PCR drafting, PDF→markdown extraction for uploaded ePCRs, PCR template validation

---

## Acceptance criteria

1. Backend starts without errors: `uvicorn app.main:app --reload`
2. `curl http://localhost:8000/api/pcr-drafts` returns `[]`
3. Dashboard shows PCR Generator card as active, clicking navigates to `/pcr-new`
4. On `/pcr-new`: uploading a video + audio file and clicking Generate creates a case and navigates to `/pcr-draft/{caseId}`
5. On `/pcr-draft/{caseId}`: page shows "GENERATING" state, polls every 2s, transitions to editor when draft arrives
6. Editor shows full PCR text with `[UNCONFIRMED]` highlighted in amber
7. Right panel shows evidence stats and live unconfirmed count
8. Clicking "CONFIRM PCR" calls PATCH, shows confirmation state, navigates to `/pcr/{caseId}`
9. `/pcr/{caseId}` shows read-only PCR with highlighting and metadata badges
10. `/archive` has a "PCR REPORTS" tab listing the confirmed PCR
11. On `/qi-review` (new-report): "Use saved PCR" radio option shows a dropdown with the confirmed PCR; selecting it and generating a QI review works
12. `npm run typecheck` passes
13. `npm run build` passes

---

## What NOT to do

- Do NOT modify `backend/app/schemas.py` — PCRDraft model is locked.
- Do NOT modify `backend/app/pipeline/pcr_drafter.py` — the drafter logic is locked.
- Do NOT add a rich text editor (Draft.js, TipTap, ProseMirror, etc.) — the PCR is plain text. A `<textarea>` or `contentEditable <pre>` with highlight overlay is sufficient.
- Do NOT add any new npm dependencies beyond what's already in `package.json` (no markdown libraries needed — PCR is plain text).
- Do NOT add WebSocket or SSE for PCR draft polling — simple HTTP polling via `setInterval` is fine for this flow (30s-2min generation time, 2s poll interval = 15-60 requests, negligible).
- Do NOT wire the PCR draft flow into the QI pipeline processing page — they are separate flows.
- Do NOT break the existing mock/local mode — `?local` should still work on all pages.
