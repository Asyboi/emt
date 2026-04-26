# INTEGRATION AUDIT — Calyx frontend ↔ Sentinel backend

Read-only audit of every seam between the React frontend (`frontend/`, branded "Calyx") and the FastAPI backend (`backend/`, branded "Sentinel"). Captured against the working tree on `main` at the time of audit.

---

## 1. Backend API surface

Mounted in `backend/app/main.py`. Three routers under `/api`, plus a top-level health endpoint. Schemas referenced live in `backend/app/schemas.py`.

### CORS (`main.py:21-27`)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],   # default "http://localhost:5173"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- Single allowed origin, sourced from `FRONTEND_ORIGIN` env (default `http://localhost:5173`).
- Wildcard methods/headers; credentials allowed.
- No preflight cache directive — browsers will re-issue OPTIONS per route.

### Routes

| Method | Path | Request body | Response model | Notes |
|---|---|---|---|---|
| `GET` | `/health` | — | `{"status": "ok"}` | Liveness, no `/api` prefix |
| `GET` | `/api/cases` | — | `list[Case]` | `case_loader.list_cases()` |
| `GET` | `/api/cases/{case_id}` | — | `Case` | 404 if not found |
| `GET` | `/api/cases/{case_id}/pcr` | — | `{"content": str}` (raw markdown) | Not a typed Pydantic model |
| `GET` | `/api/cases/{case_id}/review` | — | `QICaseReview` | 404 if no `cases/<id>/review.json` cached |
| `DELETE` | `/api/cases/{case_id}/review` | — | 204 No Content | Clears cache |
| `GET` | `/api/cases/{case_id}/video` | — | `FileResponse` (`video/mp4`) | Tries `video.mp4` / `.mov` / `.webm`; supports HTTP Range |
| `POST` | `/api/cases/{case_id}/process` | — | `{"job_id": str, "case_id": str}` | Background `asyncio.Task` runs the pipeline. Progress is **dropped** (`_noop_progress`) — this endpoint is fire-and-forget; the SSE endpoint is the real one. |
| `GET` | `/api/cases/{case_id}/stream?demo=<bool>` | — | `text/event-stream` | SSE; see below. |
| `POST` | `/api/cases/{case_id}/pcr-draft` | — | `PCRDraft` | Kicks off background draft, returns pending placeholder |
| `GET` | `/api/cases/{case_id}/pcr-draft` | — | `PCRDraft` | Poll for draft status |
| `PATCH` | `/api/cases/{case_id}/pcr-draft/confirm` | `{"edited_markdown": str, "confirmed_by": str = "emt"}` | `PCRDraft` | Writes `cases/<id>/pcr.md`, marks draft confirmed |

`Case`, `QICaseReview`, `PCRDraft` are defined in `schemas.py:315`, `:276`, `:352`.

### SSE: `GET /api/cases/{case_id}/stream`

Implementation: `backend/app/api/pipeline.py:107-159` (live) and `:56-104` (demo).

**Event types emitted:**

| `event:` name | `data:` payload (JSON) | When |
|---|---|---|
| `progress` | `PipelineProgress.model_dump_json()` — fields: `stage`, `status` ∈ `{pending, running, complete, error}`, `started_at`, `completed_at`, `error_message` | Twice per stage (`running` then `complete`/`error`) |
| `complete` | `{"type": "complete", "review": <QICaseReview JSON>}` | Terminal, after pipeline finishes; backend also caches `review.json` |
| `error` | `{"type": "error", "message": str}` | Terminal on exception |

`PipelineStage` values emitted (`schemas.py:326`): `cad_parsing`, `pcr_parsing`, `video_analysis`, `audio_analysis`, `reconciliation`, `protocol_check`, `findings`, `drafting`. `pcr_drafting` is defined but **not** emitted by the orchestrator — it's used only by the pre-pipeline auto-drafter API (separate flow).

In live mode the orchestrator (`pipeline/orchestrator.py:75`) runs cad/pcr/video/audio in parallel via `asyncio.gather`, then reconciliation → protocol_check → findings → drafting sequentially. So the `running` events for the four parallel stages can interleave.

