# BACKEND AUDIT — Sentinel pipeline & API

Read-only audit of every file under `backend/app/`. References are line-numbered against the working tree on `main` at audit time.

---

## 1. Schemas

File: `backend/app/schemas.py`. Pydantic v2. Reproduced verbatim, ordered by dependency.

### Enums

```python
class EventSource(str, Enum):
    PCR = "pcr"
    VIDEO = "video"
    AUDIO = "audio"
    CAD = "cad"


class EventType(str, Enum):
    MEDICATION = "medication"
    INTERVENTION = "intervention"
    VITAL_SIGNS = "vital_signs"
    RHYTHM_CHECK = "rhythm_check"
    CPR_START = "cpr_start"
    CPR_PAUSE = "cpr_pause"
    DEFIBRILLATION = "defibrillation"
    AIRWAY = "airway"
    IV_ACCESS = "iv_access"
    ARRIVAL = "arrival"
    TRANSPORT_DECISION = "transport_decision"
    PATIENT_RESPONSE = "patient_response"
    OTHER = "other"


class DiscrepancyType(str, Enum):
    TIMING = "timing"
    CLINICAL = "clinical"
    PHANTOM = "phantom"
    MISSING = "missing"
    NONE = "none"


class ProtocolCheckStatus(str, Enum):
    ADHERENT = "adherent"
    DEVIATION = "deviation"
    NOT_APPLICABLE = "not_applicable"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class FindingSeverity(str, Enum):
    INFO = "info"
    CONCERN = "concern"
    CRITICAL = "critical"


class FindingCategory(str, Enum):
    TIMING_DISCREPANCY = "timing_discrepancy"
    MISSING_DOCUMENTATION = "missing_documentation"
    PHANTOM_INTERVENTION = "phantom_intervention"
    PROTOCOL_DEVIATION = "protocol_deviation"
    CARE_GAP = "care_gap"
    RESPONSE_TIME_VIOLATION = "response_time_violation"


class IncidentDisposition(str, Enum):
    ALS_TRANSPORT = "82"
    BLS_TRANSPORT = "83"
    PRONOUNCED_DEAD = "84"
    UNFOUNDED = "90"
    REFUSED_TREATMENT = "93"
    NOT_TRANSPORTED = "95"
    GONE_ON_ARRIVAL = "96"
    CANCELLED = "97"
    UNKNOWN = "99"


class ClinicalAssessmentCategory(str, Enum):
    SCENE_MANAGEMENT = "scene_management"
    INITIAL_ASSESSMENT = "initial_assessment"
    CPR_QUALITY = "cpr_quality"
    AIRWAY_MANAGEMENT = "airway_management"
    VASCULAR_ACCESS = "vascular_access"
    MEDICATIONS = "medications"
    DEFIBRILLATION = "defibrillation"
    MONITORING = "monitoring"
    TRANSPORT_DECISION = "transport_decision"
    HANDOFF = "handoff"


class AssessmentStatus(str, Enum):
    MET = "met"
    NOT_MET = "not_met"
    NOT_APPLICABLE = "not_applicable"
    INSUFFICIENT_DOCUMENTATION = "insufficient_documentation"


class RecommendationAudience(str, Enum):
    CREW = "crew"
    AGENCY = "agency"
    FOLLOW_UP = "follow_up"


class RecommendationPriority(str, Enum):
    INFORMATIONAL = "informational"
    SUGGESTED = "suggested"
    REQUIRED = "required"


class ReviewerDetermination(str, Enum):
    NO_ISSUES = "no_issues"
    DOCUMENTATION_CONCERN = "documentation_concern"
    PERFORMANCE_CONCERN = "performance_concern"
    SIGNIFICANT_CONCERN = "significant_concern"
    CRITICAL_EVENT = "critical_event"


class PipelineStage(str, Enum):
    CAD_PARSING = "cad_parsing"
    PCR_PARSING = "pcr_parsing"
    VIDEO_ANALYSIS = "video_analysis"
    AUDIO_ANALYSIS = "audio_analysis"
    RECONCILIATION = "reconciliation"
    PROTOCOL_CHECK = "protocol_check"
    FINDINGS = "findings"
    DRAFTING = "drafting"
    PCR_DRAFTING = "pcr_drafting"  # pre-pipeline auto-drafter; not used by orchestrator


class PCRDraftStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
```

### Models

