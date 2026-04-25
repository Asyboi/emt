# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Sentinel

Hackathon agentic system that turns Patient Care Reports (PCR), body-cam video, and dispatch audio into a reviewer-ready After-Action Report (AAR) — timeline reconciliation, protocol checks, discrepancy findings.

The repo is built in **phases** defined by `sentinel_scaffolding_prompts.md` at the repo root. That file is the source of truth for what each phase adds (and explicitly what NOT to touch). When the user says "start phase N", read that phase's prompt block and execute it within its stated scope.

- Phase 0 — repo skeleton & tooling (✅ complete as of 2026-04-24)
- Phase 1 — shared contracts (Pydantic schemas + TS types + sample fixture)
- Phase 2 — backend API & pipeline stubs
- Phase 3 — frontend 3-pane UI
- Phase 4 — real LLM integration (PCR parser first)
- Phase 5 — remaining real stages (video, audio, reconciliation, protocol, findings, drafting)
- Phase 6 — polish & demo hardening

The phased split mirrors a three-developer division: **Data** (cases/, protocols/, fixtures/), **Pipeline** (backend), **Frontend** (frontend/). Phases 2 and 3 run in parallel after Phase 1 locks the schemas — do not edit schemas during Phase 2/3 work without explicit user direction.

## Architecture

Two deployable units that talk over HTTP:

- **`backend/`** — FastAPI + Python 3.11+ async pipeline orchestrator. Self-hosted. Calls Anthropic, Google, and OpenAI LLM SDKs to process case media into structured events, reconcile timelines across sources, check protocols, and draft AARs.
- **`frontend/`** — Vite + React 18 + TypeScript + Tailwind. Deploys to Cloudflare Pages. The Vite dev server proxies `/api/*` → `http://localhost:8000` (see `frontend/vite.config.ts`); in production the frontend hits `VITE_API_URL` directly.

Schema contract: `backend/app/schemas.py` (Pydantic v2) is the single source of truth. `frontend/src/types/schemas.ts` mirrors it exactly. `fixtures/sample_aar.json` is shared between backend stubs and frontend dev — both sides build against it.

Cases live in `cases/case_NN/` (PCR, video, audio, ground truth). Video and audio binaries are gitignored (`cases/*/video.*`, `cases/*/audio.*`).

## Commands

### Backend (from `backend/`)

```bash
uv sync                                          # install deps (creates .venv/)
uv run uvicorn app.main:app --reload             # dev server on :8000
uv run pytest                                    # run all tests
uv run pytest tests/test_foo.py::test_bar        # single test
uv run ruff check .                              # lint
uv run ruff format .                             # format
```

`uv` is installed at `~/.local/bin/uv` and may not be on PATH in non-interactive shells — use the absolute path if `uv` is not found. `pytest` is configured with `asyncio_mode = "auto"` (in `pyproject.toml`), so async tests don't need explicit markers.

### Frontend (from `frontend/`)

```bash
npm install
npm run dev              # Vite on :5173, proxies /api → :8000
npm run typecheck        # tsc --noEmit
npm run build            # typecheck + vite build → dist/
npm run preview          # serve built dist/
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build.

## Environment

Copy `.env.example` to `.env` at the repo root. Backend reads LLM keys (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`), data paths (`CASES_DIR`, `PROTOCOLS_DIR`, `FIXTURES_DIR`), and `FRONTEND_ORIGIN` (CORS allowlist for the deployed Pages domain). Frontend uses `VITE_API_URL` only in production builds — local dev uses the Vite `/api` proxy and ignores it.

## Conventions

- **Commits:** plain messages, no `Co-Authored-By: Claude` trailer in this repo.
- **Phase boundaries:** each phase prompt lists what NOT to touch. Respect those — premature work in a later phase's territory pollutes the next phase's context.
- **Shell:** the user's shell is fish, but the Bash tool runs bash. Use absolute paths or `cd` into a directory rather than relying on shell-specific syntax.
