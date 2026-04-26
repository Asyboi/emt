interface Props {
  text: string;
}

export function IncidentSummaryPreview({ text }: Props) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return (
    <p className="text-[13.5px] leading-[1.65] text-foreground">
      {trimmed}
    </p>
  );
}