```python
class Event(BaseModel):
    event_id: str
    timestamp: str
    timestamp_seconds: float
    source: EventSource
    event_type: EventType
    description: str
    details: dict[str, Any] = Field(default_factory=dict)
    confidence: float
    raw_evidence: str


class TimelineEntry(BaseModel):
    entry_id: str
    canonical_timestamp_seconds: float
    canonical_description: str
    event_type: EventType
    source_events: list[Event]
    match_confidence: float
    has_discrepancy: bool


class EventCluster(BaseModel):                       # internal — used between reconciliation agents
    cluster_id: str
    event_ids: list[str]
    centroid_timestamp_seconds: float
    source_types: list[EventSource]


class ScoredCluster(BaseModel):                      # internal
    cluster_id: str
    event_ids: list[str]
    centroid_timestamp_seconds: float
    source_types: list[EventSource]
    discrepancy_score: float
    discrepancy_type: DiscrepancyType
    discrepancy_reasoning: str


class DraftTimelineEntry(BaseModel):                 # internal
    cluster_id: str
    event_ids: list[str]
    canonical_timestamp_seconds: float
    event_type: EventType
    canonical_description: str
    match_confidence: float


class ProtocolStep(BaseModel):
    step_id: str
    description: str
    expected_timing_seconds: Optional[float] = None
    required: bool


class ProtocolCheck(BaseModel):
    check_id: str
    protocol_step: ProtocolStep
    status: ProtocolCheckStatus
    evidence_event_ids: list[str]
    explanation: str


class GeoPoint(BaseModel):
    lat: float
    lng: float
    elevation_m: Optional[float] = None


class CADRecord(BaseModel):
    cad_incident_id: str
    incident_datetime: datetime
    initial_call_type: str
    initial_severity_level_code: int
    final_call_type: str
    final_severity_level_code: int
    first_assignment_datetime: datetime
    first_activation_datetime: datetime
    first_on_scene_datetime: datetime
    first_to_hosp_datetime: Optional[datetime] = None
    first_hosp_arrival_datetime: Optional[datetime] = None
    incident_close_datetime: datetime
    dispatch_response_seconds: Optional[int] = None
    incident_response_seconds: Optional[int] = None
    incident_travel_seconds: Optional[int] = None
    incident_disposition_code: IncidentDisposition = IncidentDisposition.UNKNOWN
    borough: Optional[str] = None
    zipcode: Optional[str] = None
    incident_location: Optional[GeoPoint] = None
    protocol_families: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    finding_id: str
    severity: FindingSeverity
    category: FindingCategory
    title: str
    explanation: str
    evidence_event_ids: list[str]
    evidence_timestamp_seconds: float
    pcr_excerpt: Optional[str] = None
    suggested_review_action: str


class CrewMember(BaseModel):
    role: Literal[
        "primary_paramedic",
        "secondary_paramedic",
        "emt",
        "driver",
        "supervisor",
        "other",
    ]
    identifier: str


class ClinicalAssessmentItem(BaseModel):
    item_id: str
    category: ClinicalAssessmentCategory
    benchmark: str
    status: AssessmentStatus
    notes: str
    evidence_event_ids: list[str] = Field(default_factory=list)


class DocumentationQualityAssessment(BaseModel):
    completeness_score: float
    accuracy_score: float
    narrative_quality_score: float
    issues: list[str] = Field(default_factory=list)


class UtsteinData(BaseModel):
    """Cardiac-arrest-specific data per the 2024 Utstein registry template.
    All fields optional — only present for cardiac arrest cases."""
    witnessed: Optional[bool] = None
    bystander_cpr: Optional[bool] = None
    initial_rhythm: Optional[Literal["vf", "vt", "pea", "asystole", "unknown"]] = None
    time_to_cpr_seconds: Optional[float] = None
    time_to_first_defib_seconds: Optional[float] = None
    rosc_achieved: Optional[bool] = None
    time_to_rosc_seconds: Optional[float] = None
    disposition: Optional[
        Literal[
            "rosc_sustained",
            "transport_with_cpr",
            "pronounced_on_scene",
            "transferred_with_rosc",
        ]
    ] = None


class Recommendation(BaseModel):
    recommendation_id: str
    audience: RecommendationAudience
    priority: RecommendationPriority
    description: str
    related_finding_ids: list[str] = Field(default_factory=list)


class Case(BaseModel):
    case_id: str
    incident_type: str
    incident_date: datetime
    pcr_path: str
    video_path: str
    audio_path: str
    cad_path: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PipelineProgress(BaseModel):
    stage: PipelineStage
    status: Literal["pending", "running", "complete", "error"]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class PCRDraft(BaseModel):
    case_id: str
    generated_at: datetime
    status: PCRDraftStatus = PCRDraftStatus.PENDING_REVIEW
    video_event_count: int = 0
    audio_event_count: int = 0
    total_event_count: int = 0
    draft_markdown: str
    unconfirmed_count: int = 0
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    emt_edits_made: bool = False
    error: Optional[str] = None


class QICaseReview(BaseModel):
    case_id: str
    generated_at: datetime
    reviewer_id: str = "sentinel_agent_v1"
    # Header
    incident_date: datetime
    incident_type: str
    responding_unit: str
    crew_members: list[CrewMember] = Field(default_factory=list)
    patient_age_range: str
    patient_sex: Literal["m", "f", "unknown"]
    chief_complaint: str
    # Body
    incident_summary: str
    timeline: list[TimelineEntry]
    clinical_assessment: list[ClinicalAssessmentItem]
    documentation_quality: DocumentationQualityAssessment
    findings: list[Finding]
    protocol_checks: list[ProtocolCheck]
    adherence_score: float
    # Cardiac-arrest-specific (optional)
    utstein_data: Optional[UtsteinData] = None
    # Closing
    recommendations: list[Recommendation]
    determination: ReviewerDetermination
    determination_rationale: str
    # Human review state
    reviewer_notes: str = ""
    human_reviewed: bool = False
    # CAD enrichment (optional — absent when no cad.json exists for the case)
    cad_record: Optional[CADRecord] = None
```

There are **no `@field_validator` or `@model_validator` methods** anywhere in `schemas.py` — every constraint is expressed via type and `Literal`/enum membership. Defaults are exclusively `Field(default_factory=...)` (for mutable lists/dicts) or scalar literal defaults (`reviewer_id="sentinel_agent_v1"`, `incident_disposition_code=UNKNOWN`, the `PCRDraft` counters, etc.).

---

## 2. API routes — full implementation detail

`backend/app/main.py` mounts three routers under `/api`:

```python
app = FastAPI(title="Sentinel Backend", version="0.3.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.FRONTEND_ORIGIN],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(cases_router, prefix="/api")
app.include_router(pipeline_router, prefix="/api")
app.include_router(pcr_draft_router, prefix="/api")

@app.get("/health")
async def health() -> dict[str, str]: return {"status": "ok"}
```

`lifespan` calls `migrate_legacy_aar_caches()` once at startup (no shutdown logic).

### `backend/app/api/cases.py`

| Function | Path | Logic | Errors |
|---|---|---|---|
| `get_cases` | `GET /cases` | Returns `case_loader.list_cases()`. | None — empty list if no `cases/` dir. |
| `get_case` | `GET /cases/{case_id}` | `case_loader.load_case(case_id)`. | `FileNotFoundError` → `HTTPException(404)`. |
| `get_pcr` | `GET /cases/{case_id}/pcr` | Returns `{"content": load_pcr_content(case_id)}`. | `FileNotFoundError` → 404. Note: `_ensure_pcr` writes a placeholder PCR if missing, so this only 404s on a missing case dir. |
| `get_review` | `GET /cases/{case_id}/review` | `load_cached_review(case_id)`; `None` → 404 with detail `f"No cached review for {case_id}"`. | `case_id == "case_01"` triggers `_seed_case_01()` from the fixture before reading. |
| `delete_review` | `DELETE /cases/{case_id}/review` | `clear_cached_review(case_id)` → returns 204. | `FileNotFoundError` (case dir missing) → 404. If file already absent, returns 204 anyway (no error). |
| `get_video` | `GET /cases/{case_id}/video` | Resolves `settings.CASES_DIR/{id}/video.{mp4,mov,webm}` and returns `FileResponse(media_type="video/mp4")`. | 404 if case dir missing or no video file matches. (The `media_type` is hard-coded to `video/mp4` even for `.mov` / `.webm`.) |

Routes that emit Pydantic models declare `response_model=` so FastAPI handles serialization. `FileResponse` for video supports HTTP Range automatically (Starlette behavior).

### `backend/app/api/pipeline.py`

