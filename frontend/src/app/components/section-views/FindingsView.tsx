import type { Finding, FindingSeverity } from '../../../types/backend';
import { EmptyState, FONT_MONO, humanize, Pill } from './shared';

interface Props {
  findings: Finding[];
}

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'concern', 'info'];

function severityTone(s: FindingSeverity): 'critical' | 'concern' | 'info' {
  return s === 'critical' ? 'critical' : s === 'concern' ? 'concern' : 'info';
}

function severityBorder(s: FindingSeverity): string {
  return s === 'critical' ? '#B33A3A' : s === 'concern' ? '#B8732E' : '#9A9890';
}

// Severity-grouped finding cards. Critical at top (red), concerns next (amber).
export function FindingsView({ findings }: Props) {
  if (findings.length === 0) return <EmptyState>No areas for improvement identified.</EmptyState>;

  const grouped = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    items: findings.filter((f) => f.severity === sev),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map((g) => (
        <div key={g.severity} className="space-y-2">
          <div
            className="text-[11px] tracking-[0.12em] uppercase text-foreground-secondary"
            style={{ fontFamily: FONT_MONO }}
          >
            {humanize(g.severity)} ({g.items.length})
          </div>
          {g.items.map((f) => (
            <div
              key={f.finding_id}
              className="border border-border bg-background p-3"
              style={{ borderLeftWidth: 3, borderLeftColor: severityBorder(f.severity) }}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                <span className="text-[13px] text-foreground font-medium leading-snug">
                  {f.title}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Pill tone={severityTone(f.severity)}>{humanize(f.severity)}</Pill>
                  <Pill tone="muted">{humanize(f.category)}</Pill>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground-secondary">
                {f.explanation}
              </p>
              {f.suggested_review_action && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span
                    className="text-[10px] tracking-[0.12em] uppercase text-foreground-secondary"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    Suggested action
                  </span>
                  <p className="text-[12.5px] leading-relaxed text-foreground mt-0.5">
                    {f.suggested_review_action}
                  </p>
                </div>
              )}
              {f.pcr_excerpt && (
                <blockquote
                  className="mt-2 pl-3 border-l-2 border-border text-[12px] italic text-foreground-secondary"
                  style={{ fontFamily: FONT_MONO }}
                >
                  “{f.pcr_excerpt}”
                </blockquote>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
