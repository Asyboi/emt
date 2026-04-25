# Sentinel

Agentic system for EMS quality review — turns Patient Care Reports, body-cam video, and dispatch audio into a reviewer-ready After-Action Report (AAR) with timeline reconciliation, protocol checks, and discrepancy findings.

## Repo layout

- `backend/` — FastAPI + Python pipeline orchestrator
- `frontend/` — Vite + React + TypeScript UI (Cloudflare Pages deployable)
- `cases/` — case directories (PCR, video, audio, ground truth)
- `protocols/` — protocol definitions (e.g. ACLS)
- `fixtures/` — sample data used by tests and dev mode
- `docs/` — architecture, deployment, pitch

## Three-developer division

- **Person 1 — Data:** cases, protocols, fixtures, ground truth
- **Person 2 — Pipeline:** backend FastAPI app, LLM orchestration, stages
- **Person 3 — Frontend:** Vite/React 3-pane review UI

See `docs/` for details (architecture, deployment, etc.).

## Setup

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on http://localhost:5173 and proxies `/api` to the backend on http://localhost:8000.
