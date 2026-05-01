import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Kbd } from "../common/Kbd";
import { useSearchStore } from "../../stores/searchStore";
import type { SearchResultDto } from "../../stores/searchStore";
import type { Item } from "../../types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectItem: (id: string) => void;
  items: Item[];
}

function ResultIcon({ type }: { type: string }) {
  const icons: Record<string, typeof FileText> = {
    note: FileText,
    link: FileText,
    code: FileText,
    task: FileText,
  };
  const Icon = icons[type] ?? FileText;
  return <Icon className="h-4 w-4" />;
}

export function CommandPalette({
  open,
  onClose,
  onSelectItem,
  items,
}: CommandPaletteProps) {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const search = useSearchStore((s) => s.search);
  const setQuery = useSearchStore((s) => s.setQuery);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveResults = useMemo<SearchResultDto[]>(() => {
    if (results.length > 0) {
      console.log(
        `[CommandPalette] 使用后端搜索结果 | query="${query}" | results=${results.length}`
      );
      return results;
    }
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const filtered = items
      .filter((item) => {
        const haystack = `${item.title} ${item.summary}`.toLowerCase();
        return haystack.includes(q);
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        item_type: item.type,
        summary: item.summary,
      }));
    console.log(
      `[CommandPalette] 后端无结果，客户端 includes 兜底 | query="${query}" | results=${filtered.length}`
    );
    return filtered;
  }, [results, query, items]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIdx(0);
    }
  }, [open, setQuery]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [effectiveResults.length]);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => search(value, "note"),
      180,
    );
  }

  function handleSelect(result: SearchResultDto) {
    onClose();
    if (result.id) onSelectItem(result.id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, effectiveResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && effectiveResults[selectedIdx]) {
      handleSelect(effectiveResults[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start bg-black/20 px-4 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="mx-auto flex max-h-[72vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--popover)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--line)] px-4">
          <Search className="h-5 w-5 text-[var(--muted)]" />
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-base text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            placeholder="搜索笔记"
            data-testid="palette-search-input"
            value={query}
            onChange={(e) => handleChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="min-h-0 overflow-auto p-2">
          {effectiveResults.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              {query.trim() ? "没有匹配的笔记" : "输入关键词搜索笔记"}
            </div>
          ) : (
            effectiveResults.map((item, index) => (
              <button
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                  index === selectedIdx ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"
                }`}
                key={item.id}
                data-testid="palette-result"
                onClick={() => handleSelect(item)}
                type="button"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                  <ResultIcon type={item.item_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">
                    {item.title}
                  </div>
                  <div className="truncate text-sm text-[var(--muted)]">
                    {item.summary || item.item_type}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
