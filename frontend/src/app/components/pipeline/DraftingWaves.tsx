import { SubAgentNode } from './SubAgentNode';
import type { AgentVizStatus, ModelPillKind } from './types';

interface DraftingAgent {
  id: string;
  label: string;
  pill: ModelPillKind;
  status: AgentVizStatus;
}

// Internal structure of the report-drafting stage:
//   Wave 1 — parallel gather()  →  compute_determination()  →  Wave 2 — parallel gather()
// Each wave is its own containing box; the deterministic gate between them
// is a dashed-border node that emphasizes the rule-based join.
export function DraftingWaves({
  wave1,
  wave2,
  gateStatus,
}: {
  wave1: DraftingAgent[];
  wave2: DraftingAgent[];
  gateStatus: AgentVizStatus;
}) {
  // Wave-1's effective "source status" for the connector below it is the
  // weakest of its agents — they all run in parallel, so the connector
  // shouldn't draw until the slowest one has finished.
  const wave1Status: AgentVizStatus = wave1.every((a) => a.status === 'complete')
    ? 'complete'
    : wave1.some((a) => a.status === 'error')
      ? 'error'
      : wave1.some((a) => a.status === 'running')
        ? 'running'
        : 'pending';
  return (
    <div className="flex flex-col items-stretch" style={{ gap: 6 }}>
      <WaveBox label="Wave 1 — parallel" agents={wave1} />
      <Connector sourceStatus={wave1Status} />
      <Gate status={gateStatus} />
      <Connector sourceStatus={gateStatus} />
      <WaveBox label="Wave 2 — parallel" agents={wave2} />
    </div>
  );
}

function WaveBox({ label, agents }: { label: string; agents: DraftingAgent[] }) {
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
          gather()
        </span>
      </div>
      <div className="flex items-stretch" style={{ gap: 6, flexWrap: 'wrap' }}>
        {agents.map((a) => (
          <div key={a.id} style={{ flex: '1 1 0', minWidth: 88 }}>
            <SubAgentNode label={a.label} pill={a.pill} status={a.status} minWidth={0} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Connector({ sourceStatus }: { sourceStatus: AgentVizStatus }) {
  // No track — the connector is empty space until the source completes.
  const drawn = sourceStatus === 'complete' || sourceStatus === 'error';
  const fillColor =
    sourceStatus === 'error' ? 'var(--destructive)' : 'var(--success)';
  return (
    <div className="flex justify-center" aria-hidden>
      <span
        style={{
          width: 2,
          height: 12,
          background: 'transparent',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: drawn ? '100%' : '0%',
            background: fillColor,
            transition:
              'height 700ms cubic-bezier(0.45, 0, 0.25, 1), background 300ms ease',
          }}
        />
      </span>
    </div>
  );
}

function Gate({ status }: { status: AgentVizStatus }) {
  return (
    <div
      style={{
        alignSelf: 'center',
        border: `1px dashed color-mix(in srgb, var(--text-2) 40%, var(--border))`,
        borderRadius: 0,
        padding: '5px 10px',
        background: 'var(--surface)',
        fontSize: 10,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        opacity: status === 'pending' ? 0.55 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        compute_determination()
      </span>
      <span
        style={{
          fontSize: 9,
          background: 'var(--subcard)',
          color: 'var(--text-2)',
          padding: '1px 5px',
          borderRadius: 0,
          fontFamily: 'var(--font-sans)',
          letterSpacing: 0.1,
        }}
      >
        rule
      </span>
    </div>
  );
}
