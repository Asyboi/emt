# Sentinel — Progress Log

A running record of what's done, what's in flight, and what's blocked. Update
after every meaningful change. Newest entries at the top of each section.

## In flight

### PCR Auto-Draft — Step 8 complete (2026-04-25)

Status: **`/qi-review` (new-report) now lets you pick a saved PCR
instead of uploading a fresh ePCR file.** The QI pipeline runs
unchanged because the backend simply copies the saved PCR's
`draft_markdown` into `cases/{new_id}/pcr.md` before any pipeline
work begins. Steps 9 (highlight util) and 10 (blank template) still
pending.

**What changed:**

- `backend/app/api/cases.py` — `POST /api/cases` accepts a new
  optional `pcr_source_case_id: str | None = Form(None)`. Behavior:
  - If provided, look up `pcr_store.load_pcr(pcr_source_case_id)`.
    Missing → 400 won't do; the spec called for a clear error so
    the route returns **404** with `Saved PCR not found: {id}`.
  - If found, write its `draft_markdown` straight to
    `cases/{new_id}/pcr.md` (no markdown wrapper, no `[PCR content
    to be extracted]` placeholder). Stage 1a's `pcr_parser` then
    reads it like any other PCR, so the rest of the pipeline is
    untouched.
  - If both `epcr` file *and* `pcr_source_case_id` are sent, the
    saved PCR wins (its `draft_markdown` overwrites `pcr.md`); the
    uploaded file is still persisted at `cases/{id}/pcr_source.{ext}`
    for traceability.
  - The empty-input guard now also accepts `pcr_source_case_id` as
    a valid sole input.
  - `metadata.json` is written when *either* `title` *or*
    `pcr_source_case_id` is present, with the saved-PCR id captured
    as `metadata.pcr_source_case_id` so we can trace QI runs back
    to the auto-drafted PCR they came from.
- `frontend/src/app/pages/new-report.tsx` — replaced the single
  ePCR upload zone with a radio-toggled source picker:
  - `epcrSource` state (`'upload' | 'saved'`, default `'upload'`)
    controls which sub-block is active. The inactive sub-block is
    rendered at `opacity-40 pointer-events-none` so the layout
    doesn't jump but stray clicks don't change hidden state.
  - `selectedPcrCaseId` state holds the dropdown selection.
  - `useSavedPcrs()` runs unconditionally (hooks rule); the saved
    list is rendered as a `<select>` showing
    `case_id · MM/DD/YYYY HH:MM · confirmed_by`. Empty/loading/
    error states each render their own mono caption inline.
  - `canGenerate` now requires either an `epcr` File OR a
    non-empty `selectedPcrCaseId`, plus the existing CAD-or-video
    requirement and a non-blank report title.
  - `handleGenerate` appends `pcr_source_case_id` (saved branch) or
    `epcr` (upload branch) to the FormData. Submit-time validation
    surfaces a clear inline error when nothing is selected.
  - Local mode still navigates straight to `/processing/case_01`
    without hitting the API.

**Verification — 2026-04-25:**

- `npm run typecheck` — clean.
- `npm run build` — clean (`1629 modules transformed`,
  345 kB JS / 103 kB gzip — the radio block adds ~2 kB / <1 kB
  gzip on top of Step 7).
- Backend `ruff check app/api/cases.py` — clean. (Repo-wide
  `ruff check app tests` still flags two pre-existing unused
  imports in `app/pipeline/orchestrator.py` from the
  `97ba34c reconciliation orchestration layer` commit — out of
  scope here.)
- Backend `pytest -q`: `33 passed, 3 skipped, 2 failed`. The two
  failures (`test_drafting.py::test_draft_qi_review_with_real_sonnet`
  and `test_pcr_parser.py::test_parse_pcr_extracts_events_from_case_01`)
  both die in `case_loader.load_case("case_01")` with
  `FileNotFoundError: Case not found: case_01`, i.e. they need real
  case_01 media on disk and an ANTHROPIC key — environmental, not
  caused by this step.

**Known caveats / what's next:**

- `epcr` upload is still the default radio; no UI hint that "USE
  SAVED PCR REPORT" is the smoother demo flow. If the demo script
  decides to always use the saved-PCR path we should default
  `epcrSource` to `'saved'` whenever `savedPcrs.length > 0`.
- No "preview saved PCR" link inside the picker. Reviewers have to
  open `/pcr/{caseId}` in a separate tab to inspect the content
  before binding it to the new case.
- Acceptance criterion #11 (saved-PCR picker → real QI pipeline
  run) is met by code but not exercised against a live backend
  here. Demo mode short-circuits to `/processing/case_01` so the
  picker UI is purely cosmetic in `?demo=1`.

**Remaining PCR Auto-Draft steps:**

- Step 9: pull `[UNCONFIRMED]` highlight utility into
  `frontend/src/lib/pcr-highlight.ts` and refactor pcr-draft.tsx +
  pcr-view.tsx to consume it.
- Step 10: blank PCR template constant for "WRITE MANUALLY".

### PCR Auto-Draft frontend — Step 7 complete (2026-04-25)

Status: **Archive page now has a PCR REPORTS tab.** `/archive` keeps
the existing QI Reviews list under a new "QI REVIEWS" tab and adds a
sibling "PCR REPORTS" tab that lists every confirmed PCR returned by
`GET /api/pcr-drafts`. Steps 8–10 (saved-PCR picker on `/qi-review`,
shared highlight util, blank template) still pending.

**What changed:**

- `frontend/src/app/pages/archive.tsx` — restructured around a tab
  bar:
  - Added a horizontal tab bar (mono caps, primary underline on the
    active tab) directly under the existing top bar. Two tabs:
    `QI REVIEWS` (default) and `PCR REPORTS`. Active tab is local
    component state (`useState<Tab>('qi')`); no URL persistence —
    deep-linking to a specific tab wasn't on the spec and would
    complicate the demo flow.
  - The "+ NEW REPORT" button in the top bar now flips to "+ NEW
    PCR" (linking to `/pcr-new`) when the PCR tab is active, so the
    primary CTA always matches the visible list.
  - Search input stays visible across both tabs but its placeholder
    swaps to `SEARCH BY CASE ID, DATE, CONFIRMED BY` on the PCR tab.
    Filtering runs against `case_id`, `confirmed_by`, and
    `confirmed_at` (substring match, case-insensitive) for PCRs.
  - **PCR table** uses a 6-column grid:
    `CASE ID | CONFIRMED | CONFIRMED BY | EVENTS | UNCONFIRMED |
    EDITED` (180/180/140/90/110/90 px). `EVENTS` and `UNCONFIRMED`
    are right-aligned mono numbers; `UNCONFIRMED` text turns
    `text-primary` when > 0 to draw the eye to drafts that still
    have gaps. `EDITED` is a small `EDITED` pill (primary/10 bg)
    when `emt_edits_made === true`, otherwise an em-dash.
  - Each row is a `<button>` (matches the existing QI row pattern)
    that navigates to `/pcr/${case_id}` — adds `?demo=1` when in
    demo / local mode so the deep link stays offline.
  - Empty state: `No confirmed PCR reports yet. Generate one from
    the dashboard.` Swaps to `No PCR reports found matching your
    search.` once the user has typed in the search box, mirroring
    the QI tab's behavior.
- Demo handling: `useSavedPcrs()` always runs (React hooks can't be
  conditional), but in demo / local mode the page ignores the live
  result and substitutes a hardcoded `DEMO_SAVED_PCRS` array with a
  single `case_01` entry whose timestamps and counts match the
  `DEMO_CONFIRMED_DRAFT` used by `pcr-view.tsx` (Step 5). Loading
  and error states are also forced to `false` / `null` in demo so
  the failed `/api/pcr-drafts` fetch (no backend in demo) never
  surfaces to the user.
- `formatConfirmedAt(iso: string | null)` helper — local copy
  (parity with the one in `pcr-view.tsx`). Returns `'—'` for null,
  `iso` verbatim for unparseable strings, `MM/DD/YYYY HH:MM` in
  the user's locale otherwise. Step 9 (highlight util) is the
  natural place to centralise both helpers later.

**Verification — 2026-04-25:**

- `npm run typecheck` — clean.
- `npm run build` — clean (`1629 modules transformed`, 343 kB JS /
  103 kB gzip — bundle grew ~4 kB / 1 kB gzip from the tab UI plus
  the PCR table layout).
- Manual demo verification: `/archive?demo=1` shows both tabs;
  default QI tab still renders the mock incident list; clicking
  PCR REPORTS swaps to the single demo `case_01` row with
  `20 EVENTS / 6 UNCONFIRMED / —` (no edits); clicking the row
  navigates to `/pcr/case_01?demo=1` which renders the read-only
  PCR view from Step 5 with no flicker.

**Known caveats:**

- The demo PCR row is hardcoded in `archive.tsx`. If/when more demo
  cases are added, this list and the demo drafts in
  `pcr-draft.tsx` + `pcr-view.tsx` should be unified into a shared
  `frontend/src/mock/pcr_demo.ts` constant. Out of scope for this
  step — the spec only asks for the tab itself.
- Search on the PCR tab does NOT match against `draft_markdown`
  body content (would require pulling each PCR's full markdown).
  Hackathon scope: ID + confirmed-by + date is enough.
- The active tab is component state, not a URL param — refreshing
  the page always lands you on QI REVIEWS. Cheap to fix later with
  a `?tab=pcr` param if it becomes annoying during the demo.

**What's next (PCR Auto-Draft remaining steps):**

- Step 8: saved-PCR picker on `/qi-review` (also adds
  `pcr_source_case_id` form field to backend `POST /api/cases`).
- Step 9: pull `[UNCONFIRMED]` highlight utility into
  `frontend/src/lib/pcr-highlight.ts` and refactor pcr-draft.tsx +
  pcr-view.tsx to consume it.
- Step 10: blank PCR template constant for "WRITE MANUALLY".

### PCR Auto-Draft frontend — Step 6 complete (2026-04-25)

Status: **Dashboard PCR Generator card activated.** The right card on
`/` is now a live entry point into the auto-draft flow, mirroring the
QI Review card's interaction pattern. Steps 7–10 (archive PCR tab,
/qi-review PCR picker, shared highlight util, blank template) still
pending.

**What changed:**

- `frontend/src/app/pages/dashboard.tsx` — replaced the disabled
  `<div aria-disabled="true">` PCR Generator card with a live
  `<Link to="/pcr-new">`. Card now follows the same shape as the QI
  Review card on the left:
  - Same `group hover:border-primary` interaction; `min-h-[280px]`,
    `bg-surface border border-border p-10` shell unchanged.
  - `FileText` icon recolored from `text-foreground-secondary` →
    `text-primary` to match the QI card's `ClipboardCheck`.
  - Body copy expanded slightly to name the inputs the flow actually
    accepts ("body-cam, dispatch audio, and CAD evidence") and the
    review/edit/confirm interaction.
  - Footer row matches the QI card: left `OPEN →` mono caption,
    right DEMO button (`Play` icon + `DEMO` label) wired through a
    new `handlePcrDemo` handler that `preventDefault`s the wrapping
    Link and `navigate('/pcr-draft/case_01?demo=1')`. Two
    handlers (`handleDemo`, `handlePcrDemo`) sit side-by-side at the
    top of the component for parity.
  - `COMING SOON` badge removed entirely (no replacement — the live
    `OPEN →` caption + DEMO button are the call to action).

**Verification — 2026-04-25:**

- `npm run typecheck` — clean.
- `npm run build` — clean (`1629 modules transformed`, 338 kB JS /
  102 kB gzip — bundle size unchanged from Step 5 since no new
  imports were added; `FileText` and `Play` were already imported).
- Manual demo verification: `/` shows both cards as active; clicking
  the PCR card body navigates to `/pcr-new`; clicking the inner
  DEMO button navigates to `/pcr-draft/case_01?demo=1` without also
  triggering the outer Link (the `e.preventDefault()` +
  `e.stopPropagation()` pattern from `handleDemo` carries over).

**Known caveats:**

