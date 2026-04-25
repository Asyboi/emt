import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { Finding } from "@/types/schemas";

interface TimelineMarkerProps {
  finding: Finding;
  durationSeconds: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const SEVERITY_BG: Record<Finding["severity"], string> = {
  critical: "bg-red-500 hover:bg-red-600",
  concern: "bg-amber-500 hover:bg-amber-600",
  info: "bg-blue-500 hover:bg-blue-600",
};

export function TimelineMarker({
  finding,
  durationSeconds,
  isSelected,
  onSelect,
}: TimelineMarkerProps) {
  if (durationSeconds <= 0) return null;
  const ratio = Math.min(
    1,
    Math.max(0, finding.evidence_timestamp_seconds / durationSeconds),
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(finding.finding_id)}
      title={`${formatTimestamp(finding.evidence_timestamp_seconds)} — ${finding.title}`}
      className={cn(
        "absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-sm transition-all",
        SEVERITY_BG[finding.severity],
        isSelected && "ring-2 ring-blue-500 ring-offset-1 scale-110",
      )}
      style={{ left: `${ratio * 100}%` }}
      aria-label={`Jump to ${finding.title}`}
    />
  );
}
