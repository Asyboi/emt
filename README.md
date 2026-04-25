# Sentinel

Agentic system for EMS quality review — turns Patient Care Reports,
body-cam video, and dispatch audio into a reviewer-ready After-Action
Report (AAR) with timeline reconciliation, protocol checks, and
discrepancy findings.

→ **Pitch:** [docs/PITCH.md](docs/PITCH.md)
→ **Architecture (with mermaid diagrams):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Quick demo

The demo path uses bundled fixture data and degrades gracefully when
API keys aren't set, so a fresh clone can show the UI within a couple
of minutes.

```bash
# 1. Clone
git clone <this repo> sentinel && cd sentinel

# 2. Backend (terminal A)
cd backend
uv sync                                  # installs into .venv/
uv run uvicorn app.main:app --reload     # serves http://localhost:8000

# 3. Frontend (terminal B)
cd ../frontend
npm install
npm run dev                              # serves http://localhost:5173

# 4. Open the UI
#    http://localhost:5173?demo=1
#    The ?demo=1 flag replays the cached AAR with synthetic stage
#    delays so the demo never depends on live LLM calls.
```

That's it — clicking **Replay Pipeline** in the header will stream the
seven-stage progress UI and load the seeded AAR for `case_01`. Clicking
any Finding card seeks the body-cam to the matching second and
highlights the matching PCR sentence.

For a live (real-LLM) run, drop API keys into a `.env` file at the repo
root (see `.env.example`) and click **Process Case** without `?demo=1`.

### Demo mode details

- `?demo=1` (URL) or `VITE_DEMO_MODE=1` (build-time env var) puts the
  frontend in demo mode.
- In demo mode, **the page loads even with the backend offline** — the
  fixture is bundled at `frontend/public/demo/sample_aar.json`.
- The `Reset` button re-runs the pipeline (live or replay, depending on
  mode); in live mode it also clears `cases/<id>/aar.json` so the next
  run is genuinely fresh.

## Repo layout

- `backend/` — FastAPI + Python pipeline orchestrator
- `frontend/` — Vite + React + TypeScript UI (Cloudflare Pages deployable)
- `cases/` — case directories (PCR, video, audio, ground truth)
- `protocols/` — protocol definitions (e.g. ACLS)
- `fixtures/` — sample data used by tests and dev mode
- `docs/` — architecture, pitch, deployment, plan, progress

## Three-developer division

- **Person 1 — Data:** cases, protocols, fixtures, ground truth
- **Person 2 — Pipeline:** backend FastAPI app, LLM orchestration, stages
- **Person 3 — Frontend:** Vite/React 3-pane review UI

See `docs/PLAN.md` for the phased plan and `docs/PROGRESS.md` for the
running log of what's done.

## Setup (full / live mode)

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
uv run pytest -v                          # tests (LLM-gated tests skip without keys)
```

### Frontend

```bash
cd frontend
npm install
npm run dev                               # http://localhost:5173, proxies /api → :8000
npm run typecheck                         # tsc --noEmit
npm run build                             # production build → dist/
```

### Environment

Copy `.env.example` to `.env` at the repo root and fill in
`ANTHROPIC_API_KEY` (required for live runs), plus optionally
`GOOGLE_API_KEY` (Gemini video) and `ELEVENLABS_API_KEY` (Scribe
audio). Without them, those stages return graceful empty results
instead of crashing.
