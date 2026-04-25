# Sentinel — Progress Log

A running record of what's done, what's in flight, and what's blocked. Update
after every meaningful change. Newest entries at the top of each section.

## Completed

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
