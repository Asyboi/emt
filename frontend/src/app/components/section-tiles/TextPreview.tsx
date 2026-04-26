interface Props {
  text: string;
}

// Fallback preview for sections that ship without typed `data` (e.g. mock fixtures).
export function TextPreview({ text }: Props) {
  return (
    <p className="text-[13px] leading-[1.65] text-foreground-secondary whitespace-pre-wrap">
      {text}
    </p>
  );
}
