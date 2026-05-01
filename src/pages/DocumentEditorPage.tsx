import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Save, Star } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { VditorEditor } from "../components/editor/VditorEditor";
import { VersionPreviewModal } from "../components/common/VersionPreviewModal";

interface VersionDto {
  id: string;
  item_id: string;
  version_number: number;
  content: string;
  change_summary: string;
  name: string;
  description: string;
  created_at: string;
}

function resolveTheme(mode: string): "dark" | "light" {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
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
  const [previewVersion, setPreviewVersion] = useState<VersionDto | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const latestContent = useRef(content);

  useEffect(() => { latestTitle.current = title; }, [title]);
  useEffect(() => { latestContent.current = content; }, [content]);

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

  // Auto-save item content only (no version creation)
  const save = useCallback(async (newTitle: string, newContent: string) => {
    if (!selectedItemId) return;
    try {
      await updateItem(selectedItemId, { title: newTitle, content: newContent });
      setSaved(true);
    } catch {
      /* ignore */
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
    await updateItem(selectedItemId, { favorite: next });
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
    } catch {
      /* ignore */
    }
  }

  async function handleSaveVersionMeta(versionId: string) {
    try {
      const updated = await invoke<VersionDto>("update_version", {
        id: versionId,
        name: editName,
        description: editDesc,
      });
      setVersions((current) => current.map((v) => (v.id === versionId ? updated : v)));
      setEditingVersionId(null);
    } catch {
      /* ignore */
    }
  }

  function startEditVersion(v: VersionDto) {
    setEditingVersionId(v.id);
    setEditName(v.name);
    setEditDesc(v.description);
  }

  async function handleRestore(version: VersionDto) {
    try {
      const updatedItem = await invoke<{ id: string; title: string; content: string }>("restore_version", { versionId: version.id });
      setContent(updatedItem.content);
      setTitle(updatedItem.title);
      setPreviewVersion(null);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] p-4">
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
        <span className="ml-auto text-xs text-[var(--muted)]" data-testid="doc-save-status">{saved ? "已保存" : "保存中..."}</span>
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-sm text-white hover:opacity-90"
          type="button"
          data-testid="doc-save-version-btn"
          onClick={handleSaveVersion}
          title="保存为新版本"
        >
          <Save className="h-4 w-4" />
          保存版本
        </button>
        <button
          className={`grid h-9 w-9 place-items-center rounded-full ${isFavorite ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"}`}
          type="button"
          data-testid="doc-favorite-btn"
          onClick={handleToggleFavorite}
        >
          <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <article className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <input
          className="mb-3 w-full bg-transparent text-xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          type="text"
          data-testid="doc-title-input"
          value={title}
          onChange={(e) => handleTitleChange(e.currentTarget.value)}
          placeholder="文档标题"
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <VditorEditor initialValue={content} onChange={handleContentChange} theme={resolveTheme(theme)} />
        </div>
      </article>

      <details className="mt-3 shrink-0" open data-testid="doc-version-list">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
          <Clock className="h-4 w-4" />
          版本记录 ({versions.length})
        </summary>
        <div className="mt-2 max-h-48 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-2">
          {versions.length === 0 ? (
            <div className="px-2 py-3 text-sm text-[var(--muted)]">暂无版本记录，点击"保存版本"创建</div>
          ) : (
            versions.slice(0, 15).map((version) => (
              <div key={version.id} className="group rounded-xl px-2 py-2 hover:bg-[var(--hover)]">
                {editingVersionId === version.id ? (
                  <div className="space-y-1.5">
                    <input
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="版本名称"
                    />
                    <input
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="版本描述（可选）"
                    />
                    <div className="flex gap-1.5">
                      <button
                        className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs text-white"
                        type="button"
                        onClick={() => handleSaveVersionMeta(version.id)}
                      >
                        保存
                      </button>
                      <button
                        className="rounded-full bg-[var(--field)] px-2.5 py-0.5 text-xs text-[var(--muted)]"
                        type="button"
                        onClick={() => setEditingVersionId(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text)]">{version.name || `v${version.version_number}`}</span>
                        <span className="shrink-0 text-xs text-[var(--muted)]">{formatRelativeTime(version.created_at)}</span>
                      </div>
                      {version.description && (
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{version.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded-full px-2 py-0.5 text-xs text-[var(--muted)] hover:bg-[var(--field)] hover:text-[var(--text)]"
                        type="button"
                        onClick={() => startEditVersion(version)}
                        title="编辑"
                      >
                        编辑
                      </button>
                      <button
                        className="rounded-full px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                        type="button"
                        onClick={() => setPreviewVersion(version)}
                        title="预览并恢复"
                      >
                        恢复
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </details>

      <VersionPreviewModal
        open={previewVersion !== null}
        version={previewVersion}
        onClose={() => setPreviewVersion(null)}
        onRestore={handleRestore}
        theme={resolveTheme(theme)}
      />
    </div>
  );
}
