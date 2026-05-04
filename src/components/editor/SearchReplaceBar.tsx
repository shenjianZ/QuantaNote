import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Replace, ReplaceAll, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchReplaceBarProps {
  onSearch: (query: string, caseSensitive: boolean) => number;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function SearchReplaceBar({
  onSearch,
  onReplace,
  onReplaceAll,
  onNext,
  onPrev,
  onClose,
}: SearchReplaceBarProps) {
  const { t } = useTranslation(["editor"]);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query) {
      setMatchCount(0);
      setCurrentIdx(0);
      return;
    }
    const count = onSearch(query, caseSensitive);
    setMatchCount(count);
    setCurrentIdx(count > 0 ? 1 : 0);
  }, [query, caseSensitive, onSearch]);

  function handleNext() {
    if (matchCount === 0) return;
    onNext();
    setCurrentIdx((i) => (i % matchCount) + 1);
  }

  function handlePrev() {
    if (matchCount === 0) return;
    onPrev();
    setCurrentIdx((i) => ((i - 2 + matchCount) % matchCount) + 1);
  }

  function handleReplace() {
    if (matchCount === 0) return;
    onReplace(replacement);
    // 替换后直接更新计数（减少 1）
    const newCount = matchCount - 1;
    setMatchCount(newCount);
    if (newCount === 0) {
      setCurrentIdx(0);
    } else {
      // 当前索引指向下一个（如果超出则回到 1）
      setCurrentIdx(currentIdx > newCount ? 1 : currentIdx);
    }
  }

  function handleReplaceAll() {
    if (matchCount === 0) return;
    onReplaceAll(replacement);
    setMatchCount(0);
    setCurrentIdx(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  }

  return (
    <div
      data-testid="search-replace-bar"
      className="absolute right-4 top-2 z-20 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--popover)] p-3 shadow-xl"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          data-testid="search-input"
          className="h-8 w-48 rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          placeholder={t("editor:searchReplace.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span data-testid="search-match-count" className="min-w-[4rem] text-center text-xs text-[var(--muted)]">
          {matchCount > 0 ? `${currentIdx}/${matchCount}` : t("editor:searchReplace.noMatch")}
        </span>
        <button
          data-testid="search-prev-btn"
          className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handlePrev}
          title={t("editor:searchReplace.prev")}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          data-testid="search-next-btn"
          className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleNext}
          title={t("editor:searchReplace.next")}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          data-testid="search-case-sensitive-btn"
          className={`grid h-7 w-7 place-items-center rounded text-xs font-bold ${caseSensitive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
          type="button"
          onClick={() => setCaseSensitive(!caseSensitive)}
          title={t("editor:searchReplace.caseSensitive")}
        >
          Aa
        </button>
        <button
          data-testid="search-close-btn"
          className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={onClose}
          title={t("editor:searchReplace.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          data-testid="replace-input"
          className="h-8 w-48 rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          placeholder={t("editor:searchReplace.replace")}
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button
          data-testid="replace-btn"
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleReplace}
          title={t("editor:searchReplace.replace")}
        >
          <Replace className="h-3.5 w-3.5" />
          {t("editor:searchReplace.replace")}
        </button>
        <button
          data-testid="replace-all-btn"
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleReplaceAll}
          title={t("editor:searchReplace.replaceAll")}
        >
          <ReplaceAll className="h-3.5 w-3.5" />
          {t("editor:searchReplace.replaceAll")}
        </button>
      </div>
    </div>
  );
}
