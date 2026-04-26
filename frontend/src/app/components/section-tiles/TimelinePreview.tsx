import type { TimelineEntry } from '../../../types/backend';
import { FONT_MONO, formatMmSs } from '../section-views/shared';

interface Props {
  entries: TimelineEntry[];
}

const BUCKET_COUNT = 32;

// Mini density chart: bins entries by canonical timestamp into BUCKET_COUNT
// equal-width buckets and renders bar heights proportional to event count.
// Buckets containing a discrepancy entry render in amber.
export function TimelinePreview({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div
        className="text-[11px] text-foreground-secondary"
        style={{ fontFamily: FONT_MONO }}
      >
        NO ENTRIES
      </div>
    );
  }

  const start = Math.min(...entries.map((e) => e.canonical_timestamp_seconds));
  const end = Math.max(...entries.map((e) => e.canonical_timestamp_seconds));
  const span = Math.max(1, end - start);
  const buckets = Array.from({ length: BUCKET_COUNT }, () => ({
    count: 0,
    discrepancy: false,
  }));
  for (const e of entries) {
    const idx = Math.min(
      BUCKET_COUNT - 1,
      Math.floor(((e.canonical_timestamp_seconds - start) / span) * BUCKET_COUNT),
    );
    buckets[idx].count += 1;
    if (e.has_discrepancy) buckets[idx].discrepancy = true;
  }
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const discrepancies = entries.filter((e) => e.has_discrepancy).length;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-baseline gap-2" style={{ fontFamily: FONT_MONO }}>
        <span className="text-[28px] leading-none tabular-nums text-foreground">
          {entries.length}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-foreground-secondary">
          EVENTS
        </span>
        {discrepancies > 0 && (
          <span
            className="text-[10px] uppercase tracking-[0.12em] ml-auto"
            style={{ color: '#B8732E' }}
          >
            {discrepancies} DISCREPANC{discrepancies === 1 ? 'Y' : 'IES'}
          </span>
        )}
      </div>
      <div className="flex items-end gap-[2px] flex-1 min-h-[40px]">
        {buckets.map((b, i) => (
          <div
            key={i}
            className="flex-1"
            style={{
              height: `${Math.max(8, (b.count / maxCount) * 100)}%`,
              background: b.discrepancy ? '#B8732E' : 'var(--foreground)',
              opacity: b.count === 0 ? 0.12 : b.discrepancy ? 0.85 : 0.5,
            }}
            aria-hidden
          />
        ))}
      </div>
      <div
        className="flex items-center justify-between text-[10px] text-foreground-secondary"
        style={{ fontFamily: FONT_MONO }}
      >
        <span>{formatMmSs(start)}</span>
        <span>span {formatMmSs(end - start)}</span>
        <span>{formatMmSs(end)}</span>
      </div>
    </div>
  );
}
