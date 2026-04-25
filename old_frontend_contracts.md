# Old Frontend Contracts (port-forward reference)

Snapshot of the load-bearing pieces of the original `frontend/` (Vite + React 18 + TS) that any replacement UI must preserve to stay compatible with `backend/` and the demo flow. Captured 2026-04-25.

The visual layer (`App.tsx`, `components/*.tsx`, `index.css`, Tailwind config) is intentionally **not** included — that's the part being thrown away.

---

## 1. Backend ↔ Frontend contract overview

| Concern | Source of truth | Frontend mirror |
|---|---|---|
| Domain types | `backend/app/schemas.py` (Pydantic v2) | `frontend/src/types/schemas.ts` — must stay byte-identical in shape |
| REST endpoints | FastAPI routers in `backend/app/routers/` | `frontend/src/lib/api.ts` |
| Pipeline stream | SSE `GET /api/cases/{id}/stream` (14 `progress` + 1 `complete`) | `frontend/src/lib/api.ts` `streamCase()` + `hooks/usePipelineStream.ts` |
| Demo replay | SSE `?demo=1` on backend, fixtures under `frontend/public/demo/` | `frontend/src/lib/demo.ts` |
| Local dev wiring | Backend on `:8000`, frontend on `:5173`, Vite proxies `/api` | `vite.config.ts` |
| Production wiring | Cloudflare Pages, frontend reads `VITE_API_URL` | `package.json` build script + Pages `_headers` / `_redirects` |

**API endpoints in use** (must remain reachable from any new UI):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/cases` | List cases |
| `GET` | `/api/cases/{id}` | Case metadata |
| `GET` | `/api/cases/{id}/pcr` | `{ content }` PCR markdown |
| `GET` | `/api/cases/{id}/review` | Cached `QICaseReview`, 404 if absent |
| `DELETE` | `/api/cases/{id}/review` | Clear cache (Reset) |
| `GET` | `/api/cases/{id}/video` | `FileResponse` w/ HTTP Range |
| `POST` | `/api/cases/{id}/process` | Background job |
| `GET` | `/api/cases/{id}/stream[?demo=1]` | SSE pipeline progress |

SSE event shape: `progress` events carry `PipelineProgress` (one per (stage, status) tick); the terminal `complete` event carries `{ type, review: QICaseReview }`.

**Env vars the frontend touches:**
- `VITE_API_URL` — only used in production builds; dev relies on the Vite proxy.
- `VITE_DEMO_MODE=1` — bakes demo mode on at build time. Otherwise toggled at runtime via `?demo=1`.

**Demo fixtures shipped (under `frontend/public/demo/`):**
- `sample_qi_review.json` — full `QICaseReview` payload for offline replay
- `sample_pcr.md` — PCR markdown for the demo case

---

## 2. `src/types/schemas.ts`

Mirrors `backend/app/schemas.py`. Top-level output type is `QICaseReview`. CLAUDE.md explicitly bans drifting these without paired backend changes.

```typescript
// Mirrors backend/app/schemas.py — keep in sync. Updated to QICaseReview structure.

export type EventSource = "pcr" | "video" | "audio" | "cad";

export type EventType =
  | "medication"
  | "intervention"
  | "vital_signs"
  | "rhythm_check"
  | "cpr_start"
  | "cpr_pause"
  | "defibrillation"
  | "airway"
  | "iv_access"
  | "arrival"
  | "transport_decision"
  | "patient_response"
  | "other";

export interface Event {
  event_id: string;
  timestamp: string;
  timestamp_seconds: number;
  source: EventSource;
  event_type: EventType;
  description: string;
  details: Record<string, unknown>;
  confidence: number;
  raw_evidence: string;
}

export interface TimelineEntry {
  entry_id: string;
  canonical_timestamp_seconds: number;
  canonical_description: string;
  event_type: EventType;
  source_events: Event[];
  match_confidence: number;
  has_discrepancy: boolean;
}

export interface ProtocolStep {
  step_id: string;
  description: string;
  expected_timing_seconds: number | null;
  required: boolean;
}

export type ProtocolCheckStatus =
  | "adherent"
  | "deviation"
  | "not_applicable"
  | "insufficient_evidence";