In demo mode (`?demo=1`) the backend skips CAD entirely and replays seven stages in a fixed order with 0.4 s between `running` and `complete`, then sends the cached review.

CLAUDE.md claims "14 progress events × 7 stages"; actual stage count emitted live is **8** (CAD is included), and demo replays **7**. Worth noting if the frontend keys progress on a stage list.

---

## 2. Frontend data layer

Lives in `frontend/src/data/` (single-source-of-truth abstraction) and `frontend/src/mock/mock_data.ts` (the only data right now). Hooks in `frontend/src/data/hooks.ts` are the only consumer surface used by pages.

### `DataSource` interface — `frontend/src/data/source.ts:30-34`

```ts
export interface DataSource {
  mode: DataSourceMode;                                  // 'local' | 'remote'
  listIncidents(): Promise<IncidentSummary[]>;
  getIncident(id: string): Promise<IncidentReport>;
}
```

Two methods. Both return frontend-shaped types from `src/types.ts`. There is **no** SSE / streaming method, no PCR-draft method, no upload method, no video URL helper — the backend's larger surface has no frontend abstraction yet.

### Mode resolution — `source.ts:12-28`

Priority: `?local` / `?remote` URL param → `import.meta.env.VITE_DATA_SOURCE` → default `'local'`. `resolveMode()` is called per `getDataSource()` call (no cached choice), so toggling the URL works without reload.

### `localSource` — `source.ts:36-44`

| Method | Returns | Source |
|---|---|---|
| `listIncidents` | `mockIncidentList` (10 hand-coded summaries, `mock_data.ts:266-277`) | static array |
| `getIncident(id)` | `buildMockReport(id)` (`mock_data.ts:288-299`) | re-keys the single fixture `primaryReport` against any requested ID |

Only one real fixture is hand-built — `primaryReport` for `INC-2026-04-0231`. Every other archive entry is the same fixture with `id`, `date`, `crew`, `status` overlaid.

### `remoteSource` — `source.ts:46-54`

Both methods are stubs:

```ts
async listIncidents() { throw new Error('Remote data source not implemented yet'); },
async getIncident(_id) { throw new Error('Remote data source not implemented yet'); },
```

Nothing wired to fetch. No base URL, no SSE, no error handling.

### Call sites that pick local vs remote

The split happens in exactly **one** place: `getDataSource()` (`source.ts:56-58`). Every page goes through `useIncidentList()` or `useIncident(id)` in `hooks.ts`, which call `getDataSource()` internally. So the mode toggle is centralized — switching `remoteSource` to a real implementation hooks up the whole UI.

Pages that consume the hooks:
- `frontend/src/app/pages/archive.tsx:9` — `useIncidentList()`
- `frontend/src/app/pages/review.tsx:22` — `useIncident(resolvedId)`
- `frontend/src/app/pages/finalize.tsx:19` — `useIncident(resolvedId)`
- `frontend/src/app/pages/processing.tsx:140` — `useIncident(PRIMARY_MOCK_INCIDENT_ID)` (always loads the primary mock; ignores any case-id from the route)

Other env / flag references:
- `VITE_DATA_SOURCE` — `source.ts:21`. Only env var the frontend reads.
- `?local` / `?remote` URL params — `source.ts:14-17`.
- `?demo=1` URL param — read by **backend** SSE (`pipeline.py:110`); the frontend never reads or sets it. `dashboard.tsx:10` does `navigate('/processing?demo=1')`, but `processing.tsx` ignores query params entirely (no SSE call there at all).

No `VITE_API_URL` / `VITE_API_BASE` reference exists anywhere in `frontend/src`.

---

## 3. Type gap analysis

Backend returns `QICaseReview` (`schemas.py:276-312`). Frontend consumes `IncidentReport` (`frontend/src/types.ts:81-98`). They were not designed against each other — the frontend types describe the demo UI, and the backend types describe the QI pipeline.

### Field-by-field

**Backend `QICaseReview` only — no frontend equivalent:**

