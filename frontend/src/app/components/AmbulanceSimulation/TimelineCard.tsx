import type { SimulationEvent, MapMode } from './types';

interface TimelineCardProps {
  events: SimulationEvent[];
  activeEventId: string | null;
  visitedEventIds: Set<string>;
  mode: MapMode;
  onEventClick: (event: SimulationEvent) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

const DOT_COLORS = {
  critical: 'bg-destructive',
  warning: 'bg-amber-500',
  info: 'bg-primary',
} as const;

export function TimelineCard({
  events,
  activeEventId,
  visitedEventIds,
  mode,
  onEventClick,
}: TimelineCardProps) {
  return (
    <div
      className="absolute top-4 right-4 w-56 rounded-xl overflow-hidden shadow-xl border border-border"
      style={{ background: 'var(--surface)' }}
    >
      <div className="px-3 py-2 border-b border-border">
        <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {mode === 'emt-review' ? 'PCR Review' : 'QI Findings'}
        </div>
        <div className="text-xs text-foreground-secondary">
          Incident 230010011 · Manhattan
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        {events.map((evt) => {
          const isActive = activeEventId === evt.id;
          const isVisited = visitedEventIds.has(evt.id);
          return (
            <button
              key={evt.id}
              onClick={() => onEventClick(evt)}
              className={`w-full text-left px-3 py-2 border-b border-border flex items-start gap-2 transition-colors
                ${isActive ? 'bg-primary/10' : 'hover:bg-surface'}
                ${isVisited ? 'opacity-60' : ''}`}
            >
              <div className="flex-shrink-0 mt-1">
                {isVisited ? (
                  <div className="w-2 h-2 rounded-full bg-success" />
                ) : (
                  <div className={`w-2 h-2 rounded-full ${DOT_COLORS[evt.severity]}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-foreground-secondary font-mono">
                  {formatTime(evt.timestamp)}
                </div>
                <div className="text-xs text-foreground truncate">{evt.label}</div>
              </div>
              {isVisited && (
                <span className="flex-shrink-0 text-success text-xs">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
