import { useCallback, useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { VditorEditor } from "../components/editor/VditorEditor";
import { invoke } from "@tauri-apps/api/core";

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
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
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
  const [inspectorTab, setInspectorTab] = useState<"props" | "activity">("props");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const latestContent = useRef(content);

  useEffect(() => { latestTitle.current = title; }, [title]);
  useEffect(() => { latestContent.current = content; }, [content]);

  useEffect(() => {
    if (selectedItemId) {
      getItem(selectedItemId).catch(() => {});
      invoke<VersionDto[]>("get_versions", { itemId: selectedItemId })
        .then(setVersions)
        .catch(() => {});
    }
  }, [selectedItemId, getItem]);

  useEffect(() => {
    if (selectedItem) {
      setTitle(selectedItem.title);
      setContent(selectedItem.content || "");
      setIsFavorite(selectedItem.favorite);
      setSaved(true);
    }
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
    } catch { /* ignore */ }
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

  const resolvedTheme = resolveTheme(theme);
  const wordCount = content.length;

  return (
    <div className="editor-layout">
      <article className="editor-surface" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="doc-breadcrumb">
          <button type="button" onClick={() => navigate("all")}>全部</button>
          <span>/</span>
          <strong>{title || "未命名"}</strong>
          <span style={{ marginLeft: 'auto' }} className="text-faint text-sm">
            {saved ? "已保存" : "保存中..."}
          </span>
        </div>

        <div className="doc-header">
          <input
            className="doc-title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.currentTarget.value)}
            placeholder="文档标题"
          />
          <button
            className="doc-star"
            type="button"
            onClick={handleToggleFavorite}
            style={{ color: isFavorite ? 'var(--yellow)' : undefined }}
          >
            <Star fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="editor-content" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <VditorEditor
            initialValue={content}
            onChange={handleContentChange}
            theme={resolvedTheme}
          />
        </div>
      </article>

      <aside className="doc-inspector">
        <div className="inspector-tabs">
          <button className={`inspector-tab ${inspectorTab === "props" ? "active" : ""}`} type="button" onClick={() => setInspectorTab("props")}>属性</button>
          <button className={`inspector-tab ${inspectorTab === "activity" ? "active" : ""}`} type="button" onClick={() => setInspectorTab("activity")}>活动</button>
        </div>
        <div className="inspector-body">
          {inspectorTab === "props" ? (
            <>
              <div style={{ marginBottom: '10px' }}>
                <div className="text-faint text-sm" style={{ marginBottom: '4px', fontWeight: 600 }}>信息</div>
                <div className="text-sm text-muted">类型: {selectedItem?.item_type || "note"}</div>
                <div className="text-sm text-muted">创建: {selectedItem?.created_at ? new Date(selectedItem.created_at).toLocaleString("zh-CN") : "-"}</div>
                <div className="text-sm text-muted">更新: {selectedItem?.updated_at ? new Date(selectedItem.updated_at).toLocaleString("zh-CN") : "-"}</div>
                <div className="text-sm text-muted">字数: {wordCount}</div>
              </div>

              <div>
                <div className="text-faint text-sm" style={{ marginBottom: '4px', fontWeight: 600 }}>版本</div>
                {versions.length === 0 && (
                  <div className="text-muted text-sm">暂无版本记录</div>
                )}
                {versions.slice(0, 5).map((v, i) => (
                  <div key={v.id} style={{
                    padding: '3px 0',
                    fontSize: '11px',
                    color: i === 0 ? 'var(--cyan)' : 'var(--text-muted)',
                  }}>
                    v{v.version_number} {v.change_summary || "更新"}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div>
              <div className="text-faint text-sm" style={{ marginBottom: '8px', fontWeight: 600 }}>版本历史</div>
              {versions.length === 0 && (
                <div className="text-muted text-sm">暂无活动记录</div>
              )}
              {versions.map((v, i) => (
                <div key={v.id} className="activity-item" style={{
                  padding: '6px 0',
                  borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: i === 0 ? 'var(--cyan)' : 'var(--text)' }}>
                      v{v.version_number}
                    </span>
                    <span className="text-faint" style={{ fontSize: '10px' }}>
                      {formatRelativeTime(v.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                    {v.change_summary || "内容更新"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
