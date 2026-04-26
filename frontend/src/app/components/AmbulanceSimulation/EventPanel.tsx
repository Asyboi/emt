import type { SimulationEvent, MapMode } from './types';

interface EventPanelProps {
  event: SimulationEvent;
  mode: MapMode;
  onConfirm: (eventId: string) => void;
  onSkip: () => void;
  onDismiss: () => void;
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    icon: '⚠️',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    icon: '🔔',
  },
  info: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    icon: 'ℹ️',
  },
} as const;

export function EventPanel({
  event,
  mode,
  onConfirm,
  onSkip,
  onDismiss,
}: EventPanelProps) {
  const s = SEVERITY_STYLES[event.severity];

  return (
    <div
      className="absolute bottom-16 left-4 right-4 rounded-xl overflow-hidden shadow-2xl border border-border"
      style={{ height: '200px', background: 'var(--surface)' }}
    >
      <div className="flex h-full">
        {/* Left — video placeholder */}
        <div
          className={`w-1/2 flex flex-col items-center justify-center border-r border-border ${s.bg} relative`}
        >
          <div className="text-4xl mb-2">{s.icon}</div>
          <div className="text-xs text-foreground-secondary text-center px-4 font-mono">
            {event.videoUrl.split('/').pop()}
          </div>
          <div className="text-xs text-foreground-secondary mt-1 font-mono">
            t={event.timestamp}s
          </div>
          <div
            className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded"
            style={{
              background: 'var(--border)',
              color: 'var(--foreground-secondary)',
            }}
          >
            VIDEO PLACEHOLDER
          </div>
        </div>

        {/* Right — finding */}
        <div className="w-1/2 p-4 flex flex-col justify-between">
          <div>
            <div
              className={`text-xs font-semibold uppercase tracking-wider mb-1 ${s.text}`}
            >
              {event.severity} · {event.label}
            </div>
            <p className="text-sm text-foreground leading-relaxed">{event.finding}</p>
            {mode === 'emt-review' && event.pcrLine && (
              <div
                className="mt-2 p-2 rounded text-xs text-foreground-secondary font-mono"
                style={{ background: 'var(--background)' }}
              >
                PCR: {event.pcrLine}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {mode === 'emt-review' ? (
              <>
                <button
                  onClick={() => onConfirm(event.id)}
                  className="flex-1 bg-success text-white text-xs py-2 rounded-lg font-medium"
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={onSkip}
                  className="flex-1 text-xs py-2 rounded-lg font-medium border border-border text-foreground-secondary"
                >
                  Skip
                </button>
              </>
            ) : (
              <button
                onClick={onDismiss}
                className="flex-1 text-xs py-2 rounded-lg font-medium border border-border text-foreground-secondary"
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
