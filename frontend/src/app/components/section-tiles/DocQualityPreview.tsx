import type { DocumentationQualityAssessment } from '../../../types/backend';
import { FONT_MONO, ScoreBar } from '../section-views/shared';

interface Props {
  quality: DocumentationQualityAssessment;
}

export function DocQualityPreview({ quality }: Props) {
  const overall =
    (quality.completeness_score + quality.accuracy_score + quality.narrative_quality_score) / 3;
  const pct = Math.round(overall * 100);
  const color = overall >= 0.8 ? '#3D5A3D' : overall >= 0.6 ? '#B8732E' : '#B33A3A';

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-baseline gap-2">
        <span
          className="text-[36px] leading-none tabular-nums"
          style={{ color, fontFamily: FONT_MONO }}
        >
          {pct}
        </span>
        <span
          className="text-[10px] tracking-[0.12em] uppercase text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          OVERALL
        </span>
      </div>
      <div className="space-y-2">
        <ScoreBar label="Completeness" value={quality.completeness_score} />
        <ScoreBar label="Accuracy" value={quality.accuracy_score} />
        <ScoreBar label="Narrative" value={quality.narrative_quality_score} />
      </div>
      {quality.issues.length > 0 && (
        <div
          className="text-[10px] tracking-[0.12em] uppercase text-foreground-secondary mt-auto"
          style={{ fontFamily: FONT_MONO }}
        >
          {quality.issues.length} issue{quality.issues.length === 1 ? '' : 's'} flagged
        </div>
      )}
    </div>
  );
}
