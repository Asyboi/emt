interface Props {
  text: string;
}

// Renders the incident summary as readable prose. Splits on blank lines into
// paragraphs and applies generous line-height + capped width so the wall of
// text becomes scannable.
export function IncidentSummaryView({ text }: Props) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="text-sm text-foreground-secondary">No summary available.</p>;
  }

  return (
    <div className="space-y-4" style={{ maxWidth: '70ch' }}>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[15px] leading-[1.7] text-foreground">
          {p}
        </p>
      ))}
    </div>
  );
}
