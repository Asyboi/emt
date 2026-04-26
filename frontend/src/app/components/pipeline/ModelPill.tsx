import type { ModelPillKind } from './types';

interface PillStyle {
  bg: string;
  fg: string;
  italic?: boolean;
}

// Color tokens map to the project's CSS vars where possible. Sonnet uses
// a literal violet pair the project doesn't have; Scribe uses a literal
// amber pair (the project has no warning token).
const PILL_STYLES: Record<ModelPillKind, PillStyle> = {
  pydantic: { bg: 'var(--subcard)', fg: 'var(--text-2)' },
  rule: { bg: 'var(--subcard)', fg: 'var(--text-2)' },
  fixture: { bg: 'var(--subcard)', fg: 'var(--text-2)', italic: true },
  haiku: {
    bg: 'color-mix(in srgb, var(--primary) 22%, var(--surface))',
    fg: 'var(--primary-strong)',
  },
  sonnet: { bg: '#EEEDFE', fg: '#534AB7' },
  gemini: {
    bg: 'color-mix(in srgb, var(--success) 18%, var(--surface))',
    fg: 'var(--success)',
  },
  scribe: { bg: 'color-mix(in srgb, #C77B30 18%, var(--surface))', fg: '#9B5A1F' },
};

const PILL_LABELS: Record<ModelPillKind, string> = {
  pydantic: 'Pydantic',
  rule: 'rule',
  fixture: 'fixture stub',
  haiku: 'Haiku 4.5',
  sonnet: 'Sonnet 4.6',
  gemini: 'Gemini 2.5',
  scribe: 'Scribe v1',
};

const SHORT_LABELS: Record<ModelPillKind, string> = {
  pydantic: 'P',
  rule: 'R',
  fixture: 'F',
  haiku: 'H',
  sonnet: 'S',
  gemini: 'G',
  scribe: 'Sc',
};

export function ModelPill({
  kind,
  count,
  short = false,
  suffix,
}: {
  kind: ModelPillKind;
  count?: number;
  short?: boolean;
  suffix?: string;
}) {
  const style = PILL_STYLES[kind];
  const label = short ? SHORT_LABELS[kind] : PILL_LABELS[kind];
  const trailing =
    typeof count === 'number' && count > 1
      ? ` ×${count}`
      : suffix
        ? ` ${suffix}`
        : '';
  return (
    <span
      style={{
        background: style.bg,
        color: style.fg,
        fontSize: short ? 9 : 10,
        fontWeight: 500,
        fontStyle: style.italic ? 'italic' : 'normal',
        padding: short ? '0 4px' : '1px 6px',
        borderRadius: 0,
        whiteSpace: 'nowrap',
        display: 'inline-block',
        lineHeight: 1.45,
        letterSpacing: 0.1,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {label}
      {trailing}
    </span>
  );
}
