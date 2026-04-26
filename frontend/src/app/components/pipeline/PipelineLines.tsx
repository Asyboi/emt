import type { CSSProperties } from 'react';
import type { AgentVizStatus } from './types';

export interface PipelinePath {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The stage whose status drives the draw animation. The line is invisible
      until this stage completes (or errors), then strokes itself out. */
  sourceStatus: AgentVizStatus;
}

// Absolutely-positioned SVG that overlays the pipeline canvas. All
// connector lines (parallel fan-in + sequential spine) live here so the
// flex layout can resize boxes freely without breaking line alignment —
// path endpoints are recomputed from element refs, not hardcoded.
export function PipelineLines({ paths }: { paths: PipelinePath[] }) {
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    width: '100%',
    height: '100%',
    overflow: 'visible',
  };
  return (
    <svg style={overlayStyle} aria-hidden>
      {paths.map((p) => (
        <PipelineLine key={p.id} path={p} />
      ))}
    </svg>
  );
}

function PipelineLine({ path }: { path: PipelinePath }) {
  const length = Math.hypot(path.x2 - path.x1, path.y2 - path.y1);
  const drawn = path.sourceStatus === 'complete' || path.sourceStatus === 'error';
  const stroke =
    path.sourceStatus === 'error' ? 'var(--destructive)' : 'var(--success)';
  return (
    <line
      x1={path.x1}
      y1={path.y1}
      x2={path.x2}
      y2={path.y2}
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={length || 1}
      strokeDashoffset={drawn ? 0 : length || 1}
      style={{
        transition:
          'stroke-dashoffset 700ms cubic-bezier(0.45, 0, 0.25, 1), stroke 300ms ease',
      }}
    />
  );
}
