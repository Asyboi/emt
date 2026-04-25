import { useState } from "react";

import { FindingCard } from "@/components/FindingCard";
import { ReviewSkeleton } from "@/components/Skeleton";
import { formatPercent, formatTimestamp } from "@/lib/format";
import type {
  ClinicalAssessmentItem,
  Finding,
  ProtocolCheckStatus,
  QICaseReview,
  Recommendation,
  RecommendationPriority,
  ReviewerDetermination,
  UtsteinData,
} from "@/types/schemas";

interface ReviewPaneProps {
  review: QICaseReview | null;
  loading?: boolean;
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
  onSeekToTimestamp?: (seconds: number) => void;
  reviewerNotes: string;
  onReviewerNotesChange: (value: string) => void;
  humanReviewed: boolean;
  onToggleHumanReviewed: () => void;
}

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  concern: 1,
  info: 2,
};

const DETERMINATION_LABEL: Record<ReviewerDetermination, string> = {
  no_issues: "No issues",
  documentation_concern: "Documentation concern",
  performance_concern: "Performance concern",
  significant_concern: "Significant concern",
  critical_event: "Critical event",
};

const DETERMINATION_BG: Record<ReviewerDetermination, string> = {
  no_issues: "bg-green-100 border-green-300 text-green-900",
  documentation_concern: "bg-blue-100 border-blue-300 text-blue-900",
  performance_concern: "bg-amber-100 border-amber-300 text-amber-900",
  significant_concern: "bg-orange-100 border-orange-300 text-orange-900",
  critical_event: "bg-red-100 border-red-300 text-red-900",
};

const PROTOCOL_BADGE: Record<ProtocolCheckStatus, string> = {
  adherent: "bg-green-50 text-green-700 border-green-200",
  deviation: "bg-red-50 text-red-700 border-red-200",
  not_applicable: "bg-gray-100 text-gray-600 border-gray-200",
  insufficient_evidence: "bg-amber-50 text-amber-700 border-amber-200",
};

const ASSESSMENT_BADGE: Record<ClinicalAssessmentItem["status"], string> = {
  met: "bg-green-50 text-green-700 border-green-200",
  not_met: "bg-red-50 text-red-700 border-red-200",
  not_applicable: "bg-gray-100 text-gray-600 border-gray-200",
  insufficient_documentation: "bg-amber-50 text-amber-700 border-amber-200",
};

const RECOMMENDATION_BADGE: Record<RecommendationPriority, string> = {
  required: "bg-red-50 text-red-700 border-red-200",
  suggested: "bg-amber-50 text-amber-700 border-amber-200",
  informational: "bg-blue-50 text-blue-700 border-blue-200",
};

function titleCase(s: string): string {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatSeconds(value: number | null): string {
  if (value == null) return "—";
  return formatTimestamp(value);
}

function formatBool(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
      >
        <h3 className="text-sm font-semibold text-gray-900">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs text-gray-500 font-normal">({count})</span>
          )}
        </h3>
        <span className="text-xs text-gray-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-gray-200 p-4">{children}</div>}
    </section>
  );
}

