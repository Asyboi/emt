import { ModelPill } from './ModelPill';
import { StatusIcon } from './StatusIcon';
import type { AgentVizStatus, ModelPillKind } from './types';

// Inline sub-agent node — used inside the reconciliation chain and inside
// each drafting wave. Smaller than the top-level AgentCard, with the model
// shown as a single-letter pill.
export function SubAgentNode({
  label,
  pill,
  count,
  status,
  conditional,
  minWidth = 78,
}: {
  label: string;
  pill: ModelPillKind;
  /** Trailing modifier on the model pill, e.g. "×N" */
  count?: string;
  status: AgentVizStatus;
  conditional?: { tag: string };
  minWidth?: number;
}) {
  const borderColor =
    status === 'complete'
      ? 'var(--success)'
      : status === 'running'
        ? 'var(--primary)'
        : status === 'error'
          ? 'var(--destructive)'
          : 'var(--border)';

  const dim = status === 'pending';
  const isConditional = !!conditional;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: isConditional
          ? `1px dashed color-mix(in srgb, #C77B30 60%, ${borderColor})`
          : `1px solid ${borderColor}`,
        borderRadius: 0,
        padding: '7px 9px',
        minWidth,
        opacity: dim ? 0.5 : 1,
        transition: 'opacity 0.3s ease, border-color 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        boxSizing: 'border-box',
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: 'var(--text)',
            letterSpacing: 0.1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </span>
        <StatusIcon status={status} size={11} />
      </div>
      <div className="flex items-center gap-1 flex-wrap" style={{ rowGap: 2 }}>
        <ModelPill kind={pill} short suffix={count} />
        {conditional && (
          <span
            style={{
              fontSize: 8.5,
              color: '#9B5A1F',
              fontStyle: 'italic',
              letterSpacing: 0.1,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {conditional.tag}
          </span>
        )}
      </div>
    </div>
  );
}
