import { Loader2, Play, RotateCcw } from "lucide-react";

import { cn } from "@/lib/cn";
import type { Case } from "@/types/schemas";

interface CaseSelectorProps {
  cases: Case[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onProcess: () => void;
  onReset: () => void;
  isProcessing: boolean;
  demoMode: boolean;
  hasCachedReview: boolean;
}

export function CaseSelector({
  cases,
  selectedId,
  onSelect,
  onProcess,
  onReset,
  isProcessing,
  demoMode,
  hasCachedReview,
}: CaseSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {demoMode && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium"
          title="Pipeline replays cached review with synthetic timing"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
          Demo Mode
        </span>
      )}
      <select
        className={cn(
          "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        )}
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={cases.length === 0}
      >
        {cases.length === 0 && <option value="">No cases</option>}
        {cases.map((c) => (
          <option key={c.case_id} value={c.case_id}>
            {c.case_id} — {c.incident_type}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onReset}
        disabled={isProcessing || !selectedId || (!hasCachedReview && !demoMode)}
        title="Clear cached review and re-run live"
        className={cn(
          "h-9 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700",
          "hover:bg-gray-50 hover:border-gray-400 transition-colors",
          "disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed",
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>
      <button
        type="button"
        onClick={onProcess}
        disabled={isProcessing || !selectedId}
        className={cn(
          "h-9 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white",
          "hover:bg-blue-700 transition-colors shadow-sm",
          "disabled:bg-gray-300 disabled:cursor-not-allowed",
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            {demoMode ? "Replay Pipeline" : "Process Case"}
          </>
        )}
      </button>
    </div>
  );
}