| Backend field | Type | Notes |
|---|---|---|
| `case_id` | str | Frontend uses `id: string` instead — could map. |
| `generated_at` | datetime | No FE field |
| `reviewer_id` | str = "sentinel_agent_v1" | No FE field |
| `incident_date`, `incident_type`, `responding_unit` | datetime / str / str | FE flattens to `date`, `time`, `crew` strings |
| `crew_members` | `list[CrewMember]` (role + identifier) | FE has `crew: string` (single concatenated label) |
| `patient_age_range`, `patient_sex`, `chief_complaint` | str / Literal / str | Only `chief_complaint` has an FE analog (`pcr.chiefComplaint`) |
| `incident_summary` | str | No dedicated field — would map to one of the 9 `ReportSection`s |
| `timeline` | `list[TimelineEntry]` (rich: `entry_id`, `canonical_timestamp_seconds`, `event_type`, `source_events: list[Event]`, `match_confidence`, `has_discrepancy`) | FE has `timelineEvents: TimelineEvent[]` with only `{time, label, category}`. Massive shape mismatch. |
| `clinical_assessment` | `list[ClinicalAssessmentItem]` (10 categories × MET/NOT_MET/NA/INSUFFICIENT) | No FE field |
| `documentation_quality` | `DocumentationQualityAssessment` (3 scores + issues) | No FE field |
| `findings` | `list[Finding]` (severity, category, title, explanation, evidence_event_ids, pcr_excerpt, suggested_review_action) | FE has `pipeline.findings: PipelineFinding[]` with `{type: 'success'\|'warning', message, sources}` — different shape, different semantics. |
| `protocol_checks` | `list[ProtocolCheck]` | No FE field |
| `adherence_score` | float | No FE field |
| `utstein_data` | `Optional[UtsteinData]` | No FE field |
| `recommendations` | `list[Recommendation]` (audience, priority, description, related_finding_ids) | No FE field |
| `determination` | `ReviewerDetermination` enum | No FE field |
| `determination_rationale` | str | No FE field |
| `reviewer_notes`, `human_reviewed` | str / bool | No FE field |
| `cad_record` | `Optional[CADRecord]` | FE has `cadLog: CadEvent[]` — totally different (log of dispatch lines vs single CAD record with timestamps) |

**Frontend `IncidentReport` only — no backend equivalent:**

| Frontend field | Notes |
|---|---|
| `time: string` | Backend has `incident_date: datetime` only; no separate time. |
| `crew: string` | Backend uses `responding_unit` + `crew_members[]`. |
| `status: 'draft'\|'finalized'` | Backend's nearest is `human_reviewed: bool` plus `determination`. Not a 1:1. |
| `sections: ReportSection[]` | Frontend has 9 hand-titled sections (INCIDENT SUMMARY, TIMELINE RECONSTRUCTION, etc.). Backend has none of this — closest are `incident_summary`, `findings`, `clinical_assessment`, `recommendations`. **A mapper has to invent the section structure.** |
| `pcr: PcrMetadata` | `{incidentNumber, unit, crew, chiefComplaint}` — partially derivable from backend (`responding_unit`, `chief_complaint`, `cad_record.cad_incident_id`). |
| `cadLog: CadEvent[]` | List of `{time, message}` lines. Backend has `cad_record` (single record) plus the `Event` stream from CAD source — would need synthesis. |
| `pipeline: { elapsedSeconds, progressPct, agentTiles, findings, audioLogs }` | Pure UI state. **No backend equivalent.** Lives only in the mock; SSE was the intended source. |

**Naming/shape conflicts where the words match but the shapes don't:**
- `findings` — backend = QI clinical findings with severity/category; frontend = pipeline progress chips with `success|warning`. Same name, different concept.
- `timeline` vs `timelineEvents` — backend events are timestamped seconds + clustered evidence; frontend events are pre-formatted strings.
- `case_id` vs `id` — trivial, but every fixture uses `INC-...` prefixes that don't match backend's `case_NN` directory names.

### Adapters / transforms

There is **no** adapter function anywhere. `frontend/src/types.ts:1-3` says:

