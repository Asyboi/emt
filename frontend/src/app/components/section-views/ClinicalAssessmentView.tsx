import type { AssessmentStatus, ClinicalAssessmentItem } from '../../../types/backend';
import { EmptyState, FONT_MONO, humanize, Pill } from './shared';

interface Props {
  items: ClinicalAssessmentItem[];
}

function statusTone(
  status: AssessmentStatus,
): 'success' | 'critical' | 'concern' | 'muted' {
  switch (status) {
    case 'met':
      return 'success';
    case 'not_met':
      return 'critical';
    case 'insufficient_documentation':
      return 'concern';
    case 'not_applicable':
      return 'muted';
  }
}

// Card grid grouped by clinical-assessment category. Used for both
// "Key Clinical Decisions" and "Communication / Scene Management".
export function ClinicalAssessmentView({ items }: Props) {
  if (items.length === 0) return <EmptyState>No assessment items recorded.</EmptyState>;

  const byCategory = new Map<string, ClinicalAssessmentItem[]>();
  for (const item of items) {
    const arr = byCategory.get(item.category) ?? [];
    arr.push(item);
    byCategory.set(item.category, arr);
  }

  return (
    <div className="space-y-5">
      {Array.from(byCategory.entries()).map(([category, list]) => (
        <div key={category}>
          <div
            className="text-[11px] tracking-[0.12em] uppercase text-foreground-secondary mb-2"
            style={{ fontFamily: FONT_MONO }}
          >
            {humanize(category)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {list.map((item) => (
              <div
                key={item.item_id}
                className="border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[13px] text-foreground font-medium leading-snug">
                    {item.benchmark}
                  </span>
                  <Pill tone={statusTone(item.status)}>{humanize(item.status)}</Pill>
                </div>
                {item.notes && (
                  <p className="text-[12.5px] leading-relaxed text-foreground-secondary">
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
