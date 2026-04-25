# Sentinel Scaffolding Prompts

A phased prompt sequence for bootstrapping the Sentinel project (agentic AAR system for EMS quality review). Each phase is self-contained — you can reset the chat window between phases.

**Stack:** Vite + React + TypeScript frontend (Cloudflare Pages deployable), FastAPI + Python async backend (self-hosted).

**How to use:** Copy each phase's prompt block into your code-gen tool (Claude Code, Cursor, etc.). Verify the acceptance criteria before moving to the next phase. If something goes wrong, you can reset the chat and re-run the phase without polluting context from earlier phases.

---

## Phase 0 — Repo Skeleton & Tooling

**Goal:** Empty directory structure, dependency manifests, configs. No application logic.

**Why separate:** Getting tooling right is fiddly and unrelated to product logic. Locking it down first means later phases never get distracted by config issues.

### Prompt

```
Create the initial scaffolding for a hackathon project called "sentinel" — an agentic system for EMS quality review. This phase creates ONLY the repo structure, dependency files, and configs. No application logic yet.

## Directory structure to create

sentinel/
├── README.md
├── .gitignore
├── .env.example
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   └── __init__.py
│   ├── tests/
│   │   └── __init__.py
│   └── scripts/
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   └── public/
├── cases/
│   ├── case_01/
│   ├── case_02/
│   └── case_03/
├── protocols/
├── fixtures/
└── docs/

## Backend setup

backend/pyproject.toml — uv-compatible. Python >=3.11. Dependencies:
fastapi, uvicorn[standard], pydantic>=2, pydantic-settings, anthropic, google-generativeai, openai, python-multipart, sse-starlette, httpx, tenacity, python-dotenv.

Dev dependencies: pytest, pytest-asyncio, ruff.

Include [tool.ruff] with line-length=100, and [tool.pytest.ini_options] with asyncio_mode="auto".

## Frontend setup (Vite + React + TS + Tailwind, Cloudflare Pages compatible)

frontend/package.json:
- vite, @vitejs/plugin-react, typescript, react@18, react-dom@18, @types/react, @types/react-dom
- tailwindcss, postcss, autoprefixer
- react-markdown, remark-gfm
- lucide-react
- clsx, tailwind-merge

Scripts: dev, build, preview, typecheck (tsc --noEmit).

vite.config.ts: React plugin, port 5173, proxy /api to http://localhost:8000. Build output to dist/. Set base: '/' for Cloudflare Pages.

tsconfig.json: strict, target ES2022, module ESNext, moduleResolution Bundler, jsx react-jsx, paths alias "@/*" → "./src/*". Reference tsconfig.node.json for vite config.

tailwind.config.js: scan src/**/*.{ts,tsx,html}.

postcss.config.js: tailwindcss + autoprefixer.

index.html: minimal HTML5 with #root div, references /src/main.tsx as module.

src/main.tsx: standard React 18 createRoot bootstrap, imports App and index.css.

src/App.tsx: placeholder component returning <div>Sentinel scaffold ready</div>.

src/index.css: Tailwind directives only.

## Cloudflare Pages config

Add frontend/_headers and frontend/_redirects (empty placeholder files for now, with comments explaining their purpose). These deploy alongside the build.

Add docs/DEPLOYMENT.md describing:
- Frontend: Cloudflare Pages, build command `npm run build`, output dir `dist`, root dir `frontend`
- Backend: self-hosted (any Python host); set CORS to allow the Cloudflare Pages domain
- Env var: VITE_API_URL set in Cloudflare Pages settings

## .env.example

Template with: ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, CASES_DIR, PROTOCOLS_DIR, FIXTURES_DIR, FRONTEND_ORIGIN. No values.

## .gitignore

Standard Python (.venv, __pycache__, *.pyc, .pytest_cache, .ruff_cache) + Node (node_modules, dist) + .env + cases/*/video.* + cases/*/audio.* + .DS_Store.

## README.md

Brief overview: project purpose, three-developer division, "see docs/ for details" pointer, setup commands for backend (uv sync, uvicorn) and frontend (npm install, npm run dev).

## Acceptance criteria

1. `cd backend && uv sync` succeeds
2. `cd frontend && npm install && npm run dev` starts Vite on port 5173 and shows "Sentinel scaffold ready"
3. `cd frontend && npm run typecheck` passes
4. `cd frontend && npm run build` produces a dist/ folder
5. All directories listed above exist (empty subdirs have .gitkeep files where needed)

Stop after this phase. Do NOT add Pydantic schemas, API routes, or UI components yet — those come in later phases.
```

### Verification

Run each acceptance criterion. Commit. Move to Phase 1.

---

## Phase 1 — Shared Contracts (Pydantic Schemas + TypeScript Types + Sample Fixture)

**Goal:** The single source of truth that all three developers build against. After this phase, parallel work begins.

