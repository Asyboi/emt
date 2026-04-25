# Sentinel Update: AAR → QI Case Review

A multi-step prompt sequence to retrofit the Sentinel codebase from "AAR" terminology and structure to the accurate "QI Case Review" model based on real EMS QA practices.

**Why this update:** Initial scaffolding used "AAR" (After-Action Review), which in EMS terminology refers to disaster-level event reports. What we're actually building is a QI Case Review — a single-incident quality assurance document used by clinical coordinators and medical directors to evaluate care quality, documentation accuracy, and protocol adherence. This update aligns the codebase with how real EMS agencies (Hartford Hospital, LA County EMS, North Channel EMS) actually structure these reviews.

**Run order:** Step 1 → Step 2 → Step 3 → Step 4. Each step is self-contained — you can reset chat between steps. Verify acceptance criteria before moving on.

---

## Step 1 — Schema Updates (the contract change)

**Goal:** Update Pydantic schemas, TypeScript types, and the sample fixture to match the QI Case Review structure. This is the foundation — every other step depends on it.

**Why first:** Schemas are the contract. If pipeline/UI code is updated before schemas, you'll have type mismatches everywhere.

### Prompt

```
Update the Sentinel project schemas to model a QI Case Review (the actual output of EMS quality assurance review of a single incident) instead of the previously-named "AARDraft." This step ONLY touches:

1. backend/app/schemas.py
2. frontend/src/types/schemas.ts
3. fixtures/sample_aar.json (rename to sample_qi_review.json)
4. backend/tests/test_schemas.py
5. docs/PROGRESS.md (record this update)

Do NOT touch pipeline code, API routes, or UI components in this step. Those come in Steps 2-4.

Before starting, read backend/app/schemas.py and fixtures/sample_aar.json to understand current state.

## New / updated schemas

Keep all existing models (Event, EventSource, EventType, TimelineEntry, ProtocolStep, ProtocolCheckStatus, ProtocolCheck, FindingSeverity, FindingCategory, Finding, Case, PipelineStage, PipelineProgress) unchanged.

ADD these new models:

class CrewMember(BaseModel):
    role: Literal["primary_paramedic", "secondary_paramedic", "emt", "driver", "supervisor", "other"]
    identifier: str   # anonymized, e.g. "P-001"

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

class ClinicalAssessmentItem(BaseModel):
    item_id: str
    category: ClinicalAssessmentCategory
    benchmark: str               # e.g. "Initial vital signs obtained within 5 minutes"
    status: AssessmentStatus
    notes: str
    evidence_event_ids: list[str] = Field(default_factory=list)

class DocumentationQualityAssessment(BaseModel):
    completeness_score: float    # 0.0-1.0
    accuracy_score: float
    narrative_quality_score: float
    issues: list[str] = Field(default_factory=list)

class UtsteinData(BaseModel):
    """Cardiac-arrest-specific data per the 2024 Utstein registry template. All fields optional — only present for cardiac arrest cases."""
    witnessed: Optional[bool] = None
    bystander_cpr: Optional[bool] = None
    initial_rhythm: Optional[Literal["vf", "vt", "pea", "asystole", "unknown"]] = None
    time_to_cpr_seconds: Optional[float] = None
    time_to_first_defib_seconds: Optional[float] = None
    rosc_achieved: Optional[bool] = None
    time_to_rosc_seconds: Optional[float] = None
    disposition: Optional[Literal["rosc_sustained", "transport_with_cpr", "pronounced_on_scene", "transferred_with_rosc"]] = None

class RecommendationAudience(str, Enum):
    CREW = "crew"
    AGENCY = "agency"
    FOLLOW_UP = "follow_up"

class RecommendationPriority(str, Enum):
    INFORMATIONAL = "informational"
    SUGGESTED = "suggested"
    REQUIRED = "required"

class Recommendation(BaseModel):
    recommendation_id: str
    audience: RecommendationAudience
    priority: RecommendationPriority
    description: str
    related_finding_ids: list[str] = Field(default_factory=list)

class ReviewerDetermination(str, Enum):
    NO_ISSUES = "no_issues"
    DOCUMENTATION_CONCERN = "documentation_concern"
    PERFORMANCE_CONCERN = "performance_concern"
    SIGNIFICANT_CONCERN = "significant_concern"
    CRITICAL_EVENT = "critical_event"

## Replace AARDraft with QICaseReview

class QICaseReview(BaseModel):
    case_id: str
    generated_at: datetime
    reviewer_id: str = "sentinel_agent_v1"

    # Header
    incident_date: datetime
    incident_type: str
    responding_unit: str
    crew_members: list[CrewMember] = Field(default_factory=list)
    patient_age_range: str        # e.g. "60-69" — anonymized
    patient_sex: Literal["m", "f", "unknown"]
    chief_complaint: str

    # Body
    incident_summary: str         # 2-3 paragraph narrative
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

## Backward compatibility decision

We do NOT keep AARDraft as an alias. Rename cleanly. Steps 2-4 update consumers. Search the codebase for "AARDraft" and "aar" references and mark them as work-to-do for later steps (do not fix them in this step — track them in PROGRESS.md).

## Update fixture

Rename fixtures/sample_aar.json → fixtures/sample_qi_review.json. Update its contents to be a valid QICaseReview. Add the new fields with realistic values:

- 2 crew_members (P-001 primary paramedic, P-002 secondary)
- patient_age_range: "60-69", patient_sex: "m"
- chief_complaint: "Witnessed cardiac arrest"
- responding_unit: "Medic 51"
- incident_summary: 2-3 paragraphs
- 8-10 clinical_assessment items spanning at least 5 categories, mix of MET/NOT_MET/INSUFFICIENT_DOCUMENTATION
- documentation_quality with completeness 0.78, accuracy 0.65, narrative 0.82, and 2-3 specific issues listed
- utstein_data: witnessed=true, bystander_cpr=true, initial_rhythm="vf", time_to_cpr_seconds=180, time_to_first_defib_seconds=420, rosc_achieved=true, time_to_rosc_seconds=720, disposition="transferred_with_rosc"
- 3-4 recommendations (one per audience, mix of priorities)
- determination: "performance_concern"
- determination_rationale: 2-3 sentence explanation tied to the findings

Keep the existing 3 timeline entries, 4 findings, 5 protocol checks from the previous fixture — but ensure their IDs are referenced correctly by the new fields (e.g. recommendation.related_finding_ids points to actual finding_ids).

## Update TypeScript types

Mirror every new Pydantic model in frontend/src/types/schemas.ts. Match field names exactly (snake_case). Use string literal unions for enums. Remove the old AARDraft type. Add a comment at the top: "// Mirrors backend/app/schemas.py — keep in sync. Updated to QICaseReview structure."

## Update tests

backend/tests/test_schemas.py:
- Load fixtures/sample_qi_review.json
- Validate it parses as QICaseReview
- Assert: at least 3 timeline entries, at least 4 findings, at least 5 protocol_checks, at least 8 clinical_assessment items, at least 3 recommendations, utstein_data is present and rosc_achieved is True, determination is "performance_concern"

## Update docs/PROGRESS.md

Append a new entry:
- Date: <today>
- Change: Renamed AARDraft → QICaseReview. Added clinical_assessment, documentation_quality, utstein_data, recommendations, determination fields. Renamed sample_aar.json → sample_qi_review.json.
- Outstanding work: pipeline drafting agent, API routes, frontend components all reference old schema names — to be updated in Steps 2-4 of this update.

## Acceptance criteria

1. `cd backend && uv run pytest tests/test_schemas.py` passes
2. `cd frontend && npm run typecheck` passes (existing UI may have ts errors referencing AARDraft — those are expected and will be fixed in Step 4; ensure the types file itself compiles cleanly in isolation if possible, or note failures explicitly in PROGRESS.md to fix in Step 4)
3. fixtures/sample_qi_review.json validates against QICaseReview
4. The fixture has all specified counts and the utstein/recommendations sections populated
5. docs/PROGRESS.md reflects this change

Stop after this step. Do NOT proceed to update pipeline or UI code yet.
```

