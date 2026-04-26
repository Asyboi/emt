import type { ReactNode } from 'react';

export const FONT_MONO = 'var(--font-mono)';

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatMmSs(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}

// Pretty label from a snake_case enum value.
export function humanize(slug: string): string {
  return slug
    .split('_')
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

interface PillProps {
  tone: 'success' | 'concern' | 'critical' | 'muted' | 'info';
  children: ReactNode;
}

// Color-coded status/severity pill. Tones use existing theme tokens so the
// palette stays consistent with the rest of the app.
export function Pill({ tone, children }: PillProps) {
  const palettes: Record<PillProps['tone'], { bg: string; fg: string; border: string }> = {
    success: { bg: 'rgb(61 90 61 / 0.10)', fg: '#3D5A3D', border: 'rgb(61 90 61 / 0.30)' },
    concern: { bg: 'rgb(184 115 46 / 0.10)', fg: '#B8732E', border: 'rgb(184 115 46 / 0.30)' },
    critical: { bg: 'rgb(179 58 58 / 0.10)', fg: '#B33A3A', border: 'rgb(179 58 58 / 0.30)' },
    muted: { bg: 'rgb(154 152 144 / 0.10)', fg: '#6B6B68', border: 'rgb(154 152 144 / 0.30)' },
    info: { bg: 'rgb(112 193 255 / 0.10)', fg: '#3676A8', border: 'rgb(112 193 255 / 0.30)' },
  };
  const p = palettes[tone];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] tracking-[0.1em] uppercase"
      style={{
        fontFamily: FONT_MONO,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

interface ScoreBarProps {
  label: string;
  value: number; // 0..1
}

// Horizontal score bar. Color steps by threshold (green ≥ 0.8, amber 0.6–0.8, red < 0.6).
export function ScoreBar({ label, value }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  const color =
    clamped >= 0.8 ? '#3D5A3D' : clamped >= 0.6 ? '#B8732E' : '#B33A3A';
  return (
    <div>
      <div
        className="flex items-baseline justify-between mb-1.5"
        style={{ fontFamily: FONT_MONO }}
      >
        <span className="text-[11px] tracking-[0.12em] uppercase text-foreground-secondary">
          {label}
        </span>
        <span className="text-xs" style={{ color }}>
          {pct}
        </span>
      </div>
      <div className="h-[6px] bg-background border border-border overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// Empty-state row for sections with no rows to render.
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-xs text-foreground-secondary py-6 text-center border border-dashed border-border"
      style={{ fontFamily: FONT_MONO }}
    >
      {children}
    </div>
  );
}
