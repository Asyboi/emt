import { useState } from 'react';
import type {
  Recommendation,
  RecommendationAudience,
  RecommendationPriority,
} from '../../../types/backend';
import { EmptyState, FONT_MONO, humanize, Pill } from './shared';

interface Props {
  recs: Recommendation[];
}

const AUDIENCE_ORDER: RecommendationAudience[] = ['crew', 'agency', 'follow_up'];

function priorityTone(
  p: RecommendationPriority,
): 'critical' | 'concern' | 'muted' {
  switch (p) {
    case 'required':
      return 'critical';
    case 'suggested':
      return 'concern';
    case 'informational':
      return 'muted';
  }
}

// Tabs by audience (Crew / Agency / Follow-up). Within each tab, items
// sorted by priority (required → suggested → informational).
export function RecommendationsView({ recs }: Props) {
  const groups = AUDIENCE_ORDER.map((aud) => ({
    audience: aud,
    items: recs.filter((r) => r.audience === aud),
  })).filter((g) => g.items.length > 0);

  const [active, setActive] = useState<RecommendationAudience>(
    groups[0]?.audience ?? 'crew',
  );

  if (recs.length === 0) return <EmptyState>No recommendations.</EmptyState>;

  const PRIORITY_RANK: Record<RecommendationPriority, number> = {
    required: 0,
    suggested: 1,
    informational: 2,
  };

  const activeGroup = groups.find((g) => g.audience === active) ?? groups[0];
  const sortedItems = [...activeGroup.items].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-1 border-b border-border">
        {groups.map((g) => {
          const selected = g.audience === active;
          return (
            <button
              key={g.audience}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(g.audience)}
              className={`px-3 py-2 text-[11px] tracking-[0.12em] uppercase transition-colors relative ${
                selected
                  ? 'text-foreground'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
              style={{ fontFamily: FONT_MONO }}
            >
              {humanize(g.audience)} ({g.items.length})
              {selected && (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-0 right-0 h-px bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      <ul className="space-y-2">
        {sortedItems.map((r) => (
          <li
            key={r.recommendation_id}
            className="border border-border bg-background p-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Pill tone={priorityTone(r.priority)}>{humanize(r.priority)}</Pill>
              {r.related_finding_ids.length > 0 && (
                <span
                  className="text-[10px] tracking-[0.08em] uppercase text-foreground-secondary"
                  style={{ fontFamily: FONT_MONO }}
                >
                  Linked to {r.related_finding_ids.length} finding
                  {r.related_finding_ids.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-foreground">
              {r.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