### Verification

Run acceptance criteria. The schema is now updated. **Frontend will be temporarily broken** (it references `AARDraft`) — this is expected and gets fixed in Step 4.

---

## Step 2 — Pipeline Updates (drafting agent + orchestration)

**Goal:** Update the pipeline to produce a `QICaseReview` instead of an `AARDraft`, including new sections like clinical assessment, Utstein data, and recommendations.

**Why second:** Pipeline must produce the new schema before the API can serve it.

### Prompt

```
Update the Sentinel pipeline to produce a QICaseReview (the new schema from Step 1) instead of the old AARDraft. This step ONLY touches:

1. backend/app/pipeline/orchestrator.py
2. backend/app/pipeline/drafting.py (largest change — produces the new structure)
3. backend/app/pipeline/findings.py (minor — ensure findings reference clinical_assessment items)
4. backend/app/pipeline/protocol_check.py (no schema change, may need light updates)
5. backend/app/prompts.py (new prompts for clinical assessment, recommendations, determination)
6. backend/scripts/run_pipeline.py
7. backend/tests/ — update existing tests, add new ones

Do NOT touch API routes (Step 3) or frontend (Step 4).

Before starting, read:
- backend/app/schemas.py (the new QICaseReview structure)
- fixtures/sample_qi_review.json (target output shape)
- All current pipeline files
- docs/PROGRESS.md

## New pipeline stages? No — extended drafting.

We are NOT adding new pipeline stages. The drafting stage now produces a richer document. Conceptually, drafting now does:

1. Extract case header info (already in Case object — incident_date, incident_type, responding_unit) plus crew_members and patient demographics from the PCR
2. Generate the incident_summary narrative
3. Generate clinical_assessment items by evaluating the timeline against standard QI benchmarks for the incident_type
4. Generate documentation_quality assessment by comparing PCR content against video/audio events
5. Extract utstein_data if incident_type is "cardiac_arrest"
6. Generate recommendations based on findings + clinical_assessment
7. Compute determination from severity of findings + clinical_assessment failures
8. Compose all of this into a QICaseReview

The findings, timeline, and protocol_checks come from earlier stages unchanged. Drafting is the integration + composition step.

## drafting.py implementation

Replace draft_aar with:

async def draft_qi_review(
    case: Case,
    timeline: list[TimelineEntry],
    findings: list[Finding],
    protocol_checks: list[ProtocolCheck],
    pcr_content: str,
) -> QICaseReview:
    """Compose the full QI Case Review from upstream pipeline outputs."""

This function uses Claude Sonnet 4.6 with multiple structured calls (NOT one massive prompt — break into focused sub-calls):

Call A: Extract header info + summary + Utstein data
- Input: case metadata, pcr_content, timeline summary
- Tool schema: returns crew_members, patient_age_range, patient_sex, chief_complaint, incident_summary, utstein_data (None if not cardiac arrest)

Call B: Generate clinical assessment
- Input: timeline, incident_type
- Tool schema: returns list of ClinicalAssessmentItem covering all relevant categories
- Prompt: provide explicit benchmarks per category (CPR rate >100/min, vital signs within 5 min, etc.)

Call C: Generate documentation quality assessment
- Input: pcr_content, timeline (which has source attribution showing what's in PCR vs video vs audio)
- Tool schema: returns DocumentationQualityAssessment
- Logic: completeness = % of timeline events documented in PCR; accuracy = 1 - (discrepancies / total events); narrative_quality = LLM judgment 0-1

Call D: Generate recommendations
- Input: findings, clinical_assessment results
- Tool schema: returns list of Recommendation
- Distribution: 1-2 crew-level, 1 agency-level, 0-1 follow-up

Call E: Compute determination
- Input: findings (with severities), clinical_assessment (count of NOT_MET items)
- Logic: rule-based (no LLM call needed):
  * Any CRITICAL finding → CRITICAL_EVENT
  * 2+ CONCERN findings OR 3+ NOT_MET assessments → SIGNIFICANT_CONCERN
  * 1 CONCERN finding OR 1-2 NOT_MET assessments → PERFORMANCE_CONCERN
  * Documentation issues but no clinical concerns → DOCUMENTATION_CONCERN
  * Otherwise → NO_ISSUES
- Generate determination_rationale via Sonnet (2-3 sentences explaining the determination, citing specific findings)

Compose all of this into a QICaseReview and return it.

For now (since downstream of stubs), the implementation can fall back to fixture-derived data if any sub-call fails or if the upstream stages are still stubs. Add a clear comment: "TODO: when upstream stages are real, remove fixture fallbacks."

## prompts.py additions

Add these prompts and tool schemas:

QI_HEADER_SYSTEM = """You are an EMS Quality Improvement reviewer extracting case header information and writing an incident summary from a Patient Care Report and reconstructed timeline.

Anonymize patient details — use age ranges (e.g., "60-69") not exact ages, and use only sex/gender."""

QI_HEADER_TOOL = { ... full schema for Call A output ... }

QI_CLINICAL_ASSESSMENT_SYSTEM = """You are an EMS QI reviewer evaluating clinical care against established benchmarks for [incident_type] cases. For each benchmark below, assess whether the timeline shows the standard was met, not met, not applicable, or has insufficient documentation.

Cardiac arrest benchmarks (when incident_type=cardiac_arrest):
- Scene management: arrival to patient contact <60s
- Initial assessment: rhythm identified within 30s of patient contact
- CPR quality: chest compressions started within 10s of arrest confirmation
- CPR quality: minimal interruptions, perishock pause <10s
- Airway management: BVM ventilation initiated, advanced airway considered after initial CPR cycles
- Vascular access: IV/IO established within first 5 minutes
- Medications: epinephrine 1mg every 3-5 minutes (cardiac arrest)
- Defibrillation: VF/pulseless VT shocked within 2 minutes of identification
- Monitoring: continuous ECG monitoring, EtCO2 if available
- Transport decision: appropriate destination, timing
- Handoff: structured handoff to receiving hospital

For each benchmark, return MET / NOT_MET / NOT_APPLICABLE / INSUFFICIENT_DOCUMENTATION with notes referencing specific timeline events."""

QI_CLINICAL_ASSESSMENT_TOOL = { ... }

QI_DOCUMENTATION_QUALITY_SYSTEM = """You evaluate Patient Care Report documentation quality against the actual events captured in video and audio sources.

Score each dimension 0.0-1.0:
- completeness: did the PCR document all clinically relevant events visible/audible in other sources?
- accuracy: where the PCR overlaps with other sources, do they agree on facts (timing, doses, interventions)?
- narrative_quality: is the PCR narrative coherent, professional, complete?

List specific issues observed."""

QI_DOCUMENTATION_QUALITY_TOOL = { ... }

QI_RECOMMENDATIONS_SYSTEM = """Based on the findings and clinical assessment results, generate actionable recommendations.

Categorize each recommendation:
- crew: feedback for the responding providers (training, technique adjustment)
- agency: systemic issues (equipment, protocols, training programs)
- follow_up: additional review needed, escalation, peer discussion

Use a non-punitive tone consistent with Just Culture principles."""

QI_RECOMMENDATIONS_TOOL = { ... }

QI_DETERMINATION_RATIONALE_SYSTEM = """Given a determination classification, write a 2-3 sentence rationale that cites the specific findings and clinical assessment results supporting the determination."""

## orchestrator.py update

Update process_case to:
- Pass pcr_content into the drafting stage (read from disk via case_loader)
- Return QICaseReview instead of AARDraft

Signature change:
async def process_case(case: Case, progress_callback) -> QICaseReview:

The 7 pipeline stages remain unchanged. Only the final stage's output type and richness change.

## findings.py minor update

After Step 1 schema changes, ensure Finding generation considers ClinicalAssessmentItem failures as a source of findings. Specifically: when a clinical_assessment item is NOT_MET with significant impact, that should also surface as a Finding (with category=PROTOCOL_DEVIATION or CARE_GAP as appropriate).

For now this is a comment / TODO — full integration happens when both findings and clinical_assessment use real LLM calls. The stub can keep using fixture data.

## scripts/run_pipeline.py update

Update to print QICaseReview JSON output instead of AARDraft. Add a "--summary" flag that prints just determination + summary + finding count for quick checks.

## Tests

Update existing pipeline tests to expect QICaseReview output. Add:
- test_drafting_produces_valid_qi_review (smoke test using fixture-derived stubs)
- test_determination_logic (rule-based determination — no LLM needed for this test, just unit-test the function)

## Update docs/PROGRESS.md

Append:
- Step 2 of QI Case Review update complete
- Pipeline now produces QICaseReview structure
- Drafting stage broken into 5 sub-calls (header/summary, clinical assessment, doc quality, recommendations, determination)
- API routes (Step 3) and frontend (Step 4) still reference old schema — to be updated next

## Acceptance criteria

1. `uv run pytest tests/` passes
2. `uv run python scripts/run_pipeline.py case_01` runs and prints valid QICaseReview JSON
3. The output includes all sections: header, summary, timeline, clinical_assessment (>=5 items), documentation_quality, findings, protocol_checks, utstein_data, recommendations, determination
4. determination_rationale references specific findings
5. utstein_data is present for case_01 (cardiac_arrest)
6. `uv run ruff check app/` passes

Stop after this step.
```

