import { Check, X } from 'lucide-react';
import type { AgentVizStatus } from './types';

export function StatusIcon({
  status,
  size = 14,
}: {
  status: AgentVizStatus;
  size?: number;
}) {
  if (status === 'complete') {
    return (
      <Check
        style={{ width: size, height: size, color: 'var(--success)', flexShrink: 0 }}
        strokeWidth={2.4}
      />
    );
  }
  if (status === 'error') {
    return (
      <X
        style={{ width: size, height: size, color: 'var(--destructive)', flexShrink: 0 }}
        strokeWidth={2.4}
      />
    );
  }
  if (status === 'running') {
    return (
      <span
        aria-label="running"
        className="animate-spin"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          display: 'inline-block',
          borderRadius: '50%',
          border: `1.6px solid color-mix(in srgb, var(--primary) 22%, transparent)`,
          borderTopColor: 'var(--primary)',
          boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <span
      aria-label="pending"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-block',
        borderRadius: '50%',
        border: `1.4px solid var(--border)`,
        boxSizing: 'border-box',
      }}
    />
  );
}
