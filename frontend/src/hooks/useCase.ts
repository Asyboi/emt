import { useEffect, useState } from "react";

import { getAAR, getCase } from "@/lib/api";
import { demoCases, loadDemoAAR } from "@/lib/demo";
import type { AARDraft, Case } from "@/types/schemas";

export interface UseCaseResult {
  caseData: Case | null;
  aar: AARDraft | null;
  loading: boolean;
  error: string | null;
  setAAR: (aar: AARDraft | null) => void;
  reload: () => void;
}

export function useCase(caseId: string | null, demoMode: boolean): UseCaseResult {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [aar, setAAR] = useState<AARDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!caseId) {
      setCaseData(null);
      setAAR(null);
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
          setAAR(null);
          setLoading(false);
          return;
        }
      }

      try {
        const a = await getAAR(caseId);
        if (cancelled) return;
        setAAR(a);
      } catch {
        if (cancelled) return;
        if (demoMode) {
          try {
            const fallback = await loadDemoAAR();
            if (!cancelled) setAAR(fallback);
          } catch {
            if (!cancelled) setAAR(null);
          }
        } else {
          setAAR(null);
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
    aar,
    loading,
    error,
    setAAR,
    reload: () => setReloadToken((t) => t + 1),
  };
}