**Why separate:** Schemas are the contract. They must be locked before anyone writes pipeline logic or UI. Doing them in isolation, with full attention, prevents later rework.

### Prompt

```
Add the shared data contracts to the sentinel project. The repo already has the directory structure and dependency files from Phase 0. This phase ONLY adds:

1. Pydantic schemas (backend/app/schemas.py) — single source of truth
2. TypeScript types (frontend/src/types/schemas.ts) — exact mirror of Pydantic models
3. A realistic sample fixture (fixtures/sample_aar.json) used by both backend stubs and frontend dev

Do NOT add API routes, pipeline logic, or UI components in this phase.

## backend/app/schemas.py

Use Pydantic v2. Import from datetime, enum, typing.

Define EXACTLY these models:

class EventSource(str, Enum):
    PCR = "pcr"
    VIDEO = "video"
    AUDIO = "audio"

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

class Event(BaseModel):
    event_id: str
    timestamp: str                # "HH:MM:SS"
    timestamp_seconds: float      # seconds from incident start, used for matching
    source: EventSource
    event_type: EventType
    description: str
    details: dict[str, Any] = Field(default_factory=dict)
    confidence: float             # 0.0-1.0
    raw_evidence: str

class TimelineEntry(BaseModel):
    entry_id: str
    canonical_timestamp_seconds: float
    canonical_description: str
    event_type: EventType
    source_events: list[Event]    # 1-3 events that reconcile to this entry
    match_confidence: float
    has_discrepancy: bool

class ProtocolStep(BaseModel):
    step_id: str
    description: str
    expected_timing_seconds: Optional[float] = None
    required: bool

class ProtocolCheckStatus(str, Enum):
    ADHERENT = "adherent"
    DEVIATION = "deviation"
    NOT_APPLICABLE = "not_applicable"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"

class ProtocolCheck(BaseModel):
    check_id: str
    protocol_step: ProtocolStep
    status: ProtocolCheckStatus
    evidence_event_ids: list[str]
    explanation: str

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

class AARDraft(BaseModel):
    case_id: str
    generated_at: datetime
    summary: str
    timeline: list[TimelineEntry]
    findings: list[Finding]
    protocol_checks: list[ProtocolCheck]
    adherence_score: float
    narrative: str
    reviewer_notes: str = ""

class Case(BaseModel):
    case_id: str
    incident_type: str            # e.g. "cardiac_arrest"
    incident_date: datetime
    pcr_path: str
    video_path: str
    audio_path: str
    metadata: dict[str, Any] = Field(default_factory=dict)

class PipelineStage(str, Enum):
    PCR_PARSING = "pcr_parsing"
    VIDEO_ANALYSIS = "video_analysis"
    AUDIO_ANALYSIS = "audio_analysis"
    RECONCILIATION = "reconciliation"
    PROTOCOL_CHECK = "protocol_check"
    FINDINGS = "findings"
    DRAFTING = "drafting"

class PipelineProgress(BaseModel):
    stage: PipelineStage
    status: Literal["pending", "running", "complete", "error"]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

Add a backend/tests/test_schemas.py that:
- Loads fixtures/sample_aar.json
- Validates it parses as AARDraft
- Confirms at least 3 timeline entries, at least 4 findings, at least 5 protocol checks

## frontend/src/types/schemas.ts

Mirror EVERY Pydantic model above as a TypeScript interface or type alias. Use string literal unions for enums (matching Python enum values exactly). Use string for datetime fields. Field names must match Python exactly (snake_case preserved — do NOT camelCase).

Example:
export type EventSource = "pcr" | "video" | "audio";
export interface Event { event_id: string; timestamp: string; timestamp_seconds: number; ... }

Export every type. Add a top-of-file comment: "// Mirrors backend/app/schemas.py — keep in sync."

## fixtures/sample_aar.json

Generate a realistic, complete AARDraft for a cardiac arrest case (case_01) including:

- 3 timeline entries with reconciled source events from at least 2 sources each
- 4 findings — one of each: timing_discrepancy, missing_documentation, phantom_intervention, protocol_deviation
  - Severities: 1 critical, 2 concern, 1 info
  - Each must have a realistic evidence_timestamp_seconds and at least one pcr_excerpt
- 5 protocol_checks — 3 adherent, 2 deviation, referencing real ACLS steps (CPR within 60s, epinephrine every 3-5 min, rhythm check every 2 min, defibrillation for shockable rhythms, airway management)
- adherence_score: 0.72
- summary: 2-3 paragraphs describing a 65yo male witnessed cardiac arrest with bystander CPR, EMS arrival, ACLS, ROSC achieved
- narrative: 3-4 paragraphs of prose AAR, referencing findings inline

Use realistic event_ids (uuid-like strings), timestamp_seconds in 0-600 range, and concrete medical details. The fixture must validate cleanly against the Pydantic schema — run the test to confirm.

## Acceptance criteria

1. `cd backend && uv run pytest tests/test_schemas.py` passes
2. `cd frontend && npm run typecheck` passes
3. fixtures/sample_aar.json exists and is valid AARDraft
4. Every Pydantic model has a corresponding TypeScript type with matching field names
5. The fixture has the exact counts specified (3 timeline, 4 findings, 5 protocol checks)

Stop after this phase.
```

