# Sentinel

Agentic system for EMS quality review — turns Patient Care Reports
(PCR), body-cam video, dispatch audio, and CAD records into a
reviewer-ready **QI Case Review** with timeline reconciliation,
protocol checks, clinical assessment, discrepancy findings, and
structured recommendations.

→ **Pitch:** [docs/PITCH.md](docs/PITCH.md)
→ **Architecture (mermaid diagrams):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
→ **Phased roadmap:** [docs/PLAN.md](docs/PLAN.md) — every phase is ✅
→ **Build log:** [docs/PROGRESS.md](docs/PROGRESS.md)

---

## TL;DR — run it in 3 minutes

```bash
git clone https://github.com/Asyboi/emt.git sentinel && cd sentinel

# Terminal A — backend
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Terminal B — frontend
cd frontend && npm install && npm run dev

# Open
open http://localhost:5173
```

The frontend lands on a marketing page — click into the app and
either pick a cached case (no API keys needed) or upload a new one to
trigger the live pipeline. Click any **Finding** card → the body-cam
seeks to that second AND the matching PCR sentence is highlighted.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | ≥ 3.11 | system / pyenv |
| `uv` | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | ≥ 18 (LTS recommended) | nvm / fnm / system |
| npm | bundled with Node | — |

`uv` installs to `~/.local/bin/uv` by default; make sure that's on your
`PATH` (or use the absolute path).

---

## Run modes

The frontend exposes two **data sources** (toggled by URL param) and
the backend exposes two **streaming modes** (live or replay).

### A. Local mock data (no backend required)

Default mode. The frontend reads bundled mock fixtures from
`src/mock/mock_data.ts` — useful for UI work without running the
backend at all.

```bash
cd frontend && npm install && npm run dev
# Browser: http://localhost:5173?local
```

### B. Live mode (real LLM pipeline)

What it does:
- Hits Anthropic, Google Gemini, and ElevenLabs.
- Each pipeline stage runs for real and the result is cached to
  `cases/<id>/review.json`. Subsequent loads hit that cache; the
  **Reset** action clears it and forces a fresh run.
- The on-disk schema is `QICaseReview` (the previous `AARDraft` has
  been retired). On startup the backend auto-migrates legacy
  `cases/*/aar.json` files to `review.json` if they parse against the
  current schema.

How to start it:

```bash
# 1. Configure API keys (see "Environment" below)
cp .env.example .env
$EDITOR .env

# 2. Start backend + frontend
cd backend && uv sync && uv run uvicorn app.main:app --reload &
cd frontend && npm install && npm run dev

# 3. Browser — `?remote` switches the frontend to the live API
http://localhost:5173?remote
```

Use **New Report** in the UI to upload an ePCR (PDF/XML), CAD JSON,
audio, and video — or pick a previously confirmed PCR from the
saved-PCR picker on the same page. Or use **PCR Auto-Draft** to skip
the ePCR entirely and have Sentinel generate one from media before
running QI review. Confirmed drafts also show up in the **Archive**
tab and have a read-only view at `/pcr/:caseId`.

### C. Backend SSE replay (`?demo=1` on the stream endpoint)

`GET /api/cases/{id}/stream?demo=1` replays the cached
`QICaseReview` over Server-Sent Events with the same event shape as
the live pipeline (running/complete per stage with small synthetic
delays). Useful for demo videos and offline presentations whenever a
review is already cached on disk.

---

## Environment variables

Copy `.env.example` to `.env` at the **repo root** (not inside
`backend/`). The backend reads `../.env` first then `./.env` (see
[backend/app/config.py](backend/app/config.py)).

| Variable | Used by | Required for live mode? |
|---|---|---|
| `ANTHROPIC_API_KEY` | PCR parser, reconciliation, findings, drafting, audio events, PCR auto-draft | **Yes** |
| `GOOGLE_API_KEY` | Video analyzer (Gemini 2.5 Flash) | Optional — without it, video stage returns `[]` |
| `ELEVENLABS_API_KEY` | Audio analyzer (Scribe v1) | Optional — without it, audio stage returns `[]` |
| `OPENAI_API_KEY` | (legacy slot, currently unused) | No |
| `CASES_DIR` | Backend case loader | Optional — defaults to `../cases` |
| `PROTOCOLS_DIR` | Protocol checker | Optional — defaults to `../protocols` |
| `FIXTURES_DIR` | Backend stubs / seed | Optional — defaults to `../fixtures` |
| `FRONTEND_ORIGINS` | CORS allowlist (comma-separated) | Optional — defaults to `http://localhost:5173` |
| `VITE_API_URL` | Frontend production build only | Set this when deploying the frontend separately from the backend |
| `VITE_DATA_SOURCE` | Frontend default source (`local` or `remote`) | Optional — overridden by `?local` / `?remote` URL params |

The pipeline degrades gracefully when keys / media are missing — it
won't crash, it just emits empty events for stages it can't run. So
**`ANTHROPIC_API_KEY` alone is enough for a meaningful live demo**.

---

## Demo media (live mode only)