export interface ProtocolCheck {
  check_id: string;
  protocol_step: ProtocolStep;
  status: ProtocolCheckStatus;
  evidence_event_ids: string[];
  explanation: string;
}

export type FindingSeverity = "info" | "concern" | "critical";

export type FindingCategory =
  | "timing_discrepancy"
  | "missing_documentation"
  | "phantom_intervention"
  | "protocol_deviation"
  | "care_gap"
  | "response_time_violation";

export interface Finding {
  finding_id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  explanation: string;
  evidence_event_ids: string[];
  evidence_timestamp_seconds: number;
  pcr_excerpt: string | null;
  suggested_review_action: string;
}

export type CrewRole =
  | "primary_paramedic"
  | "secondary_paramedic"
  | "emt"
  | "driver"
  | "supervisor"
  | "other";

export interface CrewMember {
  role: CrewRole;
  identifier: string;
}

export type ClinicalAssessmentCategory =
  | "scene_management"
  | "initial_assessment"
  | "cpr_quality"
  | "airway_management"
  | "vascular_access"
  | "medications"
  | "defibrillation"
  | "monitoring"
  | "transport_decision"
  | "handoff";

export type AssessmentStatus =
  | "met"
  | "not_met"
  | "not_applicable"
  | "insufficient_documentation";

export interface ClinicalAssessmentItem {
  item_id: string;
  category: ClinicalAssessmentCategory;
  benchmark: string;
  status: AssessmentStatus;
  notes: string;
  evidence_event_ids: string[];
}

export interface DocumentationQualityAssessment {
  completeness_score: number;
  accuracy_score: number;
  narrative_quality_score: number;
  issues: string[];
}

export type UtsteinInitialRhythm = "vf" | "vt" | "pea" | "asystole" | "unknown";

export type UtsteinDisposition =
  | "rosc_sustained"
  | "transport_with_cpr"
  | "pronounced_on_scene"
  | "transferred_with_rosc";

export interface UtsteinData {
  witnessed: boolean | null;
  bystander_cpr: boolean | null;
  initial_rhythm: UtsteinInitialRhythm | null;
  time_to_cpr_seconds: number | null;
  time_to_first_defib_seconds: number | null;
  rosc_achieved: boolean | null;
  time_to_rosc_seconds: number | null;
  disposition: UtsteinDisposition | null;
}

export type RecommendationAudience = "crew" | "agency" | "follow_up";

export type RecommendationPriority = "informational" | "suggested" | "required";

export interface Recommendation {
  recommendation_id: string;
  audience: RecommendationAudience;
  priority: RecommendationPriority;
  description: string;
  related_finding_ids: string[];
}

export type ReviewerDetermination =
  | "no_issues"
  | "documentation_concern"
  | "performance_concern"
  | "significant_concern"
  | "critical_event";

export type PatientSex = "m" | "f" | "unknown";

export interface GeoPoint {
  lat: number;
  lng: number;
  elevation_m?: number;
}

export type IncidentDisposition =
  | "82" | "83" | "84" | "90" | "93" | "95" | "96" | "97" | "99";

export interface CADRecord {
  cad_incident_id: string;
  incident_datetime: string;
  initial_call_type: string;
  initial_severity_level_code: number;
  final_call_type: string;
  final_severity_level_code: number;
  first_assignment_datetime: string;
  first_activation_datetime: string;
  first_on_scene_datetime: string;
  first_to_hosp_datetime?: string;
  first_hosp_arrival_datetime?: string;
  incident_close_datetime: string;
  dispatch_response_seconds?: number;
  incident_response_seconds?: number;
  incident_travel_seconds?: number;
  incident_disposition_code: IncidentDisposition;
  borough?: string;
  zipcode?: string;
  incident_location?: GeoPoint;
  protocol_families: string[];
}

export interface QICaseReview {
  case_id: string;
  generated_at: string;
  reviewer_id: string;

  incident_date: string;
  incident_type: string;
  responding_unit: string;
  crew_members: CrewMember[];
  patient_age_range: string;
  patient_sex: PatientSex;
  chief_complaint: string;

