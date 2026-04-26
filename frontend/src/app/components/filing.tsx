import { useMemo, type ReactNode } from 'react';
import { Loader2, Paperclip, Upload, X } from 'lucide-react';

// Editorial filing chrome shared between the QI Review intake and the
// PCR auto-draft intake. Both pages dress an upload form as an official
// filing — same typography, same metadata strip, same record/aside
// layout, same sticky filing footer.

export const FONT_MONO = 'var(--font-mono)';
export const FONT_SANS = 'var(--font-sans)';

export type SectionKind = 'REQUIRED' | 'EXHIBIT' | 'OPTIONAL';

export interface MetaItem {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}

export interface AsideBlockItem {
  label: string;
  body: ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Cosmetic filing serial — anchors the page to a real-feeling document
// without persisting anything. Generated once per mount.
export function useFilingSerial(prefix: string) {
  return useMemo(() => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return {
      serial: `${prefix}-${yy}${m}${day}-${rand}`,
      iso: d.toISOString(),
      pretty: d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [prefix]);
}

// ── Document chrome ──────────────────────────────────────────────────────────

export function ClassificationBanner({
  classification,
  formCode,
}: {
  classification: string;
  formCode: string;
}) {
  return (
    <div
      className="flex items-center justify-between border-y"
      style={{
        borderColor: 'var(--foreground)',
        padding: '8px 0',
        marginBottom: 28,
        fontFamily: FONT_MONO,
        fontSize: 10.5,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--foreground)',
      }}
    >
      <span style={{ fontWeight: 600 }}>{classification}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <SealMark />
        <span>{formCode}</span>
      </span>
    </div>
  );
}

function SealMark() {
  return (
    <span
      aria-hidden
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            display: 'block',
            width: 3,
            height: 3,
            background: 'var(--foreground)',
            opacity: i === 2 ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  );
}

export function TitleBlock({
  headline,
  subtitle,
  meta,
}: {
  headline: ReactNode;
  subtitle: ReactNode;
  meta: MetaItem[];
}) {
  return (
    <header
      className="grid gap-x-12 gap-y-8"
      style={{
        gridTemplateColumns: 'minmax(0, 2.4fr) minmax(0, 1fr)',
        marginBottom: 'clamp(48px, 7vw, 80px)',
        alignItems: 'start',
      }}
    >
      {/* Left: editorial headline + brief. */}
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 500,
            fontSize: 'clamp(40px, 6vw, 76px)',
            lineHeight: 0.95,
            letterSpacing: '-0.035em',
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            marginTop: 22,
            fontStyle: 'italic',
            fontSize: 'clamp(15px, 1.4vw, 18px)',
            lineHeight: 1.55,
            color: 'var(--foreground-secondary)',
            maxWidth: '58ch',
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* Right: filing record block. */}
      <dl
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          margin: 0,
          borderTop: '2px solid var(--foreground)',
        }}
      >
        {meta.map((m) => (
          <MetaRow key={m.label} {...m} />
        ))}
      </dl>
    </header>
  );
}

function MetaRow({ label, value, strong, accent }: MetaItem) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 0.9fr) minmax(0, 1.1fr)',
        alignItems: 'baseline',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <dt
        style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--foreground-secondary)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: strong ? 13.5 : 12.5,
          fontWeight: strong ? 600 : 400,
          color: accent ? 'var(--primary-strong)' : 'var(--foreground)',
          letterSpacing: '0.02em',
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </dd>
    </div>
  );
}

export function Aside({ blocks }: { blocks: AsideBlockItem[] }) {
  return (
    <aside
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11.5,
        lineHeight: 1.7,
        color: 'var(--foreground-secondary)',
        borderTop: '2px solid var(--foreground)',
        paddingTop: 18,
        position: 'sticky',
        top: 24,
        alignSelf: 'start',
      }}
    >
      {blocks.map((b) => (
        <AsideBlock key={b.label} label={b.label}>
          {b.body}
        </AsideBlock>
      ))}
    </aside>
  );
}

function AsideBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        paddingTop: 18,
        paddingBottom: 18,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--foreground)',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <p style={{ margin: 0, color: 'var(--foreground-secondary)' }}>
        {children}
      </p>
    </div>
  );
}

// ── Section primitive ────────────────────────────────────────────────────────

