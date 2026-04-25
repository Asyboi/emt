# Sentinel

Agentic system for EMS quality review — turns Patient Care Reports,
body-cam video, and dispatch audio into a reviewer-ready After-Action
Report (AAR) with timeline reconciliation, protocol checks, and
discrepancy findings.

→ **Pitch:** [docs/PITCH.md](docs/PITCH.md)
→ **Architecture (mermaid diagrams):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
→ **Phased roadmap:** [docs/PLAN.md](docs/PLAN.md) — every phase is ✅
→ **Build log:** [docs/PROGRESS.md](docs/PROGRESS.md)

---

## TL;DR — run the demo in 3 minutes

```bash
git clone https://github.com/Asyboi/emt.git sentinel && cd sentinel

# Terminal A — backend
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Terminal B — frontend
cd frontend && npm install && npm run dev

# Open
open http://localhost:5173?demo=1
```

The `?demo=1` flag replays a cached AAR with synthetic stage delays —
**no API keys required, the demo works fully offline once the static
assets are built**.

Click **Replay Pipeline** in the header → the 7-stage progress bar
streams in → the AAR loads. Click any **Finding** card → the body-cam
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

There are **two ways to run** the system. Pick the one you need.

### A. Demo mode (no API keys, can't fail live on stage)

What it does:
- Frontend loads the pre-baked AAR from `cases/case_01/aar.json`
  (seeded from `fixtures/sample_aar.json`).
- "Replay Pipeline" emits the same SSE event shape the live pipeline
  uses, but each stage is just a 0.4 s delay and the result is the
  cached AAR.
- If the **backend itself is unreachable**, the frontend bundles
  `frontend/public/demo/sample_aar.json` + `sample_pcr.md` and falls
  back to a fully client-side synthetic stream — the UI still works.

How to start it:

```bash
# Terminal A — backend (optional in demo mode but recommended)
cd backend
uv sync
uv run uvicorn app.main:app --reload         # http://localhost:8000

# Terminal B — frontend
cd frontend
npm install
npm run dev                                   # http://localhost:5173

# Browser
http://localhost:5173?demo=1
```

You can also bake demo mode into a build:

```bash
cd frontend
VITE_DEMO_MODE=1 npm run build                # demo on by default in dist/
```

### B. Live mode (real LLM pipeline)

What it does:
- Hits Anthropic, Google Gemini, and ElevenLabs.
- Each stage runs for real and writes `cases/<id>/aar.json` to disk on
  success. Subsequent loads hit that cache; the **Reset** button
  (next to Process) deletes it and forces a fresh run.

How to start it:

```bash
# 1. Configure API keys (see "Environment" below)
cp .env.example .env
$EDITOR .env

# 2. Start backend + frontend (same as demo mode)
cd backend && uv sync && uv run uvicorn app.main:app --reload &
cd frontend && npm install && npm run dev

# 3. Browser — note: NO ?demo=1 query string
http://localhost:5173
```

Click **Process Case** in the header → real LLM calls fire → progress
bar reflects each stage's actual duration (~30 s – several minutes
depending on stage and case size).

---

## Environment variables

Copy `.env.example` to `.env` at the **repo root** (not inside
`backend/`). The backend reads `../.env` first then `./.env` (see
`backend/app/config.py`).

| Variable | Used by | Required for live mode? |
|---|---|---|
| `ANTHROPIC_API_KEY` | PCR parser, reconciliation, findings, drafting, audio events | **Yes** |
| `GOOGLE_API_KEY` | Video analyzer (Gemini 2.5 Flash) | Optional — without it, video stage returns `[]` |
| `ELEVENLABS_API_KEY` | Audio analyzer (Scribe v1) | Optional — without it, audio stage returns `[]` |
| `OPENAI_API_KEY` | (legacy slot, currently unused) | No |
| `CASES_DIR` | Backend case loader | Optional — defaults to `../cases` |
| `PROTOCOLS_DIR` | Protocol checker | Optional — defaults to `../protocols` |
| `FIXTURES_DIR` | Backend stubs / seed | Optional — defaults to `../fixtures` |
| `FRONTEND_ORIGIN` | CORS allowlist for production | Optional — defaults to `http://localhost:5173` |
| `VITE_API_URL` | Frontend production build only | Set this when deploying the frontend separately from the backend |
| `VITE_DEMO_MODE` | Frontend build-time flag (`1` to bake in demo mode) | Optional |

