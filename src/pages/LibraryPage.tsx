import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Edit3,
  FileText,
  MoreHorizontal,
  Paperclip,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { MarkdownRenderer } from "../components/common/MarkdownRenderer";
import { TagEditor } from "../components/common/TagEditor";
import { useAppStore } from "../stores/appStore";
import { useAttachmentStore } from "../stores/attachmentStore";
import { useItemStore } from "../stores/itemStore";
import { useSearchStore } from "../stores/searchStore";
import { useTagStore } from "../stores/tagStore";
import { getAllItemTagMappings } from "../services/tauriCommands";
import type { Item } from "../types";

type TabKey = "recent" | "pinned" | "favorite";
type SortOption = "updated" | "created" | "title";

interface LibraryPageProps {
  items: Item[];
  selectedItem: Item;
  onSelectItem: (id: string) => void;
  onCreateItem: () => void;
  onOpenDocument: () => void;
  previewRequest?: {
    itemId: string;
    requestId: number;
  } | null;
  onPreviewItemOpen?: (id: string) => void;
  onPreviewRequestClear?: () => void;
}

const FILTERS: Array<{ key: TabKey; label: string }> = [
  { key: "recent", label: "全部" },
  { key: "pinned", label: "置顶" },
  { key: "favorite", label: "收藏" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryPage({
  items,
  selectedItem,
  onSelectItem,
  onCreateItem,
  onOpenDocument,
  previewRequest,
  onPreviewItemOpen,
  onPreviewRequestClear,
}: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("recent");
  const [activeTag, setActiveTag] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOption>("updated");
  const [itemTagNames, setItemTagNames] = useState<Record<string, string[]>>({});
  const [copied, setCopied] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);

  const theme = useAppStore((s) => s.theme);
  const selectedItemDto = useItemStore((s) => s.selectedItem);
  const deleteItem = useItemStore((s) => s.deleteItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const attachments = useAttachmentStore((s) => s.attachments);
  const fetchAttachments = useAttachmentStore((s) => s.fetchAttachments);
  const addAttachmentAction = useAttachmentStore((s) => s.addAttachment);
  const deleteAttachmentAction = useAttachmentStore((s) => s.deleteAttachment);
  const allTags = useTagStore((s) => s.tags) as { name: string; color: string }[];
  const itemTags = useTagStore((s) => s.itemTags) as { name: string; color: string }[];
  const fetchTags = useTagStore((s) => s.fetchTags);
  const fetchItemTags = useTagStore((s) => s.fetchItemTags);
  const updateItemTagsAction = useTagStore((s) => s.updateItemTags);
  const searchResults = useSearchStore((s) => s.results);
  const searching = useSearchStore((s) => s.searching);
  const search = useSearchStore((s) => s.search);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    if (!selectedItem.id) return;
    fetchAttachments(selectedItem.id);
    fetchItemTags(selectedItem.id);
  }, [selectedItem.id, fetchAttachments, fetchItemTags]);

  useEffect(() => {
    if (!previewRequest?.itemId) return;
    onSelectItem(previewRequest.itemId);
    setReaderOpen(true);
  }, [previewRequest, onSelectItem]);

  useEffect(() => {
    let cancelled = false;
    getAllItemTagMappings()
      .then((mappings) => {
        if (cancelled) return;
        const map: Record<string, string[]> = {};
        for (const [itemId, tagName] of mappings) {
          (map[itemId] ??= []).push(tagName);
        }
        setItemTagNames(map);
      })
      .catch(() => {
        if (!cancelled) setItemTagNames({});
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [query, search]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let base = items;

    if (normalized && searchResults.length > 0) {
      const byId = new Map(items.map((item) => [item.id, item]));
      base = searchResults.map((result) => byId.get(result.id) ?? {
        id: result.id,
        type: "note",
        title: result.title,
        summary: result.summary,
        tags: [],
        time: "搜索结果",
        icon: FileText,
        accent: "cyan",
      });
    } else if (normalized) {
      base = items.filter((item) => {
        const haystack = `${item.title} ${item.summary}`.toLowerCase();
        return haystack.includes(normalized);
      });
    }

    if (activeTag !== "all") {
      base = base.filter((item) => itemTagNames[item.id]?.includes(activeTag));
    }

    if (activeTab === "pinned") base = base.filter((item) => item.pinned);
    if (activeTab === "favorite") base = base.filter((item) => item.favorite);

    return [...base].sort((a, b) => {
      if (sortOrder === "title") return a.title.localeCompare(b.title);
      return 0;
    });
  }, [activeTab, activeTag, itemTagNames, items, query, searchResults, sortOrder]);

  async function handleCopy() {
    const selectedContent =
      selectedItemDto?.id === selectedItem.id ? selectedItemDto.content : "";
    const text = selectedContent || selectedItem.summary || selectedItem.title;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function handleToggleFavorite() {
    if (!selectedItem.id) return;
    await updateItem(selectedItem.id, { favorite: !selectedItem.favorite });
  }

  async function handleTogglePin() {
    if (!selectedItem.id) return;
    await updateItem(selectedItem.id, { pinned: !selectedItem.pinned });
  }

  async function handleDelete() {
    if (!selectedItem.id) return;
    await deleteItem(selectedItem.id);
    setReaderOpen(false);
    onPreviewRequestClear?.();
  }

  async function handleAddAttachment() {
    if (!selectedItem.id) return;
    const selected = await open({ multiple: false });
    if (selected) await addAttachmentAction(selectedItem.id, selected);
  }

  async function handleOpenAttachment(path: string) {
    await openPath(path);
  }

  async function handleTagChange(tagNames: string[]) {
    if (!selectedItem.id) return;
    await updateItemTagsAction(selectedItem.id, tagNames);
  }

  function handleOpenItem(id: string) {
    onSelectItem(id);
    onPreviewItemOpen?.(id);
    setReaderOpen(true);
  }

  function handleCloseReader() {
    setReaderOpen(false);
    onPreviewRequestClear?.();
  }

  const hasSelection = readerOpen && Boolean(selectedItem.id);
  const previewContent =
    selectedItemDto?.id === selectedItem.id ? selectedItemDto.content : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
      <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-[var(--text)]">记录库</h1>
              <p className="text-sm text-[var(--muted)]">搜索、查看和管理已经保存的记录。</p>
            </div>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90"
              type="button"
              onClick={onCreateItem}
            >
              <Edit3 className="h-4 w-4" />
              新建
            </button>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-[var(--muted)]">
              <Search className="h-4 w-4 shrink-0" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={query}
                placeholder="搜索记录"
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
              {searching && <span className="text-xs">搜索中</span>}
            </div>

            <details className="relative">
              <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-[var(--line)] bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-3 shadow-xl">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">筛选</div>
                <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-[var(--field)] p-1">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`rounded-lg px-2 py-1.5 text-sm ${activeTab === filter.key ? "bg-[var(--paper)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                      onClick={() => setActiveTab(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs text-[var(--muted)]">排序</span>
                  <select
                    className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOption)}
                  >
                    <option value="updated">最近更新</option>
                    <option value="created">创建时间</option>
                    <option value="title">标题排序</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-[var(--muted)]">标签</span>
                  <select
                    className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none"
                    value={activeTag}
                    onChange={(e) => setActiveTag(e.target.value)}
                  >
                    <option value="all">全部标签</option>
                    {allTags.map((tag) => (
                      <option key={tag.name} value={tag.name}>{tag.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
            {visibleItems.length === 0 ? (
              <div className="grid h-full place-items-center px-8 text-center">
                <div>
                  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-[var(--text)]">还没有可显示的记录</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">写下第一条，或者换个关键词搜索。</div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--hover)]"
                    type="button"
                    onClick={() => handleOpenItem(item.id)}
                  >
                    {(() => {
                      const Icon = item.icon;
                      return (
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                          <Icon className="h-4 w-4" />
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">{item.title || "未命名"}</div>
                        {item.pinned && <Star className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary || "无正文预览"}</div>
                    </div>
                    <span className="mt-1 shrink-0 text-xs text-[var(--muted)]">{item.time}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {hasSelection && (
        <section className="fixed inset-x-3 bottom-3 top-14 z-30 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-2xl">
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                {(() => {
                  const SelectedIcon = selectedItem.icon;
                  return <SelectedIcon className="h-4 w-4" />;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-[var(--text)]">{selectedItem.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                  <span>{selectedItem.time}</span>
                  {itemTags.map((tag) => (
                    <span key={tag.name} className="rounded-full bg-[var(--field)] px-2 py-0.5">
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </div>
              <details className="relative shrink-0">
                <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
                  <MoreHorizontal className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl">
                  <button className="menu-item" type="button" onClick={handleTogglePin}><Star className="h-4 w-4" />{selectedItem.pinned ? "取消置顶" : "置顶"}</button>
                  <button className="menu-item" type="button" onClick={handleToggleFavorite}><Star className="h-4 w-4" />{selectedItem.favorite ? "取消收藏" : "收藏"}</button>
                  <button className="menu-item" type="button" onClick={handleCopy}><Copy className="h-4 w-4" />{copied ? "已复制" : "复制内容"}</button>
                  <button className="menu-item" type="button" onClick={handleAddAttachment}><Paperclip className="h-4 w-4" />添加附件</button>
                  <button className="menu-item" type="button" onClick={onOpenDocument}><Edit3 className="h-4 w-4" />完整编辑</button>
                  <button className="menu-item text-red-400" type="button" onClick={handleDelete}><Trash2 className="h-4 w-4" />删除</button>
                </div>
              </details>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" onClick={onOpenDocument} title="编辑当前笔记">
                <Edit3 className="h-4 w-4" />
              </button>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" onClick={handleCloseReader} title="关闭">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <MarkdownRenderer
                content={previewContent || selectedItem.summary || ""}
                theme={theme === "light" ? "light" : "dark"}
              />
            </div>

            <footer className="shrink-0 border-t border-[var(--line)] px-4 py-3">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
                  <Tag className="h-4 w-4" />
                  标签与附件
                </summary>
                <div className="mt-3 space-y-3">
                  <TagEditor selectedTags={itemTags.map((tag) => tag.name)} onChange={handleTagChange} />
                  {attachments.length > 0 && (
                    <div className="space-y-1">
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 rounded-xl bg-[var(--field)] px-3 py-2 text-sm">
                          <Paperclip className="h-4 w-4 text-[var(--muted)]" />
                          <button className="min-w-0 flex-1 truncate text-left text-[var(--text)]" type="button" onClick={() => handleOpenAttachment(att.file_path)}>
                            {att.filename}
                          </button>
                          <span className="shrink-0 text-xs text-[var(--muted)]">{formatFileSize(att.file_size)}</span>
                          <button className="text-[var(--muted)] hover:text-red-400" type="button" onClick={() => deleteAttachmentAction(att.id)}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </footer>
          </div>
        </section>
      )}
    </div>
  );
}
