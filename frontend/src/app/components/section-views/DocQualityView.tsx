import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DocumentationQualityAssessment } from '../../../types/backend';
import { EmptyState, FONT_MONO, ScoreBar } from './shared';

interface Props {
  quality: DocumentationQualityAssessment;
}

// Documentation Quality view. Three score bars at top + per-issue accordion.
// Each issue starts collapsed (showing first sentence) and expands to full text.
export function DocQualityView({ quality }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScoreBar label="Completeness" value={quality.completeness_score} />
        <ScoreBar label="Accuracy" value={quality.accuracy_score} />
        <ScoreBar label="Narrative" value={quality.narrative_quality_score} />
      </div>

      <div>
        <div
          className="text-[11px] tracking-[0.12em] uppercase text-foreground-secondary mb-2"
          style={{ fontFamily: FONT_MONO }}
        >
          Issues ({quality.issues.length})
        </div>
        {quality.issues.length === 0 ? (
          <EmptyState>No documentation issues recorded.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {quality.issues.map((issue, i) => {
              const isOpen = expanded.has(i);
              const colonIdx = issue.indexOf(':');
              // Use the leading "Title: ..." as the collapsed headline when the
              // LLM emitted that pattern; otherwise fall back to the first sentence.
              const headline =
                colonIdx > 0 && colonIdx < 80
                  ? issue.slice(0, colonIdx)
                  : issue.split(/[.!?](?:\s|$)/)[0];
              const body = issue.slice(headline.length).replace(/^[:\s]+/, '');
              return (
                <li key={i} className="border border-border bg-background">
                  <button
                    onClick={() => toggle(i)}
                    className="w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-surface/40 transition-colors"
                  >
                    <span className="pt-0.5 flex-shrink-0 text-foreground-secondary">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span className="flex-1 text-[13px] leading-snug text-foreground">
                      {headline}
                    </span>
                  </button>
                  {isOpen && body && (
                    <div className="px-3 pb-3 pl-[34px] text-[13px] leading-relaxed text-foreground-secondary">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