### Verification

Run all acceptance criteria. Eyeball the fixture — does the AAR feel realistic? If yes, commit. **This is the contract freeze point.** Future phases reference this contract; changes require team consensus.

---

## Phase 2 — Backend API & Pipeline Stubs

**Goal:** FastAPI app with all endpoints implemented, pipeline orchestrator with five stub stages, SSE streaming. Backend is fully runnable end-to-end with stub data.

**Why separate:** This is Person 2's domain. Once done, the backend can serve the frontend without any real LLM calls.

### Prompt

```
Build the FastAPI backend for sentinel. The repo has Phase 0 scaffolding and Phase 1 schemas. Reference backend/app/schemas.py and fixtures/sample_aar.json — do NOT modify them.

This phase implements:
1. FastAPI app with all REST endpoints
2. Pipeline orchestrator with 5 stub stages (returning hardcoded data matching schemas)
3. SSE streaming for live pipeline progress
4. CLI script to run the pipeline

Do NOT implement real LLM calls or real video/audio analysis yet — all stages are stubs. Do NOT touch the frontend.

## File layout to create

backend/app/
├── main.py                       # FastAPI entrypoint
├── config.py                     # pydantic-settings
├── api/
│   ├── __init__.py
│   ├── cases.py                  # case endpoints
│   └── pipeline.py               # process + stream endpoints
├── pipeline/
│   ├── __init__.py
│   ├── orchestrator.py           # process_case top-level
│   ├── pcr_parser.py             # Stage 1a stub
│   ├── video_analyzer.py         # Stage 1b stub
│   ├── audio_analyzer.py         # Stage 1c stub
│   ├── reconciliation.py         # Stage 2 stub
│   ├── protocol_check.py         # Stage 3 stub
│   ├── findings.py               # Stage 4 stub
│   └── drafting.py               # Stage 5 stub
├── llm_clients.py                # Wrapper stubs (no real calls yet)
└── case_loader.py                # Loads cases from disk

backend/scripts/run_pipeline.py   # CLI

## backend/app/config.py

Pydantic-settings reading from .env:
- ANTHROPIC_API_KEY: str = ""
- GOOGLE_API_KEY: str = ""
- OPENAI_API_KEY: str = ""
- CASES_DIR: Path = Path("../cases")
- PROTOCOLS_DIR: Path = Path("../protocols")
- FIXTURES_DIR: Path = Path("../fixtures")
- FRONTEND_ORIGIN: str = "http://localhost:5173"

Export a settings singleton.

## backend/app/main.py

FastAPI app with:
- CORS middleware allowing settings.FRONTEND_ORIGIN
- Routers from api/cases.py and api/pipeline.py mounted at /api
- A GET /health endpoint returning {"status": "ok"}

## backend/app/case_loader.py

Functions:
- list_cases() -> list[Case]: reads CASES_DIR, returns one Case per subdirectory. Each subdirectory should have pcr.md (and optionally video.mp4, audio.mp3, ground_truth.json). Use the directory name as case_id. Default incident_type to "cardiac_arrest" if not specified in metadata.
- load_case(case_id: str) -> Case: returns one case or raises FileNotFoundError
- load_pcr_content(case_id: str) -> str: reads pcr.md
- load_cached_aar(case_id: str) -> AARDraft | None: reads cases/{case_id}/aar.json if exists

If a case directory is missing pcr.md, create a placeholder pcr.md when list_cases() runs (so the demo always has at least one case). Use the case_01 PCR text from fixtures/sample_aar.json's narrative as a starting point if needed.

Also seed: if cases/case_01/ is empty on first run, copy fixtures/sample_aar.json into cases/case_01/aar.json so GET /api/cases/case_01/aar returns the fixture.

## backend/app/api/cases.py

Router with:
- GET /cases → list[Case]
- GET /cases/{case_id} → Case (404 if missing)
- GET /cases/{case_id}/pcr → {"content": str}
- GET /cases/{case_id}/aar → AARDraft (404 if no cached AAR)
- GET /cases/{case_id}/video → FileResponse with range support (return 404 if no video)

## backend/app/api/pipeline.py

Router with:
- POST /cases/{case_id}/process → triggers pipeline, returns {"job_id": str}. Use a simple in-memory dict mapping job_id → asyncio.Task.
- GET /cases/{case_id}/stream → Server-Sent Events. Streams PipelineProgress events as JSON, then a final event {"type": "complete", "aar": <AARDraft JSON>}.

Use sse-starlette's EventSourceResponse. Each progress update is one SSE event.

The /process endpoint kicks off process_case() in a background task and stores the result. The /stream endpoint subscribes to progress updates via an asyncio.Queue per job.

For simplicity: when /stream is called, run the pipeline synchronously within the SSE handler, yielding progress events as each stage completes. This avoids the complexity of separate process + stream coordination for a hackathon. (Drop the job_id complexity if it gets gnarly — just have /stream do the work.)

## backend/app/pipeline/orchestrator.py

async def process_case(
    case: Case,
    progress_callback: Callable[[PipelineProgress], Awaitable[None]],
) -> AARDraft:
    """Run all 5 stages, emitting progress along the way."""

Each stage:
1. emits PipelineProgress with status="running"
2. calls the stub function (which sleeps 1-2 seconds to simulate work)
3. emits PipelineProgress with status="complete"

Stage flow:
- Stages 1a, 1b, 1c run via asyncio.gather (parallel extraction)
- Stages 2, 3, 4, 5 run sequentially

If any stage raises, emit PipelineProgress with status="error" and re-raise.

## Stub implementations (one per stage file)

Each stub:
- Takes properly typed input
- await asyncio.sleep(1.0 + random.random())  # simulate work
- Returns hardcoded data loaded from fixtures/sample_aar.json (parsed once at module load)

Specifically:
- pcr_parser.parse_pcr(case) → list[Event]: returns the source_events with source==PCR from the fixture's timeline
- video_analyzer.analyze_video(case) → list[Event]: returns events with source==VIDEO
- audio_analyzer.analyze_audio(case) → list[Event]: returns events with source==AUDIO
- reconciliation.reconcile(pcr_events, video_events, audio_events) → list[TimelineEntry]: returns fixture.timeline
- protocol_check.check_protocol(timeline, incident_type) → list[ProtocolCheck]: returns fixture.protocol_checks
- findings.generate_findings(timeline, checks) → list[Finding]: returns fixture.findings
- drafting.draft_aar(case, timeline, findings, checks) → AARDraft: returns fixture (with case_id swapped to the actual case)

This means even with all stubs, the pipeline returns a complete valid AARDraft. The frontend can be developed against a real backend immediately.

## backend/app/llm_clients.py

Stub wrappers (no real calls yet, just signatures so future phases can fill them in):
- async def claude_haiku(messages, tools=None) -> dict: raise NotImplementedError
- async def claude_sonnet(messages, tools=None) -> dict: raise NotImplementedError
- async def gemini_flash_video(video_path, prompt) -> str: raise NotImplementedError
- async def whisper_transcribe(audio_path) -> dict: raise NotImplementedError

## backend/scripts/run_pipeline.py

CLI: `uv run python scripts/run_pipeline.py case_01`
- Loads the case
- Runs process_case with a print-based progress callback
- Pretty-prints the resulting AARDraft as JSON

## Acceptance criteria

1. `cd backend && uv run uvicorn app.main:app --reload` starts the server
2. `curl http://localhost:8000/health` returns {"status": "ok"}
3. `curl http://localhost:8000/api/cases` returns at least case_01
4. `curl http://localhost:8000/api/cases/case_01/aar` returns the full fixture as valid JSON
5. `curl -N http://localhost:8000/api/cases/case_01/stream` streams 7 progress events plus a final complete event
6. `uv run python scripts/run_pipeline.py case_01` runs end-to-end and prints a valid AARDraft (~10s total runtime due to sleep delays)
7. CORS allows http://localhost:5173

