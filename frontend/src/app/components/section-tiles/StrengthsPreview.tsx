import { Check } from 'lucide-react';
import type { ClinicalAssessmentItem } from '../../../types/backend';
import { FONT_MONO } from '../section-views/shared';

interface Props {
  items: ClinicalAssessmentItem[];
}

export function StrengthsPreview({ items }: Props) {
  const top = items.slice(0, 4);
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-baseline gap-2" style={{ fontFamily: FONT_MONO }}>
        <span
          className="text-[28px] leading-none tabular-nums"
          style={{ color: '#3D5A3D' }}
        >
          +{items.length}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-foreground-secondary">
          CALLOUTS
        </span>
      </div>
      {top.length === 0 ? (
        <div
          className="text-[11px] text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          NONE RECORDED
        </div>
      ) : (
        <ul className="space-y-2 flex-1">
          {top.map((i) => (
            <li
              key={i.item_id}
              className="flex items-start gap-2.5 text-[12.5px] leading-snug"
            >
              <Check
                className="w-3 h-3 mt-1 flex-shrink-0"
                style={{ color: '#3D5A3D' }}
                aria-hidden
              />
              <span className="text-foreground">{i.benchmark}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
