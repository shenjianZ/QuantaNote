import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Star } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { VditorEditor } from "../components/editor/VditorEditor";

interface VersionDto {
  id: string;
  item_id: string;
  version_number: number;
  content: string;
  change_summary: string;
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

export function DocumentEditorPage() {
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const navigate = useAppStore((s) => s.navigate);
  const theme = useAppStore((s) => s.theme);
  const selectedItem = useItemStore((s) => s.selectedItem);
  const getItem = useItemStore((s) => s.getItem);
  const updateItem = useItemStore((s) => s.updateItem);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
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

  const save = useCallback(async (newTitle: string, newContent: string) => {
    if (!selectedItemId) return;
    try {
      await updateItem(selectedItemId, { title: newTitle, content: newContent });
      setSaved(true);
      const version = await invoke<VersionDto>("create_version", {
        itemId: selectedItemId,
        content: newContent,
        changeSummary: "自动保存",
      });
      setVersions((current) => [version, ...current].slice(0, 50));
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] p-4">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--field)] px-3 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
          type="button"
          onClick={() => navigate("workspace")}
        >
          <ArrowLeft className="h-4 w-4" />
          工作台
        </button>
        <span className="ml-auto text-xs text-[var(--muted)]">{saved ? "已保存" : "保存中..."}</span>
        <button
          className={`grid h-9 w-9 place-items-center rounded-full ${isFavorite ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"}`}
          type="button"
          onClick={handleToggleFavorite}
        >
          <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <article className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <input
          className="mb-3 w-full bg-transparent text-xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.currentTarget.value)}
          placeholder="文档标题"
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <VditorEditor initialValue={content} onChange={handleContentChange} theme={resolveTheme(theme)} />
        </div>
      </article>

      <details className="mt-3 shrink-0">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
          <Clock className="h-4 w-4" />
          版本记录
        </summary>
        <div className="mt-2 max-h-28 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-2">
          {versions.length === 0 ? (
            <div className="px-2 py-3 text-sm text-[var(--muted)]">暂无版本记录</div>
          ) : (
            versions.slice(0, 8).map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--hover)]">
                <span className="font-medium text-[var(--text)]">v{version.version_number} {version.change_summary || "更新"}</span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{formatRelativeTime(version.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
