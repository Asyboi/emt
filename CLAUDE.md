# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Sentinel

Hackathon agentic system that turns Patient Care Reports (PCR), body-cam video, and dispatch audio into a reviewer-ready After-Action Report (AAR) — timeline reconciliation, protocol checks, discrepancy findings.

The repo was built in **phases** defined by `sentinel_scaffolding_prompts.md` at the repo root. That file is the source of truth for what each phase added (and explicitly what NOT to touch). All six phases are now complete.

- Phase 0 — repo skeleton & tooling (✅ 2026-04-24)
- Phase 1 — shared contracts: Pydantic schemas + TS types + sample fixture (✅ 2026-04-24)
- Phase 2 — backend API & pipeline stubs (✅ 2026-04-25)
- Phase 3 — frontend 3-pane UI (✅ 2026-04-25)
- Phase 4 — real LLM integration, PCR parser via Claude Haiku 4.5 (✅ 2026-04-25)
- Phase 5 — remaining real stages: reconciliation → findings → drafting → audio → video (✅ 2026-04-25)
- Phase 6 — polish & demo hardening: demo mode, AAR caching, error boundaries, skeleton loaders, mermaid architecture diagram, pitch doc, README quickstart (✅ 2026-04-25)

The phased split mirrored a three-developer division: **Data** (`cases/`, `protocols/`, `fixtures/`), **Pipeline** (`backend/`), **Frontend** (`frontend/`). Phases 2 and 3 ran in parallel after Phase 1 locked the schemas — do not edit schemas without explicit user direction even now that all phases are done.

## Architecture

Two deployable units that talk over HTTP:

- **`backend/`** — FastAPI + Python 3.11+ async pipeline orchestrator. Self-hosted. Calls Anthropic (Claude Haiku 4.5 + Sonnet 4.6), Google (Gemini 2.5 Flash for video), and ElevenLabs (Scribe v1 for audio transcription) to process case media into structured events, reconcile timelines across sources, check protocols, and draft AARs. Auto-caches the resulting AAR to `cases/<id>/aar.json` after a successful live run.
- **`frontend/`** — Vite + React 18 + TypeScript + Tailwind. Deploys to Cloudflare Pages. The Vite dev server proxies `/api/*` → `http://localhost:8000` (see `frontend/vite.config.ts`); in production the frontend hits `VITE_API_URL` directly. Demo mode (`?demo=1` URL or `VITE_DEMO_MODE=1` build env) replays a cached AAR and works fully offline using bundled fixtures in `frontend/public/demo/`.

Schema contract: `backend/app/schemas.py` (Pydantic v2) is the single source of truth. `frontend/src/types/schemas.ts` mirrors it exactly. `fixtures/sample_aar.json` is shared between backend stubs/seeding and the frontend demo fallback — both sides build against it.

Cases live in `cases/case_NN/` (PCR, video, audio, ground truth, cached AAR). Video, audio, and `aar.json` are gitignored (`cases/*/video.*`, `cases/*/audio.*`, `cases/*/aar.json`).

## Running locally

See `README.md` for the user-facing version. Quick reference for Claude:

### Demo mode (no API keys)

```bash
# Terminal A
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Terminal B
cd frontend && npm install && npm run dev

# Browser: http://localhost:5173?demo=1
```

### Live mode (real LLM pipeline)

1. `cp .env.example .env` at the repo root and fill in `ANTHROPIC_API_KEY` (required), plus optionally `GOOGLE_API_KEY` and `ELEVENLABS_API_KEY`.
2. Same two terminals as above.
3. Browser: `http://localhost:5173` (no `?demo=1`).

Drop real demo media into `cases/case_01/` for the audio/video stages to do real work: `pcr.md`, `audio.mp3` or `audio.wav`, `video.mp4` (≤ 50 MB).

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
```

`uv` is installed at `~/.local/bin/uv` and may not be on PATH in non-interactive shells — use the absolute path if `uv` is not found. `pytest` is configured with `asyncio_mode = "auto"` (in `pyproject.toml`), so async tests don't need explicit markers.

Without API keys you should see `12 passed, 6 skipped` — the skipped tests are all guarded on `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, or `ELEVENLABS_API_KEY` plus matching media files.

### Frontend (from `frontend/`)

