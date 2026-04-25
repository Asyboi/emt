import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PCRSkeleton } from "@/components/Skeleton";

interface PCRPaneProps {
  content: string;
  loading?: boolean;
  highlightExcerpt: string | null;
}

const HIGHLIGHT_CLASS = "pcr-highlight";

function pickSearchString(excerpt: string): string {
  // PCR excerpts often look like:  Section: 'actual quote here'
  // Prefer the quoted interior, otherwise the trimmed text.
  const trimmed = excerpt.trim();
  const quoted = trimmed.match(/['"]([^'"]{15,})['"]/);
  const candidate = quoted ? quoted[1] : trimmed;
  // Keep the first 80-120 chars to maximize the chance of a clean match.
  return candidate.slice(0, 120).trim();
}

function clearHighlights(container: HTMLElement) {
  container.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function applyHighlight(container: HTMLElement, search: string): boolean {
  const text = container.textContent ?? "";
  const haystack = text.toLowerCase();
  const needle = search.toLowerCase();
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  const target = idx;
  const targetEnd = idx + needle.length;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.data.length;
    if (!startNode && consumed + len > target) {
      startNode = node;
      startOffset = target - consumed;
    }
    if (startNode && consumed + len >= targetEnd) {
      endNode = node;
      endOffset = targetEnd - consumed;
      break;
    }
    consumed += len;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) return false;

  try {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    // surroundContents only works for ranges within a single element. For
    // simple PCR prose this is almost always true. If it fails, we fall back
    // to splitting and wrapping just the start node's portion.
    const mark = document.createElement("mark");
    mark.className = `${HIGHLIGHT_CLASS} bg-yellow-200 rounded px-0.5`;
    try {
      range.surroundContents(mark);
    } catch {
      const fallbackRange = document.createRange();
      fallbackRange.setStart(startNode, startOffset);
      fallbackRange.setEnd(startNode, Math.min(startNode.data.length, startOffset + needle.length));
      fallbackRange.surroundContents(mark);
    }
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  } catch {
    return false;
  }
}

export function PCRPane({ content, loading, highlightExcerpt }: PCRPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    clearHighlights(container);
    if (!highlightExcerpt) return;
    const search = pickSearchString(highlightExcerpt);
    if (search.length < 4) return;
    applyHighlight(container, search);
  }, [highlightExcerpt, content]);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-700" />
        <h2 className="font-semibold text-gray-900">Patient Care Report</h2>
      </header>
      <div className="flex-1 overflow-y-auto">
        {loading && !content ? (
          <PCRSkeleton />
        ) : content ? (
          <div ref={containerRef} className="markdown px-4 py-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm text-gray-400 px-4 py-3">No PCR content.</div>
        )}
      </div>
    </div>
  );
}