### Verification

Run all acceptance criteria. The pipeline now produces the right shape end-to-end. API and UI still need updating.

---

## Step 3 — API Updates

**Goal:** Update REST endpoints to serve QICaseReview, rename routes for clarity, and update SSE streaming.

**Why third:** Once schema and pipeline are correct, the API layer is straightforward. Doing this before the UI ensures the frontend has something correct to fetch from.

### Prompt

```
Update the Sentinel REST API to serve QICaseReview data and use updated endpoint paths. This step ONLY touches:

1. backend/app/api/cases.py
2. backend/app/api/pipeline.py
3. backend/app/case_loader.py (if cached AAR loading needs adjusting)
4. backend/tests/ — API integration tests
5. docs/API.md (create or update)

Do NOT touch pipeline internals (done in Step 2) or frontend (Step 4).

Before starting, read:
- backend/app/api/cases.py and pipeline.py (current state)
- backend/app/schemas.py (new QICaseReview)
- docs/PROGRESS.md

## Endpoint changes

Rename for clarity. Old paths can stay as 308 redirects to new paths if useful, but for a hackathon, just rename cleanly.

Old → New:
- GET /api/cases/{case_id}/aar → GET /api/cases/{case_id}/review
- The streaming endpoint stays at GET /api/cases/{case_id}/stream but the final SSE event now contains a "review" key instead of "aar"

All other endpoints unchanged.

Updated endpoint reference:

GET /api/cases
  → list[Case]

GET /api/cases/{case_id}
  → Case

GET /api/cases/{case_id}/pcr
  → {"content": str}  (PCR markdown)

GET /api/cases/{case_id}/review
  → QICaseReview  (404 if not yet generated)

GET /api/cases/{case_id}/video
  → video file with range support (404 if missing)

POST /api/cases/{case_id}/process
  → {"job_id": str}

GET /api/cases/{case_id}/stream
  → SSE: PipelineProgress events, then final {"type": "complete", "review": <QICaseReview JSON>}

## Caching update

Update cache file naming:
- cases/{case_id}/aar.json → cases/{case_id}/review.json

Add a one-time migration: on backend startup, if any cases/{case_id}/aar.json exists, rename it to review.json (only if review.json doesn't already exist). Log the migration.

Update case_loader.py:
- Rename load_cached_aar → load_cached_review
- Returns Optional[QICaseReview]
- Reads from cases/{case_id}/review.json

## Demo mode handling

If you previously implemented demo mode that returns cached AARs to avoid live API calls, update it to return cached reviews from review.json. The synthetic streaming delays remain unchanged.

## Tests

backend/tests/test_api.py:
- Use FastAPI TestClient
- Test all endpoints return correct status codes
- Test GET /api/cases/case_01/review returns valid QICaseReview JSON (after seeding cases/case_01/review.json from fixture)
- Test SSE stream emits 7 progress events plus a final "complete" event with "review" key
- Test 404s for missing cases / missing reviews

## docs/API.md

Create or update with:
- Full endpoint reference (every path, method, request/response shape)
- SSE event format
- Example curl commands
- Note about CORS (allows the configured FRONTEND_ORIGIN)

## Update docs/PROGRESS.md

Append:
- Step 3 of QI Case Review update complete
- Endpoint /aar renamed to /review across REST + SSE
- Cache file renamed aar.json → review.json with auto-migration
- Frontend (Step 4) is the final remaining update

## Acceptance criteria

1. `uvicorn app.main:app --reload` starts cleanly
2. `curl http://localhost:8000/api/cases` returns case list
3. `curl http://localhost:8000/api/cases/case_01/review` returns valid QICaseReview JSON
4. `curl -N http://localhost:8000/api/cases/case_01/stream` streams progress + final "complete" event with "review" key (NOT "aar")
5. `uv run pytest tests/test_api.py` passes
6. docs/API.md exists and is accurate

