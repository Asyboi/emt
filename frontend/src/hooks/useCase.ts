import { useEffect, useState } from "react";

import { getCase, getReview } from "@/lib/api";
import { demoCases, loadDemoReview } from "@/lib/demo";
import type { Case, QICaseReview } from "@/types/schemas";

export interface UseCaseResult {
  caseData: Case | null;
  review: QICaseReview | null;
  loading: boolean;
  error: string | null;
  setReview: (review: QICaseReview | null) => void;
  reload: () => void;
}

export function useCase(caseId: string | null, demoMode: boolean): UseCaseResult {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [review, setReview] = useState<QICaseReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!caseId) {
      setCaseData(null);
      setReview(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const c = await getCase(caseId);
        if (cancelled) return;
        setCaseData(c);
      } catch (err) {
        if (cancelled) return;
        if (demoMode) {
          // Backend may be offline — synthesize a case stub so the UI still loads.
          const fallback = demoCases().find((c) => c.case_id === caseId) ?? demoCases()[0];
          setCaseData(fallback);
        } else {
          setError((err as Error).message);
          setCaseData(null);
          setReview(null);
          setLoading(false);
          return;
        }
      }

      try {
        const r = await getReview(caseId);
        if (cancelled) return;
        setReview(r);
      } catch {
        if (cancelled) return;
        if (demoMode) {
          try {
            const fallback = await loadDemoReview();
            if (!cancelled) setReview(fallback);
          } catch {
            if (!cancelled) setReview(null);
          }
        } else {
          setReview(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [caseId, demoMode, reloadToken]);

  return {
    caseData,
    review,
    loading,
    error,
    setReview,
    reload: () => setReloadToken((t) => t + 1),
  };
}