```
// These describe the shape the UI consumes; remote mode will adapt the backend
// QICaseReview into these shapes.
```

That adapter does not yet exist. `remoteSource.getIncident` is the throw-stub.

The closest precedent is `frontend/src/mock/mock_data.ts:288 buildMockReport()`, which composes an `IncidentReport` from constants — that's the shape any backend→frontend adapter has to produce.

---

## 4. SSE wiring

The `/processing` page does **not** use SSE.

`frontend/src/app/pages/processing.tsx:140`:
```ts
const { data: incident, loading, error } = useIncident(PRIMARY_MOCK_INCIDENT_ID);
```

It loads the static mock for the primary incident and reads `incident.pipeline` (`elapsedSeconds`, `progressPct`, `agentTiles`, `findings`, `audioLogs`) — all hard-coded values from `mock_data.ts:247-264`. The status badges (`complete` / `active` / `waiting`) on the four sub-tiles and the four stage cards (`ePCR PARSER`, `AUDIO ANALYZER`, `CAD SYNC`, `RECONCILIATION`, `PROTOCOL CHECK`, `REPORT DRAFTER`) come from the same mock.

Searching the codebase confirms zero SSE plumbing on the frontend:
- No `EventSource(` reference anywhere in `frontend/src`.
- No `fetch('/api/...` reference anywhere in `frontend/src`.
- No reference to `progress`/`complete`/`error` event names.
- The only `setInterval` in processing.tsx is the cursor blink at line 148.

`dashboard.tsx:10` navigates to `/processing?demo=1`, but the page never reads `useSearchParams`, never opens an EventSource, never calls `POST /api/cases/{id}/process` or `GET /api/cases/{id}/stream`. The page is a static animation.

Backend → frontend event-name expectations:

| Backend emits (`pipeline.py`) | Frontend listens for | Match? |
|---|---|---|
| `event: progress` with `PipelineProgress` JSON | (none) | No listener |
| `event: complete` with `{type, review}` | (none) | No listener |
| `event: error` with `{type, message}` | (none) | No listener |

The only "agent" identifiers shared between the two sides are stage names — and even there they don't line up: frontend tiles are `cluster`, `score`, `canonical`, `critique` (sub-agents inside the reconciliation step), plus column cards like `epcr-parser`, `audio-analyzer`, `cad-sync`, `protocol-check`, `report-drafter`. Backend stages are `cad_parsing`, `pcr_parsing`, `video_analysis`, `audio_analysis`, `reconciliation`, `protocol_check`, `findings`, `drafting`. Mapping needs:

| Frontend tile | Backend stage(s) |
|---|---|
| `epcr-parser` | `pcr_parsing` |
| `cad-sync` | `cad_parsing` |
| `audio-analyzer` | `audio_analysis` (also covers a video step in mock copy — split needed) |
| (no FE tile) | `video_analysis` — not represented |
| reconciliation sub-tiles (`cluster`, `score`, `canonical`, `critique`) | All inside `reconciliation` — backend emits one event for the whole stage; sub-step granularity is **not** available from SSE |
| `protocol-check` | `protocol_check` |
| `report-drafter` | `drafting` (+ `findings` would also belong here — currently no FE tile for `findings`) |

---

## 5. Vite proxy

`frontend/vite.config.ts` (full file is 36 lines):

- **No `server.proxy` entry exists.** The config defines plugins (`react`, `tailwindcss`, a custom `figmaAssetResolver`), an `@` alias, and `assetsInclude`. Nothing else.
- This contradicts CLAUDE.md, which states "Vite dev server proxies `/api/*` → `http://localhost:8000`". Either the proxy was removed when this frontend was scaffolded from the Figma export, or it never made it into this version of the file.

Env vars referenced from frontend code:
- `VITE_DATA_SOURCE` — `frontend/src/data/source.ts:21`. Only one. Values: `'local'` | `'remote'`.
- **No** `VITE_API_URL`, `VITE_API_BASE`, or anything similar referenced anywhere in `frontend/src`.

