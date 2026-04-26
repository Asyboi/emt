import { useEffect, useRef, useState } from 'react';
import type {
  PipelineProgress,
  PipelineStage,
  PipelineStatus,
  QICaseReview,
} from '../types/backend';
import type { IncidentReport } from '../types';
import { buildMockReport } from '../mock/mock_data';
import { adaptReview } from './adapters';
import { API_BASE } from './api';
import { getDataSource } from './source';

export interface StageStatus {
  status: PipelineStatus;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ProcessingState {
  stages: Map<PipelineStage, StageStatus>;
  review: IncidentReport | null;
  error: string | null;
  isComplete: boolean;
  progressPct: number;
  elapsedSeconds: number;
}

const EMPTY_STATE: ProcessingState = {
  stages: new Map(),
  review: null,
  error: null,
  isComplete: false,
  progressPct: 0,
  elapsedSeconds: 0,
};

// Local-mode pipeline: stages run in the same shape the backend emits.
// The four extraction stages overlap (matching asyncio.gather) and the
// four sequential stages run back-to-back. Per-stage durations are tuned
// so the on-screen sub-agent reveals (reconciliation chain, drafting
// waves) have time to play before the parent stage snaps to complete.
const LOCAL_PARALLEL_STAGES: PipelineStage[] = [
  'cad_parsing',
  'pcr_parsing',
  'video_analysis',
  'audio_analysis',
];
const LOCAL_SEQUENTIAL_STAGES: PipelineStage[] = [
  'reconciliation',
  'protocol_check',
  'findings',
  'drafting',
];

const LOCAL_DURATION_MS: Record<string, number> = {
  cad_parsing: 1500,
  pcr_parsing: 2400,
  video_analysis: 3200,
  audio_analysis: 2800,
  reconciliation: 10000, // 4 sub-agents × ~2s + buffer
  protocol_check: 1800,
  findings: 2400,
  drafting: 7000, // wave1 (3s) + gate (~1s) + wave2 (~2s) + buffer
};

export function useProcessingStream(
  caseId: string | undefined,
  options: { demo?: boolean } = {},
): ProcessingState {
  const demo = !!options.demo;
  const [stages, setStages] = useState<Map<PipelineStage, StageStatus>>(new Map());
  const [review, setReview] = useState<IncidentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startTsRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!caseId) return;

    setStages(new Map());
    setReview(null);
    setError(null);
    setIsComplete(false);
    setElapsedSeconds(0);
    startTsRef.current = null;

    let aborted = false;

    const stopTicker = () => {
      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };

    const startTicker = () => {
      if (tickerRef.current !== null) return;
      tickerRef.current = window.setInterval(() => {
        if (startTsRef.current !== null) {
          setElapsedSeconds(Math.floor((Date.now() - startTsRef.current) / 1000));
        }
      }, 1000);
    };

