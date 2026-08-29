import type { ReactNode } from "react";

interface SearchHighlightProps {
  text: string;
  terms?: string[];
  className?: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function SearchHighlight({ text, terms = [], className }: SearchHighlightProps) {
  const normalizedTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (!text || normalizedTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(
    `(${normalizedTerms.map(escapeRegExp).join("|")})`,
    "giu",
  );
  const pieces = text.split(pattern);
  const termSet = new Set(normalizedTerms.map((term) => term.toLocaleLowerCase()));

  return (
    <span className={className}>
      {pieces.map((piece, index): ReactNode => {
        if (termSet.has(piece.toLocaleLowerCase())) {
          return (
            <mark
              key={`${piece}-${index}`}
              className="rounded bg-[var(--accent-soft)] px-0.5 text-[var(--accent)]"
              data-testid="search-highlight"
            >
              {piece}
            </mark>
          );
        }
        return <span key={`${piece}-${index}`}>{piece}</span>;
      })}
    </span>
  );
}