There is no `frontend/.env`, `.env.local`, or `.env.example`. The only env file is `/home/andresl/Projects/emt/.env(.example)` at repo root, which contains backend-side keys and `FRONTEND_ORIGIN` only.

Net effect: even if `remoteSource` were filled in, calls to `/api/...` from the dev server (`http://localhost:5173/api/...`) would hit the Vite dev server, get a 404, and never reach the backend on `:8000`. CORS-fetching `http://localhost:8000` directly is allowed (FastAPI sends `Access-Control-Allow-Origin: http://localhost:5173`), but the frontend would need an explicit base URL to do so.

---

## 6. Hookup checklist

Goal: get the Calyx frontend talking to the live Sentinel backend, end to end. Each step is independently verifiable; do them in order.

1. **Restore the Vite dev proxy** so relative `/api/...` calls work in dev.
   - File: `frontend/vite.config.ts` — add `server: { proxy: { '/api': 'http://localhost:8000' } }` to the `defineConfig` object.
   - Verify: `curl http://localhost:5173/api/cases` returns the backend's case list while `npm run dev` is running.

2. **Add an API base-URL env so production builds know where the backend is.**
   - Files: create `frontend/.env.example` with `VITE_API_URL=` and `VITE_DATA_SOURCE=remote`. Reference `import.meta.env.VITE_API_URL` from a new `frontend/src/data/api.ts` (default to `''`, which lets the proxy handle dev).
   - Verify: `console.log(import.meta.env.VITE_API_URL)` in the new module reflects the env at build time.

3. **Build a typed adapter from `QICaseReview` → `IncidentReport`.**
   - Files: new `frontend/src/data/adapters.ts`. Mirror backend `QICaseReview` (and dependents: `TimelineEntry`, `Finding`, `ClinicalAssessmentItem`, `ProtocolCheck`, `CADRecord`, `CrewMember`, `Recommendation`, enums) in a new `frontend/src/types/backend.ts` so we don't hand-write `any`. Convert:
     - `case_id` → `id`
     - `incident_date` → `date` (`YYYY-MM-DD`) + `time` (`HH:MM`)
     - `responding_unit` + `crew_members` → `crew`
     - Build `pcr: PcrMetadata` from `responding_unit` / `chief_complaint` / `cad_record.cad_incident_id`
     - Project `timeline[].canonical_timestamp_seconds + canonical_description + event_type` → `TimelineEvent[]` (decide the `category` mapping rule — likely from `event_type` or majority `source_types`)
     - Synthesize `cadLog: CadEvent[]` either from `cad_record` (a few formatted lines) or, better, from CAD-sourced `Event`s once they're surfaced; for now derive from the four datetime fields on `CADRecord`.
     - Compose `sections: ReportSection[]` by hand-mapping the 9 fixed section titles to backend fields:
       - `INCIDENT SUMMARY` ← `incident_summary`
       - `TIMELINE RECONSTRUCTION` ← rendered from `timeline`
       - `PCR DOCUMENTATION CHECK` ← `documentation_quality.issues`
       - `PROTOCOL COMPLIANCE REVIEW` ← `protocol_checks`
       - `KEY CLINICAL DECISIONS` ← `clinical_assessment` filtered to non-NA
       - `COMMUNICATION / SCENE MANAGEMENT` ← `clinical_assessment` filtered to `scene_management` + `handoff`
       - `STRENGTHS` ← `clinical_assessment` filtered to `MET`
       - `AREAS FOR IMPROVEMENT` ← `findings` of severity `concern` or `critical`
       - `RECOMMENDED FOLLOW-UP` ← `recommendations`
     - `pipeline: {…}` should be left as a placeholder shape — the live values come from the SSE stream, not from the cached review (see step 6).
   - Verify: write an adapter test in `frontend/src/data/adapters.test.ts` (or a quick inline `console.log` against `fixtures/sample_aar.json` if no test runner is present) and confirm it produces a fully-shaped `IncidentReport` with no `undefined` field reads.

