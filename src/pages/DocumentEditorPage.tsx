import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Loader2, Save, Star } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { useToastStore } from "../stores/toastStore";
import { VersionPanel, type VersionDto } from "../components/editor/VersionPanel";
import { getVersions, createVersion, updateVersion, restoreVersion, deleteVersion } from "../services/tauriCommands";

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
  onBackToPreview: () => void;
}

export function DocumentEditorPage({ onBackToPreview }: DocumentEditorPageProps) {
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const theme = useAppStore((s) => s.theme);
  const selectedItem = useItemStore((s) => s.selectedItem);
  const getItem = useItemStore((s) => s.getItem);
  const updateItem = useItemStore((s) => s.updateItem);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const latestSummary = useRef(summary);
  const latestContent = useRef(content);

  useEffect(() => { latestTitle.current = title; }, [title]);
  useEffect(() => { latestSummary.current = summary; }, [summary]);
  useEffect(() => { latestContent.current = content; }, [content]);

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
    if (!selectedItem) return;
    setTitle(selectedItem.title);
    setSummary(selectedItem.summary || "");
    setContent(selectedItem.content || "");
    setIsFavorite(selectedItem.favorite);
    setSaved(true);
  }, [selectedItem]);

  const save = useCallback(async (newTitle: string, newSummary: string, newContent: string) => {
    if (!selectedItemId) return;
    try {
      await updateItem(selectedItemId, {
        title: newTitle,
        summary: newSummary,
        content: newContent,
      });
      setSaved(true);
    } catch (e) {
      console.error("保存失败:", e);
      useToastStore.getState().addToast("error", "保存失败");
    }
  }, [selectedItemId, updateItem]);

  function scheduleSave(newTitle: string, newSummary: string, newContent: string) {
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(newTitle, newSummary, newContent), 1000);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, latestSummary.current, latestContent.current);
  }

  function handleSummaryChange(value: string) {
    setSummary(value);
    scheduleSave(latestTitle.current, value, latestContent.current);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(latestTitle.current, latestSummary.current, value);
  }

  async function handleToggleFavorite() {
    if (!selectedItemId) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateItem(selectedItemId, { favorite: next });
    } catch (e) {
      // 回滚乐观更新
      setIsFavorite(!next);
      console.error("切换收藏失败:", e);
      useToastStore.getState().addToast("error", "切换收藏失败");
    }
  }

  async function handleSaveVersion() {
    if (!selectedItemId || !canSaveVersion) return;
    try {
      const version = await createVersion(
        selectedItemId,
        latestContent.current,
        "手动保存",
        formatNowAsName(),
      );
      setVersions((current) => [version as VersionDto, ...current].slice(0, 50));
      useToastStore.getState().addToast("success", "版本已保存");
    } catch (e) {
      console.error("创建版本失败:", e);
      useToastStore.getState().addToast("error", "创建版本失败");
    }
  }

  async function handleUpdateVersionMeta(versionId: string, name: string, description: string) {
    try {
      const updated = await updateVersion(versionId, name, description);
      setVersions((current) => current.map((v) => (v.id === versionId ? (updated as VersionDto) : v)));
    } catch (e) {
      console.error("更新版本信息失败:", e);
      useToastStore.getState().addToast("error", "更新版本信息失败");
    }
  }

  async function handleRestore(version: VersionDto) {
    try {
      const updatedItem = await restoreVersion(version.id) as { id: string; title: string; content: string };
      setContent(updatedItem.content);
      setTitle(updatedItem.title);
      useToastStore.getState().addToast("success", "版本已恢复");
    } catch (e) {
      console.error("恢复版本失败:", e);
      useToastStore.getState().addToast("error", "恢复版本失败");
    }
  }

  async function handleDeleteVersion(versionId: string) {
    try {
      await deleteVersion(versionId);
      setVersions((current) => current.filter((v) => v.id !== versionId));
      useToastStore.getState().addToast("success", "版本已删除");
    } catch (e) {
      console.error("删除版本失败:", e);
      useToastStore.getState().addToast("error", "删除版本失败");
    }
  }

  const charCount = content.replace(/\s/g, "").length;
  const latestVersionContent = versions[0]?.content;
  const canSaveVersion = versionsLoaded
    && (latestVersionContent === undefined
      || normalizeForVersionCompare(content) !== normalizeForVersionCompare(latestVersionContent));

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-[var(--app-bg)] p-4">
      {/* Top toolbar: back + favorite */}
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--field)] px-3 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
          type="button"
          data-testid="doc-back-btn"
          onClick={onBackToPreview}
        >
          <ArrowLeft className="h-4 w-4" />
          预览
        </button>
        <span className="ml-auto text-xs text-[var(--muted)]">{charCount} 字</span>
        <button
          className={`grid h-9 w-9 place-items-center rounded-full ${isFavorite ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"}`}
          type="button"
          data-testid="doc-favorite-btn"
          role="switch"
          aria-checked={isFavorite}
          aria-label={isFavorite ? "取消收藏" : "收藏"}
          onClick={handleToggleFavorite}
        >
          <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Editor */}
      <article className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <input
          className="app-editor-title mb-2 w-full bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          type="text"
          data-testid="doc-title-input"
          value={title}
          onChange={(e) => handleTitleChange(e.currentTarget.value)}
          placeholder="文档标题"
        />
        <textarea
          className="mb-3 max-h-24 min-h-12 w-full resize-y rounded-xl border border-transparent bg-[var(--field)] px-3 py-2 text-sm leading-relaxed text-[var(--muted)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:text-[var(--text)]"
          data-testid="doc-summary-input"
          value={summary}
          onChange={(e) => handleSummaryChange(e.currentTarget.value)}
          placeholder="摘要"
          rows={2}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-[var(--muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载编辑器...</div>}>
            <VditorEditor initialValue={content} onChange={handleContentChange} theme={resolveTheme(theme)} />
          </Suspense>
        </div>
      </article>

      {/* Bottom status bar */}
      <div className="mt-2 flex shrink-0 items-center justify-between px-1 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span data-testid="doc-save-status">{saved ? "已保存" : "保存中..."}</span>
          <span>{charCount} 字</span>
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
            title={canSaveVersion ? "保存为新版本" : "当前内容与最新版本一致"}
          >
            <Save className="h-3.5 w-3.5" />
            保存版本
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--hover)] hover:text-[var(--text)]"
            type="button"
            data-testid="doc-version-toggle"
            onClick={() => setVersionPanelOpen(true)}
            title="版本记录"
          >
            <Clock className="h-3.5 w-3.5" />
            版本 ({versions.length})
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
    </div>
  );
}