Stop after this phase.
```

### Verification

Run every acceptance criterion. The backend is now a complete black box that returns realistic AAR data. Frontend dev can begin without waiting for real LLM integration.

---

## Phase 3 — Frontend 3-Pane UI

**Goal:** Working React app with case selector, video player, AAR draft, PCR pane, and the click-to-seek interaction. Renders against the real backend.

**Why separate:** Person 3's domain. UI work is detail-heavy and benefits from focused context.

### Prompt

```
Build the Vite + React + TypeScript frontend for sentinel. The repo has Phase 0 scaffolding, Phase 1 types in frontend/src/types/schemas.ts, and Phase 2 backend running on http://localhost:8000.

This phase implements the 3-pane review UI with click-to-seek interaction.

Do NOT modify schemas, do NOT touch backend code.

## File layout to create

frontend/src/
├── App.tsx                       # main page: header + 3-pane layout + progress
├── lib/
│   ├── api.ts                    # typed fetch client
│   ├── cn.ts                     # className helper using clsx + tailwind-merge
│   └── format.ts                 # timestamp formatting helpers
├── components/
│   ├── CaseSelector.tsx          # top-bar dropdown + Process button
│   ├── VideoPane.tsx             # left pane
│   ├── AARPane.tsx               # center pane
│   ├── PCRPane.tsx               # right pane
│   ├── FindingCard.tsx           # one finding, clickable
│   ├── PipelineProgress.tsx      # live status indicator
│   └── TimelineMarker.tsx        # finding marker on video scrubber
└── hooks/
    ├── useCase.ts                # loads case + AAR
    ├── usePCR.ts                 # loads PCR markdown
    └── usePipelineStream.ts      # subscribes to SSE