The pipeline degrades gracefully when keys / media are missing — it
won't crash, it just emits empty events for stages it can't run. So
**`ANTHROPIC_API_KEY` alone is enough for a meaningful live demo**.

---

## Demo media (live mode only)

For live mode to actually have audio and video to chew on, drop these
into `cases/case_01/`:

- `pcr.md` — a real PCR (replaces the loader's auto-generated
  placeholder)
- `audio.mp3` or `audio.wav` — dispatch audio (ElevenLabs Scribe)
- `video.mp4` (≤ 50 MB) — body-cam video (Gemini File API)

Without these files, those stages emit empty event lists and the AAR
ends up reflecting only the PCR. **Demo mode doesn't need them** — it
ships with bundled fallback data.

The `cases/` directory layout:

```
cases/
  case_01/
    pcr.md                # auto-generated placeholder if missing
    aar.json              # auto-cached after live runs (gitignored)
    audio.mp3             # gitignored
    video.mp4             # gitignored
  case_02/
  case_03/
```

---

## Common operations

### Run all backend tests

```bash
cd backend
uv run pytest -v
```

LLM-gated tests skip without API keys. Without keys you should see
`12 passed, 6 skipped`.

### Run a single backend test

```bash
cd backend
uv run pytest tests/test_case_cache.py::test_demo_stream_replays_cached_aar -v
```

### Lint / format backend

```bash
cd backend
uv run ruff check app tests           # lint
uv run ruff format app tests          # format
```

### Frontend typecheck / build

```bash
cd frontend
npm run typecheck                     # tsc --noEmit
npm run build                         # typecheck + vite build → dist/
npm run preview                       # serve built dist/ on :4173
```

### Run the pipeline from the CLI (no UI, no SSE)

Useful for quick smoke tests of the live pipeline:

```bash
cd backend
uv run python scripts/run_pipeline.py case_01
```

This loads `case_01`, runs the seven stages sequentially, and prints
the resulting `AARDraft` as JSON. Same `.env` rules apply.

### Reset a cached AAR

The **Reset** button in the UI does this through the API. From the CLI:

```bash
curl -X DELETE http://localhost:8000/api/cases/case_01/aar
```

(Note: `case_01` re-seeds itself from `fixtures/sample_aar.json` on
the next read — that's intentional, so the demo case never goes
empty.)

---

