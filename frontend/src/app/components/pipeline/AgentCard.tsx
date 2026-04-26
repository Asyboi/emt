import type { ReactNode } from 'react';
import { ModelPill } from './ModelPill';
import { StatusIcon } from './StatusIcon';
import type { AgentVizStatus, ModelPillSpec } from './types';

// Top-level agent card. Used both inside the parallel extraction box and
// for each sequential stage. Composition slot `detail` lets sequential
// stages embed their internal structure (sub-agent chain or wave layout).
export function AgentCard({
  label,
  description,
  pills,
  status,
  variant = 'parallel',
  noteRight,
  detail,
  width,
}: {
  label: string;
  description: string;
  pills: ModelPillSpec[];
  status: AgentVizStatus;
  variant?: 'parallel' | 'sequential';
  /** Small italic note shown right of the pills (e.g. "no fallback"). */
  noteRight?: string;
  /** Internal structure rendered below the description (sub-agent chain, waves). */
  detail?: ReactNode;
  width?: number;
}) {
  const borderColor =
    status === 'complete'
      ? 'var(--success)'
      : status === 'running'
        ? 'var(--primary)'
        : status === 'error'
          ? 'var(--destructive)'
          : 'var(--border)';

  const dimmed = status === 'pending';

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${borderColor}`,
        borderRadius: 0,
        padding: variant === 'sequential' ? '12px 13px' : '11px 12px',
        opacity: dimmed ? 0.55 : 1,
        transition: 'opacity 0.3s ease, border-color 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        minWidth: 0,
        width,
        boxSizing: 'border-box',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            letterSpacing: 0.1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </div>
        <StatusIcon status={status} />
      </div>
      <div className="flex items-center gap-1 flex-wrap" style={{ rowGap: 3 }}>
        {pills.map((p, i) => (
          <ModelPill key={i} kind={p.kind} count={p.count} suffix={p.suffix} />
        ))}
        {noteRight && (
          <span
            style={{
              fontSize: 9.5,
              color: 'var(--text-2)',
              fontStyle: 'italic',
              marginLeft: 4,
              letterSpacing: 0.1,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {noteRight}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-2)',
          lineHeight: 1.45,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {description}
      </div>
      {detail}
    </div>
  );
}
