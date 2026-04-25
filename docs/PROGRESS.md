# Sentinel — Progress Log

A running record of what's done, what's in flight, and what's blocked. Update
after every meaningful change. Newest entries at the top of each section.

## Completed

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

_(none — Phase 1 just landed; Phase 2 and Phase 3 are next and parallelizable)_

## Decisions

- **Schema field naming:** snake_case preserved on the TS side (no
  camelCase conversion). Justification: zero translation layer between JSON
  payloads and types — frontend can `JSON.parse(...) as AARDraft` directly.
- **Fixture as canonical demo data:** Phase 2 stubs will load
  `fixtures/sample_aar.json` once at module import and return slices of it,
  so even with all stubs the pipeline returns a fully valid `AARDraft` and
  the frontend has real-shaped data to render against.

## Known issues / debt

- Phase 0 backend has no `app/main.py` yet — Phase 2 will add it.
- `cases/case_NN/` directories exist but have no PCR/video/audio yet.
  Phase 2's case loader will seed a placeholder `pcr.md` on first run.

## Next up

**Phase 2 (Pipeline owner):** FastAPI app, pipeline orchestrator, 5 stub
stages, SSE streaming, CLI runner. Must not modify schemas or fixture.

**Phase 3 (Frontend owner):** 3-pane UI, click-to-seek interaction, SSE
subscription. Must not touch backend. Can run concurrently with Phase 2 once
both sides have the locked Phase 1 contract.
