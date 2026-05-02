import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { MarkdownRenderer } from "../components/common/MarkdownRenderer";
import { Select } from "../components/common/Select";
import { SkeletonList } from "../components/common/Skeleton";
import { TagPickerModal } from "../components/common/TagPickerModal";
import { TagManagerModal } from "../components/common/TagManagerModal";
import { AttachmentManagerModal } from "../components/common/AttachmentManagerModal";
import { useAppStore } from "../stores/appStore";
import { useAttachmentStore } from "../stores/attachmentStore";
import { useItemStore } from "../stores/itemStore";
import { useSearchStore } from "../stores/searchStore";
import { useTagStore } from "../stores/tagStore";
import { useToastStore } from "../stores/toastStore";
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
  const [readerOpen, setReaderOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const filterDetailsRef = useRef<HTMLDetailsElement>(null);
  const menuDetailsRef = useRef<HTMLDetailsElement>(null);

  const theme = useAppStore((s) => s.theme);
  const selectedItemDto = useItemStore((s) => s.selectedItem);
  const loading = useItemStore((s) => s.loading);
  const deleteItem = useItemStore((s) => s.deleteItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const fetchLibraryData = useItemStore((s) => s.fetchLibraryData);
  const itemTagNames = useItemStore((s) => s.itemTagNames);
  const setItemTagNames = useItemStore((s) => s.setItemTagNames);
  const attachments = useAttachmentStore((s) => s.attachments);
  const fetchAttachments = useAttachmentStore((s) => s.fetchAttachments);
  const addAttachmentAction = useAttachmentStore((s) => s.addAttachment);
  const allTags = useTagStore((s) => s.tags) as { name: string; color: string }[];
  const itemTags = useTagStore((s) => s.itemTags) as { name: string; color: string }[];
  const setTags = useTagStore((s) => s.setTags);
  const fetchItemTags = useTagStore((s) => s.fetchItemTags);
  const updateItemTagsAction = useTagStore((s) => s.updateItemTags);
  const searchResults = useSearchStore((s) => s.results);
  const searching = useSearchStore((s) => s.searching);
  const search = useSearchStore((s) => s.search);

  const loadLibraryData = useCallback(() => {
    fetchLibraryData().then((result) => {
      setTags(result.tags);
    });
  }, [fetchLibraryData, setTags]);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const filter = filterDetailsRef.current;
      if (filter && filter.open && !filter.contains(e.target as Node)) {
        filter.open = false;
      }
      const menu = menuDetailsRef.current;
      if (menu && menu.open && !menu.contains(e.target as Node)) {
        menu.open = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleE2eDataChanged() {
      loadLibraryData();
      if (selectedItem.id) {
        fetchAttachments(selectedItem.id);
        fetchItemTags(selectedItem.id);
      }
    }

    window.addEventListener("quantanote:e2e-data-changed", handleE2eDataChanged);
    return () => window.removeEventListener("quantanote:e2e-data-changed", handleE2eDataChanged);
  }, [fetchAttachments, fetchItemTags, loadLibraryData, selectedItem.id]);

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
        type: "note" as const,
        title: result.title,
        summary: result.summary,
        tags: [],
        time: "搜索结果",
        icon: FileText,
        accent: "cyan",
        createdAt: "",
        updatedAt: "",
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
      if (sortOrder === "updated") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      if (sortOrder === "created") return (b.createdAt || "").localeCompare(a.createdAt || "");
      return 0;
    });
  }, [activeTab, activeTag, itemTagNames, items, query, searchResults, sortOrder]);

  async function handleCopy() {
    const selectedContent =
      selectedItemDto?.id === selectedItem.id ? selectedItemDto.content : "";
    const text = selectedContent || selectedItem.summary || selectedItem.title;
    try {
      await navigator.clipboard.writeText(text);
      useToastStore.getState().addToast("success", "已复制到剪贴板");
    } catch {
      useToastStore.getState().addToast("error", "复制失败");
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
    try {
      await deleteItem(selectedItem.id);
      setReaderOpen(false);
      onPreviewRequestClear?.();
      useToastStore.getState().addToast("success", "记录已删除");
    } catch {
      useToastStore.getState().addToast("error", "删除失败");
    }
  }

  async function handleAddAttachment() {
    if (!selectedItem.id) return;
    const selected = await open({ multiple: false });
    if (selected) await addAttachmentAction(selectedItem.id, selected);
  }

  async function handleTagChange(tagNames: string[]) {
    if (!selectedItem.id) return;
    await updateItemTagsAction(selectedItem.id, tagNames);
    setItemTagNames(selectedItem.id, tagNames);
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] px-[clamp(1rem,4vw,4rem)] py-4">
      <section className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
            <div>
              <h1 className="app-hero-title text-[var(--text)]">记录库</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">搜索、查看和管理已经保存的记录。</p>
            </div>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90"
              type="button"
              data-testid="library-new-btn"
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
                data-testid="library-search-input"
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
              {searching && <span className="text-xs">搜索中</span>}
            </div>

            <details ref={filterDetailsRef} className="relative">
              <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-[var(--line)] bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden" data-testid="library-filter-btn">
                <SlidersHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-4 shadow-2xl" data-testid="library-filter-panel">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">筛选</div>
                <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-[var(--field)] p-1">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${activeTab === filter.key ? "bg-[var(--paper)] text-[var(--accent)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                      onClick={() => setActiveTab(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">排序</span>
                  <Select
                    value={sortOrder}
                    onChange={(v) => setSortOrder(v as SortOption)}
                    options={[
                      { value: "updated", label: "最近更新" },
                      { value: "created", label: "创建时间" },
                      { value: "title", label: "标题排序" },
                    ]}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">标签</span>
                  <Select
                    value={activeTag}
                    onChange={setActiveTag}
                    options={[
                      { value: "all", label: "全部标签" },
                      ...allTags.map((tag) => ({ value: tag.name, label: tag.name })),
                    ]}
                  />
                </label>
              </div>
            </details>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
            {loading && visibleItems.length === 0 ? (
              <SkeletonList count={6} />
            ) : visibleItems.length === 0 ? (
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
                    data-testid="library-item"
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
                      <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">{item.summary || "无正文预览"}</div>
                      <div className="mt-1.5 min-h-[1.25rem]">
                        {itemTagNames[item.id] && itemTagNames[item.id].length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {itemTagNames[item.id].slice(0, 3).map((tagName) => (
                              <span key={tagName} className="rounded-full bg-[var(--field)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                                #{tagName}
                              </span>
                            ))}
                            {itemTagNames[item.id].length > 3 && (
                              <span className="text-[10px] text-[var(--muted)]">+{itemTagNames[item.id].length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="mt-1 shrink-0 text-xs text-[var(--muted)]">{item.time}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
      </section>

      {hasSelection && (
        <section className="fixed inset-x-3 bottom-8 top-14 z-30 mx-auto overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-2xl" style={{ maxWidth: "42rem" }} data-testid="reader-drawer">
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
              <details ref={menuDetailsRef} className="relative shrink-0">
                <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden" data-testid="reader-menu-btn" aria-label="更多操作">
                  <MoreHorizontal className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl">
                  <button className="menu-item" type="button" onClick={() => { handleTogglePin(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Star className="h-4 w-4" />{selectedItem.pinned ? "取消置顶" : "置顶"}</button>
                  <button className="menu-item" type="button" onClick={() => { handleToggleFavorite(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Star className="h-4 w-4" />{selectedItem.favorite ? "取消收藏" : "收藏"}</button>
                  <button className="menu-item" type="button" onClick={() => { handleCopy(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Copy className="h-4 w-4" />复制内容</button>
                  <button className="menu-item" type="button" onClick={() => { handleAddAttachment(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Paperclip className="h-4 w-4" />添加附件</button>
                  <button className="menu-item" type="button" onClick={() => { onOpenDocument(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Edit3 className="h-4 w-4" />完整编辑</button>
                  <button className="menu-item text-red-400" type="button" onClick={() => { handleDelete(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Trash2 className="h-4 w-4" />删除</button>
                </div>
              </details>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="reader-edit-btn" aria-label="编辑当前笔记" onClick={onOpenDocument} title="编辑当前笔记">
                <Edit3 className="h-4 w-4" />
              </button>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="reader-close-btn" aria-label="关闭" onClick={handleCloseReader} title="关闭">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-4" onCopy={() => useToastStore.getState().addToast("success", "已复制到剪贴板")}>
              <MarkdownRenderer
                content={previewContent || selectedItem.summary || ""}
                theme={theme === "light" ? "light" : "dark"}
              />
            </div>

            <footer className="shrink-0 border-t border-[var(--line)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {itemTags.map((tag) => (
                  <span key={tag.name} className="rounded-full bg-[var(--field)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    #{tag.name}
                  </span>
                ))}
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--field)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  type="button"
                  data-testid="reader-tags-btn"
                  onClick={() => setTagModalOpen(true)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  标签
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--field)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  type="button"
                  data-testid="reader-attachments-btn"
                  onClick={() => setAttachmentModalOpen(true)}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  附件{attachments.length > 0 ? ` (${attachments.length})` : ""}
                </button>
              </div>

              <TagPickerModal
                open={tagModalOpen}
                onClose={() => setTagModalOpen(false)}
                selectedTags={itemTags.map((t) => t.name)}
                onChange={handleTagChange}
                onOpenManager={() => {
                  setTagModalOpen(false);
                  setTagManagerOpen(true);
                }}
              />
              <TagManagerModal
                open={tagManagerOpen}
                onClose={() => {
                  setTagManagerOpen(false);
                  loadLibraryData();
                  if (selectedItem.id) {
                    fetchItemTags(selectedItem.id);
                  }
                }}
              />
              <AttachmentManagerModal
                open={attachmentModalOpen}
                onClose={() => setAttachmentModalOpen(false)}
                itemId={selectedItem.id}
              />
            </footer>
          </div>
        </section>
      )}
    </div>
  );
}
