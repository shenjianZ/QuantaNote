import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock, Loader2, Paperclip, RefreshCw, Save, Star } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { getVditorLang } from "../utils/vditorConfig";
import { useToastStore } from "../stores/toastStore";
import { VersionPanel, type VersionDto } from "../components/editor/VersionPanel";
import { DocumentOutline, DocumentOutlineToggle } from "../components/editor/DocumentOutline";
import type { VditorEditorHandle } from "../components/editor/VditorEditor";
import { ContentWidthControl } from "../components/common/ContentWidthControl";
import { getVersions, createVersion, updateVersion, restoreVersion, deleteVersion, type ItemDto, type SummaryMode } from "../services/tauriCommands";
import { useSettingsStore } from "../stores/settingsStore";
import { useResponsiveContentWidth } from "../hooks/useResponsiveContentWidth";
import { CONTENT_WIDTH_EDITOR_BASE, CONTENT_WIDTH_OUTLINE_LAYOUT } from "../utils/contentWidth";
import { parseMarkdownOutline } from "../utils/markdownOutline";
import { useAttachmentStore, type AttachmentDto } from "../stores/attachmentStore";
import { AttachmentManagerModal } from "../components/common/AttachmentManagerModal";
import { isImageAttachment, removeAttachmentReferences } from "../utils/markdownAttachments";
import { Select } from "../components/common/Select";

const VditorEditor = lazy(() => import("../components/editor/VditorEditor").then((m) => ({ default: m.VditorEditor })));

