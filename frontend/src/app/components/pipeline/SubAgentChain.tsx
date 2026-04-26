import { SubAgentNode } from './SubAgentNode';
import type { AgentVizStatus, ModelPillKind } from './types';

interface SubAgentItem {
  id: string;
  label: string;
  pill: ModelPillKind;
  count?: string;
  status: AgentVizStatus;
  conditional?: { tag: string };
}

// Reconciliation sub-agent chain. Renders the items in a horizontal row
// with `→` arrows between them. The chain itself is a small containing box
// with its own label and a parallelism hint where applicable.
export function SubAgentChain({
  items,
  parallelismHint,
  label = 'Sub-agent chain',
}: {
  items: SubAgentItem[];
  /** e.g. "gather() · sem(3)" — communicates the orchestration mechanism */
  parallelismHint?: string;
  label?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--subcard)',
        border: `1px solid var(--border)`,
        borderRadius: 0,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: '0.08em',
          color: 'var(--text-2)',
          textTransform: 'uppercase',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span>{label}</span>
        {parallelismHint && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              background: 'var(--surface)',
              padding: '1px 5px',
              borderRadius: 0,
              border: `1px solid var(--border)`,
              textTransform: 'none',
              letterSpacing: 0,
              color: 'var(--text)',
            }}
          >
            {parallelismHint}
          </span>
        )}
      </div>
      <div className="flex items-stretch flex-wrap" style={{ gap: 4 }}>
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center" style={{ gap: 4 }}>
            {i > 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-2)',
                  flexShrink: 0,
                  opacity: 0.7,
                  fontFamily: 'var(--font-sans)',
                }}
                aria-hidden
              >
                →
              </span>
            )}
            <SubAgentNode
              label={item.label}
              pill={item.pill}
              count={item.count}
              status={item.status}
              conditional={item.conditional}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