## API quick reference

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/cases` | List all cases |
| `GET` | `/api/cases/{id}` | Get case metadata |
| `GET` | `/api/cases/{id}/pcr` | `{ "content": "..." }` markdown |
| `GET` | `/api/cases/{id}/aar` | Cached `AARDraft`, 404 if none |
| `DELETE` | `/api/cases/{id}/aar` | Clear the cache (Reset) |
| `GET` | `/api/cases/{id}/video` | `FileResponse` of `video.mp4` (range support) |
| `POST` | `/api/cases/{id}/process` | Background job (returns `{job_id}`) |
| `GET` | `/api/cases/{id}/stream` | **SSE pipeline stream** (live) |
| `GET` | `/api/cases/{id}/stream?demo=1` | SSE pipeline stream (replay cached) |

The SSE stream emits 14 `progress` events (running + complete per
stage × 7 stages) and one final `complete` event carrying the AAR.

---

## Repo layout

```
backend/                    FastAPI + pipeline orchestrator
  app/
    main.py                 ASGI entrypoint (CORS, /health, /api/* routers)
    config.py               pydantic-settings, reads ../.env
    schemas.py              **single source of truth** for data contracts
    case_loader.py          cases/ + fixture I/O, AAR cache helpers
    llm_clients.py          Anthropic / Gemini / ElevenLabs wrappers
    prompts.py              all LLM prompts + tool schemas
    api/
      cases.py              GET/DELETE case + AAR endpoints
      pipeline.py           POST process + GET SSE stream (incl. demo replay)
    pipeline/
      orchestrator.py       process_case(): parallel extract → reconcile → check → find → draft
      pcr_parser.py         Claude Haiku 4.5 — structured PCR extraction
      video_analyzer.py     Gemini 2.5 Flash — body-cam events (with size-cap fallback)
      audio_analyzer.py     ElevenLabs Scribe v1 → Haiku event extraction
      reconciliation.py     Claude Sonnet 4.6 — multi-source timeline merge
      protocol_check.py     deterministic ACLS rule engine (no LLM)
      findings.py           Claude Sonnet 4.6 — five-category grounded findings
      drafting.py           Claude Sonnet 4.6 — two-call summary + narrative
  scripts/run_pipeline.py   CLI runner
  tests/                    pytest, asyncio_mode=auto
frontend/                   Vite + React 18 + TS + Tailwind
  src/
    App.tsx                 3-column layout, demo-mode wiring, error boundaries
    types/schemas.ts        **mirror of backend/app/schemas.py**
    components/             VideoPane, AARPane, PCRPane, FindingCard, …
    hooks/                  useCase, usePCR, usePipelineStream
    lib/                    api client, demo helpers, format/cn utils
  public/demo/              bundled offline fallback (sample_aar.json + pcr.md)
  vite.config.ts            /api/* proxy to :8000
cases/                      case bundles (PCR/audio/video/aar.json)
protocols/                  protocol definitions
fixtures/sample_aar.json    canonical demo AAR (seeded into case_01)
docs/                       PLAN, PROGRESS, ARCHITECTURE, PITCH, DEPLOYMENT
.env.example                copy to .env at the repo root
```

---

## Three-developer division

The phased plan (`docs/PLAN.md`) maps to a clean 3-person split:

- **Person 1 — Data:** `cases/`, `protocols/`, `fixtures/`, ground truth
- **Person 2 — Pipeline:** backend FastAPI app, LLM orchestration, stages
- **Person 3 — Frontend:** Vite/React 3-pane review UI

After Phase 1 locks the schemas, Phases 2 (backend) and 3 (frontend)
can run in parallel against the locked contract — same shape on both
sides, snake_case preserved across the wire so the frontend can do
`JSON.parse(...) as AARDraft` without translation.

---

## Troubleshooting

**`uv: command not found`** — `uv` installs to `~/.local/bin/uv`.
Either add that to `PATH` or use the absolute path:
`~/.local/bin/uv sync`.

**Backend starts but `GET /api/cases/case_01/aar` 404s** — the seed
file got deleted. Either click **Process Case** in the UI to
regenerate it, or `cp fixtures/sample_aar.json
cases/case_01/aar.json`.

**Frontend says "No video for this case"** — expected unless you've
dropped a real `video.mp4` into `cases/case_01/`. The body-cam pane
falls back to a placeholder; clicking findings still works (just
without the seek effect).

**Live pipeline crashes on PCR parsing** — your `.env` doesn't have
`ANTHROPIC_API_KEY` set, or the key is invalid. Sanity-check with:

```bash
cd backend && uv run python -c "from app.config import settings; print(bool(settings.ANTHROPIC_API_KEY))"
```

**SSE stream hangs** — the Vite dev server proxies `/api/*` to
`localhost:8000`. If the backend isn't running, the EventSource sits
open until it times out. In demo mode, the frontend falls back to a
client-side synthetic stream automatically; in live mode, start the
backend.
