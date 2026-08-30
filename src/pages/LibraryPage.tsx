import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Bookmark,
  CalendarDays,
  Edit3,
  FileText,
  MoreHorizontal,
  Paperclip,
  Search,
  ListFilter,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { MarkdownPreviewWithOutline } from "../components/common/MarkdownPreviewWithOutline";
import { NoteLinksPanel } from "../components/links/NoteLinksPanel";
import { DocumentOutlineToggle } from "../components/editor/DocumentOutline";
import { ContentWidthControl } from "../components/common/ContentWidthControl";
import { Select } from "../components/common/Select";
import { SkeletonList } from "../components/common/Skeleton";
import { TagPickerModal } from "../components/common/TagPickerModal";
import { TagManagerModal } from "../components/common/TagManagerModal";
import { AttachmentManagerModal } from "../components/common/AttachmentManagerModal";
import { TrashModal } from "../components/common/TrashModal";
import { VirtualItemList } from "../components/common/VirtualItemList";
import { SearchHighlight } from "../components/common/SearchHighlight";
import { CalendarView } from "../components/common/CalendarView";
import { useAppStore } from "../stores/appStore";
import { APP_COMMAND_EVENT, getAppCommandId } from "../utils/appCommands";
import { useAttachmentStore } from "../stores/attachmentStore";
import { useItemStore } from "../stores/itemStore";
import { useSearchStore } from "../stores/searchStore";
import { useTagStore } from "../stores/tagStore";
import { useToastStore } from "../stores/toastStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useResponsiveContentWidth } from "../hooks/useResponsiveContentWidth";
import { CONTENT_WIDTH_OUTLINE_LAYOUT, CONTENT_WIDTH_PREVIEW_BASE } from "../utils/contentWidth";
import { MOBILE_BACK_EVENT } from "../utils/platform";
import { nativeLog } from "../utils/nativeLog";
import { getVditorLang } from "../utils/vditorConfig";
import { copyTextToSystemClipboard } from "../utils/clipboard";
import { removeAttachmentReferences } from "../utils/markdownAttachments";
import type { Item, ItemType } from "../types";
import type { AttachmentDto } from "../stores/attachmentStore";
import { getAttachmentItemIds, getNoteLinks, getRecordDateCounts, type NoteLinkDto, type SearchMode, type SearchScope } from "../services/tauriCommands";
import { DEFAULT_NOTE_PROPERTIES } from "../utils/frontmatter";
import { createSavedSearchId, DEFAULT_SMART_COLLECTIONS, type SavedSearchCriteria, type SavedSearchItemType, type SavedSearchTimeRange } from "../utils/savedSearches";
import { getMonthRange, shiftMonth } from "../utils/dailyNotes";

type TabKey = "recent" | "pinned" | "favorite";
type SortOption = "updated" | "created" | "title" | "priority" | "due";

