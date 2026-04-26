import { useEffect, useRef, useState } from 'react';
import type {
  PipelineProgress,
  PipelineStage,
  PipelineStatus,
  QICaseReview,
} from '../types/backend';
import type { IncidentReport } from '../types';
import { adaptReview } from './adapters';
import { API_BASE } from './api';

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
    let evtSrc: EventSource | null = null;

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
