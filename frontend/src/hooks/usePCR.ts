import { useEffect, useState } from "react";

import { getPCR } from "@/lib/api";
import { loadDemoPCR } from "@/lib/demo";

export interface UsePCRResult {
  content: string;
  loading: boolean;
  error: string | null;
}

export function usePCR(caseId: string | null, demoMode: boolean): UsePCRResult {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) {
      setContent("");
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { content: text } = await getPCR(caseId);
        if (cancelled) return;
        setContent(text);
      } catch (err) {
        if (cancelled) return;
        if (demoMode) {
          try {
            const fallback = await loadDemoPCR();
            if (!cancelled) setContent(fallback);
          } catch {
            if (!cancelled) setContent("");
          }
        } else {
          setError((err as Error).message);
          setContent("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [caseId, demoMode]);

  return { content, loading, error };
}
