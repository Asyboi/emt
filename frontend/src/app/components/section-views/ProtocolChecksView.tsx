import { Check, AlertTriangle, X, HelpCircle } from 'lucide-react';
import type { ProtocolCheck, ProtocolCheckStatus } from '../../../types/backend';
import { EmptyState, FONT_MONO, humanize, Pill } from './shared';

interface Props {
  checks: ProtocolCheck[];
}

const STATUS_ORDER: ProtocolCheckStatus[] = [
  'deviation',
  'insufficient_evidence',
  'adherent',
  'not_applicable',
];

function statusIcon(status: ProtocolCheckStatus) {
  switch (status) {
    case 'adherent':
      return <Check className="w-4 h-4" style={{ color: '#3D5A3D' }} />;
    case 'deviation':
      return <X className="w-4 h-4" style={{ color: '#B33A3A' }} />;
    case 'insufficient_evidence':
      return <AlertTriangle className="w-4 h-4" style={{ color: '#B8732E' }} />;
    case 'not_applicable':
      return <HelpCircle className="w-4 h-4" style={{ color: '#9A9890' }} />;
  }
}

function statusTone(
  status: ProtocolCheckStatus,
): 'success' | 'concern' | 'critical' | 'muted' {
  switch (status) {
    case 'adherent':
      return 'success';
    case 'deviation':
      return 'critical';
    case 'insufficient_evidence':
      return 'concern';
    case 'not_applicable':
      return 'muted';
  }
}

export function ProtocolChecksView({ checks }: Props) {
  if (checks.length === 0) return <EmptyState>No protocol checks recorded.</EmptyState>;

  // Group by status so deviations bubble to the top — same structure as a CI test report.
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: checks.filter((c) => c.status === status),
  })).filter((g) => g.items.length > 0);

  // Adherence summary (small counts row above the list).
  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    n: checks.filter((c) => c.status === s).length,
  }));

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-3 flex-wrap text-[11px]"
        style={{ fontFamily: FONT_MONO }}
      >
        {counts.map(({ status, n }) =>
          n === 0 ? null : (
            <span key={status} className="flex items-center gap-1.5">
              {statusIcon(status)}
              <span className="text-foreground-secondary uppercase tracking-[0.08em]">
                {humanize(status)}: {n}
              </span>
            </span>
          ),
        )}
      </div>

      {grouped.map((g) => (
        <div key={g.status} className="space-y-2">
          {g.items.map((check) => (
            <div
              key={check.check_id}
              className="border border-border bg-background p-3 flex gap-3"
            >
              <div className="pt-0.5 flex-shrink-0">{statusIcon(check.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[13px] text-foreground font-medium">
                    {check.protocol_step.description}
                  </span>
                  <Pill tone={statusTone(check.status)}>{humanize(check.status)}</Pill>
                </div>
                <p className="text-[13px] leading-relaxed text-foreground-secondary">
                  {check.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
