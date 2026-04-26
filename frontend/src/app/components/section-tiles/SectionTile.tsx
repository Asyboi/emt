import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ReportSection } from '../../../types';

interface Props {
  section: ReportSection;
  className?: string;
  onOpen: () => void;
  onToggleApprove: () => void;
  children: ReactNode;
}

// Tile: clickable container (role=button) that opens the deep-read Sheet.
// Header has its own APPROVE/APPROVED toggle that stops event propagation so
// it doesn't also trigger open. Container is a <div> (not <button>) because
// preview children include block-level elements (<p>, <ol>, <div>) which are
// invalid HTML inside <button> and cause browsers to close the button early.
export function SectionTile({
  section,
  className,
  onOpen,
  onToggleApprove,
  children,
}: Props) {
  const approved = section.status === 'approved';

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  const handleApprove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggleApprove();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
      aria-label={`Open ${section.title} detail`}
      className={`relative cursor-pointer border border-border bg-background flex flex-col p-4 transition-colors hover:bg-surface/30 focus:outline-none focus:ring-2 focus:ring-primary/40 ${className ?? ''}`}
      style={
        approved
          ? { borderLeftWidth: 3, borderLeftColor: '#3D5A3D' }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0">
        <span
          className="text-[10.5px] tracking-[0.15em] uppercase text-foreground-secondary"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {section.title}
        </span>
        {approved ? (
          <button
            type="button"
            onClick={handleApprove}
            aria-label="Unapprove section"
            className="flex items-center gap-1 px-2 py-1 text-[10px] tracking-[0.12em] hover:opacity-80 transition-opacity"
            style={{ fontFamily: 'var(--font-mono)', color: '#3D5A3D' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
            APPROVED
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApprove}
            className="px-2.5 py-1 border border-primary text-primary text-[10px] tracking-[0.12em] hover:bg-primary hover:text-primary-foreground transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            APPROVE
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 w-full">{children}</div>
    </div>
  );
}