Module-level state:

```python
_jobs: dict[str, asyncio.Task[QICaseReview]] = {}
_DONE = object()                                    # sentinel for queue termination
_DEMO_STAGE_DELAY_S = 0.4
_DEMO_STAGES: tuple[PipelineStage, ...] = (
    PCR_PARSING, VIDEO_ANALYSIS, AUDIO_ANALYSIS,
    RECONCILIATION, PROTOCOL_CHECK, FINDINGS, DRAFTING,
)                                                   # CAD_PARSING is omitted
```

#### `POST /cases/{case_id}/process`

```python
async def trigger_process(case_id: str) -> dict[str, str]:
    case = load_case(case_id)                       # 404s if missing
    job_id = str(uuid.uuid4())
    async def _noop_progress(_: PipelineProgress) -> None: return None
    task = asyncio.create_task(process_case(case, _noop_progress))
    _jobs[job_id] = task
    return {"job_id": job_id, "case_id": case_id}
```

- `_noop_progress` is the progress callback handed to the orchestrator: it accepts a `PipelineProgress` and returns `None` without doing anything. **All progress events are dropped on the floor for this endpoint** — no SSE, no WebSocket, no DB write.
- The task is registered in `_jobs[job_id]` but **nothing reads `_jobs` afterward**. There is no `GET /jobs/{id}`, no completion notification, no cleanup. If the orchestrator raises, the exception lives on the task object until it's garbage collected. The task does **not** call `save_cached_review` — only the SSE path does that. So calling `POST /process` runs the pipeline but never persists the result.

Effectively this endpoint is a no-op for the user-facing flow today; the SSE endpoint is the real one.

#### `GET /cases/{case_id}/stream?demo=<bool>`

Returns `EventSourceResponse` (from `sse_starlette.sse`).

**Live mode** (`demo=False`):

```python
queue: asyncio.Queue = asyncio.Queue()

async def push_progress(update: PipelineProgress) -> None:
    await queue.put(update)

async def runner() -> None:
    try:
        review = await process_case(case, push_progress)
        try: save_cached_review(case_id, review)        # writes cases/<id>/review.json
        except Exception as cache_exc: logger.warning(...)
        await queue.put({"type": "complete", "review": review.model_dump(mode="json")})
    except Exception as exc:
        await queue.put({"type": "error", "message": str(exc)})
    finally:
        await queue.put(_DONE)

async def event_source() -> AsyncIterator[dict]:
    task = asyncio.create_task(runner())
    try:
        while True:
            item = await queue.get()
            if item is _DONE: break
            if isinstance(item, PipelineProgress):
                yield {"event": "progress", "data": item.model_dump_json()}
            else:
                yield {"event": item.get("type", "message"), "data": json.dumps(item)}
    finally:
        if not task.done(): task.cancel()
```

**Demo mode** (`demo=True`, `_demo_stream`):

```python
cached = load_cached_review(case_id)
if cached is None:
    yield {"event": "error",
           "data": json.dumps({"type": "error",
                               "message": f"No cached review available for {case_id}"})}
    return
for stage in _DEMO_STAGES:                              # 7 stages, no CAD
    started = datetime.now(timezone.utc)
    yield {"event": "progress",
           "data": PipelineProgress(stage=stage, status="running",
                                    started_at=started).model_dump_json()}
    await asyncio.sleep(_DEMO_STAGE_DELAY_S)            # 0.4 s
    yield {"event": "progress",
           "data": PipelineProgress(stage=stage, status="complete",
                                    started_at=started,
                                    completed_at=datetime.now(timezone.utc)
                                    ).model_dump_json()}
yield {"event": "complete",
       "data": json.dumps({"type": "complete", "review": cached.model_dump(mode="json")})}
```

**Event shapes (both modes):**

| `event:` | `data:` JSON | Notes |
|---|---|---|
| `progress` | `PipelineProgress` JSON: `{stage, status, started_at?, completed_at?, error_message?}` | Two per stage in both modes (`running` then `complete`, or `error`). Live emits 8 stages × 2 = 16 progress events when no stage errors. Demo emits 7 stages × 2 = 14. |
| `complete` | `{"type": "complete", "review": <QICaseReview JSON>}` | Terminal success event. The shape is **wrapped** — the review is at `data.review`, not at `data` itself. |
| `error` | `{"type": "error", "message": str}` | Terminal error event. Demo emits this when there is no cached review. Live emits this when any stage raises. |

**Stream termination:** in live mode the generator exits when it pulls `_DONE` from the queue (after `complete`/`error` was queued). The `finally` block cancels the runner task if it isn't already done. The HTTP response closes when the generator ends. There is **no explicit `event: close` or null-data sentinel** sent over the wire — the client sees the connection close. Demo mode just falls off the end of the generator after yielding `complete` or `error`.

#### `_DEMO_STAGES` vs orchestrator stages

The orchestrator emits `cad_parsing` as one of its eight stages. The demo replay omits it. Frontends listening for `cad_parsing` only see it in **live** runs, never in demo replays. CLAUDE.md's "14 progress events" line refers to demo (7 × 2); a successful live run emits 16.

### `backend/app/api/pcr_draft.py`

Mounted with `prefix="/cases/{case_id}"` (so the full paths are `/api/cases/{case_id}/pcr-draft[…]`).

Helpers: `_draft_path`, `_pcr_path`, `_load_draft` (404s with `"No PCR draft found — POST /pcr-draft first"` if missing), `_save_draft` (writes `pcr_draft.json`).

