import { useEffect, useRef, useState } from "react";
import { FileText, Search, Settings, Terminal } from "lucide-react";
import { Kbd } from "../common/Kbd";
import { useSearchStore } from "../../stores/searchStore";
import type { SearchResultDto } from "../../stores/searchStore";
import type { AppPage } from "../../types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenDocument: () => void;
  onCreateNote: () => void;
  onNavigate: (page: AppPage) => void;
  onSelectItem?: (id: string) => void;
}

const COMMANDS: SearchResultDto[] = [
  { id: "command:new-note", title: "新建完整笔记", item_type: "command", summary: "打开编辑器创建一条笔记" },
  { id: "command:workspace", title: "回到工作台", item_type: "command", summary: "回到快速记录界面" },
  { id: "command:library", title: "打开记录库", item_type: "command", summary: "搜索、查看和管理记录" },
  { id: "command:settings", title: "打开设置", item_type: "command", summary: "调整外观、字体和数据" },
];

function ResultIcon({ type }: { type: string }) {
  if (type === "command") return <Terminal className="h-4 w-4" />;
  if (type === "settings") return <Settings className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function CommandPalette({
  open,
  onClose,
  onOpenDocument,
  onCreateNote,
  onNavigate,
  onSelectItem,
}: CommandPaletteProps) {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const search = useSearchStore((s) => s.search);
  const setQuery = useSearchStore((s) => s.setQuery);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      search("");
    } else {
      setQuery("");
      setSelectedIdx(0);
    }
  }, [open, search, setQuery]);

  const commandResults = COMMANDS.filter((command) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return `${command.title} ${command.summary}`.toLowerCase().includes(normalized);
  });
  const combinedResults = query.trim() ? [...commandResults, ...results] : commandResults;

  useEffect(() => {
    setSelectedIdx(0);
  }, [combinedResults.length]);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 180);
  }

  function handleSelect(result: SearchResultDto) {
    onClose();
    if (result.id === "command:new-note") {
      onCreateNote();
      return;
    }
    if (result.id === "command:settings") {
      onNavigate("settings");
      return;
    }
    if (result.id === "command:workspace") {
      onNavigate("workspace");
      return;
    }
    if (result.id === "command:library") {
      onNavigate("library");
      return;
    }
    if (result.id && onSelectItem) onSelectItem(result.id);
    onOpenDocument();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, combinedResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && combinedResults[selectedIdx]) {
      handleSelect(combinedResults[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/20 px-4 pt-16 backdrop-blur-sm" onClick={onClose}>
      <section className="mx-auto flex max-h-[72vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--popover)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--line)] px-4">
          <Search className="h-5 w-5 text-[var(--muted)]" />
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-base text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            placeholder="搜索记录或命令"
            value={query}
            onChange={(e) => handleChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="min-h-0 overflow-auto p-2">
          {combinedResults.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">没有匹配结果</div>
          ) : (
            combinedResults.map((item, index) => (
              <button
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${index === selectedIdx ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"}`}
                key={item.id}
                onClick={() => handleSelect(item)}
                type="button"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                  <ResultIcon type={item.item_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</div>
                  <div className="truncate text-sm text-[var(--muted)]">{item.summary || item.item_type}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