Real cases live in `cases/case_NN/`. Drop these in for the audio,
video, and CAD stages to do real work:

- `pcr.md` — plain-text PCR (auto-generated as a placeholder if missing)
- `audio.mp3` / `audio.wav` / `audio.m4a` — dispatch audio (ElevenLabs Scribe)
- `video.mp4` (≤ 50 MB) — body-cam video (Gemini File API)
- `cad.json` — NYC EMS CAD record (no LLM, deterministic Pydantic parse)

Without those files the corresponding stages emit empty events. The
`POST /api/cases` endpoint accepts uploads for any combination of
ePCR / audio / video / CAD and creates a new `case_NN` directory
under `CASES_DIR`.

The `cases/` layout:

```
cases/
  case_01/
    pcr.md                # plain-text PCR (auto-placeholder if missing)
    pcr.original.md       # original ePCR text (when uploaded)
    pcr_draft.json        # PCR auto-draft state (status, markdown, edits)
    cad.json              # NYC EMS CAD record
    review.json           # cached QICaseReview (gitignored)
    audio.mp3             # gitignored
    video.mp4             # gitignored
  case_02/
  case_03/
```

Confirmed PCR auto-drafts are also persisted to `pcr_store/<case>.json`
(sibling to `cases/`) so they can be browsed across cases via
`GET /api/pcr-drafts`.

---

## Common operations

### Run all backend tests

```bash
cd backend
uv run pytest -v
```

LLM-gated tests skip without API keys.

### Run a single backend test

```bash
cd backend
uv run pytest tests/test_case_cache.py -v
```

### Lint / format backend

```bash
cd backend
uv run ruff check app tests           # lint
uv run ruff format app tests          # format
```

### Frontend typecheck / build / test

```bash
cd frontend
npm run typecheck                     # tsc --noEmit
npm run build                         # typecheck + vite build → dist/
npm run test                          # vitest (adapters + source tests)
```

### Run the pipeline from the CLI (no UI, no SSE)

Useful for quick smoke tests of the live pipeline:

```bash
cd backend
uv run python scripts/run_pipeline.py case_01
uv run python scripts/run_pipeline.py case_01 --summary
```

This loads `case_01`, runs the eight stages (CAD + PCR + video +
audio in parallel, then reconciliation → protocol-check → findings →
drafting), and prints the resulting `QICaseReview` as JSON. Same
`.env` rules apply.

### Reset a cached review

```bash
curl -X DELETE http://localhost:8000/api/cases/case_01/review
```

`case_01` re-seeds itself from `fixtures/sample_qi_review.json` on
the next read — that's intentional, so the demo case never goes
empty.

---