| Endpoint | Behavior |
|---|---|
| `POST /pcr-draft` | Loads `Case`, writes a `PENDING_REVIEW` placeholder PCRDraft (`draft_markdown="*Generating PCR draft — please wait...*"`), and queues `_run` as a `BackgroundTask`. The background task `asyncio.gather`s `safe_cad_parse(case.cad_path)`, `video_analyzer.analyze_video(case)`, `audio_analyzer.analyze_audio(case)`, then calls `pcr_drafter.draft_pcr(...)` and overwrites the JSON. On exception writes a placeholder with `error=str(exc)`. Returns the pending placeholder synchronously. |
| `GET /pcr-draft` | Just reads `pcr_draft.json` via `_load_draft` (404 if absent). |
| `PATCH /pcr-draft/confirm` | Body model `ConfirmRequest` = `{edited_markdown: str, confirmed_by: str = "emt"}`. Loads draft, refuses if `draft.error and not body.edited_markdown.strip()` (400). Writes `cases/<id>/pcr.md` with `body.edited_markdown` (this is the file the QI pipeline's PCR parser ingests). Updates draft status → `CONFIRMED`, sets `confirmed_by`, `confirmed_at`, `emt_edits_made` (computed by comparing stripped strings), `unconfirmed_count` (counts `[UNCONFIRMED]` substrings in the edited text). |

There is no endpoint to reset/regenerate without re-POSTing. There is no link from confirmation to triggering `POST /api/cases/{id}/process` automatically — the frontend has to do that.

---

## 3. Pipeline orchestrator

File: `backend/app/pipeline/orchestrator.py`.

### Entry point

```python
ProgressCallback = Callable[[PipelineProgress], Awaitable[None]]

async def process_case(case: Case, progress_callback: ProgressCallback) -> QICaseReview:
```

Accepts a `Case` and an async progress callback. Returns a fully-populated `QICaseReview`.

### Progress callback contract

The callback is called with **two `PipelineProgress` objects per stage**:

1. `PipelineProgress(stage=..., status="running", started_at=now)` — emitted before the stage runs.
2. Either `status="complete"` with `started_at` + `completed_at`, or `status="error"` with `started_at`, `completed_at`, and `error_message=str(exc)`.

Each emission is `await`ed, so back-pressure on the SSE queue propagates into the orchestrator. The orchestrator doesn't emit `pending` — that status exists in the schema for the frontend to use as a default.

### Execution order

```python
cad_task   = _run_stage(CAD_PARSING,    safe_cad_parse(case.cad_path),        progress)
pcr_task   = _run_stage(PCR_PARSING,    pcr_parser.parse_pcr(case),          progress)
video_task = _run_stage(VIDEO_ANALYSIS, video_analyzer.analyze_video(case),  progress)
audio_task = _run_stage(AUDIO_ANALYSIS, audio_analyzer.analyze_audio(case),  progress)
cad_record, pcr, video, audio = await asyncio.gather(cad_task, pcr_task, video_task, audio_task)

protocol_families = (cad_record.protocol_families
                     if cad_record and cad_record.protocol_families
                     else ["cardiac_arrest"])

timeline = await _run_stage(RECONCILIATION,  reconciliation.reconcile(...),                 progress)
checks   = await _run_stage(PROTOCOL_CHECK,  protocol_check.check_protocol(timeline, ...),  progress)
found    = await _run_stage(FINDINGS,        findings_stage.generate_findings(timeline, ...),progress)
pcr_content = load_pcr_content(case.case_id)
review   = await _run_stage(DRAFTING,        drafting.draft_qi_review(case, timeline, found, checks, pcr_content), progress)
review.cad_record = cad_record
return review
```

- Stages 1a/1b/1c plus CAD parsing run **in parallel** via `asyncio.gather`.
- Reconciliation → protocol_check → findings → drafting run **sequentially** (each `await`s the previous).
- Because they run in parallel, the four `running` events for cad/pcr/video/audio can interleave with each other in arbitrary order, and same for the four `complete` events.

### Error handling

`_run_stage` catches any exception, emits an `error`-status `PipelineProgress`, then **re-raises** (line 63). That means a single stage failure aborts the whole pipeline — `asyncio.gather` will propagate the first exception, and the sequential `await`s after it never run. The SSE handler's `runner()` catches that final exception and queues `{"type": "error", "message": str(exc)}`. There is no per-stage retry, no fallback in the orchestrator itself.

(Stage-internal fallbacks exist below the orchestrator: `safe_cad_parse` returns `None` on parse failure; `video_analyzer.analyze_video` returns hard-coded fallback events on Gemini errors; `drafting` falls back to fixture data per sub-call. So most "expected" failures don't surface here. What does surface: PCR parser `RuntimeError` if Claude omits the tool block, audio analyzer `RuntimeError` for the same reason or any 4xx/5xx from the LLM/STT clients after retries are exhausted, reconciliation cluster step if Haiku refuses entirely, findings if Sonnet refuses.)

### Final return value

A `QICaseReview` built by `drafting.draft_qi_review`, with `cad_record` field populated post-hoc from the parallel CAD task. The orchestrator does not write to disk — caching to `cases/<id>/review.json` is the SSE handler's job (`save_cached_review` in `runner()`).

---

## 4. Case loader

File: `backend/app/case_loader.py`.

### Discovery

`list_cases()` walks `settings.CASES_DIR.resolve()` with `sorted(root.iterdir())` and includes every directory child. There's no manifest file, no glob filter, no env-driven include list. `_seed_case_01()` is called once at the start to copy `fixtures/sample_qi_review.json` → `cases/case_01/review.json` if missing — then the regular discovery loop builds a `Case` for each subdir via `_build_case`.

`load_case(case_id)` is the by-id variant. It raises `FileNotFoundError` if `cases/<id>/` is missing. For `case_id == "case_01"` it triggers the seeder before building the `Case`.

### Per-case directory layout expected

`_build_case(case_dir)` (lines 117–131) looks for / sets:

| Path | Purpose | Required? |
|---|---|---|
| `pcr.md` | PCR markdown — Stage 1a input. | If missing, `_ensure_pcr` writes a `PCR_PLACEHOLDER` template to disk. So effectively created on demand. |
| `video.mp4` | Body-cam video — Stage 1b input. | Optional. The `Case.video_path` is always set to `case_dir/"video.mp4"` even if the file doesn't exist; `analyze_video` returns `[]` for missing files. |
| `audio.mp3` | Dispatch audio — Stage 1c input. | Same: path always set; `analyze_audio` returns `[]` if missing. |
| `cad.json` | NYC EMS CAD JSON — Stage 0 input. | Optional. `Case.cad_path` is set only if the file exists; otherwise `None`. |
| `review.json` | Cached `QICaseReview`. Read by `load_cached_review`, written by `save_cached_review`. | Optional cache. |
| `aar.json` | Legacy cache name. `migrate_legacy_aar_caches()` renames valid ones to `review.json` at startup; deletes incompatible ones. | Migration only. |
| `pcr_draft.json` / `pcr.original.md` | Used by the auto-drafter API but **not loaded by `case_loader`**. | n/a |

### `Case` field origins (all set in `_build_case`)

| Field | Source |
|---|---|
| `case_id` | `case_dir.name` (the directory's basename, e.g. `"case_01"`). |
| `incident_type` | Hard-coded `"cardiac_arrest"`. **Every loaded case is flagged cardiac arrest.** There's no way to set this per-case from data. |
| `incident_date` | `datetime.fromtimestamp(case_dir.stat().st_mtime, tz=timezone.utc)` — the directory's mtime. Not from `cad.json`, not from `pcr.md`. |
| `pcr_path` | `str(case_dir / "pcr.md")` (after `_ensure_pcr` guarantees existence). |
| `video_path` | `str(case_dir / "video.mp4")` — file may not exist. |
| `audio_path` | `str(case_dir / "audio.mp3")` — file may not exist. Note: there is no fallback to `audio.wav` despite the `.gitignore` allowing both extensions. |
| `cad_path` | `str(case_dir / "cad.json")` if file exists, else `None`. |
| `metadata` | `{}` — never populated. |

### `review.json` cache

- `load_cached_review(case_id)` → reads `cases/<id>/review.json`, returns `QICaseReview.model_validate(json.loads(...))` or `None` if missing. `case_01` triggers the fixture seed before reading.
- `save_cached_review(case_id, review)` → writes `review.model_dump_json(indent=2)`. Raises `FileNotFoundError` if the case dir doesn't exist.
- `clear_cached_review(case_id)` → unlinks the file; returns `True` if removed, `False` if it wasn't there. Raises `FileNotFoundError` if the case dir is missing.
- `migrate_legacy_aar_caches()` — at startup, walks the cases dir; for each `aar.json` either: skips (if `review.json` exists), validates against `QICaseReview` and renames, or deletes the incompatible legacy file. Returns the number of renamed files.

---

## 5. Config / settings

File: `backend/app/config.py`. Single `Settings` class via `pydantic-settings`.

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    CASES_DIR: Path = Path("../cases")
    PROTOCOLS_DIR: Path = Path("../protocols")
    FIXTURES_DIR: Path = Path("../fixtures")
    FRONTEND_ORIGIN: str = "http://localhost:5173"

settings = Settings()
```

`env_file=("../.env", ".env")` — loads repo-root `.env` first then `backend/.env` (the second overrides). Defaults assume the process runs with CWD `backend/` so the `../*` paths resolve to repo top-level.

| Setting | Env var | Default | Where used |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | same | `""` | `llm_clients.py:21` (passed to `AsyncAnthropic`). All Haiku/Sonnet calls. Tests guard on `settings.ANTHROPIC_API_KEY` truthiness. |
| `GOOGLE_API_KEY` | same | `""` | `llm_clients.gemini_flash_video`: raises `RuntimeError` if blank, then `genai.configure(api_key=...)`. |
| `OPENAI_API_KEY` | same | `""` | **Defined but unused.** Legacy slot — Whisper was swapped for ElevenLabs Scribe. |
| `ELEVENLABS_API_KEY` | same | `""` | `llm_clients.elevenlabs_transcribe`: raises if blank, sent as `xi-api-key` header. |
| `CASES_DIR` | same | `Path("../cases")` | `case_loader._cases_root()` (every case discovery / load), `api/cases.py:get_video`, `api/pcr_draft.py:_draft_path` / `_pcr_path`. |
| `PROTOCOLS_DIR` | same | `Path("../protocols")` | Imported but **not currently read by any pipeline file** — protocol content is hard-coded in `pipeline/protocols.py` mappings + LLM prompts. |
| `FIXTURES_DIR` | same | `Path("../fixtures")` | `case_loader._seed_case_01()`, `pipeline/_fixture._review()`. |
| `FRONTEND_ORIGIN` | same | `"http://localhost:5173"` | `main.py:23` — single CORS allowed origin (string, not list — only one origin can be configured). |

---

## 6. Pipeline stages

For each stage file (excluding `orchestrator.py`):

### `cad_parser.py` — Stage 0

```python
def parse_cad(path: str) -> CADRecord
async def safe_cad_parse(path: Optional[str]) -> Optional[CADRecord]
```

- **External calls:** none. Reads `cad.json` from disk, no LLM.
- Parses NYC EMS CAD JSON (single dict or single-element list). Maps `incident_disposition_code` to `IncidentDisposition`. Looks up `zipcode` in a hard-coded `ZIPCODE_CENTROIDS` table (5 entries: 10001/10002/10003/10007/10036) for `incident_location`. Calls `select_protocol_families(record)` to populate `protocol_families`.
- **Returns** a `CADRecord` (or `None` from `safe_cad_parse` on any exception).
- **Feeds into:** `reconciliation.reconcile(..., cad_record=...)` (synthesizes ARRIVAL + TRANSPORT_DECISION events) and the orchestrator's `protocol_families` selection. Also passed straight through into `QICaseReview.cad_record` post-pipeline.

### `pcr_parser.py` — Stage 1a

```python
async def parse_pcr(case: Case) -> list[Event]
```

- **External calls:** `claude_haiku` (Anthropic Messages API, model `claude-haiku-4-5`) with system prompt `PCR_PARSER_SYSTEM`, user template `PCR_PARSER_USER_TEMPLATE`, tool `PCR_EVENTS_TOOL`, `max_tokens=4096`. Uses `case_loader.load_pcr_content(case.case_id)` for the input.
- Reads the response's first `tool_use` block; raises `RuntimeError("Claude did not return a tool_use block for extract_pcr_events")` if missing.
- For each event in `tool_use["input"]["events"]`, builds an `Event` with `event_id=str(uuid.uuid4())`, `source=EventSource.PCR`, the model-supplied other fields.
- **Returns** `list[Event]` (PCR-sourced).
- **Feeds into:** reconciliation as the `pcr` argument.

### `video_analyzer.py` — Stage 1b

```python
async def analyze_video(case: Case) -> list[Event]
```

- **External calls:** `gemini_flash_video` (Google Files API + Gemini 2.5 Flash with function-calling). Tool: `VIDEO_EVENTS_TOOL`. System: `VIDEO_EVENTS_SYSTEM`. Prompt: `VIDEO_EVENTS_USER_PROMPT`.
- Resolves `case.video_path` against CWD if relative. Returns `[]` if file missing. If file > 50 MB (`MAX_VIDEO_BYTES`), logs a warning and returns `_fallback_events()` — 4 hard-coded events (ARRIVAL, CPR_START, RHYTHM_CHECK, MEDICATION). Wraps the Gemini call in `try/except` and returns the fallback on any exception. Drops malformed events. If after all parsing the list is empty, also returns the fallback. Sorts by `timestamp_seconds` and returns.
- **Returns** `list[Event]` with `source=EventSource.VIDEO`.
- **Feeds into:** reconciliation as `video`.

### `audio_analyzer.py` — Stage 1c

```python
async def analyze_audio(case: Case) -> list[Event]
def _segment_words(words: list[dict], max_segment_seconds=12.0, pause_seconds=1.5) -> list[dict]
```

- **External calls:** `elevenlabs_transcribe(str(audio_path))` (Scribe v1 with word-level timestamps); then `claude_haiku` with `AUDIO_EVENTS_SYSTEM` / `AUDIO_EVENTS_USER_TEMPLATE` / `AUDIO_EVENTS_TOOL`.
- Resolves audio path against CWD if relative. Returns `[]` if file missing or `_segment_words(words)` returns `[]`. `_segment_words` groups Scribe word-tokens into ~12 s utterances broken on ≥1.5 s pauses.
- Reads `tool_use` block; `RuntimeError` if missing. Builds `Event`s with `source=EventSource.AUDIO`. Sorts by `timestamp_seconds`.
- **Feeds into:** reconciliation as `audio`.

### `reconciliation.py` — Stage 2

```python
async def reconcile(pcr: list[Event], video: list[Event], audio: list[Event],
                    cad_record: Optional[CADRecord] = None) -> list[TimelineEntry]
```

3-agent chain (the docstring still says "4-agent" but the code merged Agents 2+3 into a single Haiku call):

1. **`_cluster_events`** (Agent 1, Haiku) — `CLUSTER_EVENTS_TOOL` semantically clusters all events. Falls back to one cluster per event if no tool_use block is returned.
2. **`_review_cluster`** (Agent R, Haiku, parallelized via `asyncio.gather` with a `Semaphore(5)`) — `REVIEW_CLUSTER_TOOL` returns scoring + canonical entry in one call. `return_exceptions=True` → individual failures fall back to `_deterministic_score_fallback` + `_first_event_fallback`.
3. **`_critic_pass`** (Agent 4, Sonnet) — `ASSEMBLE_VERIFIED_TIMELINE_TOOL` verifies/corrects. On failure, `_assemble_from_drafts` builds the timeline directly from Agent R's output.

Before clustering, `_synthesize_cad_events(cad_record)` produces synthetic `Event`s for `first_on_scene_datetime` (ARRIVAL) and optionally `first_to_hosp_datetime` (TRANSPORT_DECISION) with `source=CAD`, `confidence=1.0`, deterministic `event_id=f"cad-{event_type}-{cad_incident_id}"`.

Constants: `DISCREPANCY_THRESHOLD_SECONDS = 10.0`, `DISCREPANCY_SCORE_THRESHOLD = 0.15`. `_hydrate_timeline` re-derives `has_discrepancy` from the timestamp spread.

- **Returns** a sorted `list[TimelineEntry]` (sorted by `canonical_timestamp_seconds`).
- **Feeds into:** `protocol_check.check_protocol`, `findings.generate_findings`, `drafting.draft_qi_review` (used in 3 of the 4 sub-calls).

### `protocols.py`

```python
CALL_TYPE_TO_FAMILY: dict[str, str]                 # ~25 NYC call codes → families
SKIP_DISPOSITIONS = {UNFOUNDED, GONE_ON_ARRIVAL, CANCELLED}
def select_protocol_families(cad: CADRecord) -> list[str]
```

Pure mapping. Used by `cad_parser.parse_cad` to populate `CADRecord.protocol_families`. No LLM calls. Returns `[]` for skip dispositions; otherwise the family for `final_call_type`, defaulting to `"general"`.

### `protocol_check.py` — Stage 3 (still a stub)

```python
async def check_protocol(timeline: list[TimelineEntry], incident_type: str) -> list[ProtocolCheck]:
    await asyncio.sleep(1.0 + random.random())
    return list(fixture_qi_review().protocol_checks)
```

- **External calls:** none. Sleeps 1–2 s, returns the protocol_checks from `fixtures/sample_qi_review.json` regardless of input.
- **Returns** `list[ProtocolCheck]` (always the fixture).
- **Feeds into:** `findings.generate_findings`, `drafting.draft_qi_review`, and `compute_adherence_score` for the final review.

### `findings.py` — Stage 4

```python
async def generate_findings(timeline: list[TimelineEntry], checks: list[ProtocolCheck]) -> list[Finding]
```

- **External calls:** `claude_sonnet` (`claude-sonnet-4-6`) with `FINDINGS_SYSTEM`/`FINDINGS_USER_TEMPLATE`/`FINDINGS_TOOL`, `max_tokens=4096`.
- Returns `[]` if both timeline and checks are empty. Otherwise serializes the timeline (entry shape with `source_events`) and checks to JSON, calls Sonnet, raises `RuntimeError` if no `tool_use` block. Filters `evidence_event_ids` to those that actually exist in the timeline's source events. Builds `Finding`s with `finding_id=str(uuid.uuid4())`. Sorts by `evidence_timestamp_seconds`.
- **Returns** `list[Finding]`.
- **Feeds into:** `drafting.draft_qi_review` (recommendations + determination); copied to `QICaseReview.findings`.

### `drafting.py` — Stage 5

```python
async def draft_qi_review(case: Case, timeline: list[TimelineEntry], findings: list[Finding],
                          protocol_checks: list[ProtocolCheck], pcr_content: str) -> QICaseReview
```

Five sub-calls (the docstring header says "Sonnet" but every `await` in the file uses `claude_haiku`):

| Sub-call | Function | Tool | Fallback on exception |
|---|---|---|---|
| A. Header + summary + Utstein | `_draft_header` | `QI_HEADER_TOOL` | `_fixture_header(case)` (built from `fixture_qi_review()`) |
| B. Clinical assessment | `_draft_clinical_assessment` | `QI_CLINICAL_ASSESSMENT_TOOL` | `fixture_clinical_assessment()` |
| C. Documentation quality | `_draft_documentation_quality` | `QI_DOCUMENTATION_QUALITY_TOOL` | `fixture_documentation_quality()` |
| D. Recommendations | `_draft_recommendations` | `QI_RECOMMENDATIONS_TOOL` | `fixture_recommendations()` |
| E. Determination rationale | `_draft_determination_rationale` | (no tool — text response) | `_fallback_rationale(...)` deterministic string |

Deterministic helpers run after the LLM calls:

- `compute_adherence_score(checks)` → `adherent / (adherent + deviation)`, default 1.0 if denominator is 0.
- `compute_determination(findings, clinical, doc_quality)` → rule-based ladder: `CRITICAL_EVENT` if any `CRITICAL` finding; `SIGNIFICANT_CONCERN` if `≥2 CONCERN` or `≥3 NOT_MET`; `PERFORMANCE_CONCERN` if `≥1 CONCERN` or `1-2 NOT_MET`; `DOCUMENTATION_CONCERN` if doc issues; else `NO_ISSUES`. The rationale sub-call receives the determination and writes prose for it.

Composes a `QICaseReview` with `case_id`, `generated_at=datetime.now(timezone.utc)`, all sub-call results, plus the deterministic `adherence_score` and `determination`. `cad_record` is left unset here — the orchestrator attaches it after this returns.

### `pcr_drafter.py` — pre-pipeline auto-drafter

```python
async def draft_pcr(case_id: str, video_events: list[Event], audio_events: list[Event],
                    cad_record: Optional[CADRecord] = None) -> PCRDraft
```

- **External calls:** `claude_sonnet` with `PCR_DRAFT_SYSTEM`/`PCR_DRAFT_USER_TEMPLATE`, `max_tokens=3000`. No tool — plain text output. Builds the user message by formatting the giant template with CAD timing fields, the serialized event lists, and `[UNCONFIRMED]` placeholders for clinical content.
- On Sonnet failure or empty response, calls `_fallback_pcr(...)` to assemble a deterministic plain-text PCR with `[UNCONFIRMED]` markers for every clinical detail; intervention lines are flagged `[UNCONFIRMED]` unless both video and audio show the same `event_type` within 30 s.
- **Returns** a `PCRDraft` with `status=PENDING_REVIEW`, `draft_markdown=<text>`, counts populated, `unconfirmed_count=draft_text.count("[UNCONFIRMED]")`. Used by `api/pcr_draft.py`'s background task; does not feed the QI pipeline directly — the EMT must `PATCH /pcr-draft/confirm` first.

### `_fixture.py`

Loads `fixtures/sample_qi_review.json` once via `lru_cache(maxsize=1)`, exposes deep-copy accessors (`fixture_qi_review`, `fixture_clinical_assessment`, `fixture_documentation_quality`, `fixture_utstein_data`, `fixture_recommendations`) and per-source event slicers (`pcr_events`, `video_events`, `audio_events`) that derive from the fixture's `timeline[].source_events`. Used by the `protocol_check` stub and the `drafting` sub-call fallbacks.

### Cross-stage shared infrastructure: `llm_clients.py`

Every LLM-touching stage above ultimately calls into:

- `claude_haiku(messages, system?, tools?, max_tokens=2048)` — `AsyncAnthropic`, model `claude-haiku-4-5`, `tenacity` retry × 5 with `wait_random_exponential(min=2, max=30)`, system prompt cached via `cache_control: ephemeral`.
- `claude_sonnet(...)` — same wrapper, model `claude-sonnet-4-6`, `max_tokens=4096`.
- `elevenlabs_transcribe(audio_path)` — POST to `api.elevenlabs.io/v1/speech-to-text` via `httpx.AsyncClient(timeout=120s)`, model `scribe_v1`, word-granularity timestamps.
- `gemini_flash_video(video_path, prompt, tool, system?)` — Google File API upload (polled for ACTIVE state, 2 s sleep) then `gemini-2.5-flash` with a single function-declaration tool forced via `function_calling_config={"mode": "ANY"}`. Proto results converted via `_proto_to_dict`.

Every wrapper raises `RuntimeError` if its key is unset (except `claude_*` which silently constructs a client with `api_key=""` — the API call itself will then fail).

---

## 7. Prompts

File: `backend/app/prompts.py`. Every prompt template / tool-schema constant:

### Stage 1a — PCR parser

| Constant | Purpose |
|---|---|
| `PCR_PARSER_SYSTEM` | Tells Haiku to extract every clinically significant Event from a PCR markdown, conservative (no invented events). |
| `PCR_PARSER_USER_TEMPLATE` | Wraps the PCR text in `<pcr>…</pcr>` and tells Haiku to use the tool. |
| `PCR_EVENTS_TOOL` | Tool schema `extract_pcr_events`: array of events (timestamp, timestamp_seconds, event_type enum, description, details, confidence, raw_evidence). |

### Stage 1b — video analyzer

| Constant | Purpose |
|---|---|
| `VIDEO_EVENTS_SYSTEM` | Tells Gemini to identify visually observable clinical events in body-cam footage (no inference for unseen actions). |
| `VIDEO_EVENTS_USER_PROMPT` | Instruction string telling Gemini to use the extract_video_events tool. |
| `VIDEO_EVENTS_TOOL` | Tool schema `extract_video_events` (built by `_events_tool` factory; same Event shape as audio). |

### Stage 1c — audio analyzer

| Constant | Purpose |
|---|---|
| `AUDIO_EVENTS_SYSTEM` | Tells Haiku to extract clinical events from time-stamped transcript segments; skip chitchat. |
| `AUDIO_EVENTS_USER_TEMPLATE` | Wraps `<transcript_segments>` JSON. |
| `AUDIO_EVENTS_TOOL` | `extract_audio_events` (factory-built, same Event shape). |

### Stage 2 — reconciliation chain

| Constant | Purpose |
|---|---|
| `RECONCILIATION_SYSTEM` | Legacy single-pass reconciliation prompt — superseded by the cluster/review/critic chain below but still in the file. |
| `RECONCILIATION_USER_TEMPLATE` / `TIMELINE_TOOL` | Legacy single-shot reconciliation tool. |
| `RECONCILIATION_CLUSTER_SYSTEM` + `..._USER_TEMPLATE` | Agent 1: semantic clustering of cross-source events into mutually-exclusive groups (`cluster_events` tool). |
| `CLUSTER_EVENTS_TOOL` | Tool schema returning `clusters: [{cluster_id, event_ids[], centroid_timestamp_seconds, source_types[]}]`. |
| `RECONCILIATION_REVIEW_SYSTEM` + `..._USER_TEMPLATE` | Agent R: combined per-cluster discrepancy scoring + canonicalization. |
| `REVIEW_CLUSTER_TOOL` | Returns `discrepancy_score`, `discrepancy_type`, `discrepancy_reasoning`, `canonical_*`, `match_confidence`. |
| `RECONCILIATION_CRITIC_SYSTEM` + `..._USER_TEMPLATE` | Agent 4 (Sonnet): verifies + corrects the draft timeline; can split or merge. |
| `ASSEMBLE_VERIFIED_TIMELINE_TOOL` | Returns final `timeline_entries[]` with critic-revised values. |

### Stage 4 — findings

| Constant | Purpose |
|---|---|
| `FINDINGS_SYSTEM` | Tells Sonnet to surface findings across 5 categories with severity rubric and evidence-grounding rules. |
| `FINDINGS_USER_TEMPLATE` | Wraps `<timeline>` and `<protocol_checks>` JSON. |
| `FINDINGS_TOOL` | `generate_findings` tool — returns severity/category/title/explanation/evidence_event_ids/evidence_timestamp_seconds/pcr_excerpt/suggested_review_action. |

### Stage 5 — drafting (5 sub-calls)

| Constant | Purpose |
|---|---|
| `QI_HEADER_SYSTEM` + `..._USER_TEMPLATE` + `QI_HEADER_TOOL` | Sub-call A: extract anonymized case header (responding_unit, crew_members, age range, sex, chief_complaint), write the 2-3 paragraph incident summary, and populate Utstein cardiac-arrest data when applicable. |
| `QI_CLINICAL_ASSESSMENT_SYSTEM` + `..._USER_TEMPLATE` + `QI_CLINICAL_ASSESSMENT_TOOL` | Sub-call B: assess care against per-incident benchmarks (10 categories) with MET/NOT_MET/NA/INSUFFICIENT_DOCUMENTATION + evidence_event_ids. |
| `QI_DOCUMENTATION_QUALITY_SYSTEM` + `..._USER_TEMPLATE` + `QI_DOCUMENTATION_QUALITY_TOOL` | Sub-call C: score PCR completeness/accuracy/narrative_quality 0-1, list specific issues. |
| `QI_RECOMMENDATIONS_SYSTEM` + `..._USER_TEMPLATE` + `QI_RECOMMENDATIONS_TOOL` | Sub-call D: produce categorized + prioritized recommendations citing related findings. |
| `QI_DETERMINATION_RATIONALE_SYSTEM` + `..._USER_TEMPLATE` | Sub-call E: 2-3 sentence rationale prose for the rule-based determination. No tool — plain text. |

### Drafting prose helpers (legacy / unused by current `drafting.py`)

| Constant | Purpose |
|---|---|
| `DRAFTING_SUMMARY_SYSTEM` + `..._USER_TEMPLATE` | Older 200-word executive summary prompt — retained but the new sub-call A handles summary inside the QI header tool. |
| `DRAFTING_NARRATIVE_SYSTEM` + `..._USER_TEMPLATE` | Older 3-4 paragraph narrative prompt — also unused by current `drafting.draft_qi_review`. |

### PCR auto-drafter (pre-pipeline)

| Constant | Purpose |
|---|---|
| `PCR_DRAFT_SYSTEM` | Tells Sonnet to draft a plain-text PCR using the exact section template, marking unevidenced fields `[UNCONFIRMED]`, flagging single-source events, no markdown. |
| `PCR_DRAFT_USER_TEMPLATE` | Massive scaffold containing the literal PCR template with placeholder fields populated from `CADRecord` and the serialized video/audio event lists. |

### Tool factory

`_events_tool(name, description)` builds the shared Event-extraction tool used by audio + video analyzers.

---

## 8. Demo mode behavior

Trace of `GET /api/cases/{case_id}/stream?demo=1`:

1. **Route handler** (`api/pipeline.py:107 stream_pipeline`):
   - Calls `load_case(case_id)` — raises 404 if case dir missing. Note: it loads the `Case` even though demo never uses it; this is a side-effect of sharing the route. For `case_01`, this also triggers `_seed_case_01()` which copies `fixtures/sample_qi_review.json` → `cases/case_01/review.json` if missing.
   - Sees `demo=True`, returns `EventSourceResponse(_demo_stream(case_id))`.

2. **`_demo_stream(case_id)`** (`api/pipeline.py:56`):
   - Calls `load_cached_review(case_id)` (`case_loader.py:164`).
     - For `case_01`, the loader runs `_seed_case_01()` again (idempotent — early-returns if `review.json` already exists).
     - Reads `cases/<case_id>/review.json` and validates against `QICaseReview`.
     - If the file doesn't exist, returns `None`.
   - If `cached is None`: emits one `event: error` with `data: {"type":"error", "message": "No cached review available for {case_id}"}` and ends the generator.
   - Otherwise iterates the constant `_DEMO_STAGES` — **7 stages, CAD parsing intentionally omitted** — in this exact order: `PCR_PARSING`, `VIDEO_ANALYSIS`, `AUDIO_ANALYSIS`, `RECONCILIATION`, `PROTOCOL_CHECK`, `FINDINGS`, `DRAFTING`. For each:
     - Emits `event: progress` with `PipelineProgress(stage=..., status="running", started_at=now)`.
     - `await asyncio.sleep(0.4)` (the `_DEMO_STAGE_DELAY_S` constant).
     - Emits `event: progress` with `status="complete"`, `started_at` and `completed_at` timestamps.
   - After all 7 stages: emits `event: complete` with `data: {"type":"complete", "review": cached.model_dump(mode="json")}`. The full QI review is delivered as one final event payload.

**Stages skipped vs live:**
- `cad_parsing` is omitted. CAD data is still present in the cached review's `cad_record` field if the original live run that produced the cache had it, but no `progress` event for the stage is emitted.
- All real LLM calls / Anthropic / Google / ElevenLabs traffic is bypassed.
- `process_case` is never invoked, the orchestrator is never imported, and `save_cached_review` is never called.

**Files read in the demo path:**
- `cases/<case_id>/` directory (existence check via `load_case`).
- `cases/<case_id>/pcr.md` (incidentally — `load_case` calls `_ensure_pcr` which writes the placeholder if missing, even though demo never reads PCR content).
- `cases/<case_id>/review.json` (the source of the final review).
- For `case_01` only: `fixtures/sample_qi_review.json` (auto-seeded into `cases/case_01/review.json` on first read).

**Final QICaseReview source:** the cached `review.json`, originally produced by either:
- A previous live `process_case` run (which called `save_cached_review` from the SSE handler); or
- The fixture seed `fixtures/sample_qi_review.json` for `case_01`.

So demo mode is fundamentally a **replay** — it requires a pre-existing cache to function, and any `case_NN` directory other than `case_01` that hasn't been run live will get `event: error` instead of a replay.

**Stream termination:** the generator returns naturally after yielding the terminal event (`complete` or `error`). `EventSourceResponse` closes the underlying HTTP connection when the generator ends; there's no explicit close marker on the wire.
