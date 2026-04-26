import { Check } from 'lucide-react';
import type { ClinicalAssessmentItem } from '../../../types/backend';
import { EmptyState } from './shared';

interface Props {
  items: ClinicalAssessmentItem[];
}

// Compact green checklist of items where status === 'met'.
export function StrengthsView({ items }: Props) {
  if (items.length === 0) return <EmptyState>No strengths recorded.</EmptyState>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.item_id}
          className="flex gap-3 p-3 border border-border bg-background"
          style={{ borderLeftWidth: 3, borderLeftColor: '#3D5A3D' }}
        >
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#3D5A3D' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-foreground font-medium leading-snug">
              {item.benchmark}
            </div>
            {item.notes && (
              <p className="text-[12.5px] leading-relaxed text-foreground-secondary mt-1">
                {item.notes}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
