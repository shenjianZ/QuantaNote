import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Braces,
  FileText,
  Folder,
  Link,
  Search,
  Terminal,
} from "lucide-react";
import { Kbd } from "../common/Kbd";
import { useSearchStore } from "../../stores/searchStore";
import type { SearchResultDto } from "../../stores/searchStore";
import type { AppPage } from "../../types";

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  link: Link,
  file: Folder,
  image: Folder,
  code: Braces,
  task: BookOpen,
  command: Terminal,
};

const TYPE_LABEL: Record<string, string> = {
  note: "笔记",
  link: "链接",
  file: "文件",
  image: "图片",
  code: "代码",
  task: "任务",
  command: "命令",
};

const TAB_FILTERS = [
  { key: "all", label: "全部" },
  { key: "note", label: "记录" },
  { key: "file", label: "文件" },
  { key: "command", label: "命令" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenDocument: () => void;
  onCreateNote: () => void;
  onNavigate: (page: AppPage) => void;
  onSelectItem?: (id: string) => void;
}

const COMMANDS: SearchResultDto[] = [
  { id: "command:new-note", title: "新建笔记", item_type: "command", summary: "创建一条新的本地笔记" },
  { id: "command:settings", title: "打开设置", item_type: "command", summary: "调整外观与备份" },
  { id: "command:all", title: "打开全部", item_type: "command", summary: "查看全部记录" },
];

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
  const [activeTab, setActiveTab] = useState("all");
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
  }, [open, setQuery, search]);

  const commandResults = COMMANDS.filter((command) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return `${command.title} ${command.summary}`.toLowerCase().includes(normalized);
  });

  const combinedResults = query.trim() ? [...commandResults, ...results] : commandResults;
  const filtered = activeTab === "all"
    ? combinedResults
    : combinedResults.filter((r) => r.item_type === activeTab);

  useEffect(() => {
    setSelectedIdx(0);
  }, [filtered.length]);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(value);
    }, 200);
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
    if (result.id === "command:all") {
      onNavigate("all");
      return;
    }
    if (result.id && onSelectItem) {
      onSelectItem(result.id);
    }
    onOpenDocument();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      handleSelect(filtered[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <section className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <Search />
          <input
            ref={inputRef}
            placeholder="搜索记录、命令、文件..."
            value={query}
            onChange={(e) => handleChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="palette-tabs">
          {TAB_FILTERS.map((tab) => (
            <button
              className={`palette-tab ${tab.key === activeTab ? "active" : ""}`}
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="palette-results">
          {filtered.length === 0 && query.trim() && (
            <div className="text-muted text-sm" style={{ padding: 12, textAlign: "center" }}>
              未找到匹配结果
            </div>
          )}
          {filtered.map((item, index) => {
            const Icon = TYPE_ICON[item.item_type] ?? FileText;
            return (
              <button
                className={`palette-result ${index === selectedIdx ? "selected" : ""}`}
                key={item.id}
                onClick={() => handleSelect(item)}
                type="button"
              >
                <div className="pr-icon accent-cyan">
                  <Icon />
                </div>
                <span className="pr-title">{item.title}</span>
                <span className="pr-desc">{TYPE_LABEL[item.item_type] ?? item.item_type}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