export function Section({
  num,
  kind,
  title,
  description,
  children,
}: {
  num: string;
  kind: SectionKind;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          paddingBottom: 14,
          borderBottom: '1px solid var(--foreground)',
          marginBottom: 22,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--foreground)',
            letterSpacing: '0.04em',
            minWidth: 28,
          }}
        >
          {num}
        </span>
        <h2
          style={{
            fontFamily: FONT_SANS,
            fontSize: 'clamp(20px, 2.2vw, 28px)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--foreground)',
            margin: 0,
            flex: 1,
          }}
        >
          {title}
        </h2>
        <SectionTag kind={kind} />
      </div>

      <p
        style={{
          fontFamily: FONT_SANS,
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--foreground-secondary)',
          margin: '0 0 22px',
          maxWidth: '62ch',
        }}
      >
        {description}
      </p>

      {children}
    </section>
  );
}

function SectionTag({ kind }: { kind: SectionKind }) {
  const palette = {
    REQUIRED: { color: 'var(--destructive)', border: 'var(--destructive)' },
    EXHIBIT: { color: 'var(--foreground)', border: 'var(--foreground)' },
    OPTIONAL: {
      color: 'var(--foreground-secondary)',
      border: 'var(--border)',
    },
  }[kind];
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: palette.color,
        border: `1px solid ${palette.border}`,
        padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {kind}
    </span>
  );
}

// ── Field decoration ────────────────────────────────────────────────────────

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--foreground-secondary)',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

export function FieldFootnote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        color: 'var(--foreground-secondary)',
        marginTop: 8,
        fontStyle: 'italic',
      }}
    >
      {children}
    </div>
  );
}

// ── File slots ──────────────────────────────────────────────────────────────

export function SingleFileSlot({
  file,
  onSelect,
  accept,
  placeholder,
  tag,
}: {
  file: File | null;
  onSelect: (f: File | null) => void;
  accept: string;
  placeholder: string;
  tag: string;
}) {
  if (file) {
    return (
      <FileChip
        name={file.name}
        size={file.size}
        onRemove={() => onSelect(null)}
      />
    );
  }
  return (
    <DropTarget
      accept={accept}
      onChange={(e) => {
        const next = e.target.files?.[0];
        if (next) onSelect(next);
      }}
      cta={placeholder}
      hint={tag}
    />
  );
}

export function MultiFileSlot({
  files,
  onAdd,
  onRemove,
  accept,
  emptyCta,
  emptyHint,
  appendLabel,
}: {
  files: File[];
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (idx: number) => void;
  accept: string;
  emptyCta: string;
  emptyHint: string;
  appendLabel: string;
}) {
  if (files.length === 0) {
    return (
      <DropTarget
        accept={accept}
        multiple
        onChange={onAdd}
        cta={emptyCta}
        hint={emptyHint}
      />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {files.map((v, idx) => (
        <FileChip
          key={`${v.name}-${idx}`}
          name={v.name}
          size={v.size}
          onRemove={() => onRemove(idx)}
          ordinal={idx + 1}
        />
      ))}
      <label
        style={{
          marginTop: 6,
          padding: '12px 14px',
          border: '1px dashed var(--border)',
          background: 'transparent',
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--foreground-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          alignSelf: 'flex-start',
        }}
      >
        <input
          type="file"
          accept={accept}
          multiple
          onChange={onAdd}
          style={{ display: 'none' }}
        />
        <Upload style={{ width: 13, height: 13 }} />
        <span>{appendLabel}</span>
      </label>
    </div>
  );
}

export function DropTarget({
  accept,
  onChange,
  cta,
  hint,
  multiple,
}: {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cta: string;
  hint: string;
  multiple?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 20px',
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
        cursor: 'pointer',
        transition: 'border-color 160ms ease, background 160ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLLabelElement).style.borderColor =
          'var(--foreground)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLLabelElement).style.borderColor =
          'var(--border)';
      }}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Upload
          style={{ width: 16, height: 16, color: 'var(--foreground)' }}
          aria-hidden
        />
        <span>
          <span
            style={{
              display: 'block',
              fontFamily: FONT_SANS,
              fontSize: 14,
              color: 'var(--foreground)',
            }}
          >
            {cta}
          </span>
          <span
            style={{
              display: 'block',
              marginTop: 2,
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--foreground-secondary)',
            }}
          >
            {hint}
          </span>
        </span>
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--foreground-secondary)',
        }}
      >
        Browse →
      </span>
    </label>
  );
}