## frontend/src/lib/api.ts

Typed wrappers using fetch. Base URL from import.meta.env.VITE_API_URL or default to "" (proxied to :8000 in dev).

Export:
- async function getCases(): Promise<Case[]>
- async function getCase(id: string): Promise<Case>
- async function getPCR(id: string): Promise<{content: string}>
- async function getAAR(id: string): Promise<AARDraft>
- function getVideoUrl(id: string): string
- function streamCase(id: string, handlers: { onProgress, onComplete, onError }): EventSource

For streamCase: open EventSource at `/api/cases/${id}/stream`, parse JSON from each message, route to handlers based on payload shape (PipelineProgress vs final {type: "complete", aar}).

## frontend/src/App.tsx

Layout:
- Header bar (h-14, border-b): app name "Sentinel", CaseSelector on the right
- Main grid: 3 columns (33% / 34% / 33%), full remaining height
  - Left: <VideoPane>
  - Center: <AARPane>
  - Right: <PCRPane>
- Footer: <PipelineProgress> (only visible when pipeline is running, slides in from bottom)

State managed at App level:
- selectedCaseId
- aar (AARDraft | null)
- pcrContent (string)
- selectedFindingId (string | null) — drives video seek + PCR highlight
- pipelineProgress (PipelineProgress[])

Use useEffect to load case + AAR when selectedCaseId changes. Use the streaming hook when "Process" is clicked.

## VideoPane.tsx

Props: videoUrl, findings, selectedFindingId, onSeek (called when user scrubs)
- HTML5 <video> element with controls
- Custom timeline overlay below video showing TimelineMarker for each finding (positioned by evidence_timestamp_seconds / video.duration)
- Markers color-coded by severity (critical=red, concern=amber, info=blue) using Tailwind
- Imperatively seek video.currentTime when selectedFindingId changes (useEffect on selectedFindingId)
- Optional: a "Blur graphic content" toggle that applies CSS filter: blur(20px) to the video element when on, with a "Click to reveal" overlay. Default ON. (This is the trauma-reduction angle made tangible — implement it.)

## AARPane.tsx

Props: aar, selectedFindingId, onSelectFinding
- Top: aar.summary in a styled card (border, rounded, p-4)
- Adherence score as a horizontal progress bar
- Section: Findings — list of FindingCard, sorted by severity (critical first)
- Section: Narrative — react-markdown rendering aar.narrative
- Section: Protocol Checks — collapsed by default, expandable list

When a FindingCard is clicked, call onSelectFinding(finding.finding_id). The selected card gets a ring/border highlight.

## FindingCard.tsx

Props: finding, isSelected, onClick
- Severity badge (critical/concern/info) with appropriate color
- Category as a smaller pill
- Title (font-semibold)
- Explanation (text-sm)
- Footer: timestamp formatted as MM:SS, "View evidence" affordance
- isSelected styling: ring-2 ring-blue-500
- Hover: bg-gray-50 cursor-pointer

## PCRPane.tsx

Props: pcrContent (markdown string), highlightExcerpt (string | null)
- Render with react-markdown + remark-gfm
- When highlightExcerpt is set, find that substring in the rendered output and wrap it in a <mark> with a yellow bg + scroll into view smoothly. Implement using a wrapper div + post-render DOM manipulation in useEffect, or by pre-processing the markdown string to inject <mark> tags before rendering.
- Scrollable container with max-height = full pane height

## PipelineProgress.tsx

Props: stages (PipelineProgress[])
- Horizontal stepper showing all 7 stages
- Each stage: name, status icon (pending=gray circle, running=spinner, complete=green check, error=red X)
- Connected by lines, lines turn green as stages complete
- Slide up animation when first stage starts

## CaseSelector.tsx

Props: cases, selectedId, onSelect, onProcess, isProcessing
- Native <select> dropdown listing cases by case_id + incident_type
- "Process Case" button next to it (disabled while isProcessing)

## Critical interaction (the demo wow moment)

Wire this up explicitly: when the user clicks a FindingCard:
1. App.tsx sets selectedFindingId
2. VideoPane seeks video to finding.evidence_timestamp_seconds
3. PCRPane highlights and scrolls to finding.pcr_excerpt
4. The selected FindingCard gets a visible ring