## API quick reference

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/cases` | List all cases |
| `POST` | `/api/cases` | Create a case from uploaded ePCR / audio / video / CAD; also accepts `pcr_source_case_id` to clone a saved PCR's body into the new case |
| `GET` | `/api/cases/{id}` | Get case metadata |
| `GET` | `/api/cases/{id}/pcr` | `{ "content": "..." }` markdown |
| `GET` | `/api/cases/{id}/review` | Cached `QICaseReview`, 404 if none |
| `DELETE` | `/api/cases/{id}/review` | Clear the cache (Reset) |
| `GET` | `/api/cases/{id}/video` | `FileResponse` of the body-cam video (range support) |
| `POST` | `/api/cases/{id}/process` | Background job (returns `{job_id, case_id}`) |
| `GET` | `/api/cases/{id}/stream` | **SSE pipeline stream** (live) |
| `GET` | `/api/cases/{id}/stream?demo=1` | SSE replay of the cached `QICaseReview` |
| `POST` | `/api/cases/{id}/pcr-draft` | Trigger PCR auto-draft (video + audio + CAD → markdown) |
| `GET` | `/api/cases/{id}/pcr-draft` | Poll the current `PCRDraft` |
| `PATCH` | `/api/cases/{id}/pcr-draft/confirm` | EMT confirms (and may edit) the drafted PCR |
| `GET` | `/api/pcr-drafts` | List all confirmed drafts from `pcr_store/` |

The SSE stream emits 16 `progress` events (running + complete per
stage × 8 stages) and one final `complete` event carrying the
`QICaseReview`. The replay (`?demo=1`) skips the CAD stage and emits
14 events for the remaining 7.

---

## Repo layout

```
backend/                    FastAPI + pipeline orchestrator (v0.3.0)
  app/
    main.py                 ASGI entrypoint (CORS, /health, /api/* routers, lifespan migration)
    config.py               pydantic-settings, reads ../.env
    schemas.py              **single source of truth** for data contracts
    case_loader.py          cases/ I/O, review.json cache + legacy aar.json migration
    pcr_store.py            persistent confirmed-PCR store (pcr_store/{case}.json)
    llm_clients.py          Anthropic / Gemini / ElevenLabs wrappers
    prompts.py              all LLM prompts + tool schemas
    api/
      cases.py              GET/POST/DELETE cases + review endpoints
      pipeline.py           POST process + GET SSE stream (incl. demo replay)
      pcr_draft.py          PCR auto-draft endpoints + saved-PCR list
    pipeline/
      orchestrator.py       process_case(): cad/pcr/video/audio in parallel → reconcile → check → find → draft
      cad_parser.py         deterministic CAD JSON → CADRecord (no LLM)
      pcr_parser.py         Claude Haiku 4.5 — structured PCR extraction
      video_analyzer.py     Gemini 2.5 Flash — body-cam events (with size-cap fallback)
      audio_analyzer.py     ElevenLabs Scribe v1 → Haiku event extraction
      reconciliation.py     Claude Sonnet 4.6 — multi-source timeline merge
      protocol_check.py     deterministic ACLS rule engine (no LLM)
      protocols.py          protocol family selection from CAD call types
      findings.py           Claude Sonnet 4.6 — five-category grounded findings
      drafting.py           Claude Sonnet 4.6 — QICaseReview synthesis
      pcr_drafter.py        Claude Sonnet 4.6 — PCR auto-draft (pre-pipeline)
  scripts/run_pipeline.py   CLI runner
  tests/                    pytest, asyncio_mode=auto
frontend/                   Vite + React 18 + TS + Tailwind + React Router
  src/
    main.tsx                bootstrap; demo session reload guard
    app/
      App.tsx               <RouterProvider />
      routes.tsx            Landing + Layout + QIReviewLayout route tree
      landing/              marketing page + sections
      pages/                dashboard, new-report, pcr-new, pcr-draft, pcr-view, processing, review, finalize, archive
      components/           layout, qi-review-layout, demo-nav, ui/ (shadcn-style), figma/
    lib/
      pcr-highlight.ts      [UNCONFIRMED] highlighter, count, section parser (shared by draft + view)
      pcr-template.ts       PCR_BLANK_TEMPLATE for manual writing fallback
    data/
      api.ts                API_BASE resolution
      source.ts             local (mock) vs remote (backend) DataSource
      adapters.ts           QICaseReview → IncidentReport UI shape
      sse.ts                useProcessingStream — SSE consumer
      hooks.ts              useIncident / useIncidentList
      pcr-api.ts            PCR auto-draft client
      pcr-hooks.ts          React hooks for PCR draft polling
    types/backend.ts        **mirror of backend/app/schemas.py**
    types.ts                UI-facing IncidentReport / IncidentSummary types
    mock/mock_data.ts       offline mock fixtures (?local mode)
    styles/                 tailwind.css, theme.css, fonts.css
  vite.config.ts            /api/* proxy to :8000, `figma:asset/` resolver
  vitest.config.ts          unit tests for adapters + source
cases/                      case bundles (PCR/audio/video/cad/review.json)
pcr_store/                  persistent confirmed PCR drafts (created on first confirm)
protocols/                  protocol definitions (placeholder — rules live in pipeline/protocol_check.py)
fixtures/sample_qi_review.json    canonical demo QI review (seeded into case_01)
docs/                       PLAN, PROGRESS, ARCHITECTURE, PITCH, DEPLOYMENT, audits
.env.example                copy to .env at the repo root
```

---

## Three-developer division

The phased plan ([docs/PLAN.md](docs/PLAN.md)) maps to a clean 3-person split:

- **Person 1 — Data:** `cases/`, `protocols/`, `fixtures/`, ground truth
- **Person 2 — Pipeline:** backend FastAPI app, LLM orchestration, stages
- **Person 3 — Frontend:** Vite/React review UI

After Phase 1 locked the schemas, Phases 2 (backend) and 3 (frontend)
ran in parallel against the locked contract — same shape on both
sides, snake_case preserved across the wire so the frontend can do
`JSON.parse(...) as QICaseReview` without translation (the
`adapters.ts` layer reshapes it for UI components).

---

## Troubleshooting

**`uv: command not found`** — `uv` installs to `~/.local/bin/uv`.
Either add that to `PATH` or use the absolute path:
`~/.local/bin/uv sync`.

**Backend starts but `GET /api/cases/case_01/review` 404s** — the
seed file got deleted. Either click **Process Case** in the UI to
regenerate it, or `cp fixtures/sample_qi_review.json cases/case_01/review.json`.

**Legacy `aar.json` warnings on startup** — pre-Phase-6 caches are
auto-migrated to `review.json` by `migrate_legacy_aar_caches()` at
startup. Files that don't parse against the current `QICaseReview`
schema are deleted; the next pipeline run regenerates them.

**Frontend says "No video for this case"** — expected unless you've
dropped a real video into `cases/<id>/`. The body-cam pane falls
back to a placeholder; clicking findings still works (just without
the seek effect).

**Live pipeline crashes on PCR parsing** — your `.env` doesn't have
`ANTHROPIC_API_KEY` set, or the key is invalid. Sanity-check with:

```bash
cd backend && uv run python -c "from app.config import settings; print(bool(settings.ANTHROPIC_API_KEY))"
```

**SSE stream hangs** — the Vite dev server proxies `/api/*` to
`localhost:8000`. If the backend isn't running in `?remote` mode the
EventSource sits open until it times out. Switch to `?local` for
mock-only UI work, or start the backend.
