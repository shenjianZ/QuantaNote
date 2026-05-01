import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Replace, ReplaceAll, X } from "lucide-react";

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
      className="absolute right-4 top-2 z-20 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--popover)] p-3 shadow-xl"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          className="h-8 w-48 rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          placeholder="搜索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="min-w-[4rem] text-center text-xs text-[var(--muted)]">
          {matchCount > 0 ? `${currentIdx}/${matchCount}` : "无匹配"}
        </span>
        <button
          className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handlePrev}
          title="上一个 (Shift+Enter)"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleNext}
          title="下一个 (Enter)"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          className={`grid h-7 w-7 place-items-center rounded text-xs font-bold ${caseSensitive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
          type="button"
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="区分大小写"
        >
          Aa
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={onClose}
          title="关闭 (Escape)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-48 rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          placeholder="替换"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleReplace}
          title="替换"
        >
          <Replace className="h-3.5 w-3.5" />
          替换
        </button>
        <button
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleReplaceAll}
          title="全部替换"
        >
          <ReplaceAll className="h-3.5 w-3.5" />
          全部
        </button>
      </div>
    </div>
  );
}
