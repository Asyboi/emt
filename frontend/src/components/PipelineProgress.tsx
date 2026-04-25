import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatStageName } from "@/lib/format";
import type { PipelineProgress, PipelineStatus } from "@/types/schemas";

interface PipelineProgressProps {
  stages: PipelineProgress[];
  visible: boolean;
}

const STATUS_STYLES: Record<PipelineStatus, { color: string; line: string }> = {
  pending: { color: "text-gray-400", line: "bg-gray-200" },
  running: { color: "text-blue-500", line: "bg-blue-200" },
  complete: { color: "text-green-600", line: "bg-green-500" },
  error: { color: "text-red-600", line: "bg-red-300" },
};

function StatusIcon({ status }: { status: PipelineStatus }) {
  const cls = STATUS_STYLES[status].color;
  if (status === "running") return <Loader2 className={cn("h-5 w-5 animate-spin", cls)} />;
  if (status === "complete") return <CheckCircle2 className={cn("h-5 w-5", cls)} />;
  if (status === "error") return <XCircle className={cn("h-5 w-5", cls)} />;
  return <Circle className={cn("h-5 w-5", cls)} />;
}

export function PipelineProgressBar({ stages, visible }: PipelineProgressProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white shadow-lg transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const lineClass = STATUS_STYLES[stage.status].line;
            return (
              <div key={stage.stage} className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusIcon status={stage.status} />
                  <div className="text-xs">
                    <div className="font-medium text-gray-900 whitespace-nowrap">
                      {formatStageName(stage.stage)}
                    </div>
                    {stage.error_message && (
                      <div className="text-red-600 truncate max-w-[12rem]">
                        {stage.error_message}
                      </div>
                    )}
                  </div>
                </div>
                {!isLast && (
                  <div className={cn("h-0.5 flex-1 rounded-full transition-colors", lineClass)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
