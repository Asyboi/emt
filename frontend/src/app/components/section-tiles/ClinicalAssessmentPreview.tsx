import type { AssessmentStatus, ClinicalAssessmentItem } from '../../../types/backend';
import { FONT_MONO } from '../section-views/shared';

interface Props {
  items: ClinicalAssessmentItem[];
}

const STATUS_ORDER: AssessmentStatus[] = [
  'not_met',
  'insufficient_documentation',
  'met',
  'not_applicable',
];

function statusColor(s: AssessmentStatus): string {
  switch (s) {
    case 'met':
      return '#3D5A3D';
    case 'not_met':
      return '#B33A3A';
    case 'insufficient_documentation':
      return '#B8732E';
    case 'not_applicable':
      return '#9A9890';
  }
}

export function ClinicalAssessmentPreview({ items }: Props) {
  const met = items.filter((i) => i.status === 'met').length;
  const notMet = items.filter((i) => i.status === 'not_met').length;
  const insufficient = items.filter((i) => i.status === 'insufficient_documentation').length;
  const top = [...items]
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    )
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-4" style={{ fontFamily: FONT_MONO }}>
        <Stat n={met} label="MET" color="#3D5A3D" />
        <Stat n={notMet} label="GAP" color="#B33A3A" />
        <Stat n={insufficient} label="UNCLEAR" color="#B8732E" />
      </div>
      {top.length === 0 ? (
        <div
          className="text-[11px] text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          NO ITEMS
        </div>
      ) : (
        <ol className="space-y-1.5 flex-1">
          {top.map((i) => (
            <li
              key={i.item_id}
              className="flex items-start gap-2.5 text-[12px] leading-snug"
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: statusColor(i.status) }}
              />
              <span className="text-foreground">{i.benchmark}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[22px] leading-none tabular-nums" style={{ color }}>
        {n}
      </span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-foreground-secondary">
        {label}
      </span>
    </div>
  );
}
