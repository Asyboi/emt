import { Check } from 'lucide-react';
import { FONT_MONO } from '../section-views/shared';

interface Props {
  content: string;
  sectionId: number;
}

// Split a paragraph into trimmed sentences, preserving the trailing period.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+(?=[A-Z(\d])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parse "HH:MM — description" lines from a timeline blob.
function parseTimeline(text: string): Array<{ time: string; desc: string }> {
  const out: Array<{ time: string; desc: string }> = [];
  const re = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[—–-]\s*([^.]+?)(?=\s+\d{1,2}:\d{2}|\.|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ time: m[1], desc: m[2].trim() });
  }
  return out;
}

// Lead + body: first sentence gets emphasis, the rest reads as supporting prose.
function LeadBody({ sentences }: { sentences: string[] }) {
  const [lead, ...rest] = sentences;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] leading-[1.55] text-foreground font-medium">
        {lead}
      </p>
      {rest.length > 0 && (
        <p className="text-[12.5px] leading-[1.6] text-foreground-secondary">
          {rest.join(' ')}
        </p>
      )}
    </div>
  );
}

// Numbered list of decisions/recs — each sentence becomes a row with a counter.
function NumberedList({
  sentences,
  accent,
}: {
  sentences: string[];
  accent: string;
}) {
  return (
    <ol className="space-y-2.5">
      {sentences.map((s, i) => (
        <li
          key={i}
          className="flex items-start gap-3 text-[12.5px] leading-[1.55]"
        >
          <span
            className="text-[10px] tracking-[0.12em] tabular-nums pt-1 flex-shrink-0"
            style={{ fontFamily: FONT_MONO, color: accent }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-foreground">{s}</span>
        </li>
      ))}
    </ol>
  );
}

// Bulleted list with a colored dot per item.
function DotList({
  sentences,
  color,
}: {
  sentences: string[];
  color: string;
}) {
  return (
    <ul className="space-y-2">
      {sentences.map((s, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 text-[12.5px] leading-[1.55]"
        >
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
            style={{ background: color }}
          />
          <span className="text-foreground">{s}</span>
        </li>
      ))}
    </ul>
  );
}

// Green-check strengths list.
function CheckList({ sentences }: { sentences: string[] }) {
  return (
    <ul className="space-y-2">
      {sentences.map((s, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 text-[12.5px] leading-[1.55]"
        >
          <Check
            className="w-3 h-3 mt-1 flex-shrink-0"
            style={{ color: '#3D5A3D' }}
            aria-hidden
          />
          <span className="text-foreground">{s}</span>
        </li>
      ))}
    </ul>
  );
}

// Vertical timeline with timestamp chips on the left.
function TimelineRail({ entries }: { entries: Array<{ time: string; desc: string }> }) {
  return (
    <ol className="relative">
      <span
        aria-hidden
        className="absolute left-[42px] top-2 bottom-2 w-px bg-border"
      />
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3 py-1.5">
          <span
            className="text-[11px] text-foreground-secondary tabular-nums w-[34px] text-right flex-shrink-0 pt-0.5"
            style={{ fontFamily: FONT_MONO }}
          >
            {e.time}
          </span>
          <span
            aria-hidden
            className="relative w-[10px] flex-shrink-0 flex justify-center pt-1.5"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--foreground)' }}
            />
          </span>
          <span className="flex-1 text-[12.5px] text-foreground leading-snug">
            {e.desc}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Dispatch by section.id so each tile picks a structure that fits its text shape.
// IDs are stable across mock_data.ts and adapters.ts.
export function StructuredTextPreview({ content, sectionId }: Props) {
  const sentences = splitSentences(content);

  switch (sectionId) {
    case 1: // INCIDENT SUMMARY — narrative hero
      return <LeadBody sentences={sentences} />;

    case 2: {
      // TIMELINE — parse HH:MM rows; fall back to lead/body if no timestamps.
      const entries = parseTimeline(content);
      return entries.length > 0 ? (
        <TimelineRail entries={entries} />
      ) : (
        <LeadBody sentences={sentences} />
      );
    }

    case 3: // PCR DOC CHECK — narrative
      return <LeadBody sentences={sentences} />;

    case 4: // PROTOCOL COMPLIANCE — narrative
      return <LeadBody sentences={sentences} />;

    case 5: // KEY CLINICAL DECISIONS — numbered list
      return <NumberedList sentences={sentences} accent="var(--primary)" />;

    case 6: // COMMUNICATION / SCENE — narrative
      return <LeadBody sentences={sentences} />;

    case 7: // STRENGTHS — check list
      return <CheckList sentences={sentences} />;

    case 8: // AREAS FOR IMPROVEMENT — amber dot list
      return <DotList sentences={sentences} color="#B8732E" />;

    case 9: // RECOMMENDED FOLLOW-UP — numbered actions
      return <NumberedList sentences={sentences} accent="#B8732E" />;

    default:
      return <LeadBody sentences={sentences} />;
  }
}