4. **Replace `remoteSource` stubs with real `fetch` calls.**
   - File: `frontend/src/data/source.ts:46-54`.
   - `listIncidents()` → `GET /api/cases`, then for each `Case` either `GET /api/cases/{id}/review` (404 → skip / mark draft) and project to `IncidentSummary`. CLAUDE.md hints reviews are cached per case; an unreviewed case becomes `status: 'draft'`.
   - `getIncident(id)` → `GET /api/cases/{id}/review`; pipe the JSON through the adapter from step 3.
   - Use the base URL from step 2; keep the throw-on-error behavior (existing hook handles `error` state).
   - Verify: with backend running and at least one cached `cases/case_NN/review.json`, `?remote` URL on `/archive` lists real cases and clicking through to `/review/<id>` renders.

5. **Plumb the case-id through the route instead of hard-coding the mock.**
   - Files: `frontend/src/app/pages/processing.tsx:140`, `dashboard.tsx:10`, `new-report.tsx:40`.
   - Pass `caseId` as a route param: `/processing/:caseId`. Update `routes.tsx`, `processing.tsx` (read with `useParams`), and the two callers (`navigate(\`/processing/\${caseId}\`)`).
   - Verify: navigating to `/processing/case_01` loads the right ID; previous `/processing` callers compile-error so nothing slips through.

6. **Wire SSE in `processing.tsx`.**
   - File: `processing.tsx`. Add a new hook `useProcessingStream(caseId, demo)` (probably in `frontend/src/data/hooks.ts` or a new `frontend/src/data/sse.ts`). It should:
     - `POST /api/cases/{id}/process` to kick off the pipeline (or skip if `demo`).
     - Open `EventSource('/api/cases/{id}/stream' + (demo ? '?demo=1' : ''))`.
     - Track per-stage status from `event: progress` (`PipelineProgress`).
     - On `event: complete`, parse `data.review` through the adapter and surface the `IncidentReport`.
     - On `event: error`, surface the error.
   - Page-level: derive `agentTiles`, `progressPct`, and `elapsedSeconds` from the live progress map. Define a stage-name → tile-id mapping (see Section 4 table) and decide what to do about the `video_analysis` and `findings` stages that have no current tile (add tiles or fold into existing ones).
   - Verify: with backend running, `POST /api/cases/case_01/process` then watch the page's column cards transition `waiting → active → complete` in real time.

7. **Default `VITE_DATA_SOURCE` to `remote` in dev once steps 1-4 work.**
   - File: `frontend/.env.example` (and developer-local `.env.local`).
   - Verify: `npm run dev` with no URL param shows real backend data; `?local` falls back to mock.

8. **Decide the demo-mode story.**
   - Today, `?demo=1` only does anything if both (a) the SSE stream is open and (b) the backend has a cached `review.json` for that case. Once steps 4 & 6 land, document this in `README.md`. Either drop the URL param entirely or make `dashboard.tsx`'s "demo" link route through SSE-with-`demo=1` so it works against a clean checkout that ships fixtures with cached reviews.
   - Verify: load the app cold (no API keys, just bundled fixtures) and confirm the demo path renders end-to-end.

9. **Update CORS once a non-localhost origin exists.**
   - File: `backend/app/config.py:22` and `.env.example`.
   - Make `FRONTEND_ORIGIN` accept a comma-separated list (or rename to `FRONTEND_ORIGINS`) and split inside `Settings`. `main.py:23` becomes `allow_origins=settings.FRONTEND_ORIGINS`.
   - Verify: deploy preview's origin is included; the browser console shows no CORS errors.

10. **Cover the rest of the backend surface that has no frontend abstraction yet.**
    - PCR draft flow (`POST/GET /api/cases/{id}/pcr-draft`, `PATCH /pcr-draft/confirm`) has zero frontend usage today. Either remove the routes or add `DataSource` methods + a UI for them on `new-report.tsx` (current upload page just calls `navigate('/processing')` and ignores the files).
    - Video playback: `GET /api/cases/{id}/video` is unused. If we want it on `/review`, add a `<video src={\`${VITE_API_URL}/api/cases/${id}/video\`} />`.
    - Verify: each route either has a frontend caller or a tracking issue / TODO comment justifying its existence.