  incident_summary: string;
  timeline: TimelineEntry[];
  clinical_assessment: ClinicalAssessmentItem[];
  documentation_quality: DocumentationQualityAssessment;
  findings: Finding[];
  protocol_checks: ProtocolCheck[];
  adherence_score: number;

  utstein_data: UtsteinData | null;

  recommendations: Recommendation[];
  determination: ReviewerDetermination;
  determination_rationale: string;

  reviewer_notes: string;
  human_reviewed: boolean;

  cad_record?: CADRecord;
}

export interface Case {
  case_id: string;
  incident_type: string;
  incident_date: string;
  pcr_path: string;
  video_path: string;
  audio_path: string;
  cad_path?: string;
  metadata: Record<string, unknown>;
}

export type PipelineStage =
  | "cad_parsing"
  | "pcr_parsing"
  | "video_analysis"
  | "audio_analysis"
  | "reconciliation"
  | "protocol_check"
  | "findings"
  | "drafting";

export type PipelineStatus = "pending" | "running" | "complete" | "error";

export interface PipelineProgress {
  stage: PipelineStage;
  status: PipelineStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}
```

---

## 3. `src/lib/api.ts`

REST + SSE client. `BASE` resolves from `VITE_API_URL` (empty in dev → relative `/api/...` paths get caught by the Vite proxy).

```typescript
import type { Case, PipelineProgress, QICaseReview } from "@/types/schemas";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${BASE}/api${path}`;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function getCases(): Promise<Case[]> {
  return getJSON<Case[]>("/cases");
}

export function getCase(id: string): Promise<Case> {
  return getJSON<Case>(`/cases/${id}`);
}

export function getPCR(id: string): Promise<{ content: string }> {
  return getJSON<{ content: string }>(`/cases/${id}/pcr`);
}

export function getReview(id: string): Promise<QICaseReview> {
  return getJSON<QICaseReview>(`/cases/${id}/review`);
}

export async function deleteReview(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/cases/${id}/review`), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /cases/${id}/review failed: ${res.status}`);
  }
}

export function getVideoUrl(id: string): string {
  return apiUrl(`/cases/${id}/video`);
}

export interface StreamHandlers {
  onProgress: (progress: PipelineProgress) => void;
  onComplete: (review: QICaseReview) => void;
  onError: (message: string) => void;
}

export interface StreamOptions {
  demo?: boolean;
}

export function streamCase(
  id: string,
  handlers: StreamHandlers,
  options: StreamOptions = {},
): EventSource {
  const qs = options.demo ? "?demo=1" : "";
  const source = new EventSource(apiUrl(`/cases/${id}/stream${qs}`));

  source.addEventListener("progress", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as PipelineProgress;
      handlers.onProgress(data);
    } catch (err) {
      handlers.onError(`Failed to parse progress event: ${(err as Error).message}`);
    }
  });

  source.addEventListener("complete", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as {
        type: string;
        review: QICaseReview;
      };
      handlers.onComplete(data.review);
    } catch (err) {
      handlers.onError(`Failed to parse complete event: ${(err as Error).message}`);
    } finally {
      source.close();
    }
  });

  source.addEventListener("error", (event) => {
    const data = (event as MessageEvent).data;
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data) as { message?: string };
        handlers.onError(parsed.message ?? "Pipeline error");
      } catch {
        handlers.onError("Pipeline error");
      }
    } else {
      handlers.onError("Stream connection error");
    }
    source.close();
  });

  return source;
}
```

---

## 4. `src/lib/demo.ts`

Demo mode helpers. Detection runs at module use-time so a `?demo=1` URL works at runtime even on a non-demo build. Synthetic stream is a fallback for when the backend is unreachable.

