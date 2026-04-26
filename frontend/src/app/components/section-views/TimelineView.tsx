import type { TimelineEntry } from '../../../types/backend';
import { EmptyState, FONT_MONO, formatMmSs, humanize } from './shared';

interface Props {
  entries: TimelineEntry[];
}

// Vertical timeline. Each row shows MM:SS chip + canonical description. Rows
// flagged with has_discrepancy get an amber border-left and a chip.
export function TimelineView({ entries }: Props) {
  if (entries.length === 0) return <EmptyState>No timeline entries.</EmptyState>;

  return (
    <ol className="relative">
      {/* Rail */}
      <span
        aria-hidden
        className="absolute left-[58px] top-1 bottom-1 w-px bg-border"
      />
      {entries.map((entry) => (
        <li key={entry.entry_id} className="flex gap-4 py-2">
          <span
            className="text-[11px] text-foreground-secondary tabular-nums w-[44px] text-right flex-shrink-0 pt-0.5"
            style={{ fontFamily: FONT_MONO }}
          >
            {formatMmSs(entry.canonical_timestamp_seconds)}
          </span>
          <span
            aria-hidden
            className="relative w-[14px] flex-shrink-0 flex justify-center pt-1.5"
          >
            <span
              className="w-2 h-2 rounded-full border-2"
              style={{
                background: 'var(--surface)',
                borderColor: entry.has_discrepancy ? '#B8732E' : '#6B6B68',
              }}
            />
          </span>
          <div
            className="flex-1 min-w-0 pl-3"
            style={{
              borderLeft: entry.has_discrepancy ? '2px solid #B8732E' : '2px solid transparent',
            }}
          >
            <div className="text-sm text-foreground leading-snug">
              {entry.canonical_description}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] text-foreground-secondary uppercase tracking-[0.08em]"
                style={{ fontFamily: FONT_MONO }}
              >
                {humanize(entry.event_type)}
                {entry.source_events.length > 0 && (
                  <>
                    {' · '}
                    {entry.source_events.map((e) => e.source).join(', ')}
                  </>
                )}
              </span>
              {entry.has_discrepancy && (
                <span
                  className="text-[10px] uppercase tracking-[0.08em]"
                  style={{ fontFamily: FONT_MONO, color: '#B8732E' }}
                >
                  · discrepancy
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
