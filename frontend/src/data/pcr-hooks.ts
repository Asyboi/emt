import { useCallback, useEffect, useRef, useState } from 'react';

import type { PCRDraft } from '../types/backend';
import { getPcrDraft, isPcrGenerating, listSavedPcrs } from './pcr-api';

const POLL_INTERVAL_MS = 2000;

export interface UsePcrDraftResult {
  draft: PCRDraft | null;
  loading: boolean;
  error: Error | null;
  isGenerating: boolean;
  refetch: () => void;
}

export function usePcrDraft(caseId: string | undefined): UsePcrDraftResult {
  const [draft, setDraft] = useState<PCRDraft | null>(null);
  const [loading, setLoading] = useState(Boolean(caseId));
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    if (!caseId) {
      setDraft(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelledRef.current = true;
        clearTimer();
      };
    }

    setLoading(true);
    setError(null);

    const fetchOnce = async () => {
      try {
        const next = await getPcrDraft(caseId);
        if (cancelledRef.current) return;
        setDraft(next);
        setLoading(false);
        if (!isPcrGenerating(next)) clearTimer();
      } catch (err) {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        clearTimer();
      }
    };

    void fetchOnce();
    clearTimer();
    intervalRef.current = setInterval(() => {
      // Only keep polling while we still believe the draft is generating.
      // fetchOnce() will clear the interval as soon as content arrives.
      if (cancelledRef.current) return;
      void fetchOnce();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, [caseId, tick, clearTimer]);

  return {
    draft,
    loading,
    error,
    isGenerating: draft !== null && isPcrGenerating(draft),
    refetch,
  };
}

export interface UseSavedPcrsResult {
  pcrs: PCRDraft[];
  loading: boolean;
  error: Error | null;
}

export function useSavedPcrs(): UseSavedPcrsResult {
  const [pcrs, setPcrs] = useState<PCRDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSavedPcrs()
      .then((list) => {
        if (!cancelled) {
          setPcrs(list);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pcrs, loading, error };
}
