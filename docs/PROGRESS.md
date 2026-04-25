# Sentinel — Progress Log

A running record of what's done, what's in flight, and what's blocked. Update
after every meaningful change. Newest entries at the top of each section.

## Completed

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
