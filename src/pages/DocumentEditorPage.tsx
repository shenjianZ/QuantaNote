import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Loader2, Save, Star } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { VersionPanel, type VersionDto } from "../components/editor/VersionPanel";

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
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const latestContent = useRef(content);

  useEffect(() => { latestTitle.current = title; }, [title]);
  useEffect(() => { latestContent.current = content; }, [content]);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;
    getItem(selectedItemId).catch(() => {});
    invoke<VersionDto[]>("get_versions", { itemId: selectedItemId })
      .then(setVersions)
      .catch(() => {});
  }, [selectedItemId, getItem]);

  useEffect(() => {
    if (!selectedItem) return;
    setTitle(selectedItem.title);
    setContent(selectedItem.content || "");
    setIsFavorite(selectedItem.favorite);
    setSaved(true);
  }, [selectedItem]);

  const save = useCallback(async (newTitle: string, newContent: string) => {
    if (!selectedItemId) return;
    try {
      await updateItem(selectedItemId, { title: newTitle, content: newContent });
      setSaved(true);
    } catch (e) {
      console.error("保存失败:", e);
    }
  }, [selectedItemId, updateItem]);

  function scheduleSave(newTitle: string, newContent: string) {
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(newTitle, newContent), 1000);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, latestContent.current);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(latestTitle.current, value);
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
    }
  }

  async function handleSaveVersion() {
    if (!selectedItemId) return;
    try {
      const version = await invoke<VersionDto>("create_version", {
        itemId: selectedItemId,
        content: latestContent.current,
        changeSummary: "手动保存",
        name: formatNowAsName(),
      });
      setVersions((current) => [version, ...current].slice(0, 50));
    } catch (e) {
      console.error("创建版本失败:", e);
    }
  }

  async function handleUpdateVersionMeta(versionId: string, name: string, description: string) {
    try {
      const updated = await invoke<VersionDto>("update_version", { id: versionId, name, description });
      setVersions((current) => current.map((v) => (v.id === versionId ? updated : v)));
    } catch (e) {
      console.error("更新版本信息失败:", e);
    }
  }

  async function handleRestore(version: VersionDto) {
    try {
      const updatedItem = await invoke<{ id: string; title: string; content: string }>("restore_version", { versionId: version.id });
      setContent(updatedItem.content);
      setTitle(updatedItem.title);
    } catch (e) {
      console.error("恢复版本失败:", e);
    }
  }

  const charCount = content.replace(/\s/g, "").length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] p-4">
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
          className="app-editor-title mb-3 w-full bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          type="text"
          data-testid="doc-title-input"
          value={title}
          onChange={(e) => handleTitleChange(e.currentTarget.value)}
          placeholder="文档标题"
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
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--hover)] hover:text-[var(--text)]"
            type="button"
            data-testid="doc-save-version-btn"
            onClick={handleSaveVersion}
            title="保存为新版本"
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
        theme={resolveTheme(theme)}
      />
    </div>
  );
}
