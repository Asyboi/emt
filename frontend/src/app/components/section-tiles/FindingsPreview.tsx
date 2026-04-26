import type { Finding, FindingSeverity } from '../../../types/backend';
import { FONT_MONO } from '../section-views/shared';

interface Props {
  findings: Finding[];
}

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'concern', 'info'];

function dotColor(s: FindingSeverity): string {
  return s === 'critical' ? '#B33A3A' : s === 'concern' ? '#B8732E' : '#9A9890';
}

export function FindingsPreview({ findings }: Props) {
  const counts = SEVERITY_ORDER.map((sev) => ({
    sev,
    n: findings.filter((f) => f.severity === sev).length,
  }));
  const top = [...findings]
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    )
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex gap-5 flex-wrap" style={{ fontFamily: FONT_MONO }}>
        {counts.map((c) => (
          <div key={c.sev} className="flex flex-col gap-0.5">
            <span
              className="text-[34px] leading-none tabular-nums"
              style={{ color: dotColor(c.sev) }}
            >
              {c.n}
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-foreground-secondary">
              {c.sev}
            </span>
          </div>
        ))}
      </div>
      {top.length === 0 ? (
        <div
          className="text-[11px] text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          NO FINDINGS
        </div>
      ) : (
        <ol className="space-y-2 flex-1">
          {top.map((f) => (
            <li
              key={f.finding_id}
              className="flex items-start gap-2.5 text-[12.5px] leading-snug"
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: dotColor(f.severity) }}
              />
              <span className="text-foreground">{f.title}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