    // Local mode: synthesize the pipeline progression from a deterministic
    // schedule, no backend involved. Avoids the EventSource entirely.
    if (getDataSource().mode === 'local') {
      startTsRef.current = Date.now();
      startTicker();

      const timeouts: number[] = [];

      const scheduleRunning = (stage: PipelineStage, at: number) => {
        timeouts.push(
          window.setTimeout(() => {
            if (aborted) return;
            setStages((prev) => {
              const next = new Map(prev);
              next.set(stage, {
                status: 'running',
                startedAt: new Date().toISOString(),
              });
              return next;
            });
          }, at),
        );
      };

      const scheduleComplete = (stage: PipelineStage, at: number) => {
        timeouts.push(
          window.setTimeout(() => {
            if (aborted) return;
            setStages((prev) => {
              const next = new Map(prev);
              const existing = next.get(stage);
              next.set(stage, {
                status: 'complete',
                startedAt: existing?.startedAt,
                completedAt: new Date().toISOString(),
              });
              return next;
            });
          }, at),
        );
      };

      // Parallel block — all four start at t=0 and finish independently.
      LOCAL_PARALLEL_STAGES.forEach((stage) => {
        const dur = LOCAL_DURATION_MS[stage] ?? 2000;
        scheduleRunning(stage, 0);
        scheduleComplete(stage, dur);
      });

      const parallelEnd = Math.max(
        ...LOCAL_PARALLEL_STAGES.map((s) => LOCAL_DURATION_MS[s] ?? 2000),
      );

      // Sequential block — runs strictly after the parallel block resolves.
      let cursor = parallelEnd;
      LOCAL_SEQUENTIAL_STAGES.forEach((stage) => {
        const dur = LOCAL_DURATION_MS[stage] ?? 2000;
        scheduleRunning(stage, cursor);
        scheduleComplete(stage, cursor + dur);
        cursor += dur;
      });

      // Synthesize the review once everything has completed.
      timeouts.push(
        window.setTimeout(() => {
          if (aborted) return;
          setReview(buildMockReport(caseId));
          setIsComplete(true);
          stopTicker();
        }, cursor + 300),
      );

      return () => {
        aborted = true;
        timeouts.forEach((t) => window.clearTimeout(t));
        stopTicker();
      };
    }

    // Remote mode (live backend or backend-served demo replay).
    let evtSrc: EventSource | null = null;

    const cleanup = () => {
      aborted = true;
      if (evtSrc) evtSrc.close();
      stopTicker();
    };

    const closeStream = () => {
      stopTicker();
      if (evtSrc) {
        evtSrc.close();
        evtSrc = null;
      }
    };

    const open = () => {
      const url = `${API_BASE}/api/cases/${caseId}/stream${demo ? '?demo=1' : ''}`;
      evtSrc = new EventSource(url);

      evtSrc.addEventListener('progress', (ev) => {
        try {
          const p = JSON.parse((ev as MessageEvent).data) as PipelineProgress;
          setStages((prev) => {
            const next = new Map(prev);
            const existing = next.get(p.stage);
            next.set(p.stage, {
              status: p.status,
              startedAt: p.started_at ?? existing?.startedAt,
              completedAt: p.completed_at ?? existing?.completedAt,
              errorMessage: p.error_message ?? existing?.errorMessage,
            });
            return next;
          });
          if (p.status === 'running' && startTsRef.current === null) {
            startTsRef.current = Date.now();
            startTicker();
          }
        } catch {
          // ignore malformed progress payloads
        }
      });

      evtSrc.addEventListener('complete', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { review: QICaseReview };
          setReview(adaptReview(data.review));
          setIsComplete(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to parse completed review');
        } finally {
          closeStream();
        }
      });

      evtSrc.addEventListener('error', (ev) => {
        const me = ev as MessageEvent;
        if (me.data) {
          try {
            const data = JSON.parse(me.data) as { message?: string };
            setError(data.message ?? 'Pipeline error');
          } catch {
            setError('Pipeline error');
          }
        } else if (evtSrc?.readyState === EventSource.CLOSED) {
          setError('Connection lost');
        }
        closeStream();
      });
    };

    (async () => {
      if (!demo) {
        try {
          const res = await fetch(`${API_BASE}/api/cases/${caseId}/process`, {
            method: 'POST',
          });
          if (!res.ok) throw new Error(`Failed to start pipeline (${res.status})`);
        } catch (err) {
          if (!aborted) {
            setError(err instanceof Error ? err.message : 'Failed to start pipeline');
          }
          return;
        }
      }
      if (aborted) return;
      open();
    })();

    return cleanup;
  }, [caseId, demo]);

  const sawCad = stages.has('cad_parsing');
  const total = demo && !sawCad ? 7 : 8;
  const completed = Array.from(stages.values()).filter((s) => s.status === 'complete').length;
  const progressPct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;

  if (!caseId) return EMPTY_STATE;

  return {
    stages,
    review,
    error,
    isComplete,
    progressPct,
    elapsedSeconds,
  };
}
