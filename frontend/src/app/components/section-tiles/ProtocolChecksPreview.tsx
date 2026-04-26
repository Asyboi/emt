import type { ReactNode } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import type { ProtocolCheck } from '../../../types/backend';
import { FONT_MONO } from '../section-views/shared';

interface Props {
  checks: ProtocolCheck[];
}

export function ProtocolChecksPreview({ checks }: Props) {
  const adherent = checks.filter((c) => c.status === 'adherent').length;
  const deviation = checks.filter((c) => c.status === 'deviation').length;
  const insufficient = checks.filter((c) => c.status === 'insufficient_evidence').length;
  const topDeviation = checks.find((c) => c.status === 'deviation');
  const total = checks.length;
  const pct = total > 0 ? Math.round((adherent / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-baseline gap-2" style={{ fontFamily: FONT_MONO }}>
        <span
          className="text-[28px] leading-none tabular-nums"
          style={{ color: pct >= 80 ? '#3D5A3D' : pct >= 60 ? '#B8732E' : '#B33A3A' }}
        >
          {pct}%
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-foreground-secondary">
          ADHERENCE
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" style={{ fontFamily: FONT_MONO }}>
        <Stat
          icon={<Check className="w-3 h-3" style={{ color: '#3D5A3D' }} />}
          value={adherent}
          label="PASS"
          color="#3D5A3D"
        />
        <Stat
          icon={<X className="w-3 h-3" style={{ color: '#B33A3A' }} />}
          value={deviation}
          label="FAIL"
          color="#B33A3A"
        />
        <Stat
          icon={<AlertTriangle className="w-3 h-3" style={{ color: '#B8732E' }} />}
          value={insufficient}
          label="UNCLEAR"
          color="#B8732E"
        />
      </div>
      {topDeviation && (
        <div
          className="mt-auto text-[11.5px] text-foreground-secondary border-t border-border pt-2"
          style={{ fontFamily: FONT_MONO }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em] mb-1"
            style={{ color: '#B33A3A' }}
          >
            Top deviation
          </div>
          <div className="text-foreground leading-snug">
            {topDeviation.protocol_step.description}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[20px] leading-none tabular-nums" style={{ color }}>
        {value}
      </span>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-foreground-secondary">
        {icon}
        {label}
      </div>
    </div>
  );
}
