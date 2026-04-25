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
