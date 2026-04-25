# Sentinel Backend API

FastAPI service that orchestrates the multi-source QI Case Review pipeline.
All non-health routes live under `/api`. The frontend hits these via the
Vite `/api` proxy in dev (`http://localhost:8000`) and via `VITE_API_URL`
in production.

CORS allows the configured `FRONTEND_ORIGIN` (default
`http://localhost:5173`).

## Endpoints

### `GET /health`

Liveness probe. Returns `{"status": "ok"}`.

```bash
curl http://localhost:8000/health
```

### `GET /api/cases`

List all cases. Returns `list[Case]`.

```bash
curl http://localhost:8000/api/cases
```

### `GET /api/cases/{case_id}`

Fetch case metadata. 404 if the case directory is missing.

```bash
curl http://localhost:8000/api/cases/case_01
```

### `GET /api/cases/{case_id}/pcr`

Fetch the PCR markdown content. Auto-creates a placeholder `pcr.md`
if none exists for the case.

Response shape: `{"content": "<markdown>"}`.

```bash
curl http://localhost:8000/api/cases/case_01/pcr
```

### `GET /api/cases/{case_id}/review`

Fetch the cached `QICaseReview`. Returns 404 if the pipeline hasn't been
run for this case (and no cached review exists). For `case_01` the
backend lazily seeds a copy of `fixtures/sample_qi_review.json` into
`cases/case_01/review.json` so this endpoint always returns realistic
data for the demo case.

```bash
curl http://localhost:8000/api/cases/case_01/review
```

### `DELETE /api/cases/{case_id}/review`

Clear the cached review. Returns 204 whether or not the file existed
(idempotent at the HTTP layer; 404 only if the case directory itself
doesn't exist). The frontend's "Reset" button uses this.

> Note: `case_01` re-seeds itself from the fixture on next read, so
> deleting + reading is idempotent rather than destructive.

```bash
curl -X DELETE http://localhost:8000/api/cases/case_01/review
```

### `GET /api/cases/{case_id}/video`

Stream the body-cam video file. Honors HTTP Range so the frontend
`<video>` element can seek without downloading the full file. Returns
404 if no `video.{mp4,mov,webm}` exists for the case.

```bash
curl -I http://localhost:8000/api/cases/case_01/video
```

### `POST /api/cases/{case_id}/process`

Kick off the pipeline as a background task. Returns
`{"job_id": "<uuid>", "case_id": "<id>"}`. The actual progress is
delivered via the SSE stream below — the job_id is informational
(used for telemetry / future cancellation hooks).

```bash
curl -X POST http://localhost:8000/api/cases/case_01/process
```

### `GET /api/cases/{case_id}/stream`

Server-Sent Events stream of pipeline progress. Two modes:

- **Live (default):** runs the actual pipeline (PCR parser → video →
  audio → reconciliation → protocol check → findings → drafting),
  emits `progress` events for each `running` and `complete` stage
  transition, and finishes with a `complete` event carrying the full
  `QICaseReview`. Saves the result to `cases/{id}/review.json` for
  future cache hits.
- **Demo (`?demo=1`):** replays the cached review with synthetic
  per-stage delays. Used by demo mode to keep the UX intact when the
  backend can't reach upstream LLMs.

Events emitted (named SSE events):

| Event       | Payload shape                                                                                  |
|-------------|------------------------------------------------------------------------------------------------|
| `progress`  | `PipelineProgress` JSON: `{ stage, status, started_at, completed_at?, error_message? }`        |
| `complete`  | `{ "type": "complete", "review": <QICaseReview JSON> }`                                        |
| `error`     | `{ "type": "error", "message": "<reason>" }`                                                   |

Live mode emits **14 `progress` events** (running + complete per stage
× 7 stages) followed by **1 `complete` event**. Demo mode emits the
same shape so the frontend handler doesn't branch.

```bash
# Live (requires upstream API keys)
curl -N http://localhost:8000/api/cases/case_01/stream

# Demo replay (works offline against the cached review)
curl -N "http://localhost:8000/api/cases/case_01/stream?demo=1"
```

## Caching

The pipeline result is cached at `cases/{case_id}/review.json`. On
backend startup, any pre-existing `cases/*/aar.json` files (legacy
naming from before the QI Case Review update) are renamed to
`review.json` automatically — the migration is one-way and safe to
re-run because it skips any directory that already has a `review.json`.

## Schema

`QICaseReview` is the canonical pipeline output. See
`backend/app/schemas.py` for the Pydantic model and
`frontend/src/types/schemas.ts` for the matching TypeScript shape.
The fixture at `fixtures/sample_qi_review.json` is the canonical
example and is what `case_01` lazily seeds.

## CORS

Set `FRONTEND_ORIGIN` in the backend `.env` to the deployed frontend's
URL (e.g. `https://sentinel.example.pages.dev`). The default
`http://localhost:5173` works for local Vite dev.
