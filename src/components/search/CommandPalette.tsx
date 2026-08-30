import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText, Loader2, Search, type LucideIcon } from "lucide-react";
import { Kbd } from "../common/Kbd";
import { SearchHighlight } from "../common/SearchHighlight";
import { useSearchStore } from "../../stores/searchStore";
import type { SearchResultDto } from "../../stores/searchStore";
import type { Item } from "../../types";

export interface CommandPaletteCommand {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: LucideIcon;
  onSelect: () => void | Promise<void>;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectItem: (id: string) => void;
  items: Item[];
  commands?: CommandPaletteCommand[];
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
  commands = [],
}: CommandPaletteProps) {
  const { t } = useTranslation(["command-palette"]);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const searching = useSearchStore((s) => s.searching);
  const search = useSearchStore((s) => s.search);
  const setQuery = useSearchStore((s) => s.setQuery);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveResults = useMemo<SearchResultDto[]>(() => {
    if (results.length > 0) {
      return results;
    }
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => {
        const haystack = `${item.title} ${item.summary}`.toLowerCase();
        return haystack.includes(q);
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        item_type: item.type,
        summary: item.summary,
        context: item.summary,
        matched_fields: ["title", "summary"],
        highlight_terms: [query],
      }));
  }, [results, query, items]);

  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.description ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [commands, query]);

  const entryCount = visibleCommands.length + effectiveResults.length;

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
  }, [entryCount]);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

  function handleSelectCommand(command: CommandPaletteCommand) {
    onClose();
    void command.onSelect();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, entryCount - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const command = visibleCommands[selectedIdx];
      if (command) {
        handleSelectCommand(command);
        return;
      }
      const result = effectiveResults[selectedIdx - visibleCommands.length];
      if (result) handleSelect(result);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[var(--popover)] pt-[env(safe-area-inset-top)] sm:grid sm:place-items-start sm:bg-black/20 sm:px-4 sm:pt-16 sm:backdrop-blur-sm"
      data-testid="command-palette-overlay"
      onClick={onClose}
    >
      <section
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--popover)] sm:mx-auto sm:max-h-[72vh] sm:max-w-xl sm:rounded-3xl sm:border sm:border-[var(--line)] sm:shadow-2xl"
        data-testid="command-palette-panel"
        role="combobox"
        aria-expanded={true}
        aria-haspopup="listbox"
        aria-label={t("command-palette:searchLabel")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 移动端返回按钮 + 搜索框 */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3 sm:gap-3 sm:px-4">
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--muted)] sm:hidden"
            type="button"
            onClick={onClose}
            aria-label={t("command-palette:back", "返回")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {searching ? (
            <Loader2 className="hidden h-5 w-5 animate-spin text-[var(--muted)] sm:block" />
          ) : (
            <Search className="hidden h-5 w-5 text-[var(--muted)] sm:block" />
          )}
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-base text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            placeholder={t("command-palette:searchPlaceholder")}
            data-testid="palette-search-input"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="palette-results"
            aria-activedescendant={entryCount > 0
              ? selectedIdx < visibleCommands.length
                ? `palette-command-${visibleCommands[selectedIdx]?.id}`
                : `palette-result-${selectedIdx - visibleCommands.length}`
              : undefined}
            value={query}
            onChange={(e) => handleChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <span className="hidden sm:inline-flex"><Kbd plain>Esc</Kbd></span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2" id="palette-results" role="listbox">
          {entryCount === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              {query.trim() ? t("command-palette:noResults") : t("command-palette:hint")}
            </div>
          ) : (
            <>
              {visibleCommands.map((command, index) => {
                const Icon = command.icon ?? Search;
                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                      index === selectedIdx ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"
                    }`}
                    key={command.id}
                    id={`palette-command-${command.id}`}
                    data-testid="palette-command"
                    role="option"
                    aria-selected={index === selectedIdx}
                    onClick={() => handleSelectCommand(command)}
                    type="button"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">{command.label}</div>
                      {command.description && <div className="truncate text-sm text-[var(--muted)]">{command.description}</div>}
                    </div>
                    {command.shortcut && <Kbd plain>{command.shortcut}</Kbd>}
                  </button>
                );
              })}
              {effectiveResults.map((item, index) => {
                const entryIndex = visibleCommands.length + index;
                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                      entryIndex === selectedIdx ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"
                    }`}
                    key={item.id}
                    id={`palette-result-${index}`}
                    data-testid="palette-result"
                    role="option"
                    aria-selected={entryIndex === selectedIdx}
                    onClick={() => handleSelect(item)}
                    type="button"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                      <ResultIcon type={item.item_type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <SearchHighlight
                        text={item.title}
                        terms={item.highlight_terms ?? [query]}
                        className="truncate text-sm font-semibold text-[var(--text)]"
                      />
                      <div className="truncate text-sm text-[var(--muted)]">
                        <SearchHighlight
                          text={item.context || item.summary || item.item_type}
                          terms={item.highlight_terms ?? [query]}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
