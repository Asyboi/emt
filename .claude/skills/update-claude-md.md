# Update CLAUDE.md

Read the current codebase state and update CLAUDE.md to reflect it. Do this every time the skill is invoked.

## Step 1 — Read everything in parallel

Read all of these files simultaneously:

- `CLAUDE.md` (current state to compare against)
- `backend/app/schemas.py` (source of truth for all data types)
- `backend/app/main.py` (app version, lifespan hooks, middleware)
- `backend/app/api/cases.py` (case management endpoints)
- `backend/app/api/pipeline.py` (pipeline/stream endpoints)
- `backend/app/pipeline/orchestrator.py` (stage order, return type)
- `backend/app/case_loader.py` (cache file names, migration logic)
- `frontend/src/App.tsx` (pane names, hooks used, top-level state)
- `frontend/src/types/schemas.ts` (TS type mirror — check it matches schemas.py)

## Step 2 — Audit these specific things

For each item, check whether CLAUDE.md currently says the right thing:

1. **Project description (first paragraph)** — Does it name the correct output type (e.g. `QICaseReview` vs `AARDraft`)?
2. **Backend version** — Does it match the `version=` string in `main.py`?
3. **Cache file name** — What filename does `case_loader.py` write to? Is that what CLAUDE.md says?
4. **Startup hooks** — Does `main.py` have a `lifespan` handler? Is it described in CLAUDE.md?
5. **API surface table** — Do the paths, methods, and response types in CLAUDE.md match the actual `@router.*` decorators in `cases.py` and `pipeline.py`?
6. **SSE stream description** — Does the final event payload name match what `pipeline.py` actually sends (e.g. `"review"` vs `"aar"`)?
7. **Frontend center pane** — Does CLAUDE.md name the right component (e.g. `ReviewPane` vs `AARPane`)?
8. **Top-level schema type** — Is `QICaseReview` (or whatever the current top-level type is) mentioned correctly? Is `AARDraft` still referenced anywhere it shouldn't be?
9. **Gitignore note** — Does the cached-file gitignore pattern match the actual cache filename?
10. **Phase list** — Are any new phases missing from the phase completion list?

## Step 3 — Edit CLAUDE.md

For every discrepancy found in Step 2, apply a targeted `Edit` to fix just that section. Do not rewrite the whole file. Do not change sections that are still accurate.

After edits, do a final check: search CLAUDE.md for the old type name (`AARDraft`, `aar.json`, `/aar`, etc.) and replace any remaining stale references.

## Step 4 — Report

Tell the user:
- Which sections were updated and what changed (one line each)
- Which sections were already accurate and needed no changes
- Any discrepancies between `schemas.py` and `schemas.ts` that you noticed (do NOT fix those automatically — flag them for the user)
