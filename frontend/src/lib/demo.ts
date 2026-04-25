import type {
  AARDraft,
  Case,
  PipelineProgress,
  PipelineStage,
} from "@/types/schemas";

const FIXTURE_URL = "/demo/sample_aar.json";
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

export async function loadDemoAAR(): Promise<AARDraft> {
  const res = await fetch(FIXTURE_URL);
  if (!res.ok) throw new Error(`Demo fixture missing: ${res.status}`);
  return (await res.json()) as AARDraft;
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
  aar: AARDraft,
  handlers: {
    onProgress: (progress: PipelineProgress) => void;
    onComplete: (aar: AARDraft) => void;
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
    handlers.onComplete(aar);
  }, DEMO_STAGES.length * stageDelayMs * 2 + 100);

  return {
    cancel: () => {
      cancelled = true;
      timeouts.forEach((t) => window.clearTimeout(t));
    },
  };
}
