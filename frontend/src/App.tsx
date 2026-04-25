import { Activity } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CaseSelector } from "@/components/CaseSelector";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PCRPane } from "@/components/PCRPane";
import { PipelineProgressBar } from "@/components/PipelineProgress";
import { ReviewPane } from "@/components/ReviewPane";
import { VideoPane } from "@/components/VideoPane";
import { useCase } from "@/hooks/useCase";
import { usePCR } from "@/hooks/usePCR";
import { usePipelineStream } from "@/hooks/usePipelineStream";
import { deleteReview, getCases, getVideoUrl } from "@/lib/api";
import { demoCases, isDemoMode } from "@/lib/demo";
import type { Case, QICaseReview } from "@/types/schemas";

export default function App() {
  const [demoMode] = useState(isDemoMode);
  const [cases, setCases] = useState<Case[]>([]);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const [seekTarget, setSeekTarget] = useState<{ ts: number; nonce: number } | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [humanReviewed, setHumanReviewed] = useState(false);
  const progressHideTimer = useRef<number | null>(null);

  const { review, loading: reviewLoading, error: caseError, setReview, reload: reloadCase } =
    useCase(selectedCaseId, demoMode);
  const { content: pcrContent, loading: pcrLoading } = usePCR(selectedCaseId, demoMode);

  const handleStreamComplete = useCallback(
    (next: QICaseReview) => {
      setReview(next);
      if (progressHideTimer.current) window.clearTimeout(progressHideTimer.current);
      progressHideTimer.current = window.setTimeout(() => setProgressVisible(false), 1500);
    },
    [setReview],
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
    setSeekTarget(null);
    reset();
    setProgressVisible(false);
  }, [selectedCaseId, reset]);

  // Reset reviewer notes when the loaded review changes.
  useEffect(() => {
    setReviewerNotes(review?.reviewer_notes ?? "");
    setHumanReviewed(review?.human_reviewed ?? false);
  }, [review?.case_id, review?.generated_at]);

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
        await deleteReview(selectedCaseId);
      } catch {
        // ignore — proceed with re-run regardless
      }
      setReview(null);
      reloadCase();
    }
    setProgressVisible(true);
    start(selectedCaseId, { demo: demoMode });
  }, [selectedCaseId, demoMode, setReview, reloadCase, start]);

  const handleSeekToTimestamp = useCallback((seconds: number) => {
    setSeekTarget({ ts: seconds, nonce: Date.now() });
  }, []);

  const selectedFinding = useMemo(
    () => review?.findings.find((f) => f.finding_id === selectedFindingId) ?? null,
    [review, selectedFindingId],
  );

  const videoUrl = selectedCaseId ? getVideoUrl(selectedCaseId) : null;
  const visibleError = casesError ?? caseError ?? streamError;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="h-14 flex-shrink-0 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Sentinel</span>
          <span className="text-xs text-gray-500 ml-1">EMS QI Case Review</span>
        </div>
        <CaseSelector
          cases={cases}
          selectedId={selectedCaseId}
          onSelect={setSelectedCaseId}
          onProcess={handleProcess}
          onReset={handleReset}
          isProcessing={isStreaming}
          demoMode={demoMode}
          hasCachedReview={review !== null}
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
            findings={review?.findings ?? []}
            selectedFindingId={selectedFindingId}
            onSelectFinding={setSelectedFindingId}
            seekTarget={seekTarget}
          />
        </section>
        <section className="min-h-0 overflow-hidden">
          <ErrorBoundary label="Review pane">
            <ReviewPane
              review={review}
              loading={reviewLoading || casesLoading}
              selectedFindingId={selectedFindingId}
              onSelectFinding={setSelectedFindingId}
              onSeekToTimestamp={handleSeekToTimestamp}
              reviewerNotes={reviewerNotes}
              onReviewerNotesChange={setReviewerNotes}
              humanReviewed={humanReviewed}
              onToggleHumanReviewed={() => setHumanReviewed((v) => !v)}
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
