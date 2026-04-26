# Repo structure — every tracked file, with purpose

Two deployable units (`backend/` FastAPI, `frontend/` Vite/React) plus shared data (`cases/`, `protocols/`, `fixtures/`) and docs. Branding: backend self-identifies as "Sentinel"; frontend UI is branded "Calyx".

## Top level

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Project guide for Claude Code — phases, architecture, run commands, conventions. |
| `README.md` | Human-facing quickstart for demo + live mode and feature overview. |
| `.env.example` | Template for repo-root `.env`: API keys (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`), `FRONTEND_ORIGIN`, data dir paths. |
| `.gitignore` | Standard ignores plus per-case media (`cases/*/video.*`, `audio.*`, `review.json`). |
| `agent-merge.txt` | Working note on merging agent outputs (legacy planning artifact). |
| `pcr_autodrafter_plan.txt` | Plan doc for the PCR auto-drafter pre-pipeline stage (now implemented). |
| `old_frontend_contracts.md` | Snapshot of the pre-rebuild frontend contract — kept for reference; the live frontend in `frontend/src/types.ts` supersedes it. |

## `.claude/` — Claude Code workspace config

| Path | Purpose |
|---|---|
| `.claude/SKILL.md` | The session skill / development workflow Claude follows when editing this repo (read PLAN/PROGRESS, match patterns, run verification). |
| `.claude/skills/update-claude-md.md` | Instructions for the "update CLAUDE.md from session learnings" sub-skill. |

## `docs/` — Project documentation

| Path | Purpose |
|---|---|
| `docs/.gitkeep` | Keeps the dir tracked. |
| `docs/API.md` | Backend HTTP surface reference (routes, payloads, SSE events). |
| `docs/ARCHITECTURE.md` | System architecture (pipeline stages, data flow, deployment topology). |
| `docs/DEPLOYMENT.md` | How to deploy backend + frontend (Cloudflare Pages, hosted backend). |
| `docs/PITCH.md` | Hackathon pitch / narrative doc. |
| `docs/PLAN.md` | Master phased plan (Phase 0–6) and decisions per phase. |
| `docs/PROGRESS.md` | Running log of changes, decisions, and outstanding debt. |
| `docs/INTEGRATION_AUDIT.md` | (this audit) frontend↔backend seam audit and hookup checklist. |
| `docs/REPO_STRUCTURE.md` | (this file) per-file purpose map. |

## `backend/` — FastAPI pipeline orchestrator

| Path | Purpose |
|---|---|
| `backend/pyproject.toml` | Python project + dependency manifest (uv-managed); Ruff + pytest config; `asyncio_mode = "auto"`. |
| `backend/uv.lock` | uv-resolved dependency lockfile. |

### `backend/app/` — application code

| Path | Purpose |
|---|---|
| `backend/app/__init__.py` | Package marker. |
| `backend/app/main.py` | FastAPI app factory: CORS middleware, router mounts (`/api/cases`, `/api/cases/.../stream`, `/api/cases/.../pcr-draft`), `lifespan` runs legacy AAR cache migration, `GET /health`. |
| `backend/app/config.py` | `pydantic-settings` Settings class — loads `.env` (root then backend), exposes `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `OPENAI_API_KEY` (legacy), `CASES_DIR`, `PROTOCOLS_DIR`, `FIXTURES_DIR`, `FRONTEND_ORIGIN`. |
| `backend/app/schemas.py` | Single source of truth — all Pydantic v2 models: `Event`, `TimelineEntry`, `Finding`, `ProtocolCheck`, `ClinicalAssessmentItem`, `Recommendation`, `CADRecord`, `Case`, `QICaseReview`, `PCRDraft`, `PipelineStage`, `PipelineProgress` and their enums. |
| `backend/app/case_loader.py` | Filesystem helpers — `list_cases()`, `load_case(id)`, `load_pcr_content(id)`, `load_cached_review(id)`, `save_cached_review(id, review)`, `clear_cached_review(id)`, `migrate_legacy_aar_caches()` (renames old `aar.json` → `review.json`). |
| `backend/app/llm_clients.py` | Thin async retry-wrapped wrappers: `claude_haiku`, `claude_sonnet` (Anthropic), `gemini_flash_video` (Google Files API + Gemini 2.5 Flash), `elevenlabs_transcribe` (Scribe v1). Each returns plain dicts so pipeline stages stay readable. |
| `backend/app/prompts.py` | Centralized LLM prompts and tool-use schemas — every prompt lives here, never inlined in pipeline files. |
| `backend/app/pcr.md` | Stray PCR file — appears to be a working-copy artifact that ended up tracked alongside the package; not loaded by code. |

### `backend/app/api/` — HTTP routers

| Path | Purpose |
|---|---|
| `backend/app/api/__init__.py` | Package marker. |
| `backend/app/api/cases.py` | Case CRUD-ish routes: list cases, fetch case meta, raw PCR markdown, cached `QICaseReview`, delete cache, video file (`FileResponse`, supports HTTP Range). |
| `backend/app/api/pipeline.py` | Pipeline trigger + SSE stream: `POST /process` (fire-and-forget background task), `GET /stream?demo=` returns `EventSourceResponse` emitting `progress` / `complete` / `error` events. |
| `backend/app/api/pcr_draft.py` | PCR auto-drafter API (pre-pipeline): `POST /pcr-draft` kicks off background draft, `GET` polls status, `PATCH /pcr-draft/confirm` writes confirmed `pcr.md` for the QI pipeline to consume. |

### `backend/app/pipeline/` — orchestrator and stages

| Path | Purpose |
|---|---|
| `backend/app/pipeline/__init__.py` | Empty package marker. |
| `backend/app/pipeline/orchestrator.py` | Top-level `process_case()` — runs cad/pcr/video/audio in parallel via `asyncio.gather`, then reconciliation → protocol_check → findings → drafting; emits `PipelineProgress` per stage transition; returns `QICaseReview`. |
| `backend/app/pipeline/cad_parser.py` | Stage 0 — parses NYC EMS CAD JSON into a `CADRecord` (no LLM, pure Pydantic + datetime + zipcode geocoding). `safe_cad_parse()` returns `None` on failure. |
| `backend/app/pipeline/pcr_parser.py` | Stage 1a — Claude Haiku 4.5 extracts events from the PCR markdown via tool use → `list[Event]`. |
| `backend/app/pipeline/video_analyzer.py` | Stage 1b — Gemini 2.5 Flash with native video input (Files API) extracts visible clinical events; returns `[]` on missing file or >50 MB. |
| `backend/app/pipeline/audio_analyzer.py` | Stage 1c — ElevenLabs Scribe v1 transcribes dispatch audio with word-level timestamps, segments into utterance windows, then Haiku 4.5 extracts clinical events. |
| `backend/app/pipeline/reconciliation.py` | Stage 2 — 4-agent chain (Haiku cluster → Haiku score / Haiku canonicalize in parallel → Sonnet critic) produces `list[TimelineEntry]`. Synthesizes CAD events from `CADRecord` timestamps when present. |
| `backend/app/pipeline/protocol_check.py` | Stage 3 — protocol adherence checks (currently a fixture-derived stub; real Sonnet impl planned). |
| `backend/app/pipeline/findings.py` | Stage 4 — Sonnet 4.6 surfaces findings across timing/missing-doc/phantom/protocol-deviation/care-gap categories with evidence event ids. |
| `backend/app/pipeline/drafting.py` | Stage 5 — composes the final `QICaseReview` via 5 focused Sonnet sub-calls (header+summary, clinical assessment, doc quality, recommendations, determination) with per-call fixture fallbacks. |
| `backend/app/pipeline/pcr_drafter.py` | Pre-pipeline auto-drafter — single Sonnet call composes a plain-text PCR from extracted video+audio events + `CADRecord`, output drops into `cases/<id>/pcr.md`. |
| `backend/app/pipeline/protocols.py` | Call-type → protocol-family mapping (e.g. `UNC`/`CARD` → `cardiac_arrest`, `CVA` → `stroke`); used by orchestrator and CAD parser. |
| `backend/app/pipeline/_fixture.py` | Loads canonical sample QI review (lru_cached) — used by stub stages and as drafting fallback when LLM sub-calls fail. |

### `backend/scripts/` — CLI utilities

| Path | Purpose |
|---|---|
| `backend/scripts/.gitkeep` | Keeps dir tracked. |
| `backend/scripts/run_pipeline.py` | CLI smoke-test runner — `uv run python scripts/run_pipeline.py case_01 [--summary]` runs the full pipeline against a case directory. |
| `backend/scripts/pcr.md` | Stray sample PCR (working-copy artifact). |

### `backend/tests/` — pytest suite

| Path | Purpose |
|---|---|
| `backend/tests/__init__.py` | Package marker. |
| `backend/tests/test_schemas.py` | Round-trip + validation tests for Pydantic schemas. |
| `backend/tests/test_pcr_parser.py` | PCR parser stage tests (gated on `ANTHROPIC_API_KEY`). |
| `backend/tests/test_video_analyzer.py` | Video analyzer stage tests (gated on `GOOGLE_API_KEY` + media). |
| `backend/tests/test_audio_analyzer.py` | Audio analyzer stage tests (gated on `ELEVENLABS_API_KEY` + media). |
| `backend/tests/test_reconciliation.py` | Reconciliation chain tests with fixture inputs. |
| `backend/tests/test_findings.py` | Findings stage tests. |
| `backend/tests/test_drafting.py` | Drafting stage tests — exercises the 5 sub-calls + fallbacks. |
| `backend/tests/test_pcr_drafter.py` | Pre-pipeline PCR auto-drafter tests. |
| `backend/tests/test_case_cache.py` | `case_loader` cache and migration tests. |
| `backend/tests/pcr.md` | Test fixture PCR markdown. |

## `cases/` — per-case input data and cached outputs

| Path | Purpose |
|---|---|
| `cases/case_01/.gitkeep` | Keeps dir tracked. |
| `cases/case_01/pcr.md` | Confirmed PCR markdown (input to Stage 1a). |
| `cases/case_01/pcr.original.md` | Original PCR before EMT confirmation edits. |
| `cases/case_01/pcr_draft.json` | Auto-drafter output (`PCRDraft` schema) — pending review / confirmed state. |
| `cases/case_01/cad.json` | NYC EMS CAD export consumed by `cad_parser.py`. |
| `cases/case_02/.gitkeep`, `cases/case_02/pcr.md` | Second sample case (PCR only — no CAD/video/audio committed). |
| `cases/case_03/.gitkeep`, `cases/case_03/pcr.md` | Third sample case. |
| (gitignored) `cases/*/video.{mp4,mov,webm}`, `audio.{mp3,wav}`, `review.json` | Per-case media + cached `QICaseReview` outputs — not tracked. |

## `protocols/` — clinical protocol definitions

| Path | Purpose |
|---|---|
| `protocols/.gitkeep` | Empty placeholder dir; protocol content currently embedded in code (`pipeline/protocols.py` mappings + prompts). |

## `fixtures/` — shared sample data

| Path | Purpose |
|---|---|
| `fixtures/.gitkeep` | Keeps dir tracked. |
| `fixtures/sample_qi_review.json` | Canonical `QICaseReview` JSON — backend stubs and drafting fallback consume it; also the source of truth for the frontend demo replay. |

## `frontend/` — Vite + React + TypeScript SPA (Calyx)

| Path | Purpose |
|---|---|
| `frontend/package.json` | npm manifest — Vite, React 18, Tailwind, react-router, lucide-react, Radix UI primitives, sonner; scripts: `dev`, `build` (tsc + vite), `typecheck`, `preview`. |
| `frontend/package-lock.json` | npm lockfile. |
| `frontend/pnpm-workspace.yaml` | pnpm workspace marker (project actually uses npm; this is a leftover from scaffold). |
| `frontend/postcss.config.mjs` | PostCSS config wiring Tailwind. |
| `frontend/vite.config.ts` | Vite config — React plugin, Tailwind plugin, custom `figmaAssetResolver` for `figma:asset/...` imports, `@` → `src` alias. **Note: no `server.proxy` is defined** (see `INTEGRATION_AUDIT.md`). |
| `frontend/index.html` | HTML shell for the SPA. |
| `frontend/default_shadcn_theme.css` | Reference shadcn theme tokens (snapshot, not actively imported). |
| `frontend/README.md` | Frontend-specific notes. |
| `frontend/ATTRIBUTIONS.md` | Third-party attribution / license credits. |
| `frontend/guidelines/Guidelines.md` | Design guidelines exported from Figma scaffold. |
| `frontend/public/_headers` | Cloudflare Pages security/cache headers. |
| `frontend/public/_redirects` | Cloudflare Pages SPA fallback redirects. |

### `frontend/src/` — application source

| Path | Purpose |
|---|---|
| `frontend/src/main.tsx` | Entry point — mounts `<App>`, special-cases reload-from-demo to drop the user back at `/`. |
| `frontend/src/types.ts` | Frontend-shaped TypeScript interfaces (`IncidentReport`, `IncidentSummary`, `ReportSection`, `TimelineEvent`, `AgentTile`, `PipelineFinding`, etc.) — the shape the UI consumes. |

### `frontend/src/app/` — router and pages

| Path | Purpose |
|---|---|
| `frontend/src/app/App.tsx` | Top-level component — wraps `<RouterProvider>` around the `router`. |
| `frontend/src/app/routes.tsx` | `createBrowserRouter` config — `/` → `Dashboard`; nested `QIReviewLayout` mounts `/qi-review` (`NewReport`), `/processing`, `/review/:incidentId`, `/finalize/:incidentId`, `/archive`. |

### `frontend/src/app/components/`

| Path | Purpose |
|---|---|
| `frontend/src/app/components/layout.tsx` | Root layout — pure `<Outlet />` for the top-level route. |
| `frontend/src/app/components/qi-review-layout.tsx` | Wraps `<Outlet />` plus `<DemoNav>` for the QI review section pages. |
| `frontend/src/app/components/demo-nav.tsx` | Floating demo nav — sticky `?demo=1` mode plus shortcut links between INTAKE / PROCESSING / REVIEW / FINALIZE / ARCHIVE. |
| `frontend/src/app/components/figma/ImageWithFallback.tsx` | Figma-export image component with broken-source fallback. |

### `frontend/src/app/components/ui/` — shadcn/Radix primitive library

This is the standard shadcn-ui drop, kept in-tree per shadcn's pattern. Each file is a typed wrapper around a Radix primitive (or a custom primitive).

| Path | Purpose |
|---|---|
| `accordion.tsx` | Collapsible accordion sections (Radix Accordion). |
| `alert-dialog.tsx` | Modal alert dialog (Radix AlertDialog). |
| `alert.tsx` | Inline alert / status banner. |
| `aspect-ratio.tsx` | Aspect-ratio container (Radix AspectRatio). |
| `avatar.tsx` | User avatar with fallback (Radix Avatar). |
| `badge.tsx` | Tag-style badge component. |
| `breadcrumb.tsx` | Breadcrumb trail. |
| `button.tsx` | Primary button variants (cva). |
| `calendar.tsx` | Date-picker calendar (react-day-picker). |
| `card.tsx` | Card surface + header/content/footer slots. |
| `carousel.tsx` | Embla-based carousel. |
| `chart.tsx` | Recharts wrappers + theming. |
| `checkbox.tsx` | Radix Checkbox. |
| `collapsible.tsx` | Radix Collapsible (single-section variant). |
| `command.tsx` | Cmdk command palette. |
| `context-menu.tsx` | Radix ContextMenu. |
| `dialog.tsx` | Radix Dialog (modal). |
| `drawer.tsx` | Vaul-based drawer / bottom sheet. |
| `dropdown-menu.tsx` | Radix DropdownMenu. |
| `form.tsx` | react-hook-form integration helpers. |
| `hover-card.tsx` | Radix HoverCard. |
| `input-otp.tsx` | OTP input field (input-otp library). |
| `input.tsx` | Standard text input. |
| `label.tsx` | Form label (Radix Label). |
| `menubar.tsx` | Radix Menubar. |
| `navigation-menu.tsx` | Radix NavigationMenu. |
| `pagination.tsx` | Pagination controls. |
| `popover.tsx` | Radix Popover. |
| `progress.tsx` | Radix Progress bar. |
| `radio-group.tsx` | Radix RadioGroup. |
| `resizable.tsx` | react-resizable-panels wrapper. |
| `scroll-area.tsx` | Radix ScrollArea. |
| `select.tsx` | Radix Select. |
| `separator.tsx` | Radix Separator. |
| `sheet.tsx` | Radix Dialog styled as a side sheet. |
| `sidebar.tsx` | Sidebar layout primitive (collapsible nav). |
| `skeleton.tsx` | Loading skeleton placeholder. |
| `slider.tsx` | Radix Slider. |
| `sonner.tsx` | Sonner toast adapter. |
| `switch.tsx` | Radix Switch. |
| `table.tsx` | Styled table primitives. |
| `tabs.tsx` | Radix Tabs. |
| `textarea.tsx` | Textarea input. |
| `toggle-group.tsx` | Radix ToggleGroup. |
| `toggle.tsx` | Radix Toggle. |
| `tooltip.tsx` | Radix Tooltip. |
| `use-mobile.ts` | `useIsMobile()` viewport hook used by `sidebar`. |
| `utils.ts` | `cn()` helper (clsx + tailwind-merge). |

### `frontend/src/app/pages/`

| Path | Purpose |
|---|---|
| `dashboard.tsx` | Landing page (`/`) — entry CTAs to `New Report`, `Demo` (which navigates to `/processing?demo=1`), and saved reports. |
| `new-report.tsx` | `/qi-review` — file-upload form for ePCR / CAD / video; on submit navigates to `/processing` (does not currently send files to the backend). |
| `processing.tsx` | `/processing` — pipeline visualization (parallel-extraction column → reconciliation → protocol check / report drafter); currently driven entirely by static mock data, no SSE. |
| `review.tsx` | `/review/:incidentId` — three-pane reviewer view (timeline + map/video/pcr/cad tabs + section-by-section AAR). |
| `finalize.tsx` | `/finalize/:incidentId` — final approval flow with diff view, per-section feedback, quick-tag annotations. |
| `archive.tsx` | `/archive` — list of past incidents with search; routes drafts → `/review/:id`, finalized → `/finalize/:id`. |

### `frontend/src/data/` — data-source abstraction

| Path | Purpose |
|---|---|
| `frontend/src/data/source.ts` | `DataSource` interface (`listIncidents`, `getIncident`), local/remote mode resolution (URL param → `VITE_DATA_SOURCE` env → default `local`), `localSource` (mock-backed), `remoteSource` (currently throw-stubs). |
| `frontend/src/data/hooks.ts` | React hooks `useIncidentList()` and `useIncident(id)` — call `getDataSource()` and return `{data, loading, error}` async state. |

### `frontend/src/mock/`

| Path | Purpose |
|---|---|
| `frontend/src/mock/mock_data.ts` | Hand-built `IncidentReport` for the primary demo case (`INC-2026-04-0231`) plus a 10-item archive list; `buildMockReport(id)` re-keys the primary fixture for any other id. |

### `frontend/src/imports/pasted_text/` — design references

| Path | Purpose |
|---|---|
| `ems-qi-report-tool.md` | Pasted design / spec reference for the overall QI tool. |
| `incident-processing-page.md` | Pasted design reference specifically for the processing page animation. |
| `salvage-processing-incident.md` | Salvage notes for re-implementing the processing-incident view. |

### `frontend/src/styles/`

| Path | Purpose |
|---|---|
| `frontend/src/styles/index.css` | Top-level stylesheet imported by `main.tsx`; chains the others. |
| `frontend/src/styles/tailwind.css` | Tailwind base + components + utilities directives. |
| `frontend/src/styles/theme.css` | Calyx color/typography tokens (CSS variables consumed throughout the UI). |
| `frontend/src/styles/fonts.css` | Custom font-face declarations (mono + sans for the Calyx aesthetic). |