function isWithinTimeRange(timestamp: string, range: SavedSearchTimeRange): boolean {
  if (range === "all") return true;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return false;
  const now = new Date();
  if (range === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return time >= startOfDay;
  }
  const days = range === "7d" ? 7 : 30;
  return time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function isIncompleteStatus(status: string): boolean {
  return !["done", "completed", "archived"].includes(status.toLowerCase());
}

interface LibraryPageProps {
  items: Item[];
  selectedItem: Item;
  onSelectItem: (id: string) => void;
  onOpenLinkedNote?: (title: string, targetId: string | null) => void;
  onCreateItem: () => void;
  onOpenDocument: () => void;
  onOpenDailyNote?: (dateKey: string) => void;
  previewRequest?: {
    itemId: string;
    requestId: number;
  } | null;
  onPreviewItemOpen?: (id: string) => void;
  onPreviewRequestClear?: () => void;
  onReaderOpenChange?: (isOpen: boolean) => void;
  onModalStateChange?: (modalOpen: boolean) => void;
}

export function LibraryPage({
  items,
  selectedItem,
  onSelectItem,
  onOpenLinkedNote,
  onCreateItem,
  onOpenDocument,
  onOpenDailyNote,
  previewRequest,
  onPreviewItemOpen,
  onPreviewRequestClear,
  onReaderOpenChange,
  onModalStateChange,
}: LibraryPageProps) {
  const { t } = useTranslation(["library", "common"]);
  const contentWidthProgress = useSettingsStore((s) => s.settings.contentWidthProgress);
  const showDocumentOutline = useSettingsStore((s) => s.settings.showDocumentOutline);
  const savedSearches = useSettingsStore((s) => s.settings.savedSearches);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const FILTERS: Array<{ key: TabKey; label: string }> = [
    { key: "recent", label: t("library:filter.all") },
    { key: "pinned", label: t("library:filter.pinned") },
    { key: "favorite", label: t("library:filter.favorite") },
  ];

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("recent");
  const [activeTag, setActiveTag] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOption>("updated");
  const [propertyStatus, setPropertyStatus] = useState("all");
  const [propertyPriority, setPropertyPriority] = useState("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<SavedSearchItemType>("all");
  const [timeRange, setTimeRange] = useState<SavedSearchTimeRange>("all");
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [hasAttachmentsOnly, setHasAttachmentsOnly] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("");
  const [attachmentItemIds, setAttachmentItemIds] = useState<Set<string>>(new Set());
  const [searchMode, setSearchMode] = useState<SearchMode>("normal");
  const [searchScopes, setSearchScopes] = useState<SearchScope[]>(["content"]);
  const [readerOpen, setReaderOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const filterDetailsRef = useRef<HTMLDetailsElement>(null);
  const menuDetailsRef = useRef<HTMLDetailsElement>(null);

  const theme = useAppStore((s) => s.theme);
  const selectedItemDto = useItemStore((s) => s.selectedItem);
  const loading = useItemStore((s) => s.loading);
  const deleteItem = useItemStore((s) => s.deleteItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const fetchLibraryData = useItemStore((s) => s.fetchLibraryData);
  const libraryTotal = useItemStore((s) => s.libraryTotal);
  const libraryLoadingMore = useItemStore((s) => s.libraryLoadingMore);
  const itemTagNames = useItemStore((s) => s.itemTagNames);
  const setItemTagNames = useItemStore((s) => s.setItemTagNames);
  const attachments = useAttachmentStore((s) => s.attachments);
  const fetchAttachments = useAttachmentStore((s) => s.fetchAttachments);
  const addAttachmentAction = useAttachmentStore((s) => s.addAttachment);
  const deleteAttachment = useAttachmentStore((s) => s.deleteAttachment);
  const allTags = useTagStore((s) => s.tags) as { name: string; color: string }[];
  const itemTags = useTagStore((s) => s.itemTags) as { name: string; color: string }[];
  const setTags = useTagStore((s) => s.setTags);
  const fetchItemTags = useTagStore((s) => s.fetchItemTags);
  const updateItemTagsAction = useTagStore((s) => s.updateItemTags);
  const searchResults = useSearchStore((s) => s.results);
  const searchTotal = useSearchStore((s) => s.total);
  const searching = useSearchStore((s) => s.searching);
  const searchLoadingMore = useSearchStore((s) => s.loadingMore);
  const searchHasMore = useSearchStore((s) => s.hasMore);
  const search = useSearchStore((s) => s.search);
  const loadMoreSearch = useSearchStore((s) => s.loadMore);

  const propertyStatusOptions = useMemo(() => {
    const values = Array.from(new Set(["all", "incomplete", ...items.map((item) => item.properties.status)]));
    const labels: Record<string, string> = {
      all: t("library:filter.allStatuses"),
      inbox: t("common:noteProperties.statuses.inbox"),
      "in-progress": t("common:noteProperties.statuses.inProgress"),
      done: t("common:noteProperties.statuses.done"),
      archived: t("common:noteProperties.statuses.archived"),
      incomplete: t("library:filter.incomplete"),
    };
    return values.map((value) => ({ value, label: labels[value] ?? value }));
  }, [items, t]);
  const propertyPriorityOptions = useMemo(() => [
    { value: "all", label: t("library:filter.allPriorities") },
    { value: "none", label: t("common:noteProperties.priorities.none") },
    { value: "low", label: t("common:noteProperties.priorities.low") },
    { value: "medium", label: t("common:noteProperties.priorities.medium") },
    { value: "high", label: t("common:noteProperties.priorities.high") },
  ], [t]);

  const listOptions = useMemo(
    () => ({
      tab: activeTab,
      tag: activeTag,
      sort: sortOrder === "priority" || sortOrder === "due" ? "updated" : sortOrder,
      itemType: itemTypeFilter === "all" ? undefined : itemTypeFilter,
    }),
    [activeTab, activeTag, itemTypeFilter, sortOrder],
  );
  const searchOptions = useMemo(
    () => ({ ...listOptions, mode: searchMode, scopes: searchScopes }),
    [listOptions, searchMode, searchScopes],
  );
  const currentSearchCriteria = useMemo<SavedSearchCriteria>(() => ({
    query,
    activeTab,
    tag: activeTag,
    sort: sortOrder,
    searchMode,
    searchScopes,
    status: propertyStatus,
    priority: propertyPriority as SavedSearchCriteria["priority"],
    type: itemTypeFilter,
    timeRange,
    untagged: untaggedOnly,
    hasAttachments: hasAttachmentsOnly,
  }), [activeTab, activeTag, hasAttachmentsOnly, itemTypeFilter, propertyPriority, propertyStatus, query, searchMode, searchScopes, sortOrder, timeRange, untaggedOnly]);

  const loadLibraryData = useCallback((append = false) => {
    fetchLibraryData(listOptions, append).then((result) => {
      if (!append) setTags(result.tags);
    });
  }, [fetchLibraryData, listOptions, setTags]);

  const refreshAttachmentItemIds = useCallback(async () => {
    try {
      const ids = await getAttachmentItemIds();
      setAttachmentItemIds(new Set(ids));
    } catch {
      setAttachmentItemIds(new Set());
    }
  }, []);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  useEffect(() => {
    if (!calendarOpen) return;
    let active = true;
    const { startDate, endDate } = getMonthRange(calendarMonth);
    setCalendarLoading(true);
    getRecordDateCounts(startDate, endDate)
      .then((rows) => {
        if (!active) return;
        setCalendarCounts(Object.fromEntries(rows.map((row) => [row.date, row.count])));
      })
      .catch(() => {
        if (active) setCalendarCounts({});
      })
      .finally(() => {
        if (active) setCalendarLoading(false);
      });
    return () => {
      active = false;
    };
  }, [calendarMonth, calendarOpen, calendarRefreshToken]);

  useEffect(() => {
    refreshAttachmentItemIds();
  }, [refreshAttachmentItemIds]);

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
        setDeleteConfirming(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleE2eDataChanged() {
      loadLibraryData();
      refreshAttachmentItemIds();
      setCalendarRefreshToken((token) => token + 1);
      if (selectedItem.id) {
        fetchAttachments(selectedItem.id);
        fetchItemTags(selectedItem.id);
      }
    }

    window.addEventListener("quantanote:e2e-data-changed", handleE2eDataChanged);
    return () => window.removeEventListener("quantanote:e2e-data-changed", handleE2eDataChanged);
  }, [fetchAttachments, fetchItemTags, loadLibraryData, refreshAttachmentItemIds, selectedItem.id]);

  useEffect(() => {
    if (!selectedItem.id) return;
    fetchAttachments(selectedItem.id);
    fetchItemTags(selectedItem.id);
    setDeleteConfirming(false);
  }, [selectedItem.id, fetchAttachments, fetchItemTags]);

  useEffect(() => {
    if (!previewRequest?.itemId) return;
    onSelectItem(previewRequest.itemId);
    setReaderOpen(true);
  }, [previewRequest, onSelectItem]);

  // 通知父组件 readerOpen 状态变化
  useEffect(() => {
    onReaderOpenChange?.(readerOpen);
    return () => { onReaderOpenChange?.(false); };
  }, [readerOpen, onReaderOpenChange]);

  // 通知父组件模态框状态变化
  useEffect(() => {
    const anyOpen = tagModalOpen || tagManagerOpen || attachmentModalOpen || trashModalOpen;
    onModalStateChange?.(anyOpen);
    return () => { onModalStateChange?.(false); };
  }, [tagModalOpen, tagManagerOpen, attachmentModalOpen, trashModalOpen, onModalStateChange]);

  useEffect(() => {
    if (!readerOpen) return;

    function handleMobileBack(e: Event) {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        nativeLog("info", "[QuantaNote][mobile-back] reader ignored because dialog is open");
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (menuDetailsRef.current?.open) {
        nativeLog("info", "[QuantaNote][mobile-back] close reader overflow menu");
        menuDetailsRef.current.open = false;
        setDeleteConfirming(false);
        return;
      }
      nativeLog("info", "[QuantaNote][mobile-back] close reader drawer");
      handleCloseReader();
    }

    window.addEventListener(MOBILE_BACK_EVENT, handleMobileBack);
    return () => window.removeEventListener(MOBILE_BACK_EVENT, handleMobileBack);
  }, [readerOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query, itemTypeFilter === "all" ? undefined : itemTypeFilter, searchOptions).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [itemTypeFilter, query, search, searchOptions]);

  const searchMetadataById = useMemo(
    () => new Map(searchResults.map((result) => [result.id, result])),
    [searchResults],
  );

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let base: Item[] = items;

    if (normalized) {
      const byId = new Map(items.map((item) => [item.id, item]));
      base = searchResults.map((result) => byId.get(result.id) ?? {
          id: result.id,
          type: (result.item_type || "note") as Item["type"],
          title: result.title,
          summary: result.summary,
          tags: [],
          time: t("library:searchResult"),
          icon: FileText,
          accent: "cyan",
          pinned: result.pinned,
          favorite: result.favorite,
           createdAt: result.created_at ?? "",
           updatedAt: result.updated_at ?? "",
           properties: byId.get(result.id)?.properties ?? { ...DEFAULT_NOTE_PROPERTIES, aliases: [] },
         });
    }

    if (activeTag !== "all") {
      base = base.filter((item) => itemTagNames[item.id]?.includes(activeTag));
    }

    if (activeTab === "pinned") base = base.filter((item) => item.pinned);
    if (activeTab === "favorite") base = base.filter((item) => item.favorite);
    if (itemTypeFilter !== "all") base = base.filter((item) => item.type === itemTypeFilter);
    if (propertyStatus !== "all") {
      base = propertyStatus === "incomplete"
        ? base.filter((item) => isIncompleteStatus(item.properties.status))
        : base.filter((item) => item.properties.status === propertyStatus);
    }
    if (propertyPriority !== "all") base = base.filter((item) => item.properties.priority === propertyPriority);
    if (timeRange !== "all") base = base.filter((item) => isWithinTimeRange(item.updatedAt, timeRange));
    if (untaggedOnly) base = base.filter((item) => (itemTagNames[item.id] ?? []).length === 0);
    if (hasAttachmentsOnly) base = base.filter((item) => attachmentItemIds.has(item.id));

    return [...base].sort((a, b) => {
      if (sortOrder === "title") return a.title.localeCompare(b.title);
      if (sortOrder === "updated") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      if (sortOrder === "created") return (b.createdAt || "").localeCompare(a.createdAt || "");
      if (sortOrder === "priority") {
        const priorityRank = { none: 0, low: 1, medium: 2, high: 3 };
        return (priorityRank[b.properties.priority] ?? 0) - (priorityRank[a.properties.priority] ?? 0)
          || (b.updatedAt || "").localeCompare(a.updatedAt || "");
      }
      if (sortOrder === "due") {
        const aDue = a.properties.dueDate ?? "9999-12-31";
        const bDue = b.properties.dueDate ?? "9999-12-31";
        return aDue.localeCompare(bDue) || (b.updatedAt || "").localeCompare(a.updatedAt || "");
      }
      return 0;
    });
  }, [activeTab, activeTag, attachmentItemIds, hasAttachmentsOnly, itemTagNames, itemTypeFilter, items, propertyPriority, propertyStatus, query, searchResults, sortOrder, t, timeRange, untaggedOnly]);

  const normalizedQuery = query.trim();
  const hasLocalFilter = propertyStatus !== "all"
    || propertyPriority !== "all"
    || itemTypeFilter !== "all"
    || timeRange !== "all"
    || untaggedOnly
    || hasAttachmentsOnly;
  const resultTotal = hasLocalFilter
    ? visibleItems.length
    : normalizedQuery
    ? searchTotal
    : (libraryTotal > 0 || items.length === 0 ? libraryTotal : items.length);
  const hasMore = normalizedQuery ? searchHasMore : items.length < libraryTotal;
  const handleLoadMore = useCallback(() => {
    if (normalizedQuery) {
      return loadMoreSearch(itemTypeFilter === "all" ? undefined : itemTypeFilter, searchOptions);
    }
    return loadLibraryData(true);
  }, [loadLibraryData, loadMoreSearch, normalizedQuery, searchOptions]);

  function toggleSearchScope(scope: SearchScope) {
    setSearchScopes((current) => {
      if (current.includes(scope)) {
        return current.length === 1 ? current : current.filter((item) => item !== scope);
      }
      return [...current, scope];
    });
  }

  function applySearchCriteria(criteria: SavedSearchCriteria) {
    setQuery(criteria.query);
    setActiveTab(criteria.activeTab);
    setActiveTag(criteria.tag);
    setSortOrder(criteria.sort);
    setSearchMode(criteria.searchMode);
    setSearchScopes(criteria.searchScopes);
    setPropertyStatus(criteria.status);
    setPropertyPriority(criteria.priority);
    setItemTypeFilter(criteria.type);
    setTimeRange(criteria.timeRange);
    setUntaggedOnly(criteria.untagged);
    setHasAttachmentsOnly(criteria.hasAttachments);
    if (filterDetailsRef.current) filterDetailsRef.current.open = false;
  }

  function handleSaveSearch() {
    const name = savedSearchName.trim();
    if (!name) return;
    updateSetting("savedSearches", [
      ...savedSearches,
      { id: createSavedSearchId(), name, ...currentSearchCriteria },
    ]);
    setSavedSearchName("");
    useToastStore.getState().addToast("success", t("library:savedSearch.saved"));
  }

  function handleDeleteSavedSearch(id: string) {
    updateSetting("savedSearches", savedSearches.filter((searchItem) => searchItem.id !== id));
    useToastStore.getState().addToast("success", t("library:savedSearch.deleted"));
  }

  async function handleCopy() {
    const selectedContent =
      selectedItemDto?.id === selectedItem.id ? selectedItemDto.content : "";
    const text = selectedContent || selectedItem.summary || selectedItem.title;
    try {
      await copyTextToSystemClipboard(text);
      useToastStore.getState().addToast("success", t("common:toast.copySuccess"));
    } catch {
      useToastStore.getState().addToast("error", t("common:toast.copyFailed"));
    }
  }

  const handleDeleteAttachment = useCallback(async (attachment: AttachmentDto) => {
    if (!(await deleteAttachment(attachment.id))) return false;
    const currentContent = selectedItemDto?.id === selectedItem.id ? selectedItemDto.content : "";
    const nextContent = removeAttachmentReferences(currentContent, attachment.id);
    if (nextContent !== currentContent) {
      await updateItem(selectedItem.id, { content: nextContent });
    }
    return true;
  }, [deleteAttachment, selectedItem.id, selectedItemDto, updateItem]);

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
      useToastStore.getState().addToast("success", t("library:toast.movedToTrash"));
    } catch {
      useToastStore.getState().addToast("error", t("common:toast.deleteFailed"));
    }
  }

  async function handleAddAttachment() {
    if (!selectedItem.id) return;
    const selected = await open({ multiple: false });
    if (selected) await addAttachmentAction(selectedItem.id, selected);
  }

  useEffect(() => {
    function handleAppCommand(event: Event) {
      if (getAppCommandId(event) !== "manage-attachments" || !selectedItem.id) return;
      setReaderOpen(true);
      setAttachmentModalOpen(true);
    }

    window.addEventListener(APP_COMMAND_EVENT, handleAppCommand);
    return () => window.removeEventListener(APP_COMMAND_EVENT, handleAppCommand);
  }, [selectedItem.id]);

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

  const handleMarkdownNoteLink = useCallback(async (targetTitle: string) => {
    if (!selectedItem.id || !onOpenLinkedNote) return;
    try {
      const links = await getNoteLinks(selectedItem.id);
      const normalizedTarget = targetTitle.trim().toLocaleLowerCase();
      const link = links.find((candidate: NoteLinkDto) => candidate.target_title.trim().toLocaleLowerCase() === normalizedTarget);
      if (link) onOpenLinkedNote(targetTitle, link.target_id);
    } catch {
      // The links panel displays the load error; a failed click should not create a duplicate note.
    }
  }, [onOpenLinkedNote, selectedItem.id]);

  function handleCloseReader() {
    setReaderOpen(false);
    setDeleteConfirming(false);
    onPreviewRequestClear?.();
  }

  const hasSelection = readerOpen && Boolean(selectedItem.id);
  const readerWidth = useResponsiveContentWidth<HTMLElement>({
    baseWidth: CONTENT_WIDTH_PREVIEW_BASE + (showDocumentOutline ? CONTENT_WIDTH_OUTLINE_LAYOUT : 0),
    progress: contentWidthProgress,
    horizontalGutter: 24,
    enabled: hasSelection,
  });
  const previewContent =
    selectedItemDto?.id === selectedItem.id ? selectedItemDto.content : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] px-3 py-3 sm:px-[clamp(1rem,4vw,4rem)] sm:py-4">
      <section className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="app-hero-title text-[var(--text)]">{t("library:title")}</h1>
              <p className="mt-1 hidden text-sm text-[var(--muted)] sm:block">{t("library:subtitle")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--line)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                type="button"
                data-testid="library-trash-btn"
                aria-label={t("library:trash.title")}
                onClick={() => setTrashModalOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t("library:trash.title")}</span>
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90"
                type="button"
                data-testid="library-new-btn"
                onClick={onCreateItem}
              >
                <Edit3 className="h-4 w-4" />
                {t("library:newBtn")}
              </button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-stretch border-b border-[var(--line)]" role="tablist" aria-label={t("library:filter.title")}>
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  data-testid={`library-tab-${filter.key}`}
                  className={`h-10 border-b-2 px-3 text-sm font-medium transition-colors ${activeTab === filter.key ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--text)]"}`}
                  role="tab"
                  aria-selected={activeTab === filter.key}
                  aria-pressed={activeTab === filter.key}
                  onClick={() => setActiveTab(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-[var(--muted)]">
              <Search className="h-4 w-4 shrink-0" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={query}
                placeholder={t("library:searchPlaceholder")}
                data-testid="library-search-input"
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
              {searching && <span className="text-xs">{t("library:searching")}</span>}
            </div>

            <details ref={filterDetailsRef} className="relative">
              <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden" data-testid="library-filter-btn" aria-label={t("library:filter.title")}>
                <ListFilter className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-12 z-20 max-h-[min(70vh,42rem)] w-72 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-4 shadow-2xl" data-testid="library-filter-panel">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t("library:filter.title")}</div>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.searchMode")}</span>
                  <Select
                    value={searchMode}
                    onChange={(value) => setSearchMode(value as SearchMode)}
                    options={[
                      { value: "normal", label: t("library:filter.normalMode") },
                      { value: "advanced", label: t("library:filter.advancedMode") },
                    ]}
                  />
                </label>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.sort")}</span>
                  <Select
                    value={sortOrder}
                    onChange={(v) => setSortOrder(v as SortOption)}
                    options={[
                      { value: "updated", label: t("library:filter.sortUpdated") },
                      { value: "created", label: t("library:filter.sortCreated") },
                      { value: "title", label: t("library:filter.sortTitle") },
                      { value: "priority", label: t("library:filter.sortPriority") },
                      { value: "due", label: t("library:filter.sortDue") },
                    ]}
                  />
                </label>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.status")}</span>
                  <span data-testid="library-property-status">
                    <Select
                      value={propertyStatus}
                      onChange={setPropertyStatus}
                      options={propertyStatusOptions}
                    />
                  </span>
                </label>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.priority")}</span>
                  <span data-testid="library-property-priority">
                    <Select
                      value={propertyPriority}
                      onChange={setPropertyPriority}
                      options={propertyPriorityOptions}
                    />
                  </span>
                </label>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.type")}</span>
                  <span data-testid="library-item-type-filter">
                    <Select
                      value={itemTypeFilter}
                      onChange={(value) => setItemTypeFilter(value as SavedSearchItemType)}
                      options={[
                        { value: "all", label: t("library:filter.allTypes") },
                        ...(["note", "link", "file", "image", "code", "task"] as ItemType[]).map((type) => ({
                          value: type,
                          label: t(`library:filter.types.${type}`),
                        })),
                      ]}
                    />
                  </span>
                </label>
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.timeRange")}</span>
                  <span data-testid="library-time-range-filter">
                    <Select
                      value={timeRange}
                      onChange={(value) => setTimeRange(value as SavedSearchTimeRange)}
                      options={[
                        { value: "all", label: t("library:filter.allTime") },
                        { value: "today", label: t("library:filter.today") },
                        { value: "7d", label: t("library:filter.last7Days") },
                        { value: "30d", label: t("library:filter.last30Days") },
                      ]}
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.tag")}</span>
                  <Select
                    value={activeTag}
                    onChange={setActiveTag}
                    options={[
                      { value: "all", label: t("library:filter.allTags") },
                      ...allTags.map((tag) => ({ value: tag.name, label: tag.name })),
                    ]}
                  />
                </label>
                <fieldset className="mt-4 space-y-2 border-0 border-t border-[var(--line)] p-0 pt-4">
                  <legend className="mb-2 text-xs font-medium text-[var(--muted)]">{t("library:filter.flags")}</legend>
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={untaggedOnly}
                      onChange={(event) => setUntaggedOnly(event.currentTarget.checked)}
                      data-testid="library-untagged-filter"
                      className="accent-[var(--accent)]"
                    />
                    {t("library:filter.untagged")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={hasAttachmentsOnly}
                      onChange={(event) => setHasAttachmentsOnly(event.currentTarget.checked)}
                      data-testid="library-has-attachments-filter"
                      className="accent-[var(--accent)]"
                    />
                    {t("library:filter.hasAttachments")}
                  </label>
                </fieldset>
                <fieldset className="border-0 p-0">
                  <legend className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:filter.searchScope")}</legend>
                  <div className="space-y-2">
                    {(["content", "tags", "attachments", "versions"] as SearchScope[]).map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-sm text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={searchScopes.includes(scope)}
                          onChange={() => toggleSearchScope(scope)}
                          data-testid={`library-search-scope-${scope}`}
                          className="accent-[var(--accent)]"
                        />
                        {t(`library:searchFields.${scope}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-4 border-t border-[var(--line)] pt-4" data-testid="library-save-search-form">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t("library:savedSearch.name")}</span>
                    <input
                      className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      value={savedSearchName}
                      placeholder={t("library:savedSearch.namePlaceholder")}
                      data-testid="library-save-search-name"
                      onChange={(event) => setSavedSearchName(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSaveSearch();
                      }}
                    />
                  </label>
                  <button
                    className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    data-testid="library-save-search-btn"
                    disabled={!savedSearchName.trim()}
                    onClick={handleSaveSearch}
                  >
                    <Bookmark className="h-4 w-4" />
                    {t("library:savedSearch.save")}
                  </button>
                </div>
              </div>
            </details>
            <button
              className={`grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] ${calendarOpen ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
              type="button"
              data-testid="library-calendar-toggle"
              aria-label={calendarOpen ? t("library:calendar.listView") : t("library:calendar.open")}
              aria-pressed={calendarOpen}
              onClick={() => {
                setCalendarOpen((open) => !open);
                setCalendarSelectedDate(null);
                if (filterDetailsRef.current) filterDetailsRef.current.open = false;
              }}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="library-smart-collections">
            <span className="mr-1 text-xs font-medium text-[var(--muted)]">{t("library:collections.title")}</span>
            {DEFAULT_SMART_COLLECTIONS.map((collection) => (
              <button
                key={collection.id}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--line)] px-2.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                type="button"
                data-testid={`library-smart-collection-${collection.id}`}
                onClick={() => applySearchCriteria(collection)}
              >
                <Bookmark className="h-3.5 w-3.5" />
                {t(collection.labelKey)}
              </button>
            ))}
            {savedSearches.map((savedSearch) => (
              <span key={savedSearch.id} className="inline-flex items-center rounded-full border border-[var(--accent)]/50 text-xs text-[var(--accent)]" data-testid={`library-saved-search-${savedSearch.id}`}>
                <button
                  className="inline-flex h-7 items-center gap-1 px-2.5 hover:opacity-80"
                  type="button"
                  onClick={() => applySearchCriteria(savedSearch)}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {savedSearch.name}
                </button>
                <button
                  className="grid h-7 w-7 place-items-center border-l border-[var(--accent)]/30 hover:opacity-80"
                  type="button"
                  aria-label={t("library:savedSearch.delete", { name: savedSearch.name })}
                  data-testid={`library-delete-saved-search-${savedSearch.id}`}
                  onClick={() => handleDeleteSavedSearch(savedSearch.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div
            className="mb-2 flex min-h-5 items-center justify-between px-1 text-xs text-[var(--muted)]"
            data-testid="library-result-count"
          >
            <span>{t("library:resultCount", { count: resultTotal })}</span>
            {normalizedQuery && searchLoadingMore && <span>{t("library:loadingMore")}</span>}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
            {calendarOpen ? (
              <CalendarView
                month={calendarMonth}
                counts={calendarCounts}
                selectedDate={calendarSelectedDate}
                loading={calendarLoading}
                onMonthChange={(offset) => {
                  setCalendarMonth((current) => shiftMonth(current, offset));
                  setCalendarSelectedDate(null);
                }}
                onSelectDate={setCalendarSelectedDate}
                onOpenDailyNote={onOpenDailyNote}
                onBackToList={() => setCalendarOpen(false)}
              />
            ) : loading && visibleItems.length === 0 ? (
              <SkeletonList count={6} />
            ) : visibleItems.length === 0 ? (
              <div className="grid h-full place-items-center px-8 text-center">
                <div>
                  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-[var(--text)]">{t("library:empty.title")}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{t("library:empty.subtitle")}</div>
                </div>
              </div>
            ) : (
              <VirtualItemList
                items={visibleItems}
                itemHeight={112}
                itemKey={(item) => item.id}
                hasMore={hasMore}
                loadingMore={normalizedQuery ? searchLoadingMore : libraryLoadingMore}
                onLoadMore={handleLoadMore}
                loadingLabel={t("library:loadingMore")}
                className="h-full overflow-auto"
                renderItem={(item) => (
                  <button
                    key={item.id}
                    className="group flex h-full w-full items-start gap-3 border-b border-[var(--line)] px-3 py-3.5 text-left transition hover:bg-[var(--hover)] sm:px-4 sm:py-3"
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
                        <SearchHighlight
                          text={item.title || t("library:unnamed")}
                          terms={searchMetadataById.get(item.id)?.highlight_terms}
                          className="truncate text-sm font-semibold text-[var(--text)]"
                        />
                        {item.pinned && <Star className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                        <SearchHighlight
                          text={searchMetadataById.get(item.id)?.context || item.summary || t("library:noPreview")}
                          terms={searchMetadataById.get(item.id)?.highlight_terms}
                        />
                      </div>
                      {normalizedQuery && (searchMetadataById.get(item.id)?.matched_fields?.length ?? 0) > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1" data-testid="search-matched-fields">
                          {searchMetadataById.get(item.id)?.matched_fields?.map((field) => (
                            <span key={field} className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                              {t(`library:searchFields.${field}`, field)}
                            </span>
                          ))}
                        </div>
                      )}
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
                )}
              />
            )}
          </div>
      </section>

      {hasSelection && (
        <section ref={readerWidth.ref} style={readerWidth.style} className="fixed inset-0 z-[60] overflow-hidden bg-[var(--paper)] sm:inset-x-3 sm:bottom-8 sm:top-14 sm:mx-auto sm:rounded-3xl sm:border sm:border-[var(--line)] sm:shadow-2xl" data-testid="reader-drawer" data-content-width-target="reader">
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-start gap-2 border-b border-[var(--line)] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 sm:py-3 sm:pt-3">
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
              <ContentWidthControl compact testId="reader-content-width-control" />
              <DocumentOutlineToggle
                visible={showDocumentOutline}
                onToggle={() => updateSetting("showDocumentOutline", !showDocumentOutline)}
                testId="reader-document-outline-toggle"
              />
              <details ref={menuDetailsRef} className="relative shrink-0">
                <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden" data-testid="reader-menu-btn" aria-label={t("library:reader.moreActions")}>
                  <MoreHorizontal className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl">
                  <button className="menu-item" type="button" onClick={() => { handleTogglePin(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Star className="h-4 w-4" />{selectedItem.pinned ? t("library:reader.unpin") : t("library:reader.pin")}</button>
                  <button className="menu-item" type="button" onClick={() => { handleToggleFavorite(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Star className="h-4 w-4" />{selectedItem.favorite ? t("library:reader.unfavorite") : t("library:reader.favorite")}</button>
                  <button className="menu-item" type="button" onClick={() => { handleCopy(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Copy className="h-4 w-4" />{t("library:reader.copy")}</button>
                  <button className="menu-item" type="button" onClick={() => { handleAddAttachment(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Paperclip className="h-4 w-4" />{t("library:reader.addAttachment")}</button>
                  <button className="menu-item" type="button" onClick={() => { onOpenDocument(); menuDetailsRef.current && (menuDetailsRef.current.open = false); }}><Edit3 className="h-4 w-4" />{t("library:reader.fullEdit")}</button>
                  <button
                    className={`menu-item ${deleteConfirming ? "bg-red-500/10 text-red-500 hover:bg-red-500/15" : "text-red-400"}`}
                    type="button"
                    data-testid="reader-delete-btn"
                    onClick={() => {
                      if (!deleteConfirming) {
                        setDeleteConfirming(true);
                        return;
                      }
                      handleDelete().then(() => {
                        setDeleteConfirming(false);
                        if (menuDetailsRef.current) menuDetailsRef.current.open = false;
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteConfirming ? t("library:reader.confirmDelete") : t("library:reader.delete")}
                  </button>
                </div>
              </details>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="reader-edit-btn" aria-label={t("library:reader.editCurrent")} onClick={onOpenDocument} title={t("library:reader.editCurrent")}>
                <Edit3 className="h-4 w-4" />
              </button>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="reader-close-btn" aria-label={t("common:buttons.close")} onClick={handleCloseReader} title={t("common:buttons.close")}>
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6" onCopy={() => useToastStore.getState().addToast("success", t("common:toast.copySuccess"))}>
              <MarkdownPreviewWithOutline
                content={previewContent || selectedItem.summary || ""}
                theme={theme === "light" ? "light" : "dark"}
                lang={getVditorLang()}
                testId="reader-preview-layout"
                attachments={attachments}
                onNoteLinkClick={handleMarkdownNoteLink}
              />
              <NoteLinksPanel itemId={selectedItem.id} onOpenNote={onOpenLinkedNote} />
            </div>

            <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--paper)] px-3 py-3 safe-area-inset-bottom sm:px-4">
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
                  {t("library:reader.tags")}
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--field)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  type="button"
                  data-testid="reader-attachments-btn"
                  onClick={() => setAttachmentModalOpen(true)}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("library:reader.attachments")}{attachments.length > 0 ? ` (${attachments.length})` : ""}
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
                onDeleteAttachment={handleDeleteAttachment}
              />
            </footer>
          </div>
        </section>
      )}

      <TrashModal
        open={trashModalOpen}
        onClose={() => setTrashModalOpen(false)}
        onDataChanged={loadLibraryData}
      />
    </div>
  );
}