This must work even with hardcoded fixture data. Verify it works before considering this phase done.

## Styling

Use Tailwind utility classes throughout. Color palette:
- Background: white / gray-50
- Borders: gray-200
- Severity: critical=red-500/red-50, concern=amber-500/amber-50, info=blue-500/blue-50
- Selected: blue-500 ring

Use lucide-react icons (Play, AlertTriangle, CheckCircle, etc.).

## Acceptance criteria

1. `cd frontend && npm run dev` starts on port 5173
2. With backend running on :8000, the app loads case_01 automatically
3. The 3-pane layout renders with AAR data, PCR markdown, and video element
4. Clicking a Finding card seeks the video AND highlights the corresponding PCR excerpt
5. Clicking "Process Case" triggers SSE stream and PipelineProgress updates live across all 7 stages
6. After streaming completes, the AAR pane updates with the new (still-fixture-derived) draft
7. `npm run typecheck` passes
8. `npm run build` succeeds (Cloudflare Pages will run this)
9. Blur toggle on VideoPane works

Stop after this phase.
```

### Verification

Run all acceptance criteria. The wow-moment interaction (click finding → seek video → highlight PCR) must work flawlessly. If it does, you have a demoable product running on stub data.

---

## Phase 4 — Real LLM Integration (PCR Parser First)

**Goal:** Replace the PCR parser stub with a real Claude Haiku implementation. Establishes the pattern for the other extractors.

**Why separate:** First real LLM stage is highest-risk. Doing it alone, with full attention, gets the pattern right before scaling to other stages.

### Prompt

```
Replace the PCR parser stub in sentinel with a real Claude Haiku 4.5 implementation. The repo has Phases 0-3 complete. The backend pipeline currently returns fixture data; we now make Stage 1a (PCR parsing) actually call Claude.

This phase ONLY touches:
- backend/app/llm_clients.py (implement claude_haiku)
- backend/app/pipeline/pcr_parser.py (replace stub)
- backend/app/prompts.py (NEW — centralized prompts)
- backend/tests/test_pcr_parser.py (NEW)

Do NOT touch other pipeline stages, do NOT modify schemas, do NOT modify the frontend.

## backend/app/llm_clients.py

Implement claude_haiku and claude_sonnet:

from anthropic import AsyncAnthropic
from tenacity import retry, stop_after_attempt, wait_exponential

_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def claude_haiku(
    messages: list[dict],
    system: str | None = None,
    tools: list[dict] | None = None,
    max_tokens: int = 2048,
) -> dict:
    response = await _client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=max_tokens,
        system=system or NOT_GIVEN,
        messages=messages,
        tools=tools or NOT_GIVEN,
    )
    return response.model_dump()

(Use the actual NOT_GIVEN sentinel from anthropic._types if needed, or omit those kwargs when None.)

Same shape for claude_sonnet but model="claude-sonnet-4-6".

Leave gemini_flash_video and whisper_transcribe as NotImplementedError for now.

## backend/app/prompts.py

Centralize all prompts. For Phase 4, only define PCR parsing prompt:

PCR_PARSER_SYSTEM = """You are an expert EMS quality assurance analyst extracting structured events from a Patient Care Report (PCR).

Given a PCR document, identify every clinically significant event and output them as structured data. Each event needs:
- A timestamp (HH:MM:SS format) and timestamp_seconds (offset from incident start, 0 = arrival on scene)
- An event_type from the allowed enum
- A clear description
- Details (medications: name + dose + route; vitals: BP/HR/SpO2/etc; interventions: technique)
- A confidence score (1.0 if explicitly stated, lower if inferred)
- raw_evidence: the exact text from the PCR that supports this event

Be conservative — extract events ONLY if they're documented in the PCR. Do not invent events.
"""

PCR_PARSER_USER_TEMPLATE = """Extract all events from this PCR:

<pcr>
{pcr_content}
</pcr>

Use the extract_pcr_events tool to return your structured output."""

Also define the tool schema:

PCR_EVENTS_TOOL = {
    "name": "extract_pcr_events",
    "description": "Extract structured events from a PCR document",
    "input_schema": {
        "type": "object",
        "properties": {
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "timestamp": {"type": "string"},
                        "timestamp_seconds": {"type": "number"},
                        "event_type": {"type": "string", "enum": [<all EventType values>]},
                        "description": {"type": "string"},
                        "details": {"type": "object"},
                        "confidence": {"type": "number"},
                        "raw_evidence": {"type": "string"},
                    },
                    "required": ["timestamp", "timestamp_seconds", "event_type", "description", "confidence", "raw_evidence"],
                },
            },
        },
        "required": ["events"],
    },
}

## backend/app/pipeline/pcr_parser.py

Replace the stub:

import uuid
from app.case_loader import load_pcr_content
from app.llm_clients import claude_haiku
from app.prompts import PCR_PARSER_SYSTEM, PCR_PARSER_USER_TEMPLATE, PCR_EVENTS_TOOL
from app.schemas import Case, Event, EventSource, EventType

async def parse_pcr(case: Case) -> list[Event]:
    pcr_content = load_pcr_content(case.case_id)
    response = await claude_haiku(
        system=PCR_PARSER_SYSTEM,
        messages=[{"role": "user", "content": PCR_PARSER_USER_TEMPLATE.format(pcr_content=pcr_content)}],
        tools=[PCR_EVENTS_TOOL],
        max_tokens=4096,
    )
    # Extract tool_use block
    tool_use = next((b for b in response["content"] if b["type"] == "tool_use"), None)
    if not tool_use:
        raise RuntimeError("Claude did not return a tool_use block")
    raw_events = tool_use["input"]["events"]
    return [
        Event(
            event_id=str(uuid.uuid4()),
            timestamp=e["timestamp"],
            timestamp_seconds=e["timestamp_seconds"],
            source=EventSource.PCR,
            event_type=EventType(e["event_type"]),
            description=e["description"],
            details=e.get("details", {}),
            confidence=e["confidence"],
            raw_evidence=e["raw_evidence"],
        )
        for e in raw_events
    ]

## backend/tests/test_pcr_parser.py

Integration test (requires ANTHROPIC_API_KEY):
- Skip if no API key in env
- Load cases/case_01/pcr.md
- Call parse_pcr
- Assert at least 5 events returned
- Assert all events have source==PCR
- Assert at least one event has event_type==MEDICATION

## Smoke check the integration

After implementing, verify the full pipeline still runs:
- `uv run python scripts/run_pipeline.py case_01` should still complete
- The PCR parser stage now takes longer (real API call) but other stages are still stubs
- The final AAR is still mostly fixture-derived (since downstream stages are stubs that ignore input), but the parsed events should appear in the logged stage 1a output

## Acceptance criteria

1. `uv run pytest tests/test_pcr_parser.py` passes (with API key)
2. `uv run python scripts/run_pipeline.py case_01` runs end-to-end without errors
3. Logging shows real Claude API call in stage 1a (look for at least 5 extracted events)
4. The frontend still works against the backend with no changes
5. `uv run ruff check app/` passes

Stop after this phase. Other stages (video, audio, reconciliation, etc.) remain stubs.
```

### Verification

Run acceptance criteria. The pattern established here — prompts.py + tool schema + parse function — is what Phases 5+ replicate for other stages.

---

## Phase 5 — Remaining Real Stages (Video, Audio, Reconciliation, Protocol, Findings, Drafting)

**Goal:** Replace the remaining stubs with real implementations.

**Why separate:** Each stage is meaningful work. By Phase 5, the team has a working system and can prioritize which stages to upgrade based on demo quality. **Implement in this order: reconciliation → findings → drafting → audio → video.** The reasoning stages matter most for demo intelligence; video is hardest and lowest ROI per hour.

### Prompt template (apply per stage)

```
Replace the [STAGE_NAME] stub in sentinel with a real implementation. The PCR parser pattern from Phase 4 is the template — follow that structure.

For each stage:
1. Add a prompt + tool schema to backend/app/prompts.py
2. Implement the stage function in backend/app/pipeline/[stage].py
3. Add an integration test in backend/tests/

Stage-specific guidance:

## Reconciliation (Sonnet 4.6)
Input: 3 lists of Events (from PCR, video, audio)
Output: list[TimelineEntry]
Approach: Pass all events sorted by timestamp_seconds to Claude. Ask it to identify which events from different sources refer to the same real-world action. Use a 60-second matching window as guidance. For each match, produce a TimelineEntry with canonical timestamp = average of source timestamps, has_discrepancy=True if timestamps differ by >10 seconds.
Tool schema: returns array of timeline_entries each with canonical_timestamp_seconds, canonical_description, event_type, source_event_ids (matching the input event IDs), match_confidence, has_discrepancy.

## Findings (Sonnet 4.6)
Input: timeline + protocol_checks
Output: list[Finding]
Approach: Ask Claude to generate findings in 5 categories. Provide explicit examples in the prompt:
- timing_discrepancy: source events for same action have differing timestamps
- missing_documentation: video/audio event has no PCR counterpart
- phantom_intervention: PCR event has no video/audio corroboration
- protocol_deviation: corresponds to a protocol_check with status==DEVIATION
- care_gap: timeline shows a >30s gap during active resuscitation
Tool schema: returns array of findings matching the Finding schema, with evidence_event_ids that map back to real events.

## Drafting (Sonnet 4.6)
Input: case + timeline + findings + protocol_checks
Output: AARDraft
Approach: Two-step. First, ask Claude to write the executive summary (2-3 paragraphs). Second, ask Claude to write the prose narrative (3-4 paragraphs) referencing findings inline. Combine into AARDraft. Compute adherence_score = (count of ADHERENT) / (count of ADHERENT + DEVIATION).