```typescript
import type {
  Case,
  PipelineProgress,
  PipelineStage,
  QICaseReview,
} from "@/types/schemas";

const FIXTURE_URL = "/demo/sample_qi_review.json";
const PCR_URL = "/demo/sample_pcr.md";

export const DEMO_STAGES: PipelineStage[] = [
  "pcr_parsing",
  "video_analysis",
  "audio_analysis",
  "reconciliation",
  "protocol_check",
  "findings",
  "drafting",
];

export function isDemoMode(): boolean {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") return true;
  }
  return import.meta.env.VITE_DEMO_MODE === "1";
}

export async function loadDemoReview(): Promise<QICaseReview> {
  const res = await fetch(FIXTURE_URL);
  if (!res.ok) throw new Error(`Demo fixture missing: ${res.status}`);
  return (await res.json()) as QICaseReview;
}

export async function loadDemoPCR(): Promise<string> {
  const res = await fetch(PCR_URL);
  if (!res.ok) throw new Error(`Demo PCR missing: ${res.status}`);
  return await res.text();
}

export function demoCases(): Case[] {
  const now = new Date().toISOString();
  return [
    {
      case_id: "case_01",
      incident_type: "cardiac_arrest",
      incident_date: now,
      pcr_path: "demo/sample_pcr.md",
      video_path: "demo/video.mp4",
      audio_path: "demo/audio.mp3",
      metadata: { demo: true },
    },
  ];
}

export interface SyntheticStreamHandle {
  cancel: () => void;
}

/**
 * Run a fully client-side replay of the pipeline progress events.
 *
 * Only used as a last resort when the backend is unreachable but demo mode
 * is on. The backend's ?demo=1 query is preferred when available because it
 * exercises the same code path (SSE → progress events → complete) the live
 * pipeline uses.
 */
export function runSyntheticStream(
  review: QICaseReview,
  handlers: {
    onProgress: (progress: PipelineProgress) => void;
    onComplete: (review: QICaseReview) => void;
  },
  stageDelayMs = 350,
): SyntheticStreamHandle {
  let cancelled = false;
  const timeouts: number[] = [];

  const schedule = (fn: () => void, delay: number) => {
    timeouts.push(window.setTimeout(fn, delay));
  };

  DEMO_STAGES.forEach((stage, idx) => {
    const startDelay = idx * stageDelayMs * 2;
    schedule(() => {
      if (cancelled) return;
      handlers.onProgress({
        stage,
        status: "running",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
      });
    }, startDelay);
    schedule(() => {
      if (cancelled) return;
      handlers.onProgress({
        stage,
        status: "complete",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: null,
      });
    }, startDelay + stageDelayMs);
  });

  schedule(() => {
    if (cancelled) return;
    handlers.onComplete(review);
  }, DEMO_STAGES.length * stageDelayMs * 2 + 100);

  return {
    cancel: () => {
      cancelled = true;
      timeouts.forEach((t) => window.clearTimeout(t));
    },
  };
}
```

---

## 5. `src/hooks/usePipelineStream.ts`

The hook that ties the SSE client and the demo synthetic fallback together. Drops back to `runSyntheticStream` only when (`demo === true` AND backend stream errors). Notable: `PIPELINE_STAGES` is the canonical 7-stage ordering used to seed the progress UI in `pending` state at start.

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

import { streamCase } from "@/lib/api";
import { loadDemoReview, runSyntheticStream, type SyntheticStreamHandle } from "@/lib/demo";
import type { QICaseReview, PipelineProgress, PipelineStage } from "@/types/schemas";

export const PIPELINE_STAGES: PipelineStage[] = [
  "pcr_parsing",
  "video_analysis",
  "audio_analysis",
  "reconciliation",
  "protocol_check",
  "findings",
  "drafting",
];

export interface UsePipelineStreamResult {
  stages: PipelineProgress[];
  isStreaming: boolean;
  error: string | null;
  start: (caseId: string, options?: { demo?: boolean }) => void;
  reset: () => void;
}

