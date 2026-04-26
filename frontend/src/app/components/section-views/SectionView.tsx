import type { ReportSection } from '../../../types';
import { ClinicalAssessmentView } from './ClinicalAssessmentView';
import { DocQualityView } from './DocQualityView';
import { FindingsView } from './FindingsView';
import { IncidentSummaryView } from './IncidentSummaryView';
import { ProtocolChecksView } from './ProtocolChecksView';
import { RecommendationsView } from './RecommendationsView';
import { StrengthsView } from './StrengthsView';
import { TimelineView } from './TimelineView';

interface Props {
  section: ReportSection;
}

// Dispatch component: picks a purpose-built view by section.data.kind.
// Falls back to the flat section.content text when section.data is absent
// (e.g. mock data, regenerated placeholder content).
export function SectionView({ section }: Props) {
  if (!section.data) {
    return (
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        {section.content}
      </p>
    );
  }

  switch (section.data.kind) {
    case 'incident-summary':
      return <IncidentSummaryView text={section.data.text} />;
    case 'timeline':
      return <TimelineView entries={section.data.entries} />;
    case 'doc-quality':
      return <DocQualityView quality={section.data.quality} />;
    case 'protocol-checks':
      return <ProtocolChecksView checks={section.data.checks} />;
    case 'clinical-assessment':
      return <ClinicalAssessmentView items={section.data.items} />;
    case 'strengths':
      return <StrengthsView items={section.data.items} />;
    case 'findings':
      return <FindingsView findings={section.data.findings} />;
    case 'recommendations':
      return <RecommendationsView recs={section.data.recs} />;
  }
}
