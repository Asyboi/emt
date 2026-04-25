import { Activity } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AARPane } from "@/components/AARPane";
import { CaseSelector } from "@/components/CaseSelector";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PCRPane } from "@/components/PCRPane";
import { PipelineProgressBar } from "@/components/PipelineProgress";
import { VideoPane } from "@/components/VideoPane";
import { useCase } from "@/hooks/useCase";
import { usePCR } from "@/hooks/usePCR";
import { usePipelineStream } from "@/hooks/usePipelineStream";
import { deleteAAR, getCases, getVideoUrl } from "@/lib/api";
import { demoCases, isDemoMode } from "@/lib/demo";
import type { AARDraft, Case } from "@/types/schemas";

export default function App() {
  const [demoMode] = useState(isDemoMode);
  const [cases, setCases] = useState<Case[]>([]);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const progressHideTimer = useRef<number | null>(null);

  const { aar, loading: aarLoading, error: caseError, setAAR, reload: reloadCase } =
    useCase(selectedCaseId, demoMode);
  const { content: pcrContent, loading: pcrLoading } = usePCR(selectedCaseId, demoMode);

  const handleStreamComplete = useCallback(
    (next: AARDraft) => {
      setAAR(next);
      if (progressHideTimer.current) window.clearTimeout(progressHideTimer.current);
      // Keep progress bar visible briefly so users see the green ticks.
      progressHideTimer.current = window.setTimeout(() => setProgressVisible(false), 1500);
    },
    [setAAR],
  );

  const { stages, isStreaming, error: streamError, start, reset } = usePipelineStream(
    handleStreamComplete,
  );

  useEffect(() => {
    let cancelled = false;
    setCasesLoading(true);
    (async () => {
      try {
        const list = await getCases();
        if (cancelled) return;
        setCases(list);
        if (list.length > 0) {
          setSelectedCaseId((prev) => prev ?? list[0].case_id);
        }
      } catch (err) {
        if (cancelled) return;
        if (demoMode) {
          const fallback = demoCases();
          setCases(fallback);
          setSelectedCaseId((prev) => prev ?? fallback[0]?.case_id ?? null);
        } else {
          setCasesError((err as Error).message);
        }
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  useEffect(() => {
    setSelectedFindingId(null);
    reset();
    setProgressVisible(false);
  }, [selectedCaseId, reset]);

  useEffect(
    () => () => {
      if (progressHideTimer.current) window.clearTimeout(progressHideTimer.current);
    },
    [],
  );

  const handleProcess = useCallback(() => {
    if (!selectedCaseId) return;
    setProgressVisible(true);
    start(selectedCaseId, { demo: demoMode });
  }, [selectedCaseId, start, demoMode]);

  const handleReset = useCallback(async () => {
    if (!selectedCaseId) return;
    if (!demoMode) {
      try {
        await deleteAAR(selectedCaseId);
      } catch {
        // ignore — proceed with re-run regardless
      }
      setAAR(null);
      reloadCase();
    }
    setProgressVisible(true);
    start(selectedCaseId, { demo: demoMode });
  }, [selectedCaseId, demoMode, setAAR, reloadCase, start]);

  const selectedFinding = useMemo(
    () => aar?.findings.find((f) => f.finding_id === selectedFindingId) ?? null,
    [aar, selectedFindingId],
  );

  const videoUrl = selectedCaseId ? getVideoUrl(selectedCaseId) : null;
  const visibleError = casesError ?? caseError ?? streamError;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="h-14 flex-shrink-0 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Sentinel</span>
          <span className="text-xs text-gray-500 ml-1">
            EMS After-Action Review
          </span>
        </div>
        <CaseSelector
          cases={cases}
          selectedId={selectedCaseId}
          onSelect={setSelectedCaseId}
          onProcess={handleProcess}
          onReset={handleReset}
          isProcessing={isStreaming}
          demoMode={demoMode}
          hasCachedAAR={aar !== null}
        />
      </header>

      {visibleError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {visibleError}
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[33%_34%_33%] min-h-0 divide-x divide-gray-200 bg-white">
        <section className="min-h-0 overflow-hidden">
          <VideoPane
            videoUrl={videoUrl}
            findings={aar?.findings ?? []}
            selectedFindingId={selectedFindingId}
            onSelectFinding={setSelectedFindingId}
          />
        </section>
        <section className="min-h-0 overflow-hidden">
          <ErrorBoundary label="AAR pane">
            <AARPane
              aar={aar}
              loading={aarLoading || casesLoading}
              selectedFindingId={selectedFindingId}
              onSelectFinding={setSelectedFindingId}
            />
          </ErrorBoundary>
        </section>
        <section className="min-h-0 overflow-hidden">
          <ErrorBoundary label="PCR pane">
            <PCRPane
              content={pcrContent}
              loading={pcrLoading}
              highlightExcerpt={selectedFinding?.pcr_excerpt ?? null}
            />
          </ErrorBoundary>
        </section>
      </main>

      <PipelineProgressBar stages={stages} visible={progressVisible && stages.length > 0} />
    </div>
  );
}