export function usePipelineStream(
  onComplete: (review: QICaseReview) => void,
): UsePipelineStreamResult {
  const [stages, setStages] = useState<PipelineProgress[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const syntheticRef = useRef<SyntheticStreamHandle | null>(null);

  const closeSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (syntheticRef.current) {
      syntheticRef.current.cancel();
      syntheticRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    closeSource();
    setStages([]);
    setIsStreaming(false);
    setError(null);
  }, [closeSource]);

  const handleProgress = useCallback((progress: PipelineProgress) => {
    setStages((prev) => {
      const next = [...prev];
      const idx = next.findIndex((s) => s.stage === progress.stage);
      if (idx === -1) {
        next.push(progress);
      } else {
        next[idx] = progress;
      }
      return next;
    });
  }, []);

  const startSynthetic = useCallback(
    async (onDone: (review: QICaseReview) => void) => {
      try {
        const review = await loadDemoReview();
        syntheticRef.current = runSyntheticStream(review, {
          onProgress: handleProgress,
          onComplete: (r) => {
            setIsStreaming(false);
            syntheticRef.current = null;
            onDone(r);
          },
        });
      } catch (err) {
        setError((err as Error).message);
        setIsStreaming(false);
      }
    },
    [handleProgress],
  );

  const start = useCallback(
    (caseId: string, options?: { demo?: boolean }) => {
      closeSource();
      setError(null);
      setStages(
        PIPELINE_STAGES.map((stage) => ({
          stage,
          status: "pending",
          started_at: null,
          completed_at: null,
          error_message: null,
        })),
      );
      setIsStreaming(true);

      const demo = options?.demo === true;

      const source = streamCase(
        caseId,
        {
          onProgress: handleProgress,
          onComplete: (review) => {
            setIsStreaming(false);
            closeSource();
            onComplete(review);
          },
          onError: (message) => {
            // In demo mode the backend may be unreachable — fall back to a
            // fully client-side synthetic stream so the demo stays alive.
            if (demo) {
              closeSource();
              void startSynthetic(onComplete);
              return;
            }
            setError(message);
            setIsStreaming(false);
            closeSource();
          },
        },
        { demo },
      );
      sourceRef.current = source;
    },
    [closeSource, handleProgress, onComplete, startSynthetic],
  );

  useEffect(() => closeSource, [closeSource]);

  return { stages, isStreaming, error, start, reset };
}
```

---

## 6. Local dev wiring — `vite.config.ts`

The `/api` → `:8000` proxy is what keeps `VITE_API_URL` empty in dev. New frontend should keep this behavior or its dev experience changes (CORS, env var juggling).

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
```

---

## 7. Cloudflare Pages deploy files

Both files live at the repo's `frontend/` root and currently contain only commented-out templates — but the *placement* and the convention (Pages picks them up alongside `dist/`) are the contract.

`frontend/_headers`:
```
# Cloudflare Pages custom headers.
# Deploys from frontend/ root alongside the dist/ build output.
# Add header rules here, e.g.:
#   /*
#     X-Frame-Options: DENY
#     Referrer-Policy: strict-origin-when-cross-origin
```

`frontend/_redirects`:
```
# Cloudflare Pages redirects/rewrites.
# Deploys from frontend/ root alongside the dist/ build output.
# Add SPA fallback if/when client-side routing is introduced, e.g.:
#   /*    /index.html   200
```

If the new frontend uses client-side routing, uncomment the SPA fallback line in `_redirects`.

---

## 8. `package.json` for reference

Build script chains `tsc --noEmit` before `vite build`, so a type error fails the build. Keep this discipline in the replacement.

```json
{
  "name": "sentinel-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

`react-markdown` + `remark-gfm` are the only non-trivial runtime dependencies — they render the PCR markdown. Keep equivalents in the new frontend if the PCR pane is staying. `lucide-react` is just icons; swap freely.

---

## Porting checklist for the new frontend

- [ ] Copy `schemas.ts` verbatim — do not edit without paired backend changes.
- [ ] Copy `api.ts` and adapt only if the new framework has a preferred fetch wrapper.
- [ ] Copy `demo.ts` + `usePipelineStream.ts` (or equivalent) — the `?demo=1` URL toggle and synthetic-fallback semantics are user-facing behavior.
- [ ] Copy `frontend/public/demo/sample_qi_review.json` and `sample_pcr.md`.
- [ ] Recreate the Vite proxy (or framework equivalent) so `/api/*` → `localhost:8000` in dev.
- [ ] Re-add `_headers` / `_redirects` at the new frontend root for Cloudflare Pages.
- [ ] Honor `VITE_API_URL` (or rename, but document) for production builds.
- [ ] Honor `VITE_DEMO_MODE=1` build-time demo toggle, in addition to runtime `?demo=1`.
- [ ] Keep `tsc --noEmit` gating on the build.