function DeterminationBanner({
  determination,
  rationale,
}: {
  determination: ReviewerDetermination;
  rationale: string;
}) {
  return (
    <div className={`rounded border px-4 py-3 ${DETERMINATION_BG[determination]}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">Determination</div>
      <div className="text-base font-semibold mt-0.5">
        {DETERMINATION_LABEL[determination]}
      </div>
      <div className="text-sm mt-2 leading-snug whitespace-pre-line">{rationale}</div>
    </div>
  );
}

function CaseHeader({ review }: { review: QICaseReview }) {
  const incidentDate = review.incident_date.replace("T", " ").replace(/\.\d+/, "").replace(/Z$/, " UTC");
  return (
    <CollapsibleSection title="Case Header" defaultOpen>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Case ID</dt>
        <dd className="font-mono text-gray-900">{review.case_id}</dd>
        <dt className="text-gray-500">Incident type</dt>
        <dd>{titleCase(review.incident_type)}</dd>
        <dt className="text-gray-500">Incident date</dt>
        <dd className="font-mono text-xs">{incidentDate}</dd>
        <dt className="text-gray-500">Responding unit</dt>
        <dd>{review.responding_unit}</dd>
        <dt className="text-gray-500">Patient</dt>
        <dd>
          {review.patient_age_range}, {review.patient_sex.toUpperCase()}
        </dd>
        <dt className="text-gray-500">Chief complaint</dt>
        <dd>{review.chief_complaint}</dd>
      </dl>
      {review.crew_members.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="text-xs uppercase text-gray-500 tracking-wide mb-1">Crew</div>
          <ul className="text-sm space-y-0.5">
            {review.crew_members.map((c) => (
              <li key={c.identifier}>
                <span className="font-mono text-xs text-gray-600 mr-2">{c.identifier}</span>
                {titleCase(c.role)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  );
}

function UtsteinDataCard({ data }: { data: UtsteinData }) {
  return (
    <CollapsibleSection title="Utstein Data" defaultOpen>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Witnessed</dt>
        <dd>{formatBool(data.witnessed)}</dd>
        <dt className="text-gray-500">Bystander CPR</dt>
        <dd>{formatBool(data.bystander_cpr)}</dd>
        <dt className="text-gray-500">Initial rhythm</dt>
        <dd>{data.initial_rhythm ? data.initial_rhythm.toUpperCase() : "—"}</dd>
        <dt className="text-gray-500">Time to CPR</dt>
        <dd className="font-mono">{formatSeconds(data.time_to_cpr_seconds)}</dd>
        <dt className="text-gray-500">Time to defib</dt>
        <dd className="font-mono">{formatSeconds(data.time_to_first_defib_seconds)}</dd>
        <dt className="text-gray-500">ROSC achieved</dt>
        <dd>{formatBool(data.rosc_achieved)}</dd>
        <dt className="text-gray-500">Time to ROSC</dt>
        <dd className="font-mono">{formatSeconds(data.time_to_rosc_seconds)}</dd>
        <dt className="text-gray-500">Disposition</dt>
        <dd>{data.disposition ? titleCase(data.disposition) : "—"}</dd>
      </dl>
    </CollapsibleSection>
  );
}

function ClinicalAssessmentSection({
  items,
  onSeek,
  review,
}: {
  items: ClinicalAssessmentItem[];
  onSeek?: (seconds: number) => void;
  review: QICaseReview;
}) {
  // Group by category, expand by default if any NOT_MET in the category.
  const byCategory = new Map<string, ClinicalAssessmentItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  const eventTimestamp = (eventId: string): number | null => {
    for (const entry of review.timeline) {
      for (const ev of entry.source_events) {
        if (ev.event_id === eventId) return ev.timestamp_seconds;
      }
    }
    return null;
  };

  const handleClick = (item: ClinicalAssessmentItem) => {
    if (!onSeek || item.evidence_event_ids.length === 0) return;
    const ts = eventTimestamp(item.evidence_event_ids[0]);
    if (ts != null) onSeek(ts);
  };

  return (
    <CollapsibleSection title="Clinical Assessment" count={items.length} defaultOpen>
      <div className="space-y-3">
        {Array.from(byCategory.entries()).map(([category, catItems]) => (
          <div key={category}>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              {titleCase(category)}
            </div>
            <ul className="space-y-1.5">
              {catItems.map((item) => {
                const clickable = onSeek && item.evidence_event_ids.length > 0;
                return (
                  <li
                    key={item.item_id}
                    onClick={() => handleClick(item)}
                    className={`rounded border border-gray-200 bg-gray-50 p-2 ${
                      clickable ? "cursor-pointer hover:bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm text-gray-900 leading-snug flex-1">
                        {item.benchmark}
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${ASSESSMENT_BADGE[item.status]}`}
                      >
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-600 mt-1 leading-snug">
                        {item.notes}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function DocumentationQualitySection({
  data,
}: {
  data: QICaseReview["documentation_quality"];
}) {
  const bar = (label: string, value: number) => (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-700">{label}</span>
        <span className="font-mono">{formatPercent(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full ${
            value >= 0.8 ? "bg-green-500" : value >= 0.6 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  );
  return (
    <CollapsibleSection title="Documentation Quality" defaultOpen={false}>
      <div className="space-y-2">
        {bar("Completeness", data.completeness_score)}
        {bar("Accuracy", data.accuracy_score)}
        {bar("Narrative quality", data.narrative_quality_score)}
      </div>
      {data.issues.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-2">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Issues</div>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
            {data.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  );
}

function RecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
  const grouped = new Map<string, Recommendation[]>();
  for (const r of recommendations) {
    if (!grouped.has(r.audience)) grouped.set(r.audience, []);
    grouped.get(r.audience)!.push(r);
  }
  return (
    <CollapsibleSection title="Recommendations" count={recommendations.length} defaultOpen>
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([audience, recs]) => (
          <div key={audience}>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              {titleCase(audience)}
            </div>
            <ul className="space-y-1.5">
              {recs.map((rec) => (
                <li
                  key={rec.recommendation_id}
                  className="rounded border border-gray-200 bg-gray-50 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-gray-900 leading-snug flex-1">
                      {rec.description}
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${RECOMMENDATION_BADGE[rec.priority]}`}
                    >
                      {rec.priority}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

export function ReviewPane({
  review,
  loading,
  selectedFindingId,
  onSelectFinding,
  onSeekToTimestamp,
  reviewerNotes,
  onReviewerNotesChange,
  humanReviewed,
  onToggleHumanReviewed,
}: ReviewPaneProps) {
  if (loading && !review) {
    return <ReviewSkeleton />;
  }

  if (!review) {
    return (
      <div className="flex flex-col h-full p-4 items-center justify-center text-gray-400 text-sm">
        No QI Case Review loaded yet. Click <span className="font-mono px-1">Process Case</span> to generate one.
      </div>
    );
  }

  const sortedFindings = [...review.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">QI Case Review</h2>
          <span className="text-xs text-gray-500 font-mono">{review.case_id}</span>
        </header>

        <DeterminationBanner
          determination={review.determination}
          rationale={review.determination_rationale}
        />

        <CaseHeader review={review} />

        <CollapsibleSection title="Incident Summary" defaultOpen>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {review.incident_summary}
          </div>
        </CollapsibleSection>

        {review.utstein_data && <UtsteinDataCard data={review.utstein_data} />}

        <CollapsibleSection title="Findings" count={review.findings.length} defaultOpen>
          {sortedFindings.length === 0 ? (
            <div className="text-sm text-gray-500">No findings.</div>
          ) : (
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
          )}
        </CollapsibleSection>

        <ClinicalAssessmentSection
          items={review.clinical_assessment}
          onSeek={onSeekToTimestamp}
          review={review}
        />

        <DocumentationQualitySection data={review.documentation_quality} />

        <CollapsibleSection
          title="Protocol Checks"
          count={review.protocol_checks.length}
          defaultOpen={false}
        >
          <div className="text-xs text-gray-600 mb-2">
            Adherence: <span className="font-mono">{formatPercent(review.adherence_score)}</span>
          </div>
          <div className="space-y-2">
            {review.protocol_checks.map((check) => (
              <div
                key={check.check_id}
                className="rounded border border-gray-200 p-2 bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-sm text-gray-900">
                    {check.protocol_step.description}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${PROTOCOL_BADGE[check.status]}`}
                  >
                    {check.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs text-gray-600 leading-snug">
                  {check.explanation}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <RecommendationsSection recommendations={review.recommendations} />

        <section className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Reviewer Notes</h3>
          <textarea
            value={reviewerNotes}
            onChange={(e) => onReviewerNotesChange(e.target.value)}
            placeholder="Add reviewer notes..."
            className="w-full h-24 text-sm border border-gray-300 rounded p-2 resize-y"
          />
          <button
            type="button"
            onClick={onToggleHumanReviewed}
            className={`mt-2 px-3 py-1.5 text-sm rounded border ${
              humanReviewed
                ? "bg-green-600 text-white border-green-700"
                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {humanReviewed ? "✓ Signed off" : "Sign off"}
          </button>
        </section>
      </div>
    </div>
  );
}
