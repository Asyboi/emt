import { AlertTriangle, ChevronRight, Info, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { Finding, FindingSeverity } from "@/types/schemas";

interface FindingCardProps {
  finding: Finding;
  isSelected: boolean;
  onClick: () => void;
}

const SEVERITY_STYLES: Record<
  FindingSeverity,
  {
    badge: string;
    icon: typeof AlertTriangle;
    iconColor: string;
    accent: string;
    selectedBorder: string;
    selectedRing: string;
  }
> = {
  critical: {
    badge: "bg-red-100 text-red-800 border-red-300",
    icon: ShieldAlert,
    iconColor: "text-red-500",
    accent: "before:bg-red-500",
    selectedBorder: "border-red-300",
    selectedRing: "ring-red-400/70",
  },
  concern: {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    accent: "before:bg-amber-400",
    selectedBorder: "border-amber-300",
    selectedRing: "ring-amber-400/70",
  },
  info: {
    badge: "bg-sky-100 text-sky-800 border-sky-300",
    icon: Info,
    iconColor: "text-sky-500",
    accent: "before:bg-sky-400",
    selectedBorder: "border-sky-300",
    selectedRing: "ring-sky-400/70",
  },
};

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function FindingCard({ finding, isSelected, onClick }: FindingCardProps) {
  const styles = SEVERITY_STYLES[finding.severity];
  const Icon = styles.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "group w-full text-left rounded-lg border bg-white p-3 pl-4",
        "relative overflow-hidden",
        // Severity accent rail on the left edge.
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
        styles.accent,
        // Smooth interaction feel.
        "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500",
        isSelected
          ? cn(
              "ring-2 ring-offset-1 shadow-md animate-finding-pulse",
              styles.selectedRing,
              styles.selectedBorder,
            )
          : "border-gray-200",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "h-4 w-4 mt-0.5 flex-shrink-0 transition-transform duration-200",
            styles.iconColor,
            "group-hover:scale-110",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded border",
                styles.badge,
              )}
            >
              {finding.severity}
            </span>
            <span className="text-xs text-gray-600 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
              {formatCategory(finding.category)}
            </span>
          </div>
          <div className="font-semibold text-sm text-gray-900 leading-snug mb-1">
            {finding.title}
          </div>
          <div className="text-sm text-gray-600 leading-snug line-clamp-2">
            {finding.explanation}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span className="font-mono">
              {formatTimestamp(finding.evidence_timestamp_seconds)}
            </span>
            <span className="flex items-center gap-1 text-blue-600 font-medium opacity-80 group-hover:opacity-100 transition-opacity">
              View evidence
              <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