export function FileChip({
  name,
  size,
  onRemove,
  ordinal,
}: {
  name: string;
  size: number;
  onRemove: () => void;
  ordinal?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--foreground)',
      }}
    >
      <Paperclip
        style={{ width: 14, height: 14, color: 'var(--foreground)' }}
        aria-hidden
      />
      {ordinal !== undefined && (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--foreground-secondary)',
          }}
        >
          EX-{String(ordinal).padStart(2, '0')}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: 'var(--foreground-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          {formatBytes(size)} · received {new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        style={{
          all: 'unset',
          cursor: 'pointer',
          padding: 6,
          color: 'var(--foreground-secondary)',
          display: 'inline-flex',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            'var(--foreground)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            'var(--foreground-secondary)';
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

// ── Sticky filing footer ─────────────────────────────────────────────────────

export interface ChecklistItem {
  done: boolean;
  label: string;
}

export function FilingFooter({
  attachedCount,
  totalCount,
  checklist,
  canSubmit,
  submitting,
  primaryLabel,
  busyLabel,
  onSubmit,
}: {
  attachedCount: number;
  totalCount: number;
  checklist: ChecklistItem[];
  canSubmit: boolean;
  submitting: boolean;
  primaryLabel: string;
  busyLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderTop: '1px solid var(--foreground)',
      }}
    >
      <div
        className="mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8"
        style={{
          maxWidth: 1280,
          padding: 'clamp(16px, 2.4vw, 24px) clamp(20px, 4vw, 64px)',
        }}
      >
        <ChecklistTrack
          attachedCount={attachedCount}
          totalCount={totalCount}
          items={checklist}
        />

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            all: 'unset',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.4,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            padding: '16px 28px',
            fontFamily: FONT_MONO,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            transition: 'opacity 160ms ease, filter 160ms ease',
            justifyContent: 'space-between',
            minWidth: 240,
          }}
          onMouseEnter={(e) => {
            if (canSubmit) {
              (e.currentTarget as HTMLButtonElement).style.filter =
                'brightness(0.94)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.filter = 'none';
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {submitting && (
              <Loader2
                className="animate-spin"
                style={{ width: 14, height: 14 }}
                aria-hidden
              />
            )}
            <span>{submitting ? busyLabel : primaryLabel}</span>
          </span>
          <span aria-hidden style={{ opacity: 0.6 }}>
            →
          </span>
        </button>
      </div>
    </div>
  );
}

function ChecklistTrack({
  attachedCount,
  totalCount,
  items,
}: {
  attachedCount: number;
  totalCount: number;
  items: ChecklistItem[];
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--foreground-secondary)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
        {String(attachedCount).padStart(2, '0')} /{' '}
        {String(totalCount).padStart(2, '0')} ATTACHED
      </span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <ul
        style={{
          display: 'flex',
          gap: 14,
          listStyle: 'none',
          margin: 0,
          padding: 0,
          flexWrap: 'wrap',
        }}
      >
        {items.map((it) => (
          <li
            key={it.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: it.done ? 'var(--success)' : 'var(--foreground-secondary)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                border: `1px solid ${
                  it.done ? 'var(--success)' : 'var(--border)'
                }`,
                background: it.done ? 'var(--success)' : 'transparent',
              }}
            />
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────────────

// Outer scrollable page container with consistent gutters used by every
// filing page. Keeps the document max-width and side padding in lockstep.
export function FilingPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="h-full overflow-y-auto bg-background"
      style={{ fontFamily: FONT_SANS }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 1280,
          padding: 'clamp(24px, 4vw, 56px) clamp(20px, 4vw, 64px) 160px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Banner shown when the page-level submit fails. Matches the chrome of the
// classification banner so it reads as a stamp on the document, not a toast.
export function FilingError({ message }: { message: string }) {
  return (
    <div
      className="mt-10 px-4 py-3 border bg-surface flex items-start gap-3"
      style={{
        borderColor: 'var(--destructive)',
        color: 'var(--destructive)',
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.04em',
      }}
      role="alert"
    >
      <span style={{ fontWeight: 600 }}>FILING REJECTED ·</span>
      <span>{message}</span>
    </div>
  );
}