## Audio Analyzer (Whisper + Haiku)
Input: case (uses case.audio_path)
Output: list[Event]
Step 1: Use OpenAI Whisper API to transcribe audio with timestamps (response_format="verbose_json", timestamp_granularities=["segment"]).
Step 2: Pass transcript with segment timestamps to Claude Haiku. Ask it to extract events using same tool schema as PCR parser, but source=AUDIO.

If audio file doesn't exist, return empty list (graceful degradation).

## Video Analyzer (Gemini 2.5 Flash)
Input: case (uses case.video_path)
Output: list[Event]
Approach: Use Gemini's native video input. Upload the video file via the File API, then ask Gemini to identify timestamped clinical events visible in the footage. Request structured output matching event schema.

If video file doesn't exist OR is too large (>50MB), return a hardcoded fallback list with a warning logged. (This is the demo-safety fallback — judges should never see a crash.)

## Acceptance criteria for each stage

1. The stage function returns properly typed data
2. Integration test passes with real API call
3. The full pipeline `python scripts/run_pipeline.py case_01` runs end-to-end with all real stages
4. Frontend displays the real (not fixture) AAR
5. The demo cases produce findings that match the seeded discrepancies in the ground truth

Implement ONE stage per chat session. Reset context between stages to avoid cross-contamination.
```

### Verification

After all stages are real, run the full pipeline on all 3 demo cases. The findings the agent produces should match the discrepancies you intentionally seeded in Phase 1's ground truth files. If they don't, that's your debugging target.

---

## Phase 6 — Polish & Demo Hardening

**Goal:** The system is built. Now make it demo-bulletproof.

### Prompt

```
Polish the sentinel project for hackathon demo. The repo has all phases complete and working end-to-end. This phase adds demo robustness, no new features.

## Tasks

1. Demo mode: add a "Demo Mode" toggle (env var or query param) that uses cached AARs from cases/{id}/aar.json instead of running the live pipeline. The Process button still streams the progress UI for visual effect (with synthetic delays) but loads the cached result. This guarantees the demo never fails on stage due to a flaky API call.

2. Caching: after a real pipeline run completes, write the AAR to cases/{id}/aar.json automatically. Subsequent loads use the cache.

3. Error boundaries: wrap the AARPane and PCRPane in React error boundaries. If anything crashes, show a friendly fallback instead of a white screen.

4. Loading states: every fetch should show a skeleton loader, never a blank pane.

5. Polish the FindingCard styling: better severity colors, smooth hover transitions, the selected ring should pulse subtly.

6. Add an architecture diagram to docs/ARCHITECTURE.md — Mermaid syntax showing the 5-stage pipeline, parallel/sequential flow, and which model handles each stage.

7. Add a one-page docs/PITCH.md with the elevator pitch, the problem statement (with stats), the solution architecture, and what makes it novel.

8. Add a "Reset" button next to "Process" that clears the cached AAR and re-runs the pipeline live. Useful for showing judges the live version after demoing the cached version.

9. README.md update: add a "Quick Demo" section with exact commands to clone, install, and run with the canned demo data.

## Acceptance criteria

1. With backend offline, the frontend in demo mode still loads case_01 and shows the AAR (from cache)
2. Clicking Process in demo mode shows the streaming progress UI but completes in <5 seconds with cached data
3. Killing the backend mid-stream shows a friendly error, not a crash
4. README quickstart commands work on a fresh clone
5. Architecture diagram renders correctly in GitHub markdown preview
```

---

## Recommended Phase Sequencing

| Phase | Owner | Hours | Can parallelize with |
|---|---|---|---|
| 0 | Anyone | 0.5 | — |
| 1 | Person 1 (Data) | 1.0 | — |
| 2 | Person 2 (Pipeline) | 2.0 | Phase 3 |
| 3 | Person 3 (Frontend) | 3.0 | Phase 2 |
| 4 | Person 2 | 1.0 | Person 1 staging footage; Person 3 polishing UI |
| 5 | Person 2 | 4-6 | Demo prep |
| 6 | All | 2 | — |

Phases 2 and 3 are the critical parallelization point. Once Phase 1 (the contracts) is locked, the pipeline owner and frontend owner work independently against the same fixture data.

---

## Reset Strategy

If a chat window gets confused mid-phase:
1. Save your current code state (commit if possible)
2. Start a fresh chat
3. Paste the relevant phase prompt
4. Mention what's already done: *"Phase 0, 1, 2 are complete. The repo currently has [X]. Run Phase 3 from where it stands."*
5. Point the new chat at specific files for context rather than re-explaining everything

The phases are designed so each one's prompt contains everything needed to execute it without needing to read the others.
