# Sentinel Development Skill

A required workflow for any code change in the Sentinel project. Follow this every time.

## Before writing any code

**Load context first. No exceptions.** Before touching any file, read:

1. `docs/PLAN.md` — the phased roadmap and which phase is current
2. `docs/PROGRESS.md` — what's been completed, what's in flight, what's blocked
3. `backend/app/schemas.py` — the locked data contracts
4. `frontend/src/types/schemas.ts` — the TypeScript mirror
5. The specific files you're about to modify

If `docs/PLAN.md` or `docs/PROGRESS.md` don't exist, create them before starting work. `PROGRESS.md` should track: completed phases, current phase + sub-task, known issues, decisions made.

**State what you understand before coding.** In your response, briefly summarize:
- What phase/task this change belongs to
- What files you'll touch
- What contracts (schemas, API endpoints) you must NOT break
- What you expect the change to do

If any of these are unclear, ask before writing code.

## While writing code

- **Match existing patterns.** If `pcr_parser.py` uses a tool-use schema with Pydantic conversion, the next extractor does too. Don't invent new patterns mid-project.
- **Respect the schema contract.** Never modify `schemas.py` or `schemas.ts` without explicit team agreement. If you think a schema needs to change, stop and flag it.
- **Type everything.** Pydantic models on the backend, TypeScript interfaces on the frontend. No `any`, no untyped dicts in function signatures.
- **One concern per file.** Pipeline stages live in their own files. API routers are split by resource. Don't pile features into existing files because it's faster.
- **No silent failures.** Every external call (LLM, file read, network) needs error handling that either retries, falls back gracefully, or surfaces a clear error to the user.
- **Centralize prompts.** All LLM prompts live in `backend/app/prompts.py`. Never inline a prompt in a pipeline file.
- **Imports at the top, no circular deps.** If you find yourself importing inside a function to break a cycle, the architecture is wrong — fix it.

## After writing code

**Write tests immediately. Same commit.** A change without tests is incomplete.

- **Backend changes:** add a test in `backend/tests/`. For pipeline stages, write an integration test that calls the real function. Skip the test if `ANTHROPIC_API_KEY` is missing using `pytest.mark.skipif`.
- **Frontend changes:** at minimum, add a TypeScript typecheck. For interactive components, add a Vitest + React Testing Library test that exercises the key interaction (e.g., clicking a finding seeks the video).
- **Schema changes:** update the schema test in `test_schemas.py` AND update `frontend/src/types/schemas.ts` in the same commit.

**Run the verification suite before declaring done:**

```bash
# Backend
cd backend
uv run ruff check app/
uv run pytest tests/ -v

# Frontend
cd frontend
npm run typecheck
npm run build
npm test  # if tests exist
```

**All checks must pass.** Don't ship red tests with a "will fix later" note. If a test is genuinely flaky (e.g., LLM non-determinism), make it tolerant (e.g., assert `len(events) >= 5` instead of exact count) rather than skipping it.

**Smoke test the full pipeline after backend changes:**

```bash
cd backend
uv run python scripts/run_pipeline.py case_01
```

The pipeline must complete end-to-end and produce a valid `AARDraft`.

**Smoke test the UI after frontend changes:**

1. Backend running on :8000
2. `npm run dev` on :5173
3. Verify: case loads, AAR renders, clicking a finding seeks video AND highlights PCR
4. The "wow moment" interaction must work — it's the demo's centerpiece

## After tests pass

**Update `docs/PROGRESS.md`.** Record:
- What was completed
- Any decisions made (e.g., "chose Gemini Flash for video; Claude vision was too slow on 5min clips")
- Any new technical debt or known issues

**Commit with a message that names the phase + task.** Example: `Phase 4: real PCR parser with Claude Haiku + integration test`

## When something breaks

1. **Read the error.** Actually read it. Don't pattern-match on the first line.
2. **Reproduce minimally.** If a test fails, run that one test in isolation. If the UI breaks, check the network tab and console.
3. **Check the contract.** Did a schema change break something? Is the API response shape what the frontend expects?
4. **Don't paper over.** If a fix requires `as any` or `# type: ignore` or a `try/except: pass`, you're hiding a real problem. Find it.
5. **If stuck >20 minutes, ask.** Hackathon time is finite. A teammate, the backend logs, or a fresh chat with this skill loaded will unblock you faster than grinding alone.

## Reset checklist (when starting a new chat)

If you're resetting context to continue work:

1. Read `docs/PLAN.md` and `docs/PROGRESS.md`
2. Read `schemas.py` and `schemas.ts`
3. Read the file(s) you're about to touch
4. Confirm in your response: "Resuming Phase X, task Y. Last completed: Z. Now working on: W."
5. Then proceed.

This skill applies to every code change. No "quick fixes" exempt from it — quick fixes are how hackathon projects break at the worst time.