function resolveTheme(mode: string): "dark" | "light" {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatNowAsName() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function normalizeForVersionCompare(value: string | undefined) {
  return (value ?? "").trimEnd();
}

interface DocumentEditorPageProps {
  onBackToPreview: () => void | Promise<void>;
  onModalStateChange?: (modalOpen: boolean) => void;
}

type ItemEcho = {
  id: string;
  fields: Record<string, string | boolean>;
};

export function DocumentEditorPage({ onBackToPreview, onModalStateChange }: DocumentEditorPageProps) {
  const { t } = useTranslation(["document", "common"]);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const theme = useAppStore((s) => s.theme);
  const contentWidthProgress = useSettingsStore((s) => s.settings.contentWidthProgress);
  const showDocumentOutline = useSettingsStore((s) => s.settings.showDocumentOutline);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const editorWidth = useResponsiveContentWidth<HTMLDivElement>({
    baseWidth: CONTENT_WIDTH_EDITOR_BASE + (showDocumentOutline ? CONTENT_WIDTH_OUTLINE_LAYOUT : 0),
    progress: contentWidthProgress,
  });
  const selectedItem = useItemStore((s) => s.selectedItem);
  const getItem = useItemStore((s) => s.getItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const regenerateSummary = useItemStore((s) => s.regenerateSummary);
  const attachments = useAttachmentStore((s) => s.attachments);
  const fetchAttachments = useAttachmentStore((s) => s.fetchAttachments);
  const addAttachment = useAttachmentStore((s) => s.addAttachment);
  const addAttachmentData = useAttachmentStore((s) => s.addAttachmentData);
  const deleteAttachment = useAttachmentStore((s) => s.deleteAttachment);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("auto");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(-1);
  const editorRef = useRef<VditorEditorHandle>(null);
  const editorViewportRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 仅忽略当前页面自己触发的 store 回声；同 ID 的 getItem/同步刷新仍需回填表单。
  const pendingItemEchoesRef = useRef<ItemEcho[]>([]);
  const latestTitle = useRef(title);
  const latestSummary = useRef(summary);
  const latestSummaryMode = useRef<SummaryMode>("auto");
  const latestContent = useRef(content);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const activeHeadingUpdateRef = useRef<(() => void) | null>(null);
  const deferredContent = useDeferredValue(content);
  const outline = useMemo(() => parseMarkdownOutline(deferredContent), [deferredContent]);

  useEffect(() => {
    const viewport = editorViewportRef.current;
    if (!viewport) return;

    const updateActiveHeading = () => {
      const headings = Array.from(viewport.querySelectorAll<HTMLElement>(
        ".vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6",
      ));
      if (headings.length === 0) {
        setActiveHeadingIndex((current) => current === -1 ? current : -1);
        return;
      }

      const threshold = Math.min(window.innerHeight * 0.28, 220);
      let nextIndex = 0;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= threshold) nextIndex = index;
      });
      setActiveHeadingIndex((current) => current === nextIndex ? current : nextIndex);
    };

    let updateTimer: number | null = null;
    const scheduleActiveHeadingUpdate = () => {
      if (updateTimer !== null) return;
      updateTimer = window.setTimeout(() => {
        updateTimer = null;
        updateActiveHeading();
      }, 0);
    };

    activeHeadingUpdateRef.current = scheduleActiveHeadingUpdate;
    const initialUpdate = window.setTimeout(scheduleActiveHeadingUpdate, 80);
    viewport.addEventListener("scroll", scheduleActiveHeadingUpdate, true);
    window.addEventListener("scroll", scheduleActiveHeadingUpdate, true);
    window.addEventListener("resize", scheduleActiveHeadingUpdate);
    return () => {
      window.clearTimeout(initialUpdate);
      if (updateTimer !== null) window.clearTimeout(updateTimer);
      viewport.removeEventListener("scroll", scheduleActiveHeadingUpdate, true);
      window.removeEventListener("scroll", scheduleActiveHeadingUpdate, true);
      window.removeEventListener("resize", scheduleActiveHeadingUpdate);
      if (activeHeadingUpdateRef.current === scheduleActiveHeadingUpdate) {
        activeHeadingUpdateRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeHeadingUpdateRef.current?.();
  }, [deferredContent]);

  function queueItemEcho(id: string, fields: ItemEcho["fields"]) {
    const echo = { id, fields };
    pendingItemEchoesRef.current.push(echo);
    return echo;
  }

  function removeItemEcho(echo: ItemEcho) {
    const index = pendingItemEchoesRef.current.indexOf(echo);
    if (index >= 0) pendingItemEchoesRef.current.splice(index, 1);
  }

  useEffect(() => { latestTitle.current = title; }, [title]);
  useEffect(() => { latestSummary.current = summary; }, [summary]);
  useEffect(() => { latestSummaryMode.current = summaryMode; }, [summaryMode]);
  useEffect(() => { latestContent.current = content; }, [content]);

  // 通知父组件版本面板状态变化
  useEffect(() => {
    onModalStateChange?.(versionPanelOpen || attachmentModalOpen);
    return () => { onModalStateChange?.(false); };
  }, [versionPanelOpen, attachmentModalOpen, onModalStateChange]);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;
    setVersionsLoaded(false);
    getItem(selectedItemId).catch(() => {});
    getVersions(selectedItemId)
      .then((v) => setVersions(v as VersionDto[]))
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoaded(true));
  }, [selectedItemId, getItem]);

  useEffect(() => {
    if (!selectedItemId) return;
    fetchAttachments(selectedItemId).catch(() => {});
    setAttachmentModalOpen(false);
  }, [selectedItemId, fetchAttachments]);

  useEffect(() => {
    if (!selectedItem) return;
    const echoIndex = pendingItemEchoesRef.current.findIndex((echo) =>
      echo.id === selectedItem.id
      && Object.entries(echo.fields).every(([key, value]) => selectedItem[key as keyof typeof selectedItem] === value),
    );
    if (echoIndex >= 0) {
      pendingItemEchoesRef.current.splice(echoIndex, 1);
      return;
    }
    setTitle(selectedItem.title);
    setSummary(selectedItem.summary || "");
    setSummaryMode(selectedItem.summary_mode === "manual" ? "manual" : "auto");
    setContent(selectedItem.content || "");
    latestTitle.current = selectedItem.title;
    latestSummary.current = selectedItem.summary || "";
    latestSummaryMode.current = selectedItem.summary_mode === "manual" ? "manual" : "auto";
    latestContent.current = selectedItem.content || "";
    setIsFavorite(selectedItem.favorite);
    setSaved(true);
  }, [selectedItem]);

  const save = useCallback(async (newTitle: string, newSummary: string, newContent: string, newSummaryMode?: SummaryMode): Promise<boolean> => {
    if (!selectedItemId) return false;
    const echo = queueItemEcho(selectedItemId, {
      title: newTitle,
      summary: newSummary,
      content: newContent,
      summary_mode: newSummaryMode ?? latestSummaryMode.current,
    });
    try {
      const resolvedSummaryMode = newSummaryMode ?? latestSummaryMode.current;
      const updates: Record<string, unknown> = {
        title: newTitle,
        summary: newSummary,
        content: newContent,
        summaryMode: resolvedSummaryMode,
      };
      await updateItem(selectedItemId, updates);
      setSaved(true);
      return true;
    } catch (e) {
      removeItemEcho(echo);
      console.error("Save failed:", e);
      useToastStore.getState().addToast("error", t("common:toast.saveFailed"));
      return false;
    }
  }, [selectedItemId, updateItem, t]);

  const triggerSave = useCallback((newTitle: string, newSummary: string, newContent: string, newSummaryMode?: SummaryMode) => {
    const promise = save(newTitle, newSummary, newContent, newSummaryMode);
    savePromiseRef.current = promise;
    void promise.then(
      () => { if (savePromiseRef.current === promise) savePromiseRef.current = null; },
      () => { if (savePromiseRef.current === promise) savePromiseRef.current = null; },
    );
    return promise;
  }, [save]);

  const scheduleSave = useCallback((newTitle: string, newSummary: string, newContent: string) => {
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void triggerSave(newTitle, newSummary, newContent);
    }, 1000);
  }, [triggerSave]);

  const flushSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Always write the latest refs before leaving. This covers the window where the
    // debounce timer has not fired yet, and also waits for a save already in flight.
    const previousSave = savePromiseRef.current;
    const latestSave = triggerSave(latestTitle.current, latestSummary.current, latestContent.current);
    const [latestResult] = await Promise.all([
      latestSave,
      previousSave && previousSave !== latestSave ? previousSave : Promise.resolve(true),
    ]);
    return latestResult;
  }, [triggerSave]);

  function handleTitleChange(value: string) {
    latestTitle.current = value;
    setTitle(value);
    scheduleSave(value, latestSummary.current, latestContent.current);
  }

  function handleSummaryChange(value: string) {
    latestSummary.current = value;
    setSummary(value);
    latestSummaryMode.current = "manual";
    setSummaryMode("manual");
    scheduleSave(latestTitle.current, value, latestContent.current);
  }

  function handleSummaryModeChange(value: string) {
    const nextMode = value as SummaryMode;
    if (nextMode !== "auto" && nextMode !== "manual") return;
    latestSummaryMode.current = nextMode;
    setSummaryMode(nextMode);
    void triggerSave(latestTitle.current, latestSummary.current, latestContent.current, nextMode);
  }

  const handleContentChange = useCallback((value: string) => {
    latestContent.current = value;
    setContent(value);
    scheduleSave(latestTitle.current, latestSummary.current, value);
  }, [scheduleSave]);

  async function handleRegenerateSummary() {
    if (!selectedItemId || !(await flushSave())) return;
    setSaved(false);
    try {
      const updated = await regenerateSummary(selectedItemId);
      setTitle(updated.title);
      setSummary(updated.summary || "");
      setSummaryMode(updated.summary_mode === "manual" ? "manual" : "auto");
      latestTitle.current = updated.title;
      latestSummary.current = updated.summary || "";
      latestSummaryMode.current = updated.summary_mode === "manual" ? "manual" : "auto";
      setSaved(true);
      useToastStore.getState().addToast("success", t("document:summaryRegenerated"));
    } catch (e) {
      console.error("Regenerate summary failed:", e);
      setSaved(true);
      useToastStore.getState().addToast("error", t("common:toast.itemUpdateFailed"));
    }
  }

  async function handleBack() {
    if (!(await flushSave())) return;
    await onBackToPreview();
  }

  const handleDeleteAttachment = useCallback(async (attachment: AttachmentDto) => {
    // 先把编辑器中的未保存内容落盘，避免删除附件时覆盖掉用户刚刚的编辑。
    if (!(await flushSave())) return false;
    if (!(await deleteAttachment(attachment.id))) return false;

    const nextContent = removeAttachmentReferences(latestContent.current, attachment.id);
    if (nextContent !== latestContent.current) {
      latestContent.current = nextContent;
      setContent(nextContent);
      editorRef.current?.setValue(nextContent);
      await triggerSave(latestTitle.current, latestSummary.current, nextContent);
    }
    return true;
  }, [deleteAttachment, flushSave, triggerSave]);

  const handleInsertAttachment = useCallback((attachment: AttachmentDto) => {
    editorRef.current?.insertAttachment(attachment, isImageAttachment(attachment));
    setAttachmentModalOpen(false);
  }, []);

  const handleAddAttachment = useCallback((path: string) => {
    return selectedItemId ? addAttachment(selectedItemId, path) : Promise.resolve(null);
  }, [selectedItemId, addAttachment]);

  const handleAddAttachmentData = useCallback((filename: string, mimeType: string, data: string) => {
    return selectedItemId ? addAttachmentData(selectedItemId, filename, mimeType, data) : Promise.resolve(null);
  }, [selectedItemId, addAttachmentData]);

  const handleOpenAttachments = useCallback(() => {
    editorRef.current?.saveSelection();
    setAttachmentModalOpen(true);
  }, []);

  async function handleToggleFavorite() {
    if (!selectedItemId) return;
    const next = !isFavorite;
    setIsFavorite(next);
    const echo = queueItemEcho(selectedItemId, { favorite: next });
    try {
      await updateItem(selectedItemId, { favorite: next });
    } catch (e) {
      removeItemEcho(echo);
      // 回滚乐观更新
      setIsFavorite(!next);
      console.error("Toggle favorite failed:", e);
      useToastStore.getState().addToast("error", t("common:toast.favoriteFailed"));
    }
  }

  async function handleSaveVersion() {
    if (!selectedItemId || !canSaveVersion) return;
    try {
      const version = await createVersion(
        selectedItemId,
        latestContent.current,
        t("document:manualSave"),
        formatNowAsName(),
      );
      setVersions((current) => [version as VersionDto, ...current].slice(0, 50));
      useToastStore.getState().addToast("success", t("common:toast.versionSaved"));
    } catch (e) {
      console.error("Create version failed:", e);
      useToastStore.getState().addToast("error", t("common:toast.versionSaveFailed"));
    }
  }

  async function handleUpdateVersionMeta(versionId: string, name: string, description: string) {
    try {
      const updated = await updateVersion(versionId, name, description);
      setVersions((current) => current.map((v) => (v.id === versionId ? (updated as VersionDto) : v)));
    } catch (e) {
      console.error("Update version meta failed:", e);
      useToastStore.getState().addToast("error", t("common:toast.versionMetaFailed"));
    }
  }

  async function handleRestore(version: VersionDto) {
    try {
      const updatedItem = await restoreVersion(version.id) as ItemDto;
      setContent(updatedItem.content);
      setTitle(updatedItem.title);
      setSummary(updatedItem.summary || "");
      setSummaryMode(updatedItem.summary_mode === "manual" ? "manual" : "auto");
      latestTitle.current = updatedItem.title;
      latestSummary.current = updatedItem.summary || "";
      latestSummaryMode.current = updatedItem.summary_mode === "manual" ? "manual" : "auto";
      latestContent.current = updatedItem.content;
      setSaved(true);
      editorRef.current?.setValue(updatedItem.content);

      if (selectedItemId) {
        setVersionsLoaded(false);
        try {
          const refreshedVersions = await getVersions(selectedItemId);
          setVersions(refreshedVersions as VersionDto[]);
        } catch (refreshError) {
          console.error("Refresh versions after restore failed:", refreshError);
        } finally {
          setVersionsLoaded(true);
        }
      }

      useToastStore.getState().addToast("success", t("common:toast.versionRestored"));
    } catch (e) {
      console.error("Restore version failed:", e);
      useToastStore.getState().addToast("error", t("common:toast.versionRestoreFailed"));
    }
  }

  async function handleDeleteVersion(versionId: string) {
    try {
      await deleteVersion(versionId);
      setVersions((current) => current.filter((v) => v.id !== versionId));
      useToastStore.getState().addToast("success", t("common:toast.versionDeleted"));
    } catch (e) {
      console.error("Delete version failed:", e);
      useToastStore.getState().addToast("error", t("common:toast.versionDeleteFailed"));
    }
  }

  const charCount = useMemo(() => deferredContent.replace(/\s/g, "").length, [deferredContent]);
  const latestVersionContent = versions[0]?.content;
  const canSaveVersion = versionsLoaded
    && (latestVersionContent === undefined
      || normalizeForVersionCompare(content) !== normalizeForVersionCompare(latestVersionContent));

  return (
    <div ref={editorWidth.ref} style={editorWidth.style} className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-[var(--app-bg)] p-2 sm:p-4" data-testid="document-editor-content">
      {/* Top toolbar: preview + title + actions */}
      <div className="mb-2 flex shrink-0 items-center gap-2 sm:mb-3" data-testid="document-editor-toolbar">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
          type="button"
          data-testid="doc-back-btn"
          onClick={() => { void handleBack(); }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("document:back")}
        </button>
        <input
          className="app-editor-title min-w-0 flex-1 bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          type="text"
          data-testid="doc-title-input"
          value={title}
          onChange={(e) => handleTitleChange(e.currentTarget.value)}
          placeholder={t("document:titlePlaceholder")}
        />
        <div className="flex shrink-0 items-center gap-1" data-testid="document-editor-actions">
          <ContentWidthControl compact testId="document-editor-content-width-control" />
          <DocumentOutlineToggle
            visible={showDocumentOutline}
            onToggle={() => updateSetting("showDocumentOutline", !showDocumentOutline)}
            ariaLabel={t(showDocumentOutline ? "document:sidebar.hide" : "document:sidebar.show")}
          />
          <button
            className="relative grid h-9 w-9 place-items-center rounded-full bg-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            type="button"
            data-testid="doc-attachments-btn"
            aria-label={t("document:attachments")}
            title={t("document:attachments")}
            onPointerDown={handleOpenAttachments}
            onClick={handleOpenAttachments}
          >
            <Paperclip className="h-4 w-4" />
            {attachments.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[var(--accent)] px-1 text-[9px] leading-4 text-white">{attachments.length}</span>}
          </button>
          <button
            className={`grid h-9 w-9 place-items-center rounded-full ${isFavorite ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
            type="button"
            data-testid="doc-favorite-btn"
            role="switch"
            aria-checked={isFavorite}
            aria-label={isFavorite ? t("document:unfavorite") : t("document:favorite")}
            onClick={handleToggleFavorite}
          >
            <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Editor */}
        <article className="flex min-h-[24rem] min-w-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 sm:rounded-3xl sm:p-4 lg:min-h-0 lg:flex-1">
          <div ref={editorViewportRef} className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-[var(--muted)]"><Loader2 className="mr-2 h-4 w-4" />{t("document:loadingEditor")}</div>}>
              <VditorEditor
                ref={editorRef}
                initialValue={content}
                onChange={handleContentChange}
                theme={resolveTheme(theme)}
                lang={getVditorLang()}
                attachments={attachments}
                onAddAttachment={handleAddAttachment}
                onAddAttachmentData={handleAddAttachmentData}
                onOpenAttachments={handleOpenAttachments}
              />
            </Suspense>
          </div>
        </article>

        {/* Summary and outline */}
        {showDocumentOutline && <aside className="flex min-h-0 min-w-0 flex-col gap-3 lg:sticky lg:top-0 lg:h-full lg:w-[18rem] lg:shrink-0" data-testid="document-editor-sidebar">
          <section className="shrink-0 rounded-2xl border border-[var(--line)] bg-transparent p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-[var(--text)]" htmlFor="doc-summary-input">
                {t("document:summaryLabel")}
              </label>
              <span className="rounded-full bg-[var(--field)] px-2 py-0.5 text-[10px] text-[var(--muted)]" data-testid="doc-summary-mode-badge">
                {t(summaryMode === "auto" ? "document:summaryAuto" : "document:summaryManual")}
              </span>
            </div>
            <textarea
              id="doc-summary-input"
              className="h-24 min-h-24 max-h-24 w-full resize-none overflow-y-auto rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm leading-relaxed text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              data-testid="doc-summary-input"
              value={summary}
              onChange={(e) => handleSummaryChange(e.currentTarget.value)}
              placeholder={t("document:summaryPlaceholder")}
              rows={4}
            />
            <div className="mt-2 space-y-2">
              <label className="block text-xs text-[var(--muted)]">
                <span className="mb-1 block">{t("document:summaryModeLabel")}</span>
                <span data-testid="doc-summary-mode-select">
                  <Select
                    value={summaryMode}
                    onChange={handleSummaryModeChange}
                    options={[
                      { value: "auto", label: t("document:summaryAuto") },
                      { value: "manual", label: t("document:summaryManual") },
                    ]}
                  />
                </span>
              </label>
              <button
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
                type="button"
                data-testid="doc-summary-regenerate-btn"
                onClick={() => { void handleRegenerateSummary(); }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("document:summaryRegenerate")}
              </button>
              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                {t(summaryMode === "auto" ? "document:summaryAutoHint" : "document:summaryManualHint")}
              </p>
            </div>
          </section>
          <DocumentOutline
            headings={outline}
            visible
            onToggle={() => updateSetting("showDocumentOutline", false)}
            activeIndex={activeHeadingIndex}
            onSelect={(index) => {
              setActiveHeadingIndex(index);
              editorRef.current?.scrollToHeading(index);
            }}
            showToggle={false}
            className="lg:min-h-0 lg:flex-1"
          />
        </aside>}
      </div>

      {/* Bottom status bar */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--muted)] safe-area-inset-bottom">
        <div className="flex items-center gap-3">
          <span data-testid="doc-save-status">{saved ? t("document:saved") : t("document:saving")}</span>
          <span>{t("document:charCount", { count: charCount })}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
              canSaveVersion
                ? "hover:bg-[var(--hover)] hover:text-[var(--text)]"
                : "cursor-not-allowed opacity-45"
            }`}
            type="button"
            data-testid="doc-save-version-btn"
            onClick={handleSaveVersion}
            disabled={!canSaveVersion}
            aria-disabled={!canSaveVersion}
            title={canSaveVersion ? t("document:saveVersionTooltip") : t("document:saveVersionDisabled")}
          >
            <Save className="h-3.5 w-3.5" />
            {t("document:saveVersion")}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--hover)] hover:text-[var(--text)]"
            type="button"
            data-testid="doc-version-toggle"
            onClick={() => setVersionPanelOpen(true)}
            title={t("document:versionTooltip")}
          >
            <Clock className="h-3.5 w-3.5" />
            {t("document:version", { count: versions.length })}
          </button>
        </div>
      </div>

      {/* Version panel */}
      <VersionPanel
        open={versionPanelOpen}
        versions={versions}
        onClose={() => setVersionPanelOpen(false)}
        onRestore={handleRestore}
        onUpdateMeta={handleUpdateVersionMeta}
        onDelete={handleDeleteVersion}
        theme={resolveTheme(theme)}
      />
      <AttachmentManagerModal
        open={attachmentModalOpen}
        onClose={() => setAttachmentModalOpen(false)}
        itemId={selectedItemId ?? ""}
        onInsertAttachment={handleInsertAttachment}
        onDeleteAttachment={handleDeleteAttachment}
      />
    </div>
  );
}
