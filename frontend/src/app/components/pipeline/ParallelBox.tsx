import type { ReactNode } from 'react';

// Containing box for parallel extraction agents. Renders its children in a
// 2×2 grid and shows a footer that advertises the parallelism mechanism.
export function ParallelBox({
  title,
  children,
  completedCount,
  totalCount,
  parallelismLabel = 'asyncio.gather()',
  width = 240,
}: {
  title: string;
  children: ReactNode;
  completedCount: number;
  totalCount: number;
  parallelismLabel?: string;
  width?: number;
}) {
  return (
    <div
      style={{
        background: 'var(--subcard)',
        border: `1px solid var(--border)`,
        borderRadius: 0,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--text-2)',
          textTransform: 'uppercase',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {children}
      </div>
      <div
        style={{
          borderTop: `1px solid var(--border)`,
          paddingTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--text-2)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span>
          {completedCount}/{totalCount} complete
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            background: 'var(--surface)',
            padding: '2px 6px',
            borderRadius: 0,
            border: `1px solid var(--border)`,
            color: 'var(--text)',
          }}
        >
          {parallelismLabel}
        </span>
      </div>
    </div>
  );
}
