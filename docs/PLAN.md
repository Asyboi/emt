# Sentinel — Phased Plan

Source of truth: `sentinel_scaffolding_prompts.md` at the repo root. This file is a
condensed index for fast context-loading; consult the scaffolding prompts for the
full per-phase specs.

## Phase index

| Phase | Goal | Owner | Status |
|---|---|---|---|
| 0 | Repo skeleton, tooling, configs | Anyone | ✅ done |
| 1 | Shared contracts: Pydantic schemas + TS types + sample fixture | Data | ✅ done |
| 2 | Backend FastAPI app + pipeline stubs + SSE | Pipeline | ✅ done |
| 3 | Frontend 3-pane UI + click-to-seek interaction | Frontend | ✅ done |
| 4 | Real PCR parser via Claude Haiku 4.5 | Pipeline | ✅ done |
| 5 | Remaining real stages (reconcile → findings → drafting → audio → video) | Pipeline | ✅ done |
| 6 | Polish: demo mode, caching, error boundaries, docs | All | ✅ done |

## Architecture (locked at Phase 1)

- **`backend/`** FastAPI + Python 3.11+ async. Calls Anthropic, Google, OpenAI SDKs.
- **`frontend/`** Vite + React 18 + TS + Tailwind. Cloudflare Pages deployable.
- Single contract: `backend/app/schemas.py` ↔ `frontend/src/types/schemas.ts`.
  Same field names (snake_case), same enum values, same shape.
- Shared sample data: `fixtures/sample_aar.json` — backend stubs return it,
  frontend dev renders against it.

## Phase boundaries (do NOT cross)

- **Phase 1 schemas are frozen.** Do not modify `schemas.py` / `schemas.ts` after
  this phase without explicit team agreement and a paired update on both sides.
- **Phase 2 must not touch frontend.** Phase 3 must not touch backend pipeline.
  They run in parallel against the locked contract.
- **Phase 4 only replaces the PCR parser stub.** Other stages stay stubbed
  until Phase 5.
- **Phase 5 implements one stage per chat session** to avoid cross-contamination
  of LLM tool schemas between stages. (Bent for the final batch — findings,
  drafting, audio, video landed together once the prompts module had become
  the natural boundary between stages.)
- **Audio uses ElevenLabs Scribe v1** (not OpenAI Whisper as originally
  specced). Same two-step pattern: transcription → Haiku event extraction.

## Critical demo path (the wow moment)

Click a Finding card →
1. AAR pane highlights the card with a ring
2. Video pane seeks to `evidence_timestamp_seconds`
3. PCR pane scrolls to and highlights `pcr_excerpt`

This must work end-to-end with stub data after Phase 3, with real data after
Phase 5, and bulletproof in demo mode after Phase 6.

## Sequencing notes

- After Phase 1, Phases 2 and 3 are parallelizable (the critical fan-out).
- Phase 5 stage order: reconciliation → findings → drafting → audio → video.
  Reasoning stages first because they drive demo intelligence; video last
  because it's the hardest with the lowest ROI per hour.
- If demo data is missing for a stage, return a graceful fallback rather than
  crashing — judges should never see a stack trace.