```bash
npm install
npm run dev              # Vite on :5173, proxies /api → :8000
npm run typecheck        # tsc --noEmit
npm run build            # typecheck + vite build → dist/
npm run preview          # serve built dist/
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build.

To bake demo mode into a build (useful for static-only deploys):

```bash
VITE_DEMO_MODE=1 npm run build
```

## API surface

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness |
| `GET` | `/api/cases` | List cases |
| `GET` | `/api/cases/{id}` | Case metadata |
| `GET` | `/api/cases/{id}/pcr` | `{ content }` markdown |
| `GET` | `/api/cases/{id}/aar` | Cached `AARDraft`, 404 if absent |
| `DELETE` | `/api/cases/{id}/aar` | Clear cache (Reset button) |
| `GET` | `/api/cases/{id}/video` | `FileResponse` with HTTP Range |
| `POST` | `/api/cases/{id}/process` | Background job |
| `GET` | `/api/cases/{id}/stream` | SSE pipeline stream (live) |
| `GET` | `/api/cases/{id}/stream?demo=1` | SSE replay of cached AAR |

The SSE stream emits 14 `progress` events (running + complete per stage × 7 stages) and one final `complete` event carrying the AAR. The frontend in `usePipelineStream` keys on `(stage, status)` to drive the progress bar.

## Environment

Copy `.env.example` to `.env` at the repo root. Backend reads (in priority order: `../.env` first then `.env`):

- LLM keys: `ANTHROPIC_API_KEY` (required for live mode), `GOOGLE_API_KEY` (Gemini), `ELEVENLABS_API_KEY` (Scribe). Without optional keys, the corresponding stage returns `[]` rather than crashing.
- Data paths: `CASES_DIR`, `PROTOCOLS_DIR`, `FIXTURES_DIR` (defaults to `../cases`, `../protocols`, `../fixtures`).
- `FRONTEND_ORIGIN` — CORS allowlist for the deployed Pages domain (default `http://localhost:5173`).
- `OPENAI_API_KEY` — legacy slot, currently unused. Audio went to ElevenLabs Scribe instead of OpenAI Whisper during Phase 5 (see `docs/PLAN.md`).

Frontend uses `VITE_API_URL` only in production builds — local dev uses the Vite `/api` proxy and ignores it. `VITE_DEMO_MODE=1` bakes demo mode on at build time; otherwise the URL `?demo=1` query param toggles it at runtime.

## Conventions

- **Commits:** plain messages, no `Co-Authored-By: Claude` trailer in this repo.
- **Phase boundaries:** each phase prompt lists what NOT to touch. Even though all phases are now done, respect the schema contract — never modify `schemas.py` / `schemas.ts` without paired updates on both sides and explicit user agreement.
- **One concern per file:** pipeline stages live in their own files; API routers split by resource. Don't pile features into existing files because it's faster.
- **Centralized prompts:** all LLM prompts live in `backend/app/prompts.py`. Never inline a prompt in a pipeline file.
- **No silent failures:** every external call (LLM, file read, network) needs error handling that retries (tenacity), falls back gracefully, or surfaces a clear error to the user.
- **Type everything:** Pydantic v2 on the backend, TypeScript interfaces on the frontend. No `any`, no untyped dicts in function signatures.
- **Shell:** the user's shell is fish, but the Bash tool runs bash. Use absolute paths or `cd` into a directory rather than relying on shell-specific syntax.

## When making changes

`.claude/SKILL.md` has the full development workflow. Highlights:

1. Read `docs/PLAN.md`, `docs/PROGRESS.md`, `backend/app/schemas.py`, and `frontend/src/types/schemas.ts` before touching code.
2. Match existing patterns (e.g. tool-use with Pydantic conversion in pipeline stages).
3. Add tests in the same change. Backend: `backend/tests/`; gate LLM-dependent tests on the relevant API key. Frontend: at minimum a typecheck pass.
4. Run the verification suite before declaring done:
   ```bash
   cd backend && uv run ruff check app tests && uv run pytest -v
   cd frontend && npm run typecheck && npm run build
   ```
5. Smoke test the full pipeline after backend changes:
   ```bash
   cd backend && uv run python scripts/run_pipeline.py case_01
   ```
6. Update `docs/PROGRESS.md` with what changed, decisions made, and any new debt.
