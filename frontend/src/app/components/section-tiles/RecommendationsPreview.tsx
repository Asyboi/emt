import type { Recommendation, RecommendationPriority } from '../../../types/backend';
import { FONT_MONO } from '../section-views/shared';

interface Props {
  recs: Recommendation[];
}

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  required: 0,
  suggested: 1,
  informational: 2,
};

function priorityColor(p: RecommendationPriority): string {
  switch (p) {
    case 'required':
      return '#B33A3A';
    case 'suggested':
      return '#B8732E';
    case 'informational':
      return '#9A9890';
  }
}

export function RecommendationsPreview({ recs }: Props) {
  const required = recs.filter((r) => r.priority === 'required').length;
  const top = [...recs]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-baseline gap-2" style={{ fontFamily: FONT_MONO }}>
        <span className="text-[28px] leading-none tabular-nums text-foreground">
          {recs.length}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-foreground-secondary">
          ITEMS
        </span>
        {required > 0 && (
          <span
            className="text-[10px] uppercase tracking-[0.12em] ml-auto"
            style={{ color: '#B33A3A' }}
          >
            {required} REQUIRED
          </span>
        )}
      </div>
      {top.length === 0 ? (
        <div
          className="text-[11px] text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          NO RECOMMENDATIONS
        </div>
      ) : (
        <ol className="space-y-2 flex-1">
          {top.map((r) => (
            <li
              key={r.recommendation_id}
              className="flex items-start gap-2.5 text-[12px] leading-snug"
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: priorityColor(r.priority) }}
              />
              <span className="text-foreground">{r.description}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
