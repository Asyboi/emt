# PCR Auto-Draft Flow Audit

Source files surveyed:

- `backend/app/api/pcr_draft.py`
- `backend/app/pipeline/pcr_drafter.py`
- `backend/app/schemas.py` (`PCRDraft`, `PCRDraftStatus`)
- `backend/app/prompts.py` (`PCR_DRAFT_SYSTEM`, `PCR_DRAFT_USER_TEMPLATE`)
- `backend/app/case_loader.py` (path resolution only)
- `frontend/src/types.ts`, `frontend/src/mock/mock_data.ts`, `frontend/src/app/pages/{review,new-report,processing,finalize,dashboard}.tsx`
- `frontend/package.json`

---

## 1. Backend PCR endpoints — full trace

Router prefix: `/cases/{case_id}` (mounted under `/api`). Two on-disk filenames in `cases/{case_id}/`:

- `pcr_draft.json` — serialized `PCRDraft` (the in-flight/completed draft state)
- `pcr.md` — confirmed PCR text (the file Stage 1a's `pcr_parser` reads)

### `POST /api/cases/{case_id}/pcr-draft` → `PCRDraft`

`backend/app/api/pcr_draft.py:47`

Step by step:

1. `load_case(case_id)` — 404 if the case directory is missing.
2. Construct a `PCRDraft` with `status=PENDING_REVIEW`, `draft_markdown="*Generating PCR draft — please wait...*"`, `generated_at=now`.
3. Persist that placeholder via `_save_draft()` → writes `cases/{id}/pcr_draft.json`.
4. Schedule background task `_run`, then return the placeholder synchronously.

Background `_run` (lines 67–97):

- `asyncio.gather` of three calls:
  - `safe_cad_parse(case.cad_path)` → `Optional[CADRecord]` (None if `cases/{id}/cad.json` doesn't exist; `case_loader.py:129`)
  - `video_analyzer.analyze_video(case)` → `list[Event]` (empty list if `GOOGLE_API_KEY` missing or `video.mp4` absent)
  - `audio_analyzer.analyze_audio(case)` → `list[Event]` (empty list if `ELEVENLABS_API_KEY` missing or `audio.mp3` absent)
- `draft_pcr(...)` → `PCRDraft` (one Sonnet 4.6 call; falls back to deterministic template on failure — see §2)
- `_save_draft(draft)` overwrites `cases/{id}/pcr_draft.json` with the completed draft.
- On any exception, writes a `PCRDraft` with `status=PENDING_REVIEW`, `draft_markdown="*Draft generation failed. Please write PCR manually.*"`, and `error=str(exc)` so the GET endpoint can surface the error.

Files read (background): `cases/{id}/cad.json`, `cases/{id}/video.mp4`, `cases/{id}/audio.mp3`.
Files written: `cases/{id}/pcr_draft.json` (placeholder synchronously, completed draft on completion or error JSON on failure).

Response body shapes:

- **Pending (initial POST or while running):**
  ```
  { case_id, generated_at, status: "pending_review", video_event_count: 0,
    audio_event_count: 0, total_event_count: 0,
    draft_markdown: "*Generating PCR draft — please wait...*",
    unconfirmed_count: 0, confirmed_by: null, confirmed_at: null,
    emt_edits_made: false, error: null }
  ```
- **Complete (after background finishes):** same shape with populated counts, full PCR text in `draft_markdown`, `unconfirmed_count` = `draft_markdown.count("[UNCONFIRMED]")`. `status` is still `pending_review` until the user PATCHes confirm.
- **Error:** `status=pending_review`, `draft_markdown="*Draft generation failed. Please write PCR manually.*"`, `error` populated, all counts 0.

**Calling POST twice:** the second call **overwrites** `pcr_draft.json` with a fresh pending placeholder and schedules another background task. There is no idempotency guard, no debounce, and no check for an in-flight task. Two parallel runs may race on the JSON file and on the LLM key budget. A POST after a confirmed draft also overwrites the confirmed `pcr_draft.json` (but not `pcr.md`).

### `GET /api/cases/{case_id}/pcr-draft` → `PCRDraft`

`backend/app/api/pcr_draft.py:103` — pure read of `pcr_draft.json`. 404 with detail `"No PCR draft found — POST /pcr-draft first"` if absent. Used to poll for completion.

### `PATCH /api/cases/{case_id}/pcr-draft/confirm` → `PCRDraft`

`backend/app/api/pcr_draft.py:114`

Body: `{ edited_markdown: str, confirmed_by: str = "emt" }`.

Steps:

1. `_load_draft` — 404 if `pcr_draft.json` missing.
2. If the existing draft has an `error` AND `edited_markdown.strip()` is empty → 400 `"Draft errored and no edited content provided — regenerate or write manually"`.
3. Compute `emt_edits_made = body.edited_markdown.strip() != draft.draft_markdown.strip()`.
4. Write `body.edited_markdown` (raw, unstripped) to `cases/{id}/pcr.md` (UTF-8). **This is the file `pcr_parser` Stage 1a will read when `/process` runs.**
5. `model_copy` the draft with `status=CONFIRMED`, replaced `draft_markdown`, `confirmed_by`, `confirmed_at=now`, `emt_edits_made`, and recomputed `unconfirmed_count = body.edited_markdown.count("[UNCONFIRMED]")`.
6. Save back to `pcr_draft.json` and return.

**Validations PATCH does NOT enforce** (notable gaps):

- Empty `edited_markdown` is allowed when there is no `error` flag — you can confirm an empty PCR. Even when an error exists, only `.strip()` is checked, not "looks like a PCR".
- Confirming a still-pending placeholder is allowed (POST returned, background not yet finished, user PATCHes the placeholder text and it gets written to `pcr.md`).
- No "already confirmed" check — re-PATCHing overwrites `pcr.md` and bumps `confirmed_at` to a new timestamp. `confirmed_by` is replaced (defaults to `"emt"` if not supplied).
- No schema-shape validation on the PCR text (no requirement that section headers exist), so Stage 1a may parse garbage downstream.

**PATCH before background task finishes:** succeeds. The placeholder string `*Generating PCR draft — please wait...*` (or whatever `edited_markdown` the client sends) is written to `pcr.md`. When the background task eventually completes, it overwrites `pcr_draft.json` with a fresh `pending_review` draft, **clobbering the confirmation status in the JSON** (but `pcr.md` is preserved). This is a real footgun.

### Auto-trigger of QI pipeline

None. The confirm handler does not call `/process`. The docstring (lines 119–122) explicitly says the QI pipeline must be started by a separate `POST /api/cases/{id}/process` call.

---

## 2. PCR drafter pipeline (`backend/app/pipeline/pcr_drafter.py`)

### `draft_pcr` inputs

- `case_id: str`
- `video_events: list[Event]` — produced by `video_analyzer.analyze_video(case)` (Gemini 2.5 Flash; empty list if no key/file)
- `audio_events: list[Event]` — produced by `audio_analyzer.analyze_audio(case)` (ElevenLabs Scribe + Claude; empty list if no key/file)
- `cad_record: Optional[CADRecord]` — produced by `safe_cad_parse(case.cad_path)`; `None` if `cad.json` missing

All three come from the parallel `asyncio.gather` in the POST handler. No raw media read here — only structured `Event` objects.

### LLM call

- One call to `claude_sonnet(messages=..., system=PCR_DRAFT_SYSTEM, max_tokens=3000)`.
- Plain text completion — **no tool use**, output is parsed as concatenated `text` blocks (line 406–408).
- Model: Claude Sonnet 4.6 (per `llm_clients.claude_sonnet`).
- Prompts: `PCR_DRAFT_SYSTEM` and `PCR_DRAFT_USER_TEMPLATE` from `app/prompts.py`.

### Output PCR shape

Plain text (not markdown — system prompt explicitly forbids `#` headers and bullet asterisks). Fixed sectioned format separated by `============================================================` lines. See §5 for the section list.

### `[UNCONFIRMED]` markers

- Sprinkled in at **template construction time** (lines 350–397): every CAD field that is None, every clinical field for which there is no evidence is filled with the literal string `[UNCONFIRMED]`.
- Sonnet is instructed (system prompt, lines 343–353) to write `[UNCONFIRMED]` for any clinical detail not directly evidenced by video or audio events, and to append `[UNCONFIRMED]` inline to any intervention that appears in only one source (video XOR audio). Interventions confirmed by BOTH sources get no flag.
- Helpers `_fmt_dt` (line 40) and `_opt_int` (line 46) return `[UNCONFIRMED]` when their input is `None`.
- Markers semantically tag any field/value the EMT must fill in or verify before the PCR is clinically usable.

### Fallback (`_fallback_pcr`, lines 93–329)

Fires when the Sonnet call raises or returns empty text. Produces the same plain-text section structure but:

- Populates only CAD-derived fields (incident ID, datetimes, severity, borough/zip, disposition code).
- Every clinical section (`HISTORY OF PRESENT ILLNESS`, `INITIAL ASSESSMENT`, `VITAL SIGNS`, `MEDICATIONS ADMINISTERED`, `PROCEDURES`, etc.) is `[UNCONFIRMED]`.
- `TREATMENTS / INTERVENTIONS` is built by sorting all video+audio events by timestamp and appending `[UNCONFIRMED]` to any whose `event_type` doesn't match across both sources within a 30-second window. Events present in **both** sources get no flag.
- `NARRATIVE` is `[UNCONFIRMED] — LLM drafting unavailable. All narrative content requires manual entry.`

### `unconfirmed_count`

`_count_unconfirmed(text)` is a literal `text.count("[UNCONFIRMED]")` (line 89). Computed twice in the lifecycle: once when `draft_pcr` builds the draft, and again on PATCH confirm against `body.edited_markdown` so the post-confirm count reflects what the EMT actually accepted.

### `PCRDraft` shape at completion (returned by `draft_pcr`)

```
PCRDraft(
  case_id=case_id,
  generated_at=now(UTC),
  status=PENDING_REVIEW,
  video_event_count=len(video_events),
  audio_event_count=len(audio_events),
  total_event_count=video+audio counts,
  draft_markdown=<full PCR plain text from Sonnet, or fallback>,
  unconfirmed_count=draft_text.count("[UNCONFIRMED]"),
  confirmed_by=None,
  confirmed_at=None,
  emt_edits_made=False,
  error=None,
)
```

---

## 3. PCR draft lifecycle

End-to-end intended flow:

1. **Trigger:** EMT POSTs `/api/cases/{id}/pcr-draft`. Backend writes a `pending_review` placeholder (`pcr_draft.json` containing `*Generating PCR draft — please wait...*`) and returns it immediately. Background task scheduled.
2. **Background:** Reads `cases/{id}/cad.json`, `video.mp4`, `audio.mp3`. Runs CAD parse + Gemini video analysis + ElevenLabs/Claude audio analysis in parallel. Then one Sonnet call with the events. Wall-clock time depends on video duration + Gemini latency — likely 30 s–2 min for small clips, longer for full incidents. On failure: deterministic fallback template still saved.
3. **Polling:** EMT GETs `/api/cases/{id}/pcr-draft` every few seconds. Same shape; presence of a real PCR text (vs. the placeholder string) and non-zero `total_event_count` signals completion. There is **no separate `status="generating"` value** — both placeholder and final share `pending_review`. Clients must inspect `draft_markdown` content (or compare `generated_at`) to detect completion.
4. **Display + edit:** EMT renders `draft_markdown` (plain text in fixed PCR format with `[UNCONFIRMED]` tokens). They can edit any field, including replacing `[UNCONFIRMED]` with real values.
5. **Confirm:** EMT PATCHes `/api/cases/{id}/pcr-draft/confirm` with `{ edited_markdown, confirmed_by }`. Backend writes `cases/{id}/pcr.md` (the QI pipeline's input file) and updates `pcr_draft.json` with `status=CONFIRMED`, `confirmed_at`, recomputed `unconfirmed_count`, and `emt_edits_made` flag.
6. **QI pipeline:** **Separate manual step.** EMT (or UI) must POST `/api/cases/{id}/process`. Confirm does **not** auto-trigger it. Stage 1a (`pcr_parser`) reads the freshly-written `pcr.md`.

---

## 4. PCRDraft data model (`backend/app/schemas.py:346`)

```python
class PCRDraftStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"   # defined but never written by any handler
```

| Field | Type | Default | Populated when |
|---|---|---|---|
| `case_id` | `str` | — (required) | Creation (POST handler & `draft_pcr`) |
| `generated_at` | `datetime` | — (required) | Set to `now(UTC)` at every save (POST placeholder, drafter completion, error fallback). **Not** preserved across confirm — model_copy keeps original `generated_at`. |
| `status` | `PCRDraftStatus` | `PENDING_REVIEW` | `PENDING_REVIEW` on POST and on background completion; `CONFIRMED` on PATCH; `REJECTED` is defined but unused. |
| `video_event_count` | `int` | `0` | Set by `draft_pcr`; remains `0` for the initial placeholder and for the failure-fallback PCRDraft written by the POST handler's exception branch. |
| `audio_event_count` | `int` | `0` | Same as above. |
| `total_event_count` | `int` | `0` | Same as above. |
| `draft_markdown` | `str` | — (required) | Placeholder text on POST, full PCR text on completion/fallback, edited text on confirm. |
| `unconfirmed_count` | `int` | `0` | `0` on placeholder; computed by `text.count("[UNCONFIRMED]")` on completion and again on confirm against the edited text. |
| `confirmed_by` | `Optional[str]` | `None` | Set on PATCH confirm (defaults to `"emt"` if body omits it). |
| `confirmed_at` | `Optional[datetime]` | `None` | Set on PATCH confirm to `now(UTC)`. |
| `emt_edits_made` | `bool` | `False` | Set on PATCH confirm; `True` iff `edited_markdown.strip() != draft_markdown.strip()`. |
| `error` | `Optional[str]` | `None` | Set on POST handler's exception branch (background failure); cleared/preserved as-is by confirm. |

Note: there is no `version`, `attempt`, or `task_id` field — the JSON file is the single source of truth and a re-POST silently replaces it.

---

## 5. PCR template and content shape (`backend/app/prompts.py:338`)

### System prompt rules (`PCR_DRAFT_SYSTEM`)

- Write only what is directly evidenced.
- CAD timestamps are authoritative for unit timing fields.
- Any clinical detail not evidenced → `[UNCONFIRMED]`.
- Past tense, third person, clinical style.
- Intervention timestamps precise to the second when supported.
- Do **not** invent vitals, demographics, med lot numbers, crew identifiers.
- Interventions in only one source (video XOR audio) → append `[UNCONFIRMED]` inline.
- Interventions in **both** sources → no flag.
- Section headers, separator lines (`====...===`), labels — preserve **exactly**.
- Output is plain text — **no markdown**, no `#`, no `*` bullets.

### Section headers (`PCR_DRAFT_USER_TEMPLATE`, in order)

Top-of-document fields (no banner): `Report Type`, `CAD Incident ID`, `PCR Number`, `Date of Service`. Then 18 banner-delimited sections:

1. `AGENCY / UNIT INFORMATION` — EMS Agency, Unit ID, Crew (Paramedic, EMT), Incident Borough, Dispatch Area, ZIP Code, Police Precinct.
2. `DISPATCH INFORMATION` — Initial Call Type, Initial Severity Level, Final Call Type, Final Severity Level, Dispatch Complaint, Call Notes.
3. `TIMES` — Incident Date/Time, First Assignment, Unit Activated, Unit Arrived On Scene, Departed Scene To Hospital, Arrived At Hospital, Incident Closed, Dispatch Response Time, Incident Response Time, Travel Time To Scene.
4. `PATIENT INFORMATION` — Patient Name, Age, Sex, DOB, Address, Patient ID.
5. `CHIEF COMPLAINT` — free text.
6. `HISTORY OF PRESENT ILLNESS` — free text.
7. `PAST MEDICAL HISTORY` — hardcoded `[UNCONFIRMED]` in the template.
8. `MEDICATIONS` — hardcoded `[UNCONFIRMED]`.
9. `ALLERGIES` — hardcoded `[UNCONFIRMED]`.
10. `INITIAL ASSESSMENT` — free text.
11. `VITAL SIGNS` — free text.
12. `TREATMENTS / INTERVENTIONS` — timestamped intervention lines (this is where per-line `[UNCONFIRMED]` markers appear).
13. `MEDICATIONS ADMINISTERED` — free text.
14. `PROCEDURES` — free text.
15. `TRANSPORT INFORMATION` — Transported, Destination, Destination Type, Transport Priority, Patient Position, Condition During Transport, Condition At Transfer, Reason For Destination.
16. `TRANSFER OF CARE` — boilerplate plus `Patient transferred with: [UNCONFIRMED]`.
17. `NARRATIVE` — free text.
18. `DISPOSITION` — Incident Disposition Code, Patient Disposition, Final Patient Condition, ROSC Achieved, Transported To Hospital, Crew Cleared.
19. `SIGNATURES` — Primary Provider, Partner, Receiving Facility Signature, Patient Signature, Report Completed.

### Where `[UNCONFIRMED]` shows up

- Hardcoded in template: `EMS Agency`, `Unit ID`, both `Crew` rows, `Patient Name/Age/Sex/DOB`, `Patient ID` line is `Not available at time of care`, `PAST MEDICAL HISTORY`, `MEDICATIONS`, `ALLERGIES`, `Destination`, `Condition During Transport`, `Condition At Transfer`, `Reason For Destination`, `Patient transferred with`, `Patient Disposition`, `Final Patient Condition`, `ROSC Achieved`, all four `SIGNATURES` slots.
- Conditionally injected by the drafter (Python-side substitution) when CAD record is missing or the relevant CAD field is `None`: incident_id, dates, borough, zip, precinct, all timing values, dispatch/initial/final call type+severity, transported flag, disposition_code.
- LLM-injected: anywhere it cannot find evidence in the video/audio event lists (per system prompt), and inline-appended to single-source interventions.

### Formatting rules

- Plain text, no markdown — must round-trip cleanly to a fixed-width text editor.
- Fixed `============================================================` separators (60 `=` chars).
- Aligned label/value layout in `TIMES` section (column-aligned by spaces in template).
- `pcr_parser` Stage 1a relies on this exact shape, so the drafter (and any UI editor) must preserve it.

---

## 6. Existing frontend PCR surface

**Bottom line: the frontend is currently 100% mock data. It does not call any backend endpoint at all** (no `fetch`, `axios`, or `EventSource` reference exists in `frontend/src/` outside font CSS imports). Everything below is static UI awaiting wiring.

### PCR tab in the review page

`frontend/src/app/pages/review.tsx:272–292`. Center column has a tab bar (`MAP | VIDEO | PCR SOURCE | CAD LOG`). The `pcr` tab renders a tiny mock metadata card titled `ePCR DOCUMENT / PATIENT CARE REPORT` with four labelled rows: `INCIDENT #`, `UNIT`, `CREW`, `CHIEF COMPLAINT`. Data source: `incident.pcr` from `mock_data.ts`. **It does not render the full PCR text** — just four metadata fields.

### `PcrMetadata` type

`frontend/src/types.ts:62`:

```ts
export interface PcrMetadata {
  incidentNumber: string;
  unit: string;
  crew: string;
  chiefComplaint: string;
}
```

Four fields, all `string`. No `draft_markdown`, no status, no `[UNCONFIRMED]` modeling, no editing fields.

### Mock data

`frontend/src/mock/mock_data.ts:126`:

```ts
const pcr: PcrMetadata = {
  incidentNumber: '2026-041201',
  unit: 'M-7',
  crew: 'RODRIGUEZ, CHEN',
  chiefComplaint: 'CARDIAC ARREST',
};
```

No PCR document body is mocked — only the metadata.

### `GET /api/cases/{id}/pcr` usage

Not used anywhere in the frontend (`grep` for `/pcr` returns zero matches). Same for `/pcr-draft`, `pcr_draft`, and `PCRDraft`.

### Markdown rendering

No markdown library installed (`react-markdown`, `marked`, `remark`, `mdx` — none present in `package.json`). The PCR text is plain text anyway (system prompt forbids markdown), but if any field needs HTML-style rendering for `[UNCONFIRMED]` highlighting, the team will need to add a library or implement a small custom renderer.

### Other PCR-related surface (cosmetic only)

- `new-report.tsx`: an "ePCR FILE (PDF/XML)" upload tile (`epcr` state). The PCR draft API does not consume an uploaded ePCR file — it generates a PCR from video/audio/CAD. The upload tile is misleading relative to the new auto-draft flow.
- `processing.tsx`: a static `ePCR PARSER` agent card (`processing.tsx:558`) — purely visual.
- `dashboard.tsx`: nav copy `"PCR Generator"`.
- `finalize.tsx`: a single hardcoded reasoning line referencing the PCR narrative (`finalize.tsx:258`).

---

## 7. What exists vs what's missing

| Backend capability | Frontend support exists? | What's needed |
|---|---|---|
| `POST /pcr-draft` (kick off draft) | No — `new-report.tsx` "Generate" button just `navigate('/processing')` with no API call. | Replace mock navigation with a real `POST` to `/api/cases/{id}/pcr-draft`; surface the returned `case_id`/status in app state. |
| `GET /pcr-draft` polling for completion | No — no polling logic anywhere; no `EventSource`/`fetch` in `src/`. | Add a polling hook (e.g. `usePcrDraft(caseId)`) that re-GETs every 1–2 s while `draft_markdown` equals the placeholder string (or `total_event_count == 0`); transition state when content arrives or `error` populates. |
| Pending placeholder display | Partial — `processing.tsx` shows agent cards but they're animations, not real status. | Render a "Drafting PCR…" loading state that shows the running stages (CAD/video/audio gather, then Sonnet draft). |
| Full draft markdown display | No — review's `PCR SOURCE` tab only shows 4 metadata fields. | Render the full plain-text PCR (preserve fixed-width formatting; mono font + `<pre>` works). Show on the review page's PCR tab AND on a dedicated draft-review screen before the QI pipeline runs. |
| `[UNCONFIRMED]` highlighting | No — no rendering of the token at all. | Tokenize `draft_markdown`, highlight `[UNCONFIRMED]` spans (e.g. amber background) and surface a count badge driven by `unconfirmed_count`. |
| Inline editing | No — no editable PCR component exists. | Editable `<textarea>` (or section-by-section editor) seeded with `draft_markdown`. Track local edits; provide a diff vs. server draft. |
| `PATCH /pcr-draft/confirm` | No. | Wire a "Confirm PCR" button that PATCHes with edited content + `confirmed_by` from session/user state. Disable until something has loaded; show server-returned validation errors (the 400 for empty content on errored drafts). |
| Post-confirm PCR view (read-only) | No — `review.tsx` PCR tab only knows about `PcrMetadata`. | After confirmation, show the same PCR text in a read-only view with `confirmed_by`/`confirmed_at` badge and remaining-unconfirmed count. |
| Trigger QI pipeline (`POST /process`) after confirm | No. | The confirm handler does not auto-trigger; the UI must explicitly call `POST /api/cases/{id}/process` (or chain it from a "Run QI Review" button after confirmation). Decide: auto-fire on confirm, or require explicit user action. |
| Error surfacing (background failure → `error` field) | No. | Detect `error != null` on GET; show a banner with the message and offer "Regenerate" (re-POST) or "Write manually" (clear textarea, allow free-form). |
| Re-POST safety | No backend guard exists. | UI should disable "Regenerate" while a draft is in-flight; warn before overwriting a `confirmed` draft. (Backend has no protection here, so the frontend is the only safety net.) |
| Frontend `PCRDraft` type | No — `PcrMetadata` is unrelated. | Add a `PCRDraft` TS interface mirroring `backend/app/schemas.py:352`. |
| Calling `GET /api/cases/{id}/pcr` (raw confirmed PCR) | No. | Optional: use this read-only endpoint for the post-confirm view if you don't want to keep polling `/pcr-draft`. |

---

## 8. UX flow mapping

Starting state: user has uploaded `pcr.md`/`audio`/`video`/`cad.json` into `cases/{id}/` via the new-report page (or seeded the case folder out-of-band) and the case directory exists.

1. **"Case ready" screen.** User sees a "Generate PCR Draft" CTA on the case detail page.
   - User action: clicks Generate.
   - API: `POST /api/cases/{id}/pcr-draft`.
   - Backend: writes `cases/{id}/pcr_draft.json` with placeholder text and `status=pending_review`; schedules background task.
   - Completion: HTTP 200 returned almost immediately with the placeholder body. UI transitions to step 2.

2. **"Drafting…" screen.** Show progress affordance (spinner + stage list: "Reading CAD", "Analyzing video", "Analyzing audio", "Drafting PCR with Sonnet"). Reuse the existing processing-page agent tile aesthetic if desired.
   - User action: wait. Provide a Cancel control only if you intend to wire one — backend has no cancel endpoint, so this is cosmetic.
   - API: `GET /api/cases/{id}/pcr-draft` polled every 1–2 s.
   - Backend: no state change while waiting; on completion the background task overwrites `pcr_draft.json` with the populated draft. On failure, writes a draft with `error` set and `draft_markdown="*Draft generation failed...*"`.
   - Completion: response shows real PCR text (not the placeholder string) and non-zero `total_event_count` → UI transitions to step 3. If `error` populated → show step 3a.

3. **"Review draft" screen.** Two-column: left = full PCR text in a `<pre>` editor (or section editor), right = stats panel (`unconfirmed_count`, video/audio counts, generated_at) and a legend explaining `[UNCONFIRMED]`.
   - User action: scroll, edit, replace `[UNCONFIRMED]` tokens with real values; optionally click "Regenerate" to re-POST (warn first).
   - API: none until confirm. Local state only.
   - Backend: no change while editing.
   - Completion: when user clicks Confirm, transition to step 4.

3a. **"Draft errored" variant.** Banner: `*Draft generation failed. Please write PCR manually.*` plus the `error` string. Same editor, but seeded with a blank PCR template (or the template the drafter would have produced — backend already wrote the placeholder text, replace it). Provide Regenerate and Write-Manually paths. Confirming a manually-written PCR still PATCHes confirm.

4. **"Confirm PCR" action.**
   - User action: clicks Confirm. Optionally captures `confirmed_by` (e.g. logged-in user).
   - API: `PATCH /api/cases/{id}/pcr-draft/confirm` with `{ edited_markdown, confirmed_by }`.
   - Backend: writes `cases/{id}/pcr.md` (the QI pipeline input), updates `pcr_draft.json` to `status=confirmed` + `confirmed_at` + recomputed `unconfirmed_count` + `emt_edits_made`.
   - Completion: returns the updated `PCRDraft`. UI shows a success state (e.g. green check + "Confirmed by ALEX RODRIGUEZ at 14:42:11, 3 unconfirmed fields remaining"). Transition to step 5.

5. **"PCR confirmed — ready for QI review" screen.** Read-only PCR view (mono `<pre>` rendering of `draft_markdown` from the confirmed draft, with `[UNCONFIRMED]` highlighted in amber if any remain). Primary CTA: "Run QI Review".
   - User action: clicks Run QI Review.
   - API: `POST /api/cases/{id}/process` (separate manual step — confirm does NOT auto-trigger).
   - Backend: starts the existing 7-stage QI pipeline; `pcr_parser` Stage 1a reads `cases/{id}/pcr.md`. Stream via the existing `GET /api/cases/{id}/stream` SSE endpoint.
   - Completion: hand off to the existing `processing.tsx` / `review.tsx` flow (already built, but currently driven by mock data — also needs wiring).

Optional secondary affordance available on step 5: a "Edit PCR" link that returns to step 3 and re-PATCHes confirm. Note: per §1, re-PATCH succeeds without a guard — if re-edit-after-QI is allowed it will overwrite `pcr.md` while the QI review still references the old version.
