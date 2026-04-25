import { ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { FindingCard } from "@/components/FindingCard";
import { AARSkeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import type {
  AARDraft,
  Finding,
  ProtocolCheck,
  ProtocolCheckStatus,
} from "@/types/schemas";

interface AARPaneProps {
  aar: AARDraft | null;
  loading?: boolean;
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
}

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  concern: 1,
  info: 2,
};

const PROTOCOL_BADGE: Record<ProtocolCheckStatus, string> = {
  adherent: "bg-green-50 text-green-700 border-green-200",
  deviation: "bg-red-50 text-red-700 border-red-200",
  not_applicable: "bg-gray-100 text-gray-600 border-gray-200",
  insufficient_evidence: "bg-amber-50 text-amber-700 border-amber-200",
};

export function AARPane({ aar, loading, selectedFindingId, onSelectFinding }: AARPaneProps) {
  const [protocolsOpen, setProtocolsOpen] = useState(false);

  if (loading && !aar) {
    return <AARSkeleton />;
  }

  if (!aar) {
    return (
      <div className="flex flex-col h-full p-4 items-center justify-center text-gray-400 text-sm">
        <ClipboardCheck className="h-8 w-8 mb-2" />
        No AAR loaded yet. Click <span className="font-mono px-1">Process Case</span> to generate one.
      </div>
    );
  }

  const sortedFindings = [...aar.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const adherencePct = formatPercent(aar.adherence_score);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            After-Action Report
          </h2>
          <span className="text-xs text-gray-500 font-mono">{aar.case_id}</span>
        </header>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Summary</h3>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {aar.summary}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              ACLS Adherence
            </h3>
            <span className="text-sm font-mono font-semibold text-gray-900">
              {adherencePct}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                aar.adherence_score >= 0.85
                  ? "bg-green-500"
                  : aar.adherence_score >= 0.6
                    ? "bg-amber-500"
                    : "bg-red-500",
              )}
              style={{ width: adherencePct }}
            />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Findings ({aar.findings.length})
          </h3>
          <div className="space-y-2">
            {sortedFindings.map((finding) => (
              <FindingCard
                key={finding.finding_id}
                finding={finding}
                isSelected={finding.finding_id === selectedFindingId}
                onClick={() => onSelectFinding(finding.finding_id)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Narrative</h3>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{aar.narrative}</ReactMarkdown>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setProtocolsOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              Protocol Checks ({aar.protocol_checks.length})
            </h3>
            {protocolsOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
          {protocolsOpen && (
            <div className="border-t border-gray-200 p-4 space-y-3">
              {aar.protocol_checks.map((check: ProtocolCheck) => (
                <div
                  key={check.check_id}
                  className="rounded border border-gray-200 p-3 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-medium text-gray-900">
                      {check.protocol_step.description}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded border whitespace-nowrap",
                        PROTOCOL_BADGE[check.status],
                      )}
                    >
                      {check.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 leading-snug">
                    {check.explanation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
