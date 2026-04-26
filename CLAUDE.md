# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Sentinel

Hackathon agentic system that turns Patient Care Reports (PCR), body-cam video, dispatch audio, and CAD records into a reviewer-ready **QI Case Review** — timeline reconciliation, protocol checks, discrepancy findings, clinical assessment, and structured recommendations. The system also includes a **PCR Auto-Draft** pre-pipeline that synthesizes a draft PCR from media when one isn't provided.

The repo was built in **phases** defined by `sentinel_scaffolding_prompts.md` at the repo root. That file is the source of truth for what each phase added (and explicitly what NOT to touch). All six phases are now complete; subsequent work added CAD ingestion, the QI Case Review schema migration, the PCR Auto-Draft flow, and a multi-page React Router frontend.

- Phase 0 — repo skeleton & tooling (✅)
- Phase 1 — shared contracts: Pydantic schemas + TS types + sample fixture (✅)
- Phase 2 — backend API & pipeline stubs (✅)
- Phase 3 — frontend 3-pane UI (✅)
- Phase 4 — real LLM integration, PCR parser via Claude Haiku 4.5 (✅)
- Phase 5 — remaining real stages: reconciliation → findings → drafting → audio → video (✅)
- Phase 6 — polish & demo hardening: demo mode, review caching, error boundaries, mermaid architecture diagram, pitch doc, README quickstart (✅)

Post-Phase-6 work (not phased): CAD parser stage; `AARDraft` → `QICaseReview` schema rename + on-disk migration; PCR Auto-Draft endpoints; React Router multi-page UI; landing page; case-creation upload endpoint.

The phased split mirrored a three-developer division: **Data** (`cases/`, `protocols/`, `fixtures/`), **Pipeline** (`backend/`), **Frontend** (`frontend/`). Phases 2 and 3 ran in parallel after Phase 1 locked the schemas — do not edit schemas without explicit user direction.

## Architecture

Two deployable units that talk over HTTP:

- **`backend/`** — FastAPI + Python 3.11+ async pipeline orchestrator (v0.3.0). Self-hosted. Calls Anthropic (Claude Haiku 4.5 + Sonnet 4.6), Google (Gemini 2.5 Flash for video), and ElevenLabs (Scribe v1 for audio transcription) to process case media into structured events, reconcile timelines across sources, check protocols, and produce a `QICaseReview`. Auto-caches the resulting review to `cases/<id>/review.json` after a successful live run. On startup, a `lifespan` handler runs `migrate_legacy_aar_caches()` to upgrade any old `aar.json` files (renames if they parse, deletes if they don't).
- **`frontend/`** — Vite + React 18 + TypeScript + Tailwind + React Router. Multi-page app: Landing → Dashboard → New Report (with saved-PCR picker) / PCR Auto-Draft → PCR Draft Review → Read-only PCR View (`/pcr/:caseId`) → Processing → Review → Finalize → Archive (cases tab + confirmed-PCR tab). The Vite dev server proxies `/api/*` → `http://localhost:8000` (see [frontend/vite.config.ts](frontend/vite.config.ts)); in production the frontend hits `VITE_API_URL` directly. The data source is selected via URL: `?local` for bundled mock fixtures (no backend needed), `?remote` for the live API. Default is `local`; override via `VITE_DATA_SOURCE`. Shared PCR utilities — `[UNCONFIRMED]` highlighter, section parser, blank template — live in [frontend/src/lib/pcr-highlight.ts](frontend/src/lib/pcr-highlight.ts) and [frontend/src/lib/pcr-template.ts](frontend/src/lib/pcr-template.ts) and are used by both the draft and view pages.

Schema contract: [backend/app/schemas.py](backend/app/schemas.py) (Pydantic v2) is the single source of truth. [frontend/src/types/backend.ts](frontend/src/types/backend.ts) mirrors it exactly. [fixtures/sample_qi_review.json](fixtures/sample_qi_review.json) is shared between backend stubs/seeding and the frontend mock fallback. The top-level output type is `QICaseReview` (replacing the old `AARDraft`); the corresponding on-disk cache file is `cases/<id>/review.json`.

The frontend never reads raw backend JSON in components — every payload that crosses the API boundary passes through [frontend/src/data/adapters.ts](frontend/src/data/adapters.ts), which reshapes `QICaseReview` into the UI's `IncidentReport` type.

Cases live in `cases/case_NN/` (PCR, video, audio, CAD, ground truth, cached review). Video, audio, `review.json`, and `pcr_draft.json` are gitignored.

## Running locally

See [README.md](README.md) for the user-facing version. Quick reference for Claude:

### Mock mode (no API keys, frontend only)

```bash
# Frontend reads from src/mock/mock_data.ts — no backend needed
cd frontend && npm install && npm run dev

# Browser: http://localhost:5173?local
```

### Live mode (real LLM pipeline)

1. `cp .env.example .env` at the repo root and fill in `ANTHROPIC_API_KEY` (required), plus optionally `GOOGLE_API_KEY` and `ELEVENLABS_API_KEY`.
2. Two terminals:

```bash
# Terminal A
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Terminal B
cd frontend && npm install && npm run dev
```

3. Browser: `http://localhost:5173?remote`.

Drop real demo media into `cases/case_01/` for the audio/video/CAD stages to do real work: `pcr.md`, `audio.{mp3,wav,m4a}`, `video.mp4` (≤ 50 MB), `cad.json`. Or use `POST /api/cases` (the **New Report** UI) to upload them.

## Commands

### Backend (from `backend/`)

```bash
uv sync                                          # install deps (creates .venv/)
uv run uvicorn app.main:app --reload             # dev server on :8000
uv run pytest                                    # run all tests (LLM-gated tests skip without keys)
uv run pytest tests/test_foo.py::test_bar        # single test
uv run ruff check app tests                      # lint
uv run ruff format app tests                     # format
uv run python scripts/run_pipeline.py case_01    # CLI smoke test of the live pipeline
uv run python scripts/run_pipeline.py case_01 --summary   # condensed output
```

`uv` is installed at `~/.local/bin/uv` and may not be on PATH in non-interactive shells — use the absolute path if `uv` is not found. `pytest` is configured with `asyncio_mode = "auto"` (in [backend/pyproject.toml](backend/pyproject.toml)), so async tests don't need explicit markers.

Without API keys the LLM-dependent tests (gated on `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, or `ELEVENLABS_API_KEY` plus matching media files) skip automatically.

### Frontend (from `frontend/`)

```bash
npm install
npm run dev              # Vite on :5173, proxies /api → :8000
npm run typecheck        # tsc --noEmit
npm run build            # typecheck + vite build → dist/
npm run test             # vitest (adapters.test.ts, source.test.ts)
npm run test:watch       # vitest in watch mode
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build.

## API surface

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness |
| `GET` | `/api/cases` | List cases |
| `POST` | `/api/cases` | Create a case from uploaded ePCR (PDF/XML) / audio / video / CAD, or clone a previously confirmed PCR via the `pcr_source_case_id` form field. At least one source required; a saved PCR wins over an uploaded ePCR if both are sent. |
| `GET` | `/api/cases/{id}` | Case metadata |
| `GET` | `/api/cases/{id}/pcr` | `{ content }` markdown |
| `GET` | `/api/cases/{id}/review` | Cached `QICaseReview`, 404 if absent |
| `DELETE` | `/api/cases/{id}/review` | Clear cache (Reset button) |
| `GET` | `/api/cases/{id}/video` | `FileResponse` with HTTP Range |
| `POST` | `/api/cases/{id}/process` | Background job (returns `{job_id, case_id}`) |
| `GET` | `/api/cases/{id}/stream` | SSE pipeline stream (live) |
| `GET` | `/api/cases/{id}/stream?demo=1` | SSE replay of cached `QICaseReview` |
| `POST` | `/api/cases/{id}/pcr-draft` | Trigger PCR auto-draft from video + audio + CAD |
| `GET` | `/api/cases/{id}/pcr-draft` | Poll the current `PCRDraft` |
| `PATCH` | `/api/cases/{id}/pcr-draft/confirm` | EMT confirms (and may edit) the draft; writes to `pcr.md` and `pcr_store/<id>.json` |
| `GET` | `/api/pcr-drafts` | List all confirmed drafts from the persistent store |

The live SSE stream emits 16 `progress` events (running + complete per stage × 8 stages: cad/pcr/video/audio in parallel, then reconciliation → protocol_check → findings → drafting) and one final `complete` event carrying the `QICaseReview`. The `?demo=1` replay skips CAD and emits 14 events for 7 stages. The frontend's `useProcessingStream` ([frontend/src/data/sse.ts](frontend/src/data/sse.ts)) keys on `(stage, status)` to drive the progress UI.

## Environment

Copy `.env.example` to `.env` at the repo root. Backend reads (in priority order: `../.env` first then `.env`):

- LLM keys: `ANTHROPIC_API_KEY` (required for live mode), `GOOGLE_API_KEY` (Gemini), `ELEVENLABS_API_KEY` (Scribe). Without optional keys, the corresponding stage returns `[]` rather than crashing.
- Data paths: `CASES_DIR`, `PROTOCOLS_DIR`, `FIXTURES_DIR` (defaults to `../cases`, `../protocols`, `../fixtures`).
- `FRONTEND_ORIGINS` — comma-separated CORS allowlist (default `http://localhost:5173`).
- `OPENAI_API_KEY` — legacy slot, currently unused. Audio went to ElevenLabs Scribe instead of OpenAI Whisper during Phase 5 (see [docs/PLAN.md](docs/PLAN.md)).

Frontend: `VITE_API_URL` is used only in production builds — local dev uses the Vite `/api` proxy and ignores it. `VITE_DATA_SOURCE` (`local` or `remote`) sets the default data source; `?local` / `?remote` URL params override it at runtime.

## Conventions

- **Commits:** plain messages, no `Co-Authored-By: Claude` trailer in this repo.
- **Phase boundaries:** each phase prompt lists what NOT to touch. Even though the phased plan is done, respect the schema contract — never modify [backend/app/schemas.py](backend/app/schemas.py) / [frontend/src/types/backend.ts](frontend/src/types/backend.ts) without paired updates on both sides and explicit user agreement.
- **One concern per file:** pipeline stages live in their own files; API routers split by resource. Don't pile features into existing files because it's faster.
- **Centralized prompts:** all LLM prompts live in [backend/app/prompts.py](backend/app/prompts.py). Never inline a prompt in a pipeline file.
- **No silent failures:** every external call (LLM, file read, network) needs error handling that retries (tenacity), falls back gracefully, or surfaces a clear error to the user.
- **Type everything:** Pydantic v2 on the backend, TypeScript interfaces on the frontend. No `any`, no untyped dicts in function signatures.
- **Frontend never reads raw backend JSON in components.** All `QICaseReview` payloads pass through [frontend/src/data/adapters.ts](frontend/src/data/adapters.ts) before reaching UI code.
- **Shell:** the user's shell is fish, but the Bash tool runs bash. Use absolute paths or `cd` into a directory rather than relying on shell-specific syntax.

## When making changes

`.claude/SKILL.md` has the full development workflow. Highlights:

1. Read [docs/PLAN.md](docs/PLAN.md), [docs/PROGRESS.md](docs/PROGRESS.md), [backend/app/schemas.py](backend/app/schemas.py), and [frontend/src/types/backend.ts](frontend/src/types/backend.ts) before touching code.
2. Match existing patterns (e.g. tool-use with Pydantic conversion in pipeline stages).
3. Add tests in the same change. Backend: `backend/tests/`; gate LLM-dependent tests on the relevant API key. Frontend: at minimum a typecheck pass; adapter/source changes warrant a vitest case.
4. Run the verification suite before declaring done:
   ```bash
   cd backend && uv run ruff check app tests && uv run pytest -v
   cd frontend && npm run typecheck && npm run test && npm run build
   ```
5. Smoke test the full pipeline after backend changes:
   ```bash
   cd backend && uv run python scripts/run_pipeline.py case_01
   ```
6. Update [docs/PROGRESS.md](docs/PROGRESS.md) with what changed, decisions made, and any new debt.
