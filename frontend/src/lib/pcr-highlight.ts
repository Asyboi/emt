import type { CSSProperties, ReactNode } from 'react';
import { createElement } from 'react';

const UNCONFIRMED_TOKEN = '[UNCONFIRMED]';
const SECTION_RULE_RE = /^={20,}$/;

const DEFAULT_TOKEN_STYLE: CSSProperties = {
  background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
  color: 'var(--primary-strong)',
  borderRadius: 2,
  padding: '0 2px',
};

export interface HighlightOptions {
  tokenStyle?: CSSProperties;
  tokenClassName?: string;
}

export interface PcrSection {
  header: string;
  content: string;
  startLine: number;
}

export function highlightUnconfirmed(
  text: string,
  options: HighlightOptions = {},
): ReactNode[] {
  const { tokenStyle, tokenClassName } = options;
  const style = tokenStyle ?? DEFAULT_TOKEN_STYLE;

  const parts = text.split(UNCONFIRMED_TOKEN);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    nodes.push(createElement('span', { key: `p-${i}` }, part));
    if (i < parts.length - 1) {
      nodes.push(
        createElement(
          'span',
          {
            key: `u-${i}`,
            className: tokenClassName,
            style,
          },
          UNCONFIRMED_TOKEN,
        ),
      );
    }
  });
  return nodes;
}

export function countUnconfirmed(text: string): number {
  return (text.match(/\[UNCONFIRMED\]/g) ?? []).length;
}

// Sections look like:
//
//   ============
//   HEADER LINE
//   ============
//   ...content...
//
// We only treat a rule as a section *opener* if it sits above a non-rule
// line AND another rule line — otherwise field rows like "Agency: ..." get
// mistaken for headers and `===` rules leak into the body.
function isHeaderTriple(lines: string[], i: number): boolean {
  if (i + 2 >= lines.length) return false;
  return (
    SECTION_RULE_RE.test(lines[i].trim()) &&
    lines[i + 1].trim().length > 0 &&
    !SECTION_RULE_RE.test(lines[i + 1].trim()) &&
    SECTION_RULE_RE.test(lines[i + 2].trim())
  );
}

export function parsePcrSections(text: string): PcrSection[] {
  const lines = text.split('\n');
  const sections: PcrSection[] = [];

  // Collect every triple's opener index up-front so we know where each
  // section's content stops (= the next section's opener).
  const openers: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isHeaderTriple(lines, i)) openers.push(i);
  }

  for (let s = 0; s < openers.length; s++) {
    const i = openers[s];
    const header = lines[i + 1].trim();
    const contentStart = i + 3; // skip opener rule, header, closer rule
    const contentEnd = openers[s + 1] ?? lines.length;
    const content = lines.slice(contentStart, contentEnd).join('\n');
    sections.push({ header, content, startLine: i });
  }

  return sections;
}