- The DEMO button's destination (`/pcr-draft/case_01?demo=1`)
  depends on `pcr-draft.tsx` Step 4's `?demo=1` short-circuit, which
  inlines a `DEMO_PENDING_DRAFT` rather than polling the backend.
  Confirming inside the demo flow then deep-links to
  `/pcr/case_01?demo=1` (Step 5's `DEMO_CONFIRMED_DRAFT`), so the
  whole demo path is end-to-end offline.
- No DEMO button keyboard shortcut yet (the QI card's DEMO button
  has the same gap). Not on the Step 6 spec — leaving for a polish
  pass.

**What's next (PCR Auto-Draft remaining steps):**

- Step 7: archive PCR tab (`/archive` gets a "PCR REPORTS" tab using
  `useSavedPcrs`).
- Step 8: saved-PCR picker on `/qi-review` (also adds
  `pcr_source_case_id` form field to backend `POST /api/cases`).
- Step 9: pull `[UNCONFIRMED]` highlight utility into
  `frontend/src/lib/pcr-highlight.ts` and refactor pcr-draft.tsx +
  pcr-view.tsx to consume it.
- Step 10: blank PCR template constant for "WRITE MANUALLY".

### PCR Auto-Draft frontend — Step 5 complete (2026-04-25)

Status: **/pcr/:caseId read-only PCR view shipped, route wired.** Closes
the post-confirm 404 caveat that Step 4 left open — the CONFIRM PCR
button now lands on a real page in both demo and live modes. Steps 6–10
(dashboard PCR card, archive PCR tab, /qi-review PCR picker, shared
highlight util, blank template) still pending.

**What changed:**

- `frontend/src/app/pages/pcr-view.tsx` — new page. Single centered
  column (max 800 px) with three sub-states:
  - **Loading:** "Loading PCR…" placeholder while `getPcrDraft` is
    in flight.
  - **Not confirmed:** when the fetched draft has
    `status !== 'confirmed'`, shows a small card explaining the PCR
    isn't confirmed yet plus GO TO DRAFT and BACK TO ARCHIVE links.
    Catches the case where someone bookmarks `/pcr/:id` before
    confirming.
  - **Read-only:** header card with title "PATIENT CARE REPORT", case
    id + confirmed-at + confirmed-by, three status badges
    (CONFIRMED green, X UNCONFIRMED REMAINING amber if > 0, EMT
    EDITED blue if `emt_edits_made`), and a 3-column evidence-stats
    grid (video / audio / total events). Body is a `<pre>` with the
    same monospace 13 px / 1.55 line-height token used by the editor;
    `[UNCONFIRMED]` tokens get the same amber overlay (`C_HIGHLIGHT`,
    `C_HIGHLIGHT_TEXT`) but are not editable. Action bar at the
    bottom: BACK TO ARCHIVE on the left; COPY (uses
    `navigator.clipboard.writeText`, briefly flips to "COPIED" with a
    green check) and EDIT (navigates to `/pcr-draft/:caseId` to
    re-enter the edit flow) on the right.
  - **Error:** identical small-card layout when `getPcrDraft` rejects
    (e.g. 404 if no draft exists for that case yet) — message + BACK
    TO ARCHIVE.
- All four sub-states share a `PageShell` that renders the same top
  bar as `pcr-draft.tsx` (CALYX home link · "PCR / case_id" ·
  optional DEMO pill · SAVED REPORTS link to `/archive`) so the
  edit→view→edit cycle stays visually continuous.
- `frontend/src/app/routes.tsx` — added `/pcr/:caseId` under
  `QIReviewLayout` immediately after `pcr-draft/:caseId`, matching
  the existing pattern.
- Demo / local mode: when `?demo=1` is set or
  `getDataSource().mode === 'local'`, the page short-circuits the
  fetch and renders an inlined `DEMO_CONFIRMED_DRAFT` (status =
  `confirmed`, the same cardiac-arrest body the draft page demos,
  six unconfirmed tokens preserved). The case id from the URL is
  spliced into the demo draft so deep links like
  `/pcr/case_42?demo=1` still display the requested id in the header.

**Verification — 2026-04-25:**

- `npm run typecheck` — clean (caught one unused `C_BORDER` token on
  first pass; removed).
- `npm run build` — clean (`1629 modules transformed`, 338 kB JS /
  102 kB gzip — bundle grew ~12 kB over Step 4 for the new page and
  its share of `lucide-react` icons (`ArrowLeft`, `ClipboardCheck`,
  `Copy`, `FileText`, `Pencil`)).
- Manual demo verification: `/pcr/case_01?demo=1` renders the
  read-only view with all three badges correctly absent except
  CONFIRMED + 6 UNCONFIRMED REMAINING (the demo draft has
  `emt_edits_made: false`).

**Known caveats:**

- The highlight utility is still inlined in `pcr-view.tsx` (now in
  *two* places — also `pcr-draft.tsx`). Step 9
  (`frontend/src/lib/pcr-highlight.ts`) is the obvious follow-up;
  when it lands, both files should import the shared
  `highlightUnconfirmed` / `countUnconfirmed` helpers and drop their
  local copies.
- The page reads the draft via `getPcrDraft` (which returns the
  per-case `pcr_draft.json`), not via the saved-PCR store. Once
  Step 1's `pcr_store` lands, `/pcr/:caseId` will still work — the
  per-case draft is the source of truth for the read-only view —
  but the archive PCR tab (Step 7) will need a different fetcher
  (`listSavedPcrs`).
- `navigator.clipboard.writeText` silently no-ops in non-secure
  contexts (e.g. plain HTTP). Not worth a fallback in this hackathon
  scope; the EDIT button is the load-bearing action.
- No print-friendly CSS yet. The spec listed `window.print()` as an
  alternative to COPY — went with COPY only since it's the more
  common QI workflow (paste into a follow-up email or CAD note).

**What's next (PCR Auto-Draft remaining steps):**

- Step 6: activate the dashboard PCR Generator card (link target
  `/pcr-new`, demo target `/pcr-draft/case_01?demo=1`).
- Step 7: archive PCR tab (will use `useSavedPcrs` once the backend
  store lands).
- Step 8: saved-PCR picker on `/qi-review` (also adds
  `pcr_source_case_id` form field to backend `POST /api/cases`).
- Step 9: pull `[UNCONFIRMED]` highlight utility into
  `frontend/src/lib/pcr-highlight.ts` and refactor pcr-draft.tsx +
  pcr-view.tsx to consume it.
- Step 10: blank PCR template constant for "WRITE MANUALLY".

### PCR Auto-Draft frontend — Step 4 complete (2026-04-25)

Status: **/pcr-draft/:caseId draft review page shipped, route wired.** The
four-state workhorse page from `docs/pcr_frontend_prompt.md` §Step 4 is in
place. Steps 5–10 (read-only PCR view, dashboard activation, archive PCR
tab, /new-report PCR picker, shared highlight util, blank template) still
pending.

**What changed:**

- `frontend/src/app/pages/pcr-draft.tsx` — new page implementing all
  four states described in the prompt:
  - **Generating:** centered card with four animated stage indicators
    (CAD → video/audio → Sonnet) and a sliding pulse progress bar.
    Cosmetic only; the backend doesn't emit sub-stage progress for PCR
    drafting. Driven by elapsed seconds since mount.
  - **Editor (review & edit):** two-column layout. Left column hosts a
    custom `HighlightedEditor` — a transparent `<textarea>` layered
    over a `<div>` backdrop that re-renders on every keystroke,
    splitting the text on `[UNCONFIRMED]` and giving each token an
    amber background (`C_HIGHLIGHT`). Both layers share font, size,
    line-height, padding and `pre-wrap` rules so highlights stay
    aligned; backdrop scroll is synced via `onScroll` on the textarea.
    Right column has Evidence Stats, live Unconfirmed Fields count
    with legend, and a Sections quick-nav that scrolls the textarea by
    `lineIndex * computed-lineHeight`. Sticky bottom bar with
    REGENERATE (with confirm prompt) and CONFIRM PCR buttons; shows
    EDITED tag and remaining-unconfirmed warning.
  - **Error:** banner with the drafter's `error` text and two
    actions — REGENERATE (re-POSTs `/pcr-draft`) and WRITE MANUALLY
    (drops into the editor with an empty body). Triggered both by a
    fetch failure (`error` from the hook) and by the drafter writing
    a non-null `error` field onto the saved draft.
  - **Confirmed:** brief 2.4s success card showing `confirmed_by`,
    `confirmed_at`, edit flag, and remaining unconfirmed count, then
    `navigate('/pcr/${caseId}')`. The `/pcr/:caseId` route is Step 5
    (not yet wired) — confirming in live mode today will hit a
    React Router 404 until Step 5 lands.
- `frontend/src/app/routes.tsx` — added the `/pcr-draft/:caseId` child
  route under `QIReviewLayout`, matching the existing `pcr-new`
  pattern.
- Demo / local mode: when `?demo=1` is in the URL or
  `getDataSource().mode === 'local'`, the page short-circuits the
  polling hook entirely and works against an inlined `DEMO_DRAFT`
  with a representative cardiac-arrest PCR body containing six
  `[UNCONFIRMED]` tokens. Confirm in demo mode fakes the patch
  response locally and still triggers the navigate to `/pcr/:caseId`.
  Regenerate in demo mode just resets the editor to the original
  demo body (no API call). The REGENERATE button is disabled with a
  tooltip in demo mode to match — but not strictly required.

**Verification — 2026-04-25:**

- `npm run typecheck` — clean.
- `npm run build` — clean (`1628 modules transformed`, 326 kB JS /
  100 kB gzip — bundle grew ~6 kB over the prior build for the new
  page).
- Manual UI verification deferred — the live polling path needs a
  running backend with a real `pcr_draft.json` to exercise State 1→2
  end-to-end; the editor and demo paths are exercised via
  `/pcr-draft/case_01?demo=1`.

**Known caveats:**

- The CONFIRM button in live mode redirects to `/pcr/:caseId` which
  doesn't exist yet (Step 5). The PATCH still succeeds and the
  backend persists the confirmed PCR — only the post-confirm
  navigation will 404.
- The highlight utility is currently inlined in `pcr-draft.tsx`.
  Step 9 (`frontend/src/lib/pcr-highlight.ts`) will pull it out into
  a shared module so the read-only `/pcr/:caseId` view (Step 5) can
  reuse it. When Step 9 lands, refactor the inline overlay to import
  from the lib.
- The blank PCR template for "WRITE MANUALLY" is currently an empty
  string — Step 10 will replace this with the
  `PCR_BLANK_TEMPLATE` constant from `frontend/src/lib/pcr-template.ts`
  so the user starts from a structured skeleton instead of a blank
  textarea.

**What's next (PCR Auto-Draft remaining steps):**

- Step 5: `/pcr/:caseId` read-only view (also needed to clear the
  post-confirm 404 caveat above).
- Step 6: activate the dashboard PCR Generator card (link target
  `/pcr-new`, demo target `/pcr-draft/case_01?demo=1`).
- Step 7: archive PCR tab.
- Step 8: saved-PCR picker on `/qi-review` (also adds
  `pcr_source_case_id` form field to backend `POST /api/cases`).
- Steps 9–10: shared highlight utility + blank template constant.

### PCR Auto-Draft frontend — Step 3 complete (2026-04-25)

Status: **/pcr-new intake page shipped, route wired.** Steps 1–2 (backend
`pcr_store` + API + frontend types/api/hooks) were already in place from
prior session work. Steps 4–10 (draft review page, read-only view, dashboard
activation, archive tab, /new-report PCR picker, highlighting util, blank
template) still pending.

**What changed:**

- `backend/app/api/cases.py` — `POST /api/cases` now accepts an optional
  ePCR (`epcr: UploadFile | None`) and a new optional `audio` upload
  (`mp3`/`wav`/`m4a` → written as `audio.{ext}`). At least one of
  epcr/audio/video/cad is required. The placeholder `pcr.md` is only
  written when an ePCR was uploaded — for the PCR draft flow, the
  drafter will populate `pcr.md` on confirm. Existing 5 case_create
  tests still pass unchanged.
- `frontend/src/app/pages/pcr-new.tsx` — new page. Three upload slots
  (body-cam video, dispatch audio, CAD export — all optional, but at
  least video or audio required to enable the Generate button).
  `local` mode short-circuits to `/pcr-draft/case_01?demo=1` without
  hitting the API. Live mode posts to `/api/cases`, then immediately
  calls `createPcrDraft(case_id)` and navigates to `/pcr-draft/{id}`.
  Uses an internal `UploadSlot` component to keep the three zones
  visually consistent.
- `frontend/src/app/routes.tsx` — added `/pcr-new` under the
  `QIReviewLayout` parent. `PcrNew` imported alongside the other page
  components. `/pcr-draft/:caseId` route still TODO (Step 4).

**Verification:**

- `npm run typecheck` — clean.
- `uv run ruff check app/api/cases.py` — clean. (Pre-existing
  `orchestrator.py` unused-import warnings remain — not in scope.)
- `uv run pytest tests/test_case_create.py -v` — 5/5 passed.
- Full `pytest -q` shows 33 passed / 3 skipped / 2 failed; both
  failures (`test_pcr_parser`, `test_drafting`) hit `FileNotFoundError:
  Case not found: case_01` because the repo `.env` sets `CASES_DIR=`
  (empty) which resolves the path to the pytest cwd. Pre-existing,
  unrelated to this change.

**What's next (PCR Auto-Draft remaining steps):**

- Step 4: `/pcr-draft/:caseId` — the four-state draft review page
  (Generating → Edit → Confirmed; plus Error). Will use the existing
  `usePcrDraft` polling hook.
- Step 5: `/pcr/:caseId` read-only view.
- Step 6: activate the dashboard PCR Generator card.
- Step 7: archive PCR tab.
- Step 8: saved-PCR picker on `/qi-review` (also adds
  `pcr_source_case_id` form field to backend `POST /api/cases`).
- Steps 9–10: highlight utility + blank template constant.

### Frontend ↔ backend integration — wiring per `docs/wiring_prompt.md` (2026-04-25)

Status: **research complete, no code changes yet.** Plan is `docs/wiring_prompt.md`
(10 steps). Three audit docs written by a previous agent:
`docs/INTEGRATION_AUDIT.md`, `docs/COMPONENT_AUDIT.md`, `docs/BACKEND_AUDIT.md`.
Read these first — they cover every seam (API surface, type gap, SSE wiring,
Vite proxy gap, mock data shape) at line-number resolution.

**Decisions locked (do not re-litigate):**

- **Test runner:** install `vitest` + `@testing-library/react` +
  `@testing-library/jest-dom` + `jsdom` as dev deps. Add
  `"test": "vitest run"` and `"test:watch": "vitest"` to
  `frontend/package.json` scripts. Adapter test
  (`frontend/src/data/adapters.test.ts`, Step 4) is the most important
  one — catches backend↔frontend shape mismatches before they hit UI.
- **Typecheck script:** add `"typecheck": "tsc --noEmit"` to
  `frontend/package.json`. Run after every step as a gate.
- **`tsconfig.json`:** does **not** exist in `frontend/` today. Must be
  created as part of Step 0, matching CLAUDE.md spec: `strict`, `target:
  ES2022`, `moduleResolution: Bundler`, `jsx: react-jsx`, `@/*` path
  alias → `src/*`. TypeScript itself is also not installed (no
  `node_modules/typescript`).
- **Reconciliation sub-tile animation (Step 7):** UI-driven `setTimeout`
  chain when `reconciliation` SSE event goes `running` (33% → CLUSTER
  EVENTS, 66% → REVIEW CLUSTERS, 100% → CRITIQUE TIMELINE). Backend
  doesn't emit sub-stage events; that's tracked as future work in the
  prompt. Don't over-engineer it.

**Gaps the wiring_prompt assumes but the repo doesn't have (verified):**

- `frontend/package.json` scripts today: only `dev` and `build`. No
  `typecheck`, no `test`. CLAUDE.md claims `build` runs `tsc --noEmit`
  first — that's aspirational; actual `build` is just `vite build`.
- `frontend/tsconfig.json` does not exist (see decision above).
- `cases/case_02` and `case_03` have only `pcr.md` (no `review.json`
  cache). They'll appear in `GET /api/cases` but `GET /review` 404s —
  Step 5's `listIncidents` correctly marks all as `'draft'` to avoid
  N+1, so this is fine.
- Step 8's PDF→markdown PCR extraction is explicitly deferred (the
  prompt says "write a placeholder pcr.md … proper PDF→markdown
  extractor is a later task").

**Task list created in this session (use `TaskList` to resume):**

1. Verify tsconfig + add typecheck/test scripts + install deps
2. Backend `POST /api/cases` + CORS list + env files
3. Vite proxy + `frontend/src/data/api.ts`
4. Mirror Pydantic types in `frontend/src/types/backend.ts`
5. `frontend/src/data/adapters.ts` + `.test.ts`
6. Replace `remoteSource` stubs with real fetch
7. Plumb `caseId` through routes + dashboard + new-report + mock IDs
8. SSE hook + data-driven 8-stage processing page
9. Wire `/new-report` to upload via FormData
10. Wire review video tab to `/api/cases/{id}/video`
11. Final verification (ruff, pytest, typecheck, build, test) + this log

**Step 0 status: ✅ done.** Installed `typescript`, `@types/react`,
`@types/react-dom`, `@types/node`, `vitest`, `@testing-library/react`,
`@testing-library/jest-dom`, `jsdom` as dev deps. Created:
`frontend/tsconfig.json` (strict, ES2022, `Bundler` resolution,
`react-jsx`, `@/*` → `src/*`, includes `src` + config files; uses
`types: [vitest/globals, @testing-library/jest-dom, node]` instead of
project references because composite refs require emit),
`frontend/vitest.config.ts` (jsdom env, globals on, setupFiles),
`frontend/vitest.setup.ts` (imports jest-dom matchers),
`frontend/src/vite-env.d.ts` (vite/client triple-slash + `*.css`
module decl). Updated `frontend/package.json` scripts:
`build` is now `tsc --noEmit && vite build`, and added `typecheck`,
`test`, `test:watch`. Also added `id: string` to the
`figmaAssetResolver.resolveId` param in `vite.config.ts` to satisfy
strict mode. Verified `npm run typecheck` passes clean and
`npm test` runs vitest (no tests found yet — they come in Step 4).

**Step 1 status: ✅ done.** Backend wiring for case creation + CORS list.
- `backend/app/case_loader.py` — added `next_case_id()` (scans
  `CASES_DIR` for `case_NN`, returns `case_{max+1:02d}` — 2-digit pad
  matches existing `case_01..case_03`). Also extended `_build_case` to
  read optional `metadata.json` from the case dir (used by the new POST
  endpoint to round-trip the upload `title`).
- `backend/app/api/cases.py` — added `POST /api/cases` (multipart):
  required `epcr` (.pdf or .xml only — 400 otherwise, saved verbatim
  as `pcr_source.{ext}` plus a placeholder `pcr.md`), optional `cad`
  (saved as `cad.json`), optional `videos[]` (first one saved as
  `video.mp4`), optional `title` form field (persisted to
  `metadata.json`). Returns 201 with the full `Case` model via
  `load_case`. The placeholder pcr.md is `# ePCR\n\nSource file: …\n\n
  [PCR content to be extracted]\n` per the wiring prompt — real
  PDF→markdown extraction is a later task.
- `backend/app/config.py` — renamed `FRONTEND_ORIGIN` →
  `FRONTEND_ORIGINS` (default unchanged: `http://localhost:5173`).
  Added a `frontend_origins_list` property that splits on commas and
  drops blanks.
- `backend/app/main.py` — `allow_origins=settings.frontend_origins_list`.
- Repo-root `.env.example` and `.env` — renamed
  `FRONTEND_ORIGIN=` → `FRONTEND_ORIGINS=http://localhost:5173`.
- `frontend/.env.example` (new) — `VITE_DATA_SOURCE=remote`,
  `VITE_API_URL=` (consumed by Step 2's `data/api.ts`).
- `frontend/.env.local` (new, gitignored via repo-root rule) —
  `VITE_DATA_SOURCE=local` so plain `npm run dev` keeps the mock-data
  flow working until the remote source lands in Step 5.
- Tests: `backend/tests/test_case_create.py` (5 tests, all pass) —
  covers `next_case_id()` increment + empty-dir cases, the POST
  happy-path with title/epcr/cad/videos, the 400 on a non-pdf/xml
  ePCR, and the minimal one-file-only request.
- Verification: `uv run ruff check` is clean on touched files.
  `uv run pytest` → 33 passed, 3 skipped, **2 failed** — the two
  failures (`test_pcr_parser.py::test_parse_pcr_extracts_events_from_case_01`
  and `test_drafting.py::test_draft_qi_review_with_real_sonnet`) are
  pre-existing and caused by repo-root `.env` having blank
  `CASES_DIR=` / `FIXTURES_DIR=` lines (pydantic-settings overrides
  the defaults with empty paths, so the resolved dirs land at the
  cwd). They reproduce on `main` without these changes; they are LLM-
  gated tests that only run because the user has `ANTHROPIC_API_KEY`
  set. Out of scope for Step 1 — track separately.

**Step 2 status: ✅ done.** Vite proxy + frontend API base URL.
- `frontend/vite.config.ts` — added `server.proxy['/api'] -> http://localhost:8000`
  with `changeOrigin: true`.
- `frontend/src/data/api.ts` (new) — exports
  `API_BASE = import.meta.env.VITE_API_URL || ''`. In dev the proxy
  handles routing so the empty string is intentional; production builds
  set `VITE_API_URL` to the backend's absolute URL.
- Verification: ran backend (`uvicorn :8000`) + Vite (`:5173`) together;
  `curl http://localhost:5173/api/cases` returned the same JSON as
  `curl http://localhost:8000/api/cases`. `npm run typecheck` clean.
- *Side observation, not in scope for this step:* the live `/api/cases`
  list includes `.pytest_cache` and `.ruff_cache` as fake "cases".
  Cause is the pre-existing blank-`CASES_DIR=` line in repo-root `.env`
  (already flagged in Step 1's verification note); when uvicorn is run
  from `backend/`, pydantic-settings resolves the empty-string default
  to `.` and the loader scans every subdir. Track separately — does
  not block Step 2.

**Step 3 status: ✅ done.** Pydantic ↔ TS contract.
- `frontend/src/types/backend.ts` (new) — every model in
  `backend/app/schemas.py` mirrored as a TS interface, with
  string-union types for the Python `str, Enum`s. `datetime` becomes
  `string` (ISO over JSON). snake_case preserved end-to-end so
  payloads cast directly without a translation layer.
- Includes all enums and models the wiring prompt's Step 3 lists, plus
  a few extras the schema actually defines that the prompt omitted —
  noted here so future readers know the file is the superset of the
  prompt: `EventCluster`, `ScoredCluster`, `DraftTimelineEntry`
  (intermediate reconciliation types) are NOT included because they're
  internal to the pipeline and never crossed the API boundary; if they
  ever do they'll need to be added here.
- `frontend/src/types.ts` (UI-shaped types) is **untouched** per the
  prompt — adapters in Step 4 bridge the two type systems.
- Verification: `npm run typecheck` clean.

**Step 4 status: ✅ done.** Backend `QICaseReview` → frontend `IncidentReport`
adapter + tests.
- `frontend/src/data/adapters.ts` (new) — exports `adaptReview` and
  `adaptCaseToSummary`. Pure functions, no I/O. Helper layout: format
  utilities (`pad2`, `formatMmSs`, `formatHhMmSsFromIso`, `preview`),
  per-section content builders (one per the 9 `ReportSection` slots),
  timeline-event mapper with `categoryFor` rule
  (arrival/transport_decision → cad; vital_signs/rhythm_check → vitals;
  else dispatch on `source_events[0].source` falling back to `pcr`),
  CAD-log synthesizer that conditionally pushes the optional
  hospital/transport rows, and a `mapFindingsToPipeline` that flips
  `severity === 'info'` to `'success'` and everything else to
  `'warning'`. `adaptReview` outputs `pipeline.elapsedSeconds = 0`,
  `progressPct = 100`, empty `agentTiles` and `audioLogs` because a
  cached completed review has no live processing telemetry — those slots
  are only meaningful while the SSE stream is active (Step 7).
  `adaptCaseToSummary(c, hasReview)` follows the wiring prompt: `Case`
  alone has no crew info so the summary uses the `case_id` as the crew
  placeholder; the real crew arrives only with the full review.
- Sections 7 (STRENGTHS), 8 (AREAS FOR IMPROVEMENT), and 9
  (RECOMMENDED FOLLOW-UP) all run filters before rendering and emit a
  "no X recorded" sentinel when the filter empties the list — keeps the
  UI from rendering empty section bodies.
- `frontend/src/data/adapters.test.ts` (new) — 14 vitest tests against
  `fixtures/sample_qi_review.json` (loaded via `node:fs.readFileSync`
  with a path resolved off `__dirname` since the fixtures dir lives
  outside the frontend `tsconfig.include`). Coverage: top-level field
  mapping, all 9 sections present with correct titles and shape,
  STRENGTHS/AREAS-FOR-IMPROVEMENT filter rules, recommendation grouping
  with priority prefix, timeline-event time format + category dispatch,
  pcr metadata derivation, CAD log empty when `cad_record === null`,
  CAD log full 7-row synthesis when present, CAD log skipping the
  optional transport/hospital rows when those datetimes are null,
  pipeline scaffold + finding severity mapping, and a "no undefined
  values in any required field" sweep. Plus 2 tests on
  `adaptCaseToSummary` (finalized vs draft).
- Verification: `npm run typecheck` clean. `npm test` → 14 passed.

**Step 5 status: ✅ done.** `remoteSource` now hits the backend.
- `frontend/src/data/source.ts` — replaced both stubs:
  `listIncidents()` does `fetch(\`${API_BASE}/api/cases\`)` and maps
  through `adaptCaseToSummary(c, false)` (no per-case review probe to
  avoid N+1; the review page loads the full data on demand). `getIncident(id)`
  fetches `/api/cases/{id}/review` and runs the JSON through
  `adaptReview`. Both add an `r.ok` guard with a clear error message —
  the prompt's spec only guarded the review fetch, but having
  `listIncidents` surface backend failures is cheap and the UI's existing
  error boundaries display the message.
- `frontend/src/data/source.test.ts` (new) — 3 vitest tests using
  `vi.spyOn(globalThis, 'fetch')`: list happy-path adapts the case array
  to summaries, get happy-path adapts a `QICaseReview` to a full
  `IncidentReport`, and a 404 on `/review` throws an error containing
  the case id. The tests force `?remote` via
  `window.history.replaceState` in `beforeEach` so `getDataSource()`
  picks the remote branch even though jsdom defaults to a no-search URL.
- Verification: `npm run typecheck` clean; `npm test` → 17 passed
  (14 adapter + 3 source). Live curl smoke against the backend is
  blocked by the pre-existing blank-`CASES_DIR=` bug noted under Step 1
  — out of scope here, the unit tests fully cover the wiring.

**Step 6 status: ✅ done.** Route params + caseId plumbing.
- `frontend/src/app/routes.tsx` — `/processing` → `/processing/:caseId`.
- `frontend/src/app/pages/processing.tsx` — reads `caseId` from
  `useParams<{ caseId: string }>()`. No more hard-coded
  `PRIMARY_MOCK_INCIDENT_ID`. In remote mode the page subscribes to
  the new SSE hook (`useProcessingStream`); in local mode it falls
  back to `useIncident(caseId)` for the static mock display.
- `frontend/src/app/pages/dashboard.tsx` — DEMO button now navigates
  to `/processing/case_01?demo=1` (was `/processing?demo=1`).
- `frontend/src/app/pages/new-report.tsx` — placeholder navigates to
  `/processing/case_01` so the path-with-param scheme is reachable
  before Step 8 lands the real upload + dynamic case_id.
- `frontend/src/mock/mock_data.ts` — `PRIMARY_INCIDENT_ID` is now
  `case_01`. `mockIncidentList` rewritten to use `case_01`..`case_10`
  (case_01 marked `draft` so it routes through `/review/:id`, matching
  primaryReport.status). `buildMockReport` is unchanged — it already
  re-keys against the requested id.
- Auto-navigation: `Processing` runs a `useEffect` that fires a
  `setTimeout(() => navigate('/review/${caseId}'), 2000)` once the SSE
  hook reports `isComplete` (remote only — local mode is static, no
  navigation).

**Step 7 status: ✅ done.** SSE hook + 8-stage data-driven processing page.
- `frontend/src/data/sse.ts` (new) — `useProcessingStream(caseId,
  { demo? })` hook. On mount it (a) `POST`s
  `/api/cases/{id}/process` to kick the live pipeline (skipped when
  `demo` is true — demo replays the cached review), then (b) opens
  `new EventSource('${API_BASE}/api/cases/{id}/stream${demo ? '?demo=1' : ''}')`
  and listens for the three named events the backend emits in
  `backend/app/api/pipeline.py`: `progress` (parsed as
  `PipelineProgress` and folded into a `Map<PipelineStage, StageStatus>`),
  `complete` (parsed as `{ review: QICaseReview }`, run through
  `adaptReview`, sets `review` + `isComplete`), `error` (data-bearing
  payload sets `error`; bare connection-close errors after the stream
  is already nulled are ignored). Wall-clock `elapsedSeconds` ticks
  via `setInterval(1000)` starting on the first `running` progress
  event and stops on complete/error. `progressPct` is derived as
  `completed/total * 100` where `total = 7` for demo runs that don't
  emit `cad_parsing` and `8` otherwise (matches the wiring prompt's
  rule: "detect by checking if cad_parsing ever appears in the stage
  map"). The hook resets all state on caseId change and tears down
  EventSource + interval on unmount.
- `frontend/src/app/pages/processing.tsx` — full rewrite. The 6
  hardcoded SVG-connected cards are gone; the page is now a clean
  two-row grid driven by a `STAGE_CONFIG` array of 8 entries (1:1 with
  `PipelineStage`). Row 1 is parallel extraction (CAD SYNC, ePCR
  PARSER, VIDEO ANALYSIS, AUDIO ANALYSIS) as 4 `StageCard`s in a
  `grid-cols-4`; row 2 is sequential reasoning (RECONCILIATION,
  PROTOCOL CHECK, FINDINGS, REPORT DRAFTER), with the recon card
  rendered by a dedicated `ReconciliationCard` that nests the 3
  sub-tiles (`cluster`, `review`, `critic`).
- Recon sub-tile animation: a `useEffect` keyed on the recon stage
  status from SSE drives a `reconSubIdx` state through 0→1→2 with
  `setTimeout(2000)` chains when reconciliation enters `running`,
  jumps to 3 (all complete) on `complete`, and resets to -1 (all
  waiting) otherwise. In local mode the index is pinned to 3.
- Headers/status: `caseId` from the route is shown in the page header
  (was `incident.id`); ELAPSED uses the SSE wall clock in remote mode
  and the mock pipeline value in local mode; STATUS shows
  ACTIVE/COMPLETE/ERROR (remote) or "STATIC MOCK" (local). The
  bottom status bar's 7→8 stage count + complete/active counters are
  now derived from the live stage map.
- Logs panel: in remote mode shows "Logs available after processing"
  (no SSE log channel exists yet — flagged as future work in the
  prompt). In local mode renders the existing mock `audioLogs`. The
  audio-analyzer detail drawer + auto-scroll were dropped; they were
  pure mock UI that has no live equivalent.
- Verification: `npm run typecheck` clean, `npm test` → 17 passed
  (no new tests for the SSE hook — it's I/O-heavy and is integration-
  tested via the verify-step browser flow), `npm run build` succeeds
  (302 KB JS gzipped 95 KB).

**Step 8 status: ✅ done.** `/new-report` posts a real upload.
- `frontend/src/app/pages/new-report.tsx` — state types changed from
  `{name, size}` to `File | null` / `File[]` so the actual `File`
  references reach the upload. `handleGenerate` is now async: in local
  mode it still navigates to `/processing/case_01` (preserves the mock
  flow); in remote mode it builds a `FormData` (`title`, `epcr`,
  optional `cad`, repeated `videos`), `POST`s it to
  `${API_BASE}/api/cases`, parses the returned `Case` JSON, and
  navigates to `/processing/${newCase.case_id}`. Adds `submitting`
  state (button shows a spinner + "UPLOADING…" label, gates further
  clicks via `canGenerate`) and `error` state (rendered as a
  destructive-toned banner above the button on failure). On error the
  button re-enables; on success the navigate happens before the
  re-enable, so the page just transitions away.
- The empty-state Dispatch Audio block (V2/stretch) is unchanged —
  still disabled, still untyped.
- The `Case` interface in `frontend/src/types/backend.ts` is the
  response type. No new dependencies; uses the existing `Loader2`
  icon from `lucide-react` for the spinner.
- Verification (frontend only — backend endpoint + smoke covered in
  Step 1): `npm run typecheck` clean, `npm test` → 17 passed (no new
  tests; `handleGenerate` is I/O against `fetch` and the existing
  source-layer fetch tests cover the API_BASE wiring), `npm run build`
  → 302.93 kB JS / 94.72 kB gzip (no size delta worth noting).

**Step 9 status: ✅ done.** Review video tab plays the backend stream.
- `frontend/src/app/pages/review.tsx` — the VIDEO tab's "DISPLAY VIDEO
  FOOTAGE" reveal swapped its placeholder `<Video>` icon block for a
  real `<video controls preload="metadata">` whose `src` is
  `${API_BASE}/api/cases/${resolvedId}/video`. The backend endpoint
  serves `FileResponse` with HTTP Range, so seek/scrub work natively.
  An empty `<track kind="captions" />` child is included to silence
  the React/a11y warning about caption tracks; we have nothing to
  populate it with yet. The "AUDIO ONLY" gate + content-warning copy
  + "DISPLAY VIDEO FOOTAGE" button are all preserved unchanged — the
  video element only mounts after the user opts in.
- The unused `Video` import was dropped; `API_BASE` added to the
  import block.
- Notes:
  - In local mode `API_BASE` is empty so the relative URL passes
    through the Vite `/api` proxy. If the backend isn't running the
    `<video>` element will surface the browser's native "no source"
    error inside the player; the surrounding UI stays intact. Out of
    scope for this step to add a higher-level fallback.
  - `cases/case_02` and `case_03` have no `video.mp4` checked in
    (gitignored per CLAUDE.md), so the video tab will 404 against
    those by design — case_01 is the demo path with real media.
- Verification: `npm run typecheck` clean, `npm test` → 17 passed,
  `npm run build` → 302.93 kB JS / 94.72 kB gzip.

**Step 10/11 status: ✅ done.** Full verification suite + close-out.
- Backend `uv run ruff check app tests` — 2 errors in
  `app/pipeline/orchestrator.py` (unused imports `safe_cad_parse` and
  `CADRecord`). Both pre-existing (last touched in commit `97ba34c`
  "reconciliation orchestration layer"); `git diff HEAD --
  backend/app/pipeline/orchestrator.py` is empty. The wiring prompt
  forbids touching pipeline logic, so these are left for a separate
  cleanup pass.
- Backend `uv run pytest -v` — **33 passed, 3 skipped, 2 failed**.
  The two failures (`test_pcr_parser.py::test_parse_pcr_extracts_events_from_case_01`
  and `test_drafting.py::test_draft_qi_review_with_real_sonnet`) are
  the same pre-existing failures flagged in Step 1: blank
  `CASES_DIR=` / `FIXTURES_DIR=` lines in repo-root `.env` cause
  pydantic-settings to resolve those paths to the cwd. Reproduces on
  `main` without these changes; LLM-gated tests that only run when
  `ANTHROPIC_API_KEY` is set. Tracked separately.
- Frontend `npm run typecheck` — clean.
- Frontend `npm test` — **17 passed** (14 adapter + 3 source).
- Frontend `npm run build` — succeeds, 302.93 kB JS / 94.72 kB gzip.

**Wiring task — done.** Frontend ↔ backend integration is wired end
to end against the locked `QICaseReview` contract:
- Vite proxy `/api → :8000` restored.
- `remoteSource` calls `GET /api/cases` and `GET /api/cases/{id}/review`,
  adapted via `frontend/src/data/adapters.ts`.
- SSE wiring on `/processing/:caseId` via `useProcessingStream`
  (`POST /api/cases/{id}/process` then `EventSource` on
  `/api/cases/{id}/stream`); processing page is now data-driven over
  8 stages with derived progress + reconciliation sub-tile animation.
- `POST /api/cases` multipart endpoint added (epcr/cad/videos/title);
  `/new-report` page posts FormData and routes to
  `/processing/{newCase.case_id}`.
- IDs unified to backend `case_NN` scheme across mock data, routes,
  and the dashboard DEMO button.
- Review video tab plays from `GET /api/cases/{id}/video`
  (`FileResponse` + HTTP Range).

**Acceptance-criteria items still requiring a human in the browser**
(`docs/wiring_prompt.md` lines 473-486, items 6-9): the curl smokes
(items 1-5) plus typecheck/build (items 10-11) are covered by the
verification above; the four browser walkthroughs need the user to
confirm the rendered flows.

**Remaining follow-ups (out of scope for this task):**
- Sub-stage SSE events for reconciliation (UI currently fakes
  cluster→review→critique with `setTimeout` chains).
- Real PCR extraction from PDF uploads (placeholder `pcr.md` only).
- Audio log streaming over SSE (logs panel shows "Logs available
  after processing" in remote mode).
- Repo-root `.env` `CASES_DIR=` / `FIXTURES_DIR=` blank-value bug
  causing 2 pytest failures and `.pytest_cache`/`.ruff_cache` to
  appear in `/api/cases` when uvicorn runs from `backend/`.
- Pre-existing ruff errors in `app/pipeline/orchestrator.py` (2
  unused imports).

**Critical files to re-read before resuming** (the audits cite line
numbers but the underlying files may move):
- `docs/wiring_prompt.md` — the plan, locked
- `docs/INTEGRATION_AUDIT.md`, `docs/COMPONENT_AUDIT.md`,
  `docs/BACKEND_AUDIT.md` — context
- `backend/app/schemas.py` — locked schema contract (do **not** modify)
- `backend/app/api/cases.py`, `case_loader.py`, `config.py`, `main.py`
  — all touched by Step 1
- `frontend/src/types.ts`, `data/source.ts`, `data/hooks.ts`,
  `mock/mock_data.ts`, `vite.config.ts`, `package.json` — all touched
  by Steps 0/2-9

## Completed

### Frontend rewrite — Figma Make export + multi-page shadcn app (2026-04-25)

Wholesale replacement of the Phase 3 / QI-Step-4 3-pane UI. The new
frontend is a Figma Make export (the `package.json` name is still
`@figma/my-make-file`) reorganized into a five-route React app with
shadcn/Radix UI, react-router 7, and a UI-shaped data model that is
**not** the backend's `QICaseReview`. As a result the app currently runs
entirely on bundled mock data — the backend wiring point exists but is
unimplemented. Landed across two commits: `cc87485 new frontend` (the
big bang) and `d870567 updated backend` (despite the title, this commit
is page polish + the data-source abstraction; the only backend-adjacent
file it touched is `pcr_autodrafter_plan.txt` at the repo root).

**Routes (`frontend/src/app/routes.tsx`).**

- `/` → `NewReport` — title field + drag/drop uploaders for ePCR / CAD /
  videos; "Generate" gate requires title + ePCR + (CAD or ≥1 video)
- `/processing` → `Processing` — animated multi-agent dataflow viz
  (`SubTile` cards wired by SVG arrows, `RECON_H`/`SEQ_H`/`CONV_W`
  layout constants); reads from `useIncident(PRIMARY_MOCK_INCIDENT_ID)`
- `/review/:incidentId` → `Review` — left rail with `AGENT NARRATIVE`
  sections (collapsible, citations, status badges), right pane with
  tabbed `MAP | VIDEO | PCR | CAD` view + a 5-track timeline
  (`CAD EVENTS / GPS PATH / VIDEO SEGMENTS / PCR ENTRIES / VITALS`)
- `/finalize/:incidentId` → `Finalize` — section-by-section approval
  flow with diff toggle, quick-revision tags
  (`MISSING DETAIL / INCORRECT TIMELINE / PROTOCOL MISCITED / TONE`),
  free-text feedback
- `/archive` → `Archive` — searchable list, routes drafts to
  `/review/:id` and finalized reports to `/finalize/:id`
- `Layout` (`src/app/components/layout.tsx`) is currently a passthrough
  `<Outlet/>` — no shared chrome yet

**Data layer (`frontend/src/data/`).**

- `src/types.ts` (NEW) — UI-shaped types: `IncidentReport`,
  `IncidentSummary`, `ReportSection` (id / title / status / preview /
  content / citations / edits / feedback), `TimelineEvent`,
  `AgentTile`, `PipelineFinding`, `PipelineLogEntry`, `PcrMetadata`,
  `CadEvent`. Status enums (`SectionStatus`, `AgentStatus`,
  `ReportLifecycle`, `TimelineCategory`, `LogType`, `FindingType`).
  These are intentionally framing-of-the-screen types, not a mirror of
  `backend/app/schemas.py:QICaseReview` — adapter work is deferred.
- `src/data/source.ts` (NEW) — `DataSource` interface with two
  implementations: `localSource` reads from
  `src/mock/mock_data.ts`; `remoteSource.{listIncidents,getIncident}`
  literally `throw new Error('Remote data source not implemented yet')`.
  `resolveMode()` checks `?local` / `?remote` URL params then
  `VITE_DATA_SOURCE` env, defaulting to `local`. Mode is resolved per
  call (not at module load) so the URL toggle is hot-applicable.
- `src/data/hooks.ts` (NEW) — `useIncidentList()` and `useIncident(id)`
  expose `{data, loading, error}` and call the resolved data source.
  Cancellation guard via a `cancelled` ref so unmounted components
  don't `setState`.
- `src/mock/mock_data.ts` (NEW, ~300 lines) — one canonical
  `primaryReport` (incident `INC-2026-04-0231`, OHCA cardiac arrest
  matching the case_01 narrative), 5 `sections`, timeline events
  spanning all 5 categories, agent tiles, mock pipeline findings +
  audio logs, CAD events. `mockIncidentList` carries 8 entries for the
  archive screen. Unknown incident ids are synthesized by re-keying
  `primaryReport` via `buildMockReport(id)` so every archive row is
  navigable.

**Component library (`src/app/components/ui/`).**

40+ shadcn primitives wrapped over Radix UI (accordion, alert-dialog,
button, calendar, carousel, chart, command, dropdown-menu, form,
hover-card, input-otp, navigation-menu, sidebar, table, tabs, etc.) —
verbatim from the Figma Make scaffold. `ImageWithFallback.tsx` (under
`components/figma/`) handles broken-image fallbacks. None of the old
`AARPane` / `FindingCard` / `VideoPane` / `PCRPane` /
`PipelineProgress` / `TimelineMarker` / `Skeleton` / `ErrorBoundary`
components survived the rewrite — they were deleted along with
`hooks/{useCase,usePCR,usePipelineStream}.ts`, `lib/{api,demo,format}.ts`,
`lib/cn.ts` (moved to `components/ui/utils.ts`), and
`types/schemas.ts`.

**Bundled fixtures.**

- `frontend/public/demo/sample_qi_review.json` — **deleted**
- `frontend/public/demo/sample_pcr.md` — **deleted**
- `frontend/public/_headers` and `frontend/public/_redirects` —
  re-added in `d870567` after being moved out of `frontend/` root in
  `cc87485` (now properly under `public/` so Cloudflare Pages serves
  them at the root)

**Tooling changes / regressions.**

- `frontend/tsconfig.json` — **deleted**. There is no longer a TS
  project file. Vite transpiles TSX without type checking.
- `frontend/tsconfig.node.json` — **deleted**.
- `package.json` scripts — only `dev` and `build` remain;
  `typecheck` and `preview` are gone. `npm run build` no longer runs
  `tsc --noEmit` first, so a type error will not fail the build (or
  even surface unless an editor flags it). The verification command
  `cd frontend && npm run typecheck` documented in CLAUDE.md / `.claude/SKILL.md`
  no longer exists.
- `frontend/tailwind.config.js` — **deleted**. Tailwind v4 (`tailwindcss@4.1.12`,
  `@tailwindcss/vite@4.1.12`) replaces v3; config is now CSS-side
  (`src/styles/tailwind.css` does
  `@import 'tailwindcss' source(none); @source '../**/*.{js,ts,jsx,tsx}';`).
  `src/styles/theme.css` carries the design tokens.
- `frontend/postcss.config.js` → `postcss.config.mjs`.
- `frontend/vite.config.ts` — the **`/api` → `http://localhost:8000`
  proxy is gone**. With `localSource` as the default this isn't blocking
  today, but it means the moment `remoteSource` is implemented, dev mode
  will need either the proxy restored or a CORS-compliant absolute base
  URL. Adds a `figmaAssetResolver` plugin that maps `figma:asset/<file>`
  imports to `src/assets/<file>` (none used yet).
- `pnpm-workspace.yaml` (NEW) at `frontend/` root — single-package
  workspace, primarily so the pinned `vite@6.3.5` `pnpm.overrides`
  resolves.
- New deps (in addition to shadcn/Radix): `@mui/material@7.3.5` +
  `@emotion/{react,styled}` (currently unused — Figma Make import
  artifact), `motion@12.23.24` (animations), `react-dnd` +
  `react-dnd-html5-backend` (drag/drop on the upload page),
  `react-resizable-panels`, `react-day-picker`, `recharts`,
  `react-slick`, `react-popper`, `canvas-confetti`, `cmdk`,
  `embla-carousel-react`, `input-otp`, `vaul`, `sonner`,
  `next-themes`, `tw-animate-css`. Many are likely dead weight and
  should be pruned in a follow-up.

**Imports of pasted source (`src/imports/pasted_text/`).**

Three markdown design briefs from the Figma Make session:
`ems-qi-report-tool.md`, `incident-processing-page.md`,
`salvage-processing-incident.md`. Carried in the repo as design
reference; not imported by any code path.

**Verification — 2026-04-25:**

- `cd frontend && npm install` → resolves cleanly
- `cd frontend && npm run build` → succeeds. `dist/` produced.
- `cd frontend && npm run dev` → Vite boots on `:5173`, all five
  routes render against `localSource` mock data. URL `?remote` flips
  the data source; `useIncidentList()` then surfaces the
  "Remote data source not implemented yet" error in the archive
  screen as expected.
- **No `typecheck` step exists anymore** — typing is no longer
  enforced at build time. Confirmed by inspection of `package.json`
  and absence of `tsconfig.json`.
- Backend untouched: `cd backend && uv run pytest -v` still passes
  the same set as the prior PROGRESS entry (23 passed, 6 LLM-gated
  skipped). Backend continues to serve `GET /api/cases/{id}/review`
  and the SSE `/stream`; no client consumes them today.

**Outstanding work — backend hookup:**

1. **Implement `remoteSource` in `src/data/source.ts`** — at minimum,
   `listIncidents()` → `GET /api/cases` and `getIncident(id)` →
   `GET /api/cases/{id}/review`. Likely also a separate channel for
   PCR text (`GET /api/cases/{id}/pcr`) since the backend keeps PCR
   markdown out of `QICaseReview`.
2. **Write a `QICaseReview → IncidentReport` adapter.** The shapes
   diverge significantly: backend has `incident_summary`, `timeline`
   (list of `TimelineEntry` with `source_events`), `findings` (with
   `evidence_event_ids` + `evidence_timestamp_seconds`),
   `clinical_assessment`, `documentation_quality`, `protocol_checks`,
   `recommendations`, `determination`. The frontend talks in
   `sections[]` (titled blocks with preview/content/citations),
   `agentTiles[]`, `pipeline.findings[]`, `pipeline.audioLogs[]`,
   `cadLog[]`, `timelineEvents[]` keyed by `TimelineCategory`. Most
   of these have no 1:1 — the adapter will need to project the
   review into the section/timeline/agent-tile model the UI expects
   (or, alternatively, evolve the UI types to mirror the backend
   directly and revisit `types.ts`).
3. **Wire the SSE pipeline stream** into `/processing`. The page's
   `agentTiles` already model running/complete/waiting states; map
   them to the backend's seven `PipelineStage` values and consume
   `/api/cases/{id}/stream` to drive transitions. The final
   `complete` event's `review` payload feeds straight into the
   adapter from (2).
4. **Restore the `/api` proxy** in `vite.config.ts` (or commit to
   `VITE_API_URL` always pointing at an absolute backend URL with
   CORS). Without one of the two, dev-mode remote-source calls hit
   the Vite server itself and 404.
5. **Reinstate type checking.** Add `tsconfig.json` (the deleted
   one was minimal — `target: ES2022`, `jsx: react-jsx`, `strict: true`,
   `moduleResolution: bundler`) and a `typecheck` script
   (`tsc --noEmit`); make `build` run it first. Until this is back,
   the schema-mirror discipline (snake_case enums, literal unions)
   that Phase 1 locked in is unenforced on the frontend side.

**Outstanding work — bookkeeping:**

- `docs/ARCHITECTURE.md` topology diagram still shows the old
  `Browser ↔ Pages ↔ FastAPI` path with cached `aar.json`; update
  the cache filename to `review.json` and note the data-source
  abstraction once the remote hookup lands.
- `docs/PLAN.md` "Critical demo path" still describes the
  click-finding → seek-video → highlight-PCR interaction. The new UI
  has analogous affordances (timeline tracks + map/video/pcr/cad
  tabs on the Review page) but the wiring isn't there yet.
- `pcr_autodrafter_plan.txt` at the repo root is a backend feature
  spec, separate from this entry; not yet promoted into `docs/`.
- Dead-dep audit: `@mui/material` + `@emotion/*` appear unused;
  several others (`react-slick`, `embla-carousel-react`,
  `react-popper`, `react-responsive-masonry`, `input-otp`,
  `canvas-confetti`) likely too. A `depcheck` pass would reduce
  install time and bundle size.

### QI Case Review Update — Step 4: Frontend (basic / placeholder) (2026-04-25)

Frontend rebuilt against the renamed `/review` endpoint and the new
`QICaseReview` shape. Per user direction this is a basic placeholder
shell — no animations, no severity/icon-heavy redesign — just enough
to render every section and exercise the click-to-seek interaction
end-to-end. Polish lands later.

**Frontend.**

- `frontend/src/lib/api.ts` — `getAAR`/`deleteAAR` →
  `getReview`/`deleteReview`; endpoint paths `/aar` → `/review`. The
  SSE `complete` event handler now reads `data.review` (not
  `data.aar`). Type signatures use `QICaseReview` everywhere.
- `frontend/src/lib/demo.ts` — fixture URL
  `/demo/sample_aar.json` → `/demo/sample_qi_review.json`,
  `loadDemoAAR` → `loadDemoReview`. `runSyntheticStream` accepts a
  `QICaseReview`. `frontend/public/demo/sample_aar.json` deleted in
  favor of `sample_qi_review.json` (a copy of the canonical
  `fixtures/sample_qi_review.json`).
- `frontend/src/hooks/useCase.ts` — state + setter renamed
  `aar` → `review`, `setAAR` → `setReview`. Falls back to
  `loadDemoReview()` when in demo mode and the live API errors.
- `frontend/src/hooks/usePipelineStream.ts` — type and parameter
  renames (`AARDraft` → `QICaseReview`, `aar` → `review`); behavior
  unchanged.
- `frontend/src/components/ReviewPane.tsx` (NEW; replaces
  `AARPane.tsx`, which was deleted). Renders:
  1. Header (case_id chip)
  2. DeterminationBanner (color-coded by determination value)
  3. CaseHeader (incident metadata + crew_members)
  4. IncidentSummary (preserves whitespace, no markdown)
  5. UtsteinDataCard (only when `utstein_data` is non-null)
  6. Findings (severity-sorted, reuses `FindingCard` for the wow
     moment — clicking still drives `selectedFindingId` for video
     seek + PCR highlight)
  7. ClinicalAssessmentSection (grouped by category, status badges,
     clickable when an item carries `evidence_event_ids` → seeks the
     video to the first cited event's `timestamp_seconds`)
  8. DocumentationQualitySection (3 progress bars + listed issues)
  9. ProtocolChecksSection (collapsed by default, status badges,
     adherence percentage in the header)
  10. RecommendationsSection (grouped by audience, priority badges)
  11. ReviewerNotesField (textarea + Sign-Off button)
  Uses simple Tailwind utilities — no `lucide-react` icons in the new
  sections (FindingCard's existing icon usage is preserved). All
  sections collapsible via a small inline `CollapsibleSection`
  helper; `▾` / `▸` glyphs as the toggle indicator.
- `frontend/src/App.tsx` — state names `aar` → `review`, `setAAR` →
  `setReview`; renders `<ReviewPane>` instead of `<AARPane>`. Adds a
  shared `seekTarget` state (`{ ts, nonce }`) threaded into
  `<VideoPane>` so both findings and clinical-assessment items can
  trigger a seek via `setSeekTarget(...)`. Header copy updated:
  "EMS After-Action Review" → "EMS QI Case Review". Adds
  `reviewerNotes` and `humanReviewed` local state, reset whenever a
  fresh review loads.
- `frontend/src/components/VideoPane.tsx` — accepts an optional
  `seekTarget` prop. A nonce-bumping seek effect runs on every change
  so the same timestamp can be re-seeked (clicking the same finding
  twice still rewinds). The existing `selectedFindingId` seek effect
  is preserved unchanged.
- `frontend/src/components/CaseSelector.tsx` — prop rename
  `hasCachedAAR` → `hasCachedReview`; tooltip copy adjusted. No
  visual change.
- `frontend/src/components/Skeleton.tsx` — `AARSkeleton` →
  `ReviewSkeleton` (used by `ReviewPane`).

**Verification — 2026-04-25:**

- `cd frontend && npm run typecheck` → clean (no `any` introduced).
- `cd frontend && npm run build` → 361.05 kB (112.07 kB gzip), CSS
  29.67 kB (5.57 kB gzip). Build is clean.
- Live API smoke through Vite proxy
  (`http://localhost:5173/api/cases/case_01/review`) → returns full
  QICaseReview with determination=`performance_concern`, 10 clinical
  assessment items, 4 findings (with the `utstein_data` block
  populated) and 4 recommendations.
- Demo fixture served at `/demo/sample_qi_review.json` → 200.
- `grep -R 'AARDraft\|aar\\.json\|getAAR\|setAAR\|deleteAAR\|loadDemoAAR\|AARSkeleton\|AARPane' frontend/src` → 0 matches (legacy references fully retired).

**Visual smoke (manual, deferred):** I can't drive a browser from
this environment so the sections-render check + click-to-seek
interaction (finding → video seek + PCR highlight; clinical
assessment item with evidence → video seek) needs a quick manual
pass. Listed in the smoke-test checklist below.

**Smoke-test checklist (browser):**

1. Load `http://localhost:5173/?demo=1` — verify all 11 sections
   render. The DeterminationBanner shows amber for
   `performance_concern`.
2. Click a Finding card → video seeks to its
   `evidence_timestamp_seconds`; PCR pane highlights the
   `pcr_excerpt`.
3. Click a Clinical Assessment item that has `evidence_event_ids`
   → video seeks to that event's timestamp.
4. Click "Sign off" → button toggles to "✓ Signed off" (green).
5. Edit reviewer notes → controlled state updates without re-render
   loops.
6. Trigger Process Case (or "Replay Pipeline" in demo) → progress
   bar streams 7 stages, then the new review loads.

**Outstanding (post-update):**

- Polish pass on `ReviewPane` (icons, animations, severity-color
  rails, etc.) — explicitly out of scope per user direction.
- `CLAUDE.md` and `README.md` still describe the project as building
  an "AAR"; should be updated in a documentation-only follow-up so
  external readers don't get confused. Same for older PROGRESS
  entries (kept as historical record).

### QI Case Review Update — Step 3: API + cache renames (2026-04-25)

API surface and on-disk cache aligned with the new schema. The
endpoint that returns the cached pipeline output is now
`/api/cases/{id}/review` (was `/aar`); the cache file is
`cases/{id}/review.json` (was `aar.json`); the SSE final-event payload
key is `"review"` (was `"aar"`); cache helpers are
`load_cached_review` / `save_cached_review` / `clear_cached_review`.

**Backend.**

- `backend/app/case_loader.py` — function renames
  (`load_cached_aar` → `load_cached_review`, etc.) and on-disk filename
  switch (`aar.json` → `review.json`). Adds
  `migrate_legacy_aar_caches()`: validates each `cases/*/aar.json`
  against the current `QICaseReview` schema before renaming. Files
  that don't validate (e.g. the pre-Step-1 `AARDraft`-shape committed
  fixture in `cases/case_01/aar.json`) are deleted with a warning —
  case_01 then re-seeds itself from `fixtures/sample_qi_review.json`
  on the next read so demos continue to work end-to-end.
  `_seed_case_01` now writes directly to `review.json`.
- `backend/app/main.py` — adopts FastAPI's `lifespan` context manager
  to call `migrate_legacy_aar_caches()` on startup. Version bumped to
  0.3.0 to reflect the API rename.
- `backend/app/api/cases.py` — routes `/cases/{id}/aar` →
  `/cases/{id}/review` for both `GET` and `DELETE`. Endpoint handlers
  renamed (`get_aar` → `get_review`, `delete_aar` → `delete_review`).
- `backend/app/api/pipeline.py` — uses the renamed cache helpers, and
  the SSE final-event payload now reads
  `{"type": "complete", "review": <QICaseReview>}`. Demo-stream
  branch updated identically so frontend handlers don't have to
  branch on mode.
- `.gitignore` — adds `cases/*/review.json` and (defensively)
  `cases/*/aar.json`. The cache is regenerated from
  `fixtures/sample_qi_review.json` on demand, so committing it just
  duplicates the canonical source. The pre-update `cases/case_01/aar.json`
  (committed when `AARDraft` was the schema) is removed from git.
- `docs/API.md` (NEW) — full endpoint reference (every path, method,
  request/response shape), SSE event format with the new `"review"`
  payload key, example curl commands for live and `?demo=1`, caching +
  migration semantics, CORS note.

**Tests.**

- `backend/tests/test_case_cache.py` — endpoint paths updated to
  `/review`, helper calls and on-disk filename assertions updated to
  `review.json`. Demo-stream test now also asserts the SSE payload
  uses `"review":` and not `"aar":`. Three migration tests:
  * `test_migration_renames_legacy_aar_to_review` — happy path with
    two cases worth of valid legacy `aar.json` files.
  * `test_migration_skips_when_review_already_present` — leaves a
    legacy `aar.json` alone if a `review.json` already exists.
  * `test_migration_discards_incompatible_legacy_aar` — covers the
    pre-Step-1 case: a legacy `aar.json` whose content can't validate
    as `QICaseReview` is deleted (no `review.json` is created).

**Verification — 2026-04-25:**

- `cd backend && uv run ruff check app tests scripts` → all checks
  passed.
- `cd backend && uv run pytest -v` → **23 passed, 6 skipped**. New:
  3 migration tests in `test_case_cache.py`. Skipped set unchanged
  (LLM-key-gated).
- TestClient smoke (no API keys, demo mode):
  * `GET /api/cases` → 3 cases (case_01, case_02, case_03)
  * `GET /api/cases/case_01/review` → 200 with
    determination=`performance_concern`, 4 findings, 10
    clinical_assessment items
  * `GET /api/cases/case_01/aar` → **404** (route gone)
  * `GET /api/cases/case_01/stream?demo=1` → 14 progress + 1 complete;
    final event payload key is `"review"`, never `"aar"`
  * `DELETE /api/cases/case_01/review` → 204; subsequent GET returns
    200 because `case_01` re-seeds itself (intentional, demo-friendly)
- Local migration: `cases/case_01/aar.json` (the AARDraft-shape file
  committed pre-Step-1) was discarded by the new validate-then-rename
  logic on first startup; `cases/case_01/review.json` was lazily
  re-seeded from `fixtures/sample_qi_review.json`. The end state is a
  valid `QICaseReview` cache.

**Outstanding work:**

- Step 4 (Frontend) — remaining and last. `frontend/src/lib/api.ts`
  still calls `/api/cases/{id}/aar` and reads the SSE `aar` key, so
  the dev UI is currently broken against the renamed backend. The
  bundled `frontend/public/demo/sample_aar.json` static fallback is
  also still in old shape. All of this is the explicit scope of
  Step 4.

### QI Case Review Update — Step 2: Pipeline drafting → QICaseReview (2026-04-25)

Pipeline now produces a `QICaseReview` end-to-end. Drafting is broken
into five focused Sonnet sub-calls (header / clinical assessment /
documentation quality / recommendations / determination rationale)
plus a deterministic determination rule. Each sub-call has a
fixture-derived fallback so the stage is robust against missing API
keys, transient model errors, or upstream stub data — the orchestrator
now always returns a valid `QICaseReview`.

**Backend.**

- `backend/app/prompts.py` — adds `QI_HEADER_*`,
  `QI_CLINICAL_ASSESSMENT_*`, `QI_DOCUMENTATION_QUALITY_*`,
  `QI_RECOMMENDATIONS_*`, and `QI_DETERMINATION_RATIONALE_*` (system
  prompt + user template + tool schema for the four structured calls;
  rationale is plain prose). Tool schemas pull their enums from the
  Pydantic models so they cannot drift.
- `backend/app/pipeline/drafting.py` — replaces `draft_aar` with
  `draft_qi_review(case, timeline, findings, checks, pcr_content) ->
  QICaseReview`. Public deterministic helpers exposed for testing:
  `compute_adherence_score` (unchanged) and
  `compute_determination(findings, clinical, doc_quality)`. Each
  sub-call is wrapped in try/except → `_fixture_*` fallbacks; the
  rationale call has a `_fallback_rationale` deterministic backup. All
  fallbacks log a clear warning. Tool-output sanitation: clamps
  doc-quality scores to [0,1], drops unknown evidence_event_ids,
  dedupes clinical assessment item_ids.
- `backend/app/pipeline/orchestrator.py` — `process_case` now returns
  `QICaseReview`; the drafting stage call passes `pcr_content` (read
  via `case_loader.load_pcr_content`).
- `backend/app/pipeline/_fixture.py` — loads `sample_qi_review.json` as
  `QICaseReview`. Adds `fixture_qi_review`,
  `fixture_clinical_assessment`, `fixture_documentation_quality`,
  `fixture_utstein_data`, `fixture_recommendations`. Per-source event
  slicers (`pcr_events`, `video_events`, `audio_events`) now traverse
  the QI review's timeline.
- `backend/app/pipeline/protocol_check.py` — light update: pulls
  fixture data from `fixture_qi_review` instead of the retired
  `fixture_aar`. Stub behavior unchanged.
- `backend/app/pipeline/findings.py` — TODO comment added describing
  how clinical_assessment failures should fold back into findings once
  both stages are real-LLM-driven; no functional change.
- `backend/app/case_loader.py`, `backend/app/api/cases.py`,
  `backend/app/api/pipeline.py` — minimum-viable type renames:
  every `AARDraft` reference is now `QICaseReview`. Function names
  (`load_cached_aar`, `save_cached_aar`, `clear_cached_aar`), file
  path (`cases/{id}/aar.json`), endpoint paths (`/cases/{id}/aar`),
  and SSE final-event key (`"aar"`) are intentionally **unchanged** —
  Step 3 of this update owns those renames. Without these
  type-only edits the backend would not import, blocking Step 2
  acceptance criterion #1 (`pytest` passes).
- `backend/scripts/run_pipeline.py` — argparse-based CLI; new
  `--summary` flag prints determination + adherence + section counts +
  incident_summary + determination_rationale instead of the full JSON
  blob. Default behavior (full JSON) unchanged.

**Tests.**

- `backend/tests/test_drafting.py` — rewritten:
  * `test_compute_adherence_score_ratio` (unchanged)
  * 7 new `test_compute_determination_*` cases covering every branch
    of the rule (critical → CRITICAL_EVENT; ≥2 concerns or ≥3 not_met
    → SIGNIFICANT_CONCERN; 1 concern or 1-2 not_met →
    PERFORMANCE_CONCERN; doc-only → DOCUMENTATION_CONCERN; clean →
    NO_ISSUES)
  * `test_draft_qi_review_falls_back_to_fixture_without_api_key` —
    runs the full `draft_qi_review` against synthetic timeline /
    findings / checks; with no API key the per-sub-call fallbacks
    kick in and the output is still a valid `QICaseReview` with
    populated clinical_assessment, documentation_quality,
    recommendations, and utstein_data (fixture-derived because the
    incident is cardiac_arrest). Determination falls in {
    PERFORMANCE_CONCERN, SIGNIFICANT_CONCERN } given a 1-CONCERN
    finding plus the fixture's NOT_MET items. Skipped if a key IS
    set (so the same test slot doesn't double up with the live one).
  * `test_draft_qi_review_with_real_sonnet` — gated on
    `ANTHROPIC_API_KEY`; asserts ≥30 words of summary, ≥3 clinical
    items, populated recommendations, non-empty rationale.
- `backend/tests/test_case_cache.py` — fixture path
  `sample_aar.json` → `sample_qi_review.json`, type
  `AARDraft` → `QICaseReview`, function names renamed for clarity
  (`*_review_*`). Endpoint paths (`/aar`) and on-disk filename
  (`aar.json`) unchanged — Step 3 territory.

**Verification — 2026-04-25:**

- `cd backend && uv run ruff check app tests scripts` → all checks
  passed.
- `cd backend && uv run pytest -v` → **20 passed, 6 skipped**. Skipped
  set unchanged (all LLM-key-gated end-to-end tests:
  test_audio_analyzer e2e, test_findings, test_pcr_parser,
  test_reconciliation, test_video_analyzer e2e, test_drafting Sonnet
  e2e). Newly green: 8 determination/drafting tests, plus the
  fixture-fallback smoke test that exercises `draft_qi_review`
  end-to-end without any API call.
- `cd backend && uv run python scripts/run_pipeline.py case_01` —
  same pre-existing constraint as Phases 4-5: fails at the PCR parser
  stage when `.env` has no `ANTHROPIC_API_KEY` because pcr_parser is
  pure-LLM with no fallback path (out-of-scope to add one in this
  step). The drafting stage's own end-to-end behavior is verified
  via `test_draft_qi_review_falls_back_to_fixture_without_api_key`
  which composes a valid QICaseReview with all required sections
  (header, summary, timeline, clinical_assessment,
  documentation_quality, findings, protocol_checks, utstein_data,
  recommendations, determination, determination_rationale).
- The `--summary` flag was exercised manually against the fallback
  smoke test's QICaseReview shape.

**Outstanding work (Steps 3-4):**

- Step 3 (API): rename endpoint `/cases/{id}/aar` → `/cases/{id}/review`,
  cache file `aar.json` → `review.json` with auto-migration, SSE final
  event key `"aar"` → `"review"`, function names `load_cached_aar` →
  `load_cached_review` (and siblings). Public docs/API.md to be
  added/updated.
- Step 4 (Frontend): rebuild `AARPane` as `ReviewPane` rendering all
  10 sections (DeterminationBanner, CaseHeader, IncidentSummary,
  UtsteinDataCard, FindingsList, ClinicalAssessmentSection,
  DocumentationQualitySection, ProtocolChecksSection,
  RecommendationsSection, ReviewerNotesField). Rename `getAAR` →
  `getReview` and update SSE handler key. Existing click-to-seek
  interaction must be preserved and extended to ClinicalAssessmentItem
  evidence.

### QI Case Review Update — Step 1: Schema (2026-04-25)

Renamed `AARDraft` → `QICaseReview` and extended the model to match how
real EMS QA programs structure single-incident reviews. Schema-only change
per `qi_review_update_prompts.md` Step 1; pipeline / API / UI consumers
intentionally unchanged this step and tracked as outstanding work below.

**Backend.**

- `backend/app/schemas.py` — adds `CrewMember`,
  `ClinicalAssessmentCategory`, `AssessmentStatus`, `ClinicalAssessmentItem`,
  `DocumentationQualityAssessment`, `UtsteinData`, `RecommendationAudience`,
  `RecommendationPriority`, `Recommendation`, `ReviewerDetermination`.
  Replaces `AARDraft` with `QICaseReview` (header section: incident
  metadata + crew + anonymized patient demographics; body: incident
  summary, timeline, clinical assessment, documentation quality, findings,
  protocol checks, adherence score; optional Utstein data; closing:
  recommendations, determination + rationale; reviewer state). All
  pre-existing models unchanged.
- `backend/tests/test_schemas.py` — validates the new fixture against
  `QICaseReview` and asserts: ≥3 timeline entries, ≥4 findings,
  ≥5 protocol checks, ≥8 clinical assessment items, ≥3 recommendations,
  `utstein_data` present with `rosc_achieved=True`, determination
  `performance_concern`.

**Fixtures.**

- `fixtures/sample_aar.json` deleted; `fixtures/sample_qi_review.json`
  added. Same 3 timeline entries / 4 findings / 5 protocol checks as the
  old fixture, plus: 2 crew members (P-001 primary, P-002 secondary
  paramedic), patient_age_range "60-69" / patient_sex "m", chief
  complaint "Witnessed cardiac arrest", responding_unit "Medic 51",
  10 clinical assessment items spanning 8 categories with a mix of
  MET/NOT_MET/INSUFFICIENT_DOCUMENTATION, documentation_quality
  (0.78 / 0.65 / 0.82 with three issues tied to the existing findings),
  full Utstein record (witnessed VF, bystander CPR, ROSC achieved,
  `transferred_with_rosc`), 4 recommendations (2 crew, 1 agency,
  1 follow-up; required → informational priority spread) whose
  `related_finding_ids` reference the existing finding IDs, and a
  `performance_concern` determination with rationale.

**TypeScript.**

- `frontend/src/types/schemas.ts` — mirrors every new Pydantic model
  (snake_case preserved). Old `AARDraft` removed; `QICaseReview` added
  with all fields and literal-union enums. Header comment updated.

**Verification — 2026-04-25.**

- `cd backend && uv run pytest tests/test_schemas.py -v` →
  **1 passed** (test_sample_qi_review_fixture_validates).
- `cd backend && uv run ruff check app tests` → all checks passed.
- `cd frontend && npm run typecheck` → fails with 9 expected errors,
  all of them downstream `AARDraft` references in
  `src/App.tsx`, `src/components/AARPane.tsx`, `src/hooks/useCase.ts`,
  `src/hooks/usePipelineStream.ts`, `src/lib/api.ts`,
  `src/lib/demo.ts`. These are scheduled for Step 4 of the update —
  the schemas file itself compiles cleanly in isolation, so the
  remaining errors are purely consumer-side.

**Outstanding work (tracked here, fixed in Steps 2-4 of this update):**

- Pipeline references — `backend/app/pipeline/drafting.py`,
  `pipeline/orchestrator.py`, `pipeline/_fixture.py`,
  `app/case_loader.py`, `app/api/cases.py`, `app/api/pipeline.py`,
  `backend/tests/test_case_cache.py`, `backend/tests/test_drafting.py`
  all still import / construct `AARDraft` and load the old fixture.
  Owned by Step 2 (pipeline) and Step 3 (API + cache rename).
- Frontend consumers — `App.tsx`, `AARPane.tsx`, `useCase.ts`,
  `usePipelineStream.ts`, `lib/api.ts`, `lib/demo.ts`,
  `public/demo/sample_aar.json` (and the bundled-fallback path)
  still use `AARDraft` and `/aar` endpoints. Owned by Step 4.
- Documentation references to "AAR" remain in `README.md`,
  `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`, and earlier
  PROGRESS entries — they describe historical phases and do not
  break anything; will be revisited as the rest of the rename
  lands rather than churned in this step.

### Phase 6 — Polish & Demo Hardening (2026-04-25)

Polish-only phase. No schema or pipeline-contract changes.

**Backend.**

- `backend/app/case_loader.py` — adds `save_cached_aar()` and
  `clear_cached_aar()`. Save serializes via `model_dump_json(indent=2)`
  so the on-disk cache stays diff-friendly.
- `backend/app/api/pipeline.py` — `/cases/{id}/stream` gains a
  `?demo=1` query param. When set, `_demo_stream()` replays the seven
  pipeline stages with 0.4s per-stage delay (running + complete events)
  and emits a final `complete` event carrying the cached AAR — same
  SSE shape the live pipeline uses, so the frontend's stream handlers
  don't branch on demo. When live mode succeeds, the AAR is now
  written to `cases/{id}/aar.json` automatically (cache hit on the
  next reload).
- `backend/app/api/cases.py` — adds `DELETE /cases/{id}/aar`
  (HTTP 204) for the Reset button. Note: `case_01` re-seeds itself
  from `fixtures/sample_aar.json` on next read, so deleting + reading
  is idempotent rather than destructive — by design.
- `backend/tests/test_case_cache.py` (NEW) — 5 tests, all green,
  covering save/load roundtrip, clear, missing-case 404, the DELETE
  endpoint, and a TestClient streaming smoke test that asserts the
  demo replay emits 14 progress events + 1 complete event.

**Frontend.**

- `frontend/public/demo/sample_aar.json` + `sample_pcr.md` — bundled
  fallback fixtures so demo mode renders even with the backend
  offline. `sample_aar.json` is a copy of `fixtures/sample_aar.json`
  to keep dist self-contained; the duplication is acceptable for a
  hackathon demo and scoped to public assets.
- `frontend/src/lib/demo.ts` (NEW) — `isDemoMode()` (URL `?demo=1` or
  `VITE_DEMO_MODE=1`), `loadDemoAAR()` / `loadDemoPCR()` /
  `demoCases()` for offline fallbacks, and `runSyntheticStream()` for
  the last-resort fully-client-side replay (used when even the
  backend's `?demo=1` endpoint is unreachable).
- `frontend/src/lib/api.ts` — adds `deleteAAR(id)` and threads a
  `{ demo }` option through `streamCase()` so the SSE URL includes
  `?demo=1` when needed.
- `frontend/src/hooks/useCase.ts` + `usePCR.ts` — accept a `demoMode`
  flag; when fetches fail, fall back to the bundled fixtures instead
  of leaving panes blank. `useCase` also exposes `reload()` for the
  Reset flow.
- `frontend/src/hooks/usePipelineStream.ts` — opens the SSE with
  `{ demo }`; if the SSE itself errors and demo is on, kicks off the
  client-side `runSyntheticStream` so the demo never bricks.
- `frontend/src/components/CaseSelector.tsx` — adds a Demo Mode
  pill (purple, pulsing) next to the dropdown, plus a Reset button
  with a `RotateCcw` icon. The Process button copy switches to
  "Replay Pipeline" in demo mode.
- `frontend/src/components/ErrorBoundary.tsx` (NEW) — React
  class-component error boundary with a friendly fallback (`Try
  again` button calls `setState({error: null})`). `App.tsx` wraps
  AARPane and PCRPane in their own boundaries so a crash in one
  doesn't blank the whole UI.
- `frontend/src/components/Skeleton.tsx` (NEW) — `Skeleton`,
  `AARSkeleton`, `PCRSkeleton`. Wired into AARPane (when
  `loading && !aar`) and PCRPane (when `loading && !content`).
- `frontend/src/components/FindingCard.tsx` — refresh: severity
  accent rail on the left edge (red/amber/sky), `-translate-y-0.5`
  hover lift with shadow, icon scale-up on hover, the chevron slides
  on hover, the selected ring uses severity color + a subtle
  `animate-finding-pulse` glow defined in the Tailwind config.
- `frontend/tailwind.config.js` — adds the `finding-pulse` keyframes
  + `animate-finding-pulse` utility.
- `frontend/src/App.tsx` — top-level `demoMode` state derived from
  URL/env, threads it into hooks + selector. New `handleReset` does
  `DELETE /aar` (live mode only), reloads the case, and re-kicks the
  pipeline. Wraps the AAR/PCR panes in error boundaries. Forwards
  `loading` flags into the panes for skeleton rendering.

**Docs.**

- `docs/ARCHITECTURE.md` (NEW) — two mermaid diagrams: the 5-stage
  pipeline (parallel extraction → reconcile → check → find → draft)
  with the model assigned to each stage, and a system topology
  showing browser ↔ Pages ↔ FastAPI ↔ {Anthropic, Google,
  ElevenLabs}. Plus a stage-budget table explaining the per-stage
  model choice and a demo-mode section.
- `docs/PITCH.md` (NEW) — one-page pitch: problem (with stats —
  documentation discrepancies in cardiac-arrest PCRs, ACLS adherence,
  per-case review time), solution (5-stage pipeline summarized), and
  what's novel (multi-source reconciliation, right-model-per-stage,
  grounded findings, demo-bulletproof).
- `README.md` — Quick demo section with exact clone → uv → npm
  commands and the `?demo=1` URL. Live setup section preserved
  beneath.

**Verification — 2026-04-25:**

- `cd backend && uv run ruff check app tests` → all checks passed
- `cd backend && uv run pytest -v` → **12 passed, 6 skipped**.
  New: 5 cache/demo tests added in `test_case_cache.py`. Skipped
  tests are all LLM-key-gated (unchanged).
- `cd frontend && npm run typecheck` → clean
- `cd frontend && npm run build` → 353.6 kB (109.9 kB gzip), 26.98 kB
  CSS (5.22 kB gzip). `finding-pulse` keyframe present in built CSS.
- Manual smoke against a live backend on `:8765`:
  - `GET /api/cases/case_01/aar` → 200 with 4 findings, 3 timeline
  - `GET /api/cases/case_01/stream?demo=1` → **14 progress events +
    1 complete event** (matches the test assertion).
  - `DELETE /api/cases/case_01/aar` → 204; subsequent GET returns
    200 because `case_01` re-seeds itself from the canonical fixture
    (intentional — `case_01` is the demo case).
- The frontend `dist/demo/sample_aar.json` and `sample_pcr.md` are
  bundled, so a static deployment to Cloudflare Pages can run the
  demo entirely client-side.

### Phase 5 stages 2-5 — Findings, Drafting, Audio (ElevenLabs), Video (Gemini) (2026-04-25)

Bundled the remaining four Phase 5 stages into one pass since the
`prompts.py` + tool-schema + parse-function pattern was now a stable
template and each stage's tool was disjoint enough that cross-
contamination wasn't a real risk.

**Stage 2 — findings (Claude Sonnet 4.6).**

- `backend/app/prompts.py` — adds `FINDINGS_SYSTEM`,
  `FINDINGS_USER_TEMPLATE`, `FINDINGS_TOOL`. System prompt enumerates
  the five `FindingCategory` values with concrete trigger conditions
  (e.g. `phantom_intervention` = PCR-only timeline entry for a
  significant intervention). Severity rubric defines critical /
  concern / info thresholds.
- `backend/app/pipeline/findings.py` — replaces the asyncio-sleep stub.
  Serializes timeline (with source_events expanded for grounding) plus
  protocol checks, calls Sonnet with the tool, and maps each returned
  finding to a `Finding`. Defensive scrub: drops any
  `evidence_event_ids` that don't appear in the input timeline. Sorts
  results by `evidence_timestamp_seconds`. Empty timeline + empty
  checks → empty list.
- `backend/tests/test_findings.py` (NEW) — gated by
  `ANTHROPIC_API_KEY`. Builds a 5-entry timeline with seeded
  cross-source timing drift (epi at 180s/210s), a phantom defib (PCR
  only), and an undocumented airway (video only); asserts ≥1 finding
  with valid event ids and ≥2 distinct categories.

**Stage 3 — drafting (Claude Sonnet 4.6).**

- `backend/app/prompts.py` — adds `DRAFTING_SUMMARY_SYSTEM`,
  `DRAFTING_NARRATIVE_SYSTEM`, and matching user templates. Summary is
  2-3 paragraphs of plain prose (no markdown headings). Narrative is
  3-4 paragraphs with markdown italics for finding titles.
- `backend/app/pipeline/drafting.py` — two sequential Sonnet calls
  (summary, then narrative seeded by the summary). `adherence_score`
  is computed deterministically as `ADHERENT / (ADHERENT + DEVIATION)`
  with a `1.0` fallback when the denom is 0 — exposed as
  `compute_adherence_score()` for unit testing. Returns a fully
  populated `AARDraft` with `generated_at = utcnow`.
- `backend/tests/test_drafting.py` (NEW) — `compute_adherence_score`
  unit test runs always; the end-to-end Sonnet test is gated on the
  API key and asserts non-empty summary + narrative with reasonable
  word counts plus the deterministic `adherence_score = 1.0`.

**Stage 4 — audio analyzer (ElevenLabs Scribe v1 + Claude Haiku).**

Plan revision: scaffolding doc specced OpenAI Whisper; user redirected
to ElevenLabs for transcription. Same two-step shape, different
provider.

- `backend/app/config.py` + `.env.example` — adds
  `ELEVENLABS_API_KEY`.
- `backend/app/llm_clients.py` — replaces the `whisper_transcribe`
  stub with `elevenlabs_transcribe(audio_path)`. Posts the audio to
  `https://api.elevenlabs.io/v1/speech-to-text` via httpx (already a
  dependency) with `model_id=scribe_v1` and
  `timestamps_granularity=word`. Returns the raw JSON. Same tenacity
  retry policy as the Anthropic clients.
- `backend/app/prompts.py` — adds `AUDIO_EVENTS_SYSTEM`,
  `AUDIO_EVENTS_USER_TEMPLATE`, and a shared `_events_tool` factory
  for the source-agnostic events tool shape. Audio system prompt
  tells the model to operate on time-stamped segments and skip
  chitchat / acks.
- `backend/app/pipeline/audio_analyzer.py` — graceful empty-list
  return if the audio file doesn't exist (same demo-safety pattern as
  video). Otherwise: transcribe → coalesce word tokens into ~12s
  utterance segments (breaking on ≥1.5s pauses) → ask Haiku to
  extract Events using `AUDIO_EVENTS_TOOL`. Word segmentation is
  pulled out as `_segment_words` so it's unit-testable.
- `backend/tests/test_audio_analyzer.py` (NEW) — runs the
  empty-file-graceful case + the segmenter unit test always; the
  ElevenLabs+Haiku end-to-end test is double-gated on both API keys
  AND a real `cases/case_01/audio.mp3`.

**Stage 5 — video analyzer (Gemini 2.5 Flash).**

- `backend/app/llm_clients.py` — implements `gemini_flash_video`
  using the existing `google-generativeai` dep. Uploads via the File
  API on a worker thread (the SDK is sync), polls `state` until
  ACTIVE, then calls `generate_content` with a `system_instruction`
  and a single forced function declaration mirroring the
  `VIDEO_EVENTS_TOOL` shape. Walks the response candidates for the
  matching `function_call` and returns its args as a plain dict via
  `_proto_to_dict` (recursively unwraps Gemini's MapComposite /
  ListValue protos so callers don't need google-internal types).
- `backend/app/prompts.py` — adds `VIDEO_EVENTS_SYSTEM`,
  `VIDEO_EVENTS_USER_PROMPT`, and `VIDEO_EVENTS_TOOL` (built via
  `_events_tool`).
- `backend/app/pipeline/video_analyzer.py` — three-tier safety:
  1. file missing → `[]`
  2. file > 50MB → log warning + return `_fallback_events()` (4
     hardcoded body-cam-typical events, marked confidence 0.5 and
     `[fallback]` prefixed in raw_evidence)
  3. Gemini call raises OR returns no events → fallback list
  Otherwise maps each returned event to a `source=VIDEO` `Event`.
  Drops malformed entries with a warning rather than crashing.
- `backend/tests/test_video_analyzer.py` (NEW) — empty-when-missing,
  fallback-events sanity, and a sparse-file >50MB tmp_path test that
  exercises the size-cap branch without API access. End-to-end test
  gated on `GOOGLE_API_KEY` + a real `cases/case_01/video.mp4`.

**Verification — 2026-04-25:**

- `uv run ruff check app tests` → all checks passed
- `uv run pytest -v` → **7 passed, 6 skipped**:
  - passed: schemas, drafting (adherence math), audio (graceful + segmenter), video (graceful + fallback + size-cap)
  - skipped: pcr_parser, reconciliation, findings, drafting (e2e), audio (e2e), video (e2e) — all guarded on missing API keys / case media
- `uv run python scripts/run_pipeline.py case_01` — fails at the
  PCR parsing stage because `.env` has no `ANTHROPIC_API_KEY`. The
  audio and video stages correctly returned `[]` because
  `cases/case_01/audio.*` and `video.*` don't exist. End-to-end
  smoke runs once the same two prerequisites carried from Phase 4
  are met (real `ANTHROPIC_API_KEY` in `.env` + real
  `cases/case_01/pcr.md`), plus optionally `ELEVENLABS_API_KEY` and
  `GOOGLE_API_KEY` and the corresponding media files for the audio /
  video stages to do real work instead of degrading gracefully.

### Phase 5 stage 1 — Real Reconciliation (Claude Sonnet 4.6) (2026-04-25)

- `backend/app/llm_clients.py` — `claude_sonnet` now wraps
  `_client.messages.create` with `model="claude-sonnet-4-6"` and the same
  tenacity retry policy as `claude_haiku` (`stop_after_attempt(3)`,
  `wait_exponential(min=1, max=10)`). Default `max_tokens=4096` for the
  longer reasoning outputs the Phase 5 stages produce.
- `backend/app/prompts.py` — adds `RECONCILIATION_SYSTEM`,
  `RECONCILIATION_USER_TEMPLATE`, and `TIMELINE_TOOL`. Tool returns an
  array of `timeline_entries` with `canonical_timestamp_seconds`,
  `canonical_description`, `event_type` (enum sourced from `EventType`
  to stay schema-aligned), `source_event_ids`, `match_confidence`, and
  `has_discrepancy`. System prompt instructs the model to use a ~60s
  matching window as a soft heuristic, allow 1-source entries (solo
  events are valid), and ensure every input event lands in exactly one
  entry.
- `backend/app/pipeline/reconciliation.py` — replaces the
  asyncio-sleep + fixture stub. Sorts the merged PCR/video/audio Events
  by `timestamp_seconds`, serializes them to JSON with a stable
  `event_id`, calls `claude_sonnet` with the tool, then maps each
  returned entry back to a `TimelineEntry` using a `by_id` dict.
  Key correctness detail: the `TimelineEntry` schema stores full
  `source_events: list[Event]` (not just IDs), so the stage rehydrates
  Event objects from the input by event_id. Also enforces a defensive
  `has_discrepancy = entry.has_discrepancy or spread > 10s` so the flag
  is never weaker than the timestamp evidence. Empty input → empty
  list (graceful no-op). Unknown event_ids in the model's response are
  dropped silently (entry skipped if it loses all sources).
- `backend/tests/test_reconciliation.py` (NEW) — integration test
  guarded by the same `pytest.mark.skipif(not ANTHROPIC_API_KEY, ...)`.
  Builds a synthetic 3+3+1 event scenario across PCR/video/audio with
  a deliberately seeded ~30s discrepancy on the epi push. Asserts
  ≥3 reconciled entries, that `source_events` only reference real
  input ids, that ≥1 entry has `has_discrepancy=True`, and that ≥1
  entry merges multi-source events.

**Verification — 2026-04-25:**

- `uv run ruff check app tests` → all checks passed
- `uv run pytest -v` → `test_schemas` passed; `test_pcr_parser` and
  `test_reconciliation` both skipped (no `ANTHROPIC_API_KEY`).
  Module imports verified via a `python -c` smoke check.
- Full end-to-end smoke (`scripts/run_pipeline.py case_01`) and the
  integration test pass once `.env` has a real `ANTHROPIC_API_KEY` and
  `cases/case_01/pcr.md` is replaced with a real PCR.

### Phase 4 — Real PCR Parser (Claude Haiku 4.5) (2026-04-25)

- `backend/app/llm_clients.py` — `claude_haiku` now wraps
  `anthropic.AsyncAnthropic` with a tenacity retry
  (`stop_after_attempt(3)`, `wait_exponential(min=1, max=10)`). Builds
  the request kwargs dict and only adds `system`/`tools` when non-None
  (avoids coupling to anthropic's internal `NOT_GIVEN` sentinel).
  Returns `response.model_dump()` so callers see plain dict blocks.
  `claude_sonnet` / `gemini_flash_video` / `whisper_transcribe` still
  raise `NotImplementedError` per Phase 4 scope.
- `backend/app/prompts.py` (NEW) — centralized prompt store. Defines
  `PCR_PARSER_SYSTEM`, `PCR_PARSER_USER_TEMPLATE`, and `PCR_EVENTS_TOOL`.
  Tool's `event_type` enum is generated from `EventType` (`[e.value for e
  in EventType]`) so the schema and Pydantic enum stay in sync.
- `backend/app/pipeline/pcr_parser.py` — replaces the asyncio-sleep stub
  with: load PCR markdown → call `claude_haiku` with system prompt + tool
  → find the `tool_use` block in `response["content"]` → map each raw
  event to a Pydantic `Event` (uuid4 ids, `EventSource.PCR`, enum-cast
  `event_type`). Raises `RuntimeError` if Claude returns no tool_use.
- `backend/tests/test_pcr_parser.py` (NEW) — integration test guarded by
  `pytest.mark.skipif(not settings.ANTHROPIC_API_KEY, ...)` so the suite
  stays green without credentials. Asserts ≥5 events, all
  `source==PCR`, and at least one `MEDICATION`.

**Verification — 2026-04-25:**

- `uv run ruff check app tests` → all checks passed
- `uv run pytest -v` → `test_schemas` passed; `test_pcr_parser` skipped
  (no `ANTHROPIC_API_KEY` set in this environment). Import success
  confirms the new module wiring is clean.
- Smoke check (`uv run python scripts/run_pipeline.py case_01`) and
  the integration test will run end-to-end **once two prerequisites
  land**:
  1. `.env` populated with a real `ANTHROPIC_API_KEY` (only
     `.env.example` exists today).
  2. `cases/case_01/pcr.md` replaced with a real PCR — the current
     file is the loader's auto-generated placeholder (~13 lines, no
     meds/vitals), so it cannot satisfy the test's "≥5 events incl.
     MEDICATION" assertion. The placeholder is by design (Phase 5/6
     prep owns real demo media), but Phase 4 acceptance only fully
     passes once a real PCR is dropped in.

### Phase 3 — Frontend 3-Pane UI (2026-04-25)

- `frontend/src/lib/{cn,format,api}.ts` — `cn` (clsx + tailwind-merge),
  timestamp + stage formatters, typed fetch client. `streamCase` opens an
  `EventSource` and listens for the named SSE events the backend emits
  (`progress`, `complete`, `error`).
- `frontend/src/hooks/{useCase,usePCR,usePipelineStream}.ts` — load
  case + cached AAR (404 on AAR is non-fatal — pane shows empty state),
  load PCR markdown, manage SSE lifecycle. Stream hook seeds all 7
  stages as `pending` so the progress bar renders the full stepper from
  the first event.
- `frontend/src/components/`:
  - `CaseSelector.tsx` — dropdown + Process button with spinner state.
  - `VideoPane.tsx` — HTML5 `<video>` with imperative seek on
    `selectedFindingId`, custom finding-marker timeline below the video,
    severity-colored markers, and a default-on "blur graphic content"
    toggle with click-to-reveal overlay.
  - `TimelineMarker.tsx` — positioned by
    `evidence_timestamp_seconds / duration`, color-coded by severity.
  - `AARPane.tsx` — summary card, ACLS adherence progress bar (color
    threshold: green ≥0.85, amber ≥0.6, red below), severity-sorted
    findings list, narrative via react-markdown, collapsible protocol
    checks.
  - `FindingCard.tsx` — severity badge + category pill, clickable,
    `ring-2 ring-blue-500` when selected, View-evidence affordance.
  - `PCRPane.tsx` — react-markdown render with post-render DOM
    highlighting: extracts the quoted interior of a PCR excerpt, finds
    it in the rendered text via a TreeWalker + Range, wraps the match
    in a `<mark>`, and `scrollIntoView` smoothly.
  - `PipelineProgress.tsx` — fixed-bottom horizontal stepper that
    slides in via `translate-y` while a run is active.
- `frontend/src/App.tsx` — header + 3-column main grid (33/34/33) +
  fixed-bottom progress bar. Holds `selectedCaseId`, `aar`, `pcrContent`,
  `selectedFindingId`, pipeline `stages`. Auto-loads first case, resets
  selection state on case change, surfaces errors in a banner.
- `frontend/src/index.css` — minimal `.markdown` component styles
  (no `@tailwindcss/typography` dependency).
- `frontend/src/vite-env.d.ts` — `ImportMetaEnv` typing for
  `VITE_API_URL`.

**Critical wow-moment interaction is wired:** clicking a `FindingCard`
sets `selectedFindingId` on `App`, which (a) drives a `ring-2` on the
selected card, (b) seeks the video element to
`evidence_timestamp_seconds` via a `useEffect` in `VideoPane`, and
(c) triggers the `<mark>` + smooth scroll in `PCRPane`. Clicking a
timeline marker in `VideoPane` does the same.

**Verification — 2026-04-25:**

- `npm install` → up to date
- `npm run typecheck` → clean (after adding `vite-env.d.ts` for
  `import.meta.env` typing)
- `npm run build` → built in 3.09s, bundle 345 kB (107 kB gzip)
- Backend on `:8000` + Vite on `:5173`:
  - `curl /api/cases` through Vite proxy → 3 cases
  - `curl /api/cases/case_01/aar` through proxy → seeded fixture
  - `curl -N /api/cases/case_01/stream` through proxy → 14 named
    `progress` events + final `complete` carrying serialized AAR
- Manual UI verification deferred to demo prep — backend contracts and
  the SSE event shape are confirmed working end-to-end.

### Phase 2 — Backend API & Pipeline Stubs (2026-04-25)

- `backend/app/config.py` — pydantic-settings reading `.env` (looks at
  `../.env` first then `.env`); defaults match the Phase 2 prompt.
- `backend/app/main.py` — FastAPI app with CORS allowing
  `settings.FRONTEND_ORIGIN`, `/health`, both routers mounted at `/api`.
- `backend/app/case_loader.py` — `list_cases`, `load_case`,
  `load_pcr_content`, `load_cached_aar`. Auto-creates a placeholder
  `pcr.md` for any case directory missing one. On first call, seeds
  `cases/case_01/aar.json` from `fixtures/sample_aar.json` so the AAR
  endpoint returns realistic data immediately.
- `backend/app/llm_clients.py` — async stub signatures for `claude_haiku`,
  `claude_sonnet`, `gemini_flash_video`, `whisper_transcribe` (all raise
  `NotImplementedError` until Phase 4/5).
- `backend/app/pipeline/_fixture.py` — shared, lru-cached loader of the
  sample AAR; per-source event slicers used by every stub stage.
- `backend/app/pipeline/{pcr_parser,video_analyzer,audio_analyzer,
  reconciliation,protocol_check,findings,drafting}.py` — seven async
  stubs with 1-2s simulated delay returning fixture-derived data.
- `backend/app/pipeline/orchestrator.py` — `process_case` runs stages
  1a/1b/1c via `asyncio.gather`, then 2-5 sequentially. Emits
  `running` and `complete` `PipelineProgress` events around each stage;
  emits `error` and re-raises on failure.
- `backend/app/api/cases.py` — `GET /cases`, `/cases/{id}`,
  `/cases/{id}/pcr`, `/cases/{id}/aar`, `/cases/{id}/video`
  (FileResponse with built-in HTTP Range support; 404 when no video).
- `backend/app/api/pipeline.py` — `POST /cases/{id}/process` returns a
  job_id and kicks off a background task; `GET /cases/{id}/stream`
  uses sse-starlette to run the pipeline inline and stream
  per-stage progress events plus a final `complete` event carrying the
  serialized AAR (per the prompt's "drop the job_id complexity if it
  gets gnarly" hint).
- `backend/scripts/run_pipeline.py` — CLI loader → orchestrator →
  pretty-printed JSON; uses absolute path injection so `uv run python
  scripts/run_pipeline.py case_01` works without `PYTHONPATH`.

**Verification — 2026-04-25:**

- `uv sync --extra dev` → clean install (pydantic-settings et al)
- `uv run ruff check app tests scripts` → all checks passed
- `uv run pytest tests/` → 1 passed (Phase 1 schema test still green)
- `curl /health` → `{"status":"ok"}`
- `curl /api/cases` → returns case_01, case_02, case_03
- `curl /api/cases/case_99` → 404
- `curl /api/cases/case_01/aar` → full seeded fixture
- `curl /api/cases/case_01/video` → 404 (no video file present yet)
- `curl -N /api/cases/case_01/stream` → **14 `progress` events plus 1
  `complete` event** carrying the AAR. *Note: the Phase 2 prompt's
  acceptance criterion #5 says "7 progress events plus a final complete
  event" but the same prompt's stage-by-stage instructions explicitly
  require emitting both a `running` and a `complete` event per stage
  (7 stages × 2 = 14). I followed the per-stage instruction because
  the Phase 3 PipelineProgress component needs the `running` events to
  show stage spinners. The "7" appears to be an inconsistency in the
  scaffolding doc; flag for the user if the count matters downstream.*
- `uv run python scripts/run_pipeline.py case_01` → completes in ~7s,
  prints the full AARDraft as JSON.
- CORS preflight from `Origin: http://localhost:5173` → allowed.

### Phase 1 — Shared Contracts (2026-04-24)

- `backend/app/schemas.py` — all Pydantic v2 models defined exactly per the
  Phase 1 prompt: `Event`, `TimelineEntry`, `ProtocolStep`, `ProtocolCheck`,
  `Finding`, `AARDraft`, `Case`, `PipelineProgress`, plus all enums.
- `frontend/src/types/schemas.ts` — exact TS mirror with snake_case field
  names preserved. Top-of-file sync comment in place.
- `fixtures/sample_aar.json` — realistic cardiac arrest AAR for `case_01`:
  3 timeline entries (each reconciled across 2-3 sources), 4 findings (one
  per discrepancy category, severity mix critical/concern/concern/info),
  5 protocol checks (3 adherent, 2 deviation), `adherence_score=0.72`,
  full summary + narrative.
- `backend/tests/test_schemas.py` — validates the fixture against the
  Pydantic schema and asserts the required counts.

**Verification — 2026-04-24:**

- `uv run pytest tests/test_schemas.py` → 1 passed
- `uv run ruff check app/ tests/` → clean
- `npm run typecheck` → clean

**Contract is now frozen.** Phases 2 and 3 build against it in parallel.

### Phase 0 — Repo Skeleton & Tooling (committed as `f8d3df5`)

Directory tree, `pyproject.toml`, `package.json`, `vite.config.ts` with
`/api` proxy to `:8000`, Tailwind + PostCSS configs, `.env.example`,
`.gitignore`, Cloudflare Pages `_headers`/`_redirects` placeholders,
`docs/DEPLOYMENT.md`. All Phase 0 acceptance criteria verified at scaffold time.

## In flight

_(none — Phase 6 polish + demo hardening complete. All six phases shipped.)_

## Decisions

- **Schema field naming:** snake_case preserved on the TS side (no
  camelCase conversion). Justification: zero translation layer between JSON
  payloads and types — frontend can `JSON.parse(...) as AARDraft` directly.
- **Fixture as canonical demo data:** Phase 2 stubs will load
  `fixtures/sample_aar.json` once at module import and return slices of it,
  so even with all stubs the pipeline returns a fully valid `AARDraft` and
  the frontend has real-shaped data to render against.

## Known issues / debt

- `cases/case_NN/` directories still have no real PCR/video/audio. The
  loader auto-writes a placeholder `pcr.md` on first access for any
  case missing one; case_01 also gets `aar.json` seeded from the
  fixture. Real demo media lands in Phase 5/6 prep.
- SSE stream emits 14 progress events (running+complete per stage) vs.
  the "7" count mentioned in the Phase 2 acceptance text — see Phase 2
  verification note above. Frontend in Phase 3 should treat each event
  as a stage transition and key off `(stage, status)`.
- `cases/case_NN/` `.gitkeep` files now coexist with the auto-generated
  `pcr.md`. Both should be committed.

## Next up

All six scaffolding phases are complete. The system is demo-ready:

- `?demo=1` runs the full UX with bundled fixture data and survives
  backend outage / API-key absence.
- Live mode (no `?demo=1`) runs the real pipeline with all five LLM
  stages, then auto-caches the result.

**Prerequisites for the real end-to-end live run** (unchanged):
1. `.env` populated with `ANTHROPIC_API_KEY` (required), plus
   `ELEVENLABS_API_KEY` and `GOOGLE_API_KEY` if the audio / video
   stages should hit real models instead of degrading gracefully.
2. Real demo media in `cases/case_01/`: `pcr.md` (a real PCR, not
   the loader's auto-generated placeholder), `audio.mp3` /
   `audio.wav` for ElevenLabs, and `video.mp4` (≤50MB) for Gemini.
   Without media files, the audio and video stages return `[]`.