Stop after this step.
```

### Verification

Run all acceptance criteria. Backend is now fully aligned with the new schema. Frontend is still broken — fix in Step 4.

---

## Step 4 — Frontend Updates (the last mile)

**Goal:** Update React components to render QICaseReview structure, including new sections (clinical assessment, documentation quality, Utstein data, recommendations, determination).

**Why last:** UI work is detail-heavy. Doing it after backend is locked means no rework when shapes shift.

### Prompt

```
Update the Sentinel frontend to render the QICaseReview structure (replacing the old AARDraft display). This step ONLY touches:

1. frontend/src/lib/api.ts (rename getAAR → getReview, update endpoint path, update types)
2. frontend/src/App.tsx (state names, prop wiring)
3. frontend/src/components/AARPane.tsx → rename to ReviewPane.tsx, restructure
4. frontend/src/components/PipelineProgress.tsx (SSE final event key change)
5. frontend/src/components/FindingCard.tsx (no major changes, verify still works)
6. NEW components for new sections (see below)
7. frontend/src/types/schemas.ts (already updated in Step 1, verify alignment)

Do NOT touch backend.

Before starting, read:
- frontend/src/types/schemas.ts (the QICaseReview type)
- frontend/src/lib/api.ts (current state)
- frontend/src/components/AARPane.tsx (current state — being replaced)
- fixtures/sample_qi_review.json (the data shape you're rendering)

## API client update (frontend/src/lib/api.ts)

- Rename getAAR → getReview
- Update endpoint from /api/cases/${id}/aar → /api/cases/${id}/review
- Update return type from AARDraft → QICaseReview
- Update streamCase: the final SSE event now has shape { type: "complete", review: QICaseReview } — change handler signature accordingly

## New component: ReviewPane.tsx (replaces AARPane.tsx)

Replaces the center pane. Renders the full QI Case Review with collapsible sections.

Structure (top to bottom):

1. **DeterminationBanner** (NEW component)
   - Top of pane, color-coded by determination:
     * NO_ISSUES: green
     * DOCUMENTATION_CONCERN: blue
     * PERFORMANCE_CONCERN: amber
     * SIGNIFICANT_CONCERN: orange
     * CRITICAL_EVENT: red
   - Shows determination label + rationale
   - Always visible, never collapsed

2. **CaseHeader** (NEW component)
   - Compact card with: case_id, incident_type, incident_date, responding_unit
   - patient_age_range + patient_sex + chief_complaint
   - crew_members (list of role + identifier)
   - Collapsible, default expanded

3. **IncidentSummary**
   - Existing summary section, but now reads from review.incident_summary (was review.summary)
   - 2-3 paragraphs in a card

4. **UtsteinDataCard** (NEW component, conditional)
   - Only renders if review.utstein_data is not null
   - Shows: witnessed, bystander_cpr, initial_rhythm, time_to_cpr, time_to_first_defib, rosc_achieved, time_to_rosc, disposition
   - Format times as MM:SS
   - Use icons (lucide-react Heart, Zap, Activity, etc.)

5. **FindingsList**
   - Existing FindingCard list, sorted by severity (critical first)
   - Click → seek video, highlight PCR (existing wow moment, preserved)

6. **ClinicalAssessmentSection** (NEW component)
   - Grouped by category (CPR_QUALITY, AIRWAY_MANAGEMENT, etc.)
   - Each item shows: benchmark, status badge, notes
   - Status badges: MET=green check, NOT_MET=red X, N/A=gray dash, INSUFFICIENT_DOC=amber question mark
   - Collapsible by category, default expanded for any category with NOT_MET items
   - Items reference evidence_event_ids — clicking should seek video like findings do

7. **DocumentationQualitySection** (NEW component)
   - 3 progress bars: completeness, accuracy, narrative_quality (each 0-100%)
   - Color-coded: >80% green, 60-80% amber, <60% red
   - List of issues below the bars
   - Collapsible

8. **ProtocolChecksSection**
   - Existing collapsed-by-default protocol check list
   - Show overall adherence_score as a header bar

9. **RecommendationsSection** (NEW component)
   - Grouped by audience (CREW, AGENCY, FOLLOW_UP)
   - Each rec shows: priority badge, description
   - Priority colors: REQUIRED=red, SUGGESTED=amber, INFORMATIONAL=blue
   - Collapsible per audience group

10. **NarrativeSection**
    - Optional — if you want to keep a free-text narrative, add it here
    - Otherwise, the structured sections above replace the narrative role

11. **ReviewerNotesField**
    - Textarea where the human reviewer adds notes
    - "Sign Off" button at the bottom that toggles human_reviewed

## App.tsx updates

- Rename state `aar` → `review`, `setAar` → `setReview`
- Rename type from AARDraft to QICaseReview
- Update SSE handler: final event has `review` key
- Pass review prop to <ReviewPane> instead of <AARPane>
- The selectedFindingId and click-to-seek logic stays unchanged

## PipelineProgress component

The component itself doesn't change much, but the parent passes the same data structure. Just make sure the type used for "complete" event matches the new shape.

## Styling

Use the same Tailwind palette established in the original frontend phase. New severity/status colors:
- Determination: green-500, blue-500, amber-500, orange-500, red-500
- Assessment status: green-600, red-600, gray-400, amber-500
- Recommendation priority: red-500, amber-500, blue-500

Add some breathing room — the review is now denser. Use space-y-4 between major sections, p-4 inside cards.

Use lucide-react icons throughout: Heart (cardiac), Activity (CPR), Zap (defib), Stethoscope (assessment), FileText (documentation), MessageSquare (recommendations), AlertTriangle (findings), CheckCircle (met), XCircle (not met), HelpCircle (insufficient).

## Critical interaction (preserved + extended)

The existing wow moment (click finding → seek video → highlight PCR) MUST still work. Additionally, ClinicalAssessmentItem with evidence_event_ids should also be clickable and seek the video. Extend the App.tsx handler to look up timestamp from either findings OR clinical assessment items.

## Tests

If you have any frontend tests set up, add at minimum a typecheck pass and a manual smoke test checklist to docs:
- Load case_01, verify all sections render
- Click finding → video seeks
- Click clinical assessment item with evidence → video seeks
- Trigger "Process Case" → progress streams → final review loads
- Toggle "Sign Off" — reviewer_notes textarea works

## Update docs/PROGRESS.md

Append:
- Step 4 of QI Case Review update complete
- Frontend now renders full QICaseReview structure with all 10 sections
- Click-to-seek interaction extended to ClinicalAssessmentItem evidence
- Old AARPane.tsx removed, replaced by ReviewPane.tsx
- Update is fully complete end-to-end (schema → pipeline → API → UI)

## Acceptance criteria

1. `cd frontend && npm run typecheck` passes
2. `cd frontend && npm run build` succeeds
3. `cd frontend && npm run dev` — UI loads with backend on :8000
4. case_01 displays all sections: determination banner (amber for performance_concern), case header, incident summary, Utstein data, findings, clinical assessment, documentation quality, protocol checks, recommendations
5. Determination banner is color-coded correctly per the determination value
6. Click on a Finding card seeks video AND highlights PCR (preserved wow moment)
7. Click on a ClinicalAssessmentItem with evidence_event_ids also seeks the video
8. Triggering Process Case streams progress and ends with the new review loaded
9. Reviewer notes textarea works (controlled state)
10. No console errors

This step completes the AAR → QI Case Review update.
```

### Verification

Run all acceptance criteria. The system is now end-to-end aligned with real EMS QA practices.

---

## After all 4 steps

You should have:

1. **Schemas** that model an actual EMS QI Case Review (not a fictional AAR)
2. **Pipeline** that produces all the sections a real reviewer expects (clinical assessment, Utstein, recommendations, determination)
3. **API** with cleanly named endpoints that serve the new structure
4. **UI** that renders the full QI review with the original wow-moment interaction preserved and extended

## Demo pitch update

With this update, your pitch becomes more credible to anyone with EMS knowledge:

*"Sentinel produces a QI Case Review aligned with how real EMS agencies — like LA County EMS Agency and Hartford Hospital's QA program — structure their reviews. It includes Utstein-compliant cardiac arrest data points, clinical performance assessment against ACLS benchmarks, documentation quality scoring, categorized recommendations under Just Culture principles, and a final reviewer determination. A clinical coordinator who normally spends 30-45 minutes per case excavating findings from bodycam footage can now verify Sentinel's draft in under 10 minutes."*

That's a pitch that survives technical scrutiny from a judge who happens to know EMS.

## If something breaks mid-update

1. Each step is committable independently — commit after each step's acceptance criteria pass
2. If Step 2 produces wrong output, you can fix it without redoing Step 1
3. If Step 4 has UI bugs, the backend remains correct
4. Worst case: revert just the last step's commits, the others are stable