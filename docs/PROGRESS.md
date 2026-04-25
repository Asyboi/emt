# Sentinel — Progress Log

A running record of what's done, what's in flight, and what's blocked. Update
after every meaningful change. Newest entries at the top of each section.

## Completed

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

_(none — Phase 2 just landed; Phase 3 is next and unblocked)_

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

**Phase 3 (Frontend owner):** 3-pane UI, click-to-seek interaction, SSE
subscription. Backend on `:8000` is a fully working black box — frontend
can build directly against `/api/cases`, `/api/cases/{id}/aar`,
`/api/cases/{id}/pcr`, and the `/api/cases/{id}/stream` SSE endpoint.
