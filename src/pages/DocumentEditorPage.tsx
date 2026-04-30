import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  CheckSquare,
  Code2,
  FileText,
  Italic,
  Link,
  List,
  Quote,
  Star,
  Underline,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { invoke } from "@tauri-apps/api/core";

interface VersionDto {
  id: string;
  item_id: string;
  version_number: number;
  content: string;
  change_summary: string;
  created_at: string;
}

type FormatAction = "h1" | "h2" | "h3" | "bold" | "italic" | "underline" | "code" | "link" | "list" | "check" | "quote";

const FORMAT_MARKS: Record<FormatAction, { prefix: string; suffix: string }> = {
  h1: { prefix: "# ", suffix: "" },
  h2: { prefix: "## ", suffix: "" },
  h3: { prefix: "### ", suffix: "" },
  bold: { prefix: "**", suffix: "**" },
  italic: { prefix: "*", suffix: "*" },
  underline: { prefix: "__", suffix: "__" },
  code: { prefix: "`", suffix: "`" },
  link: { prefix: "[", suffix: "](url)" },
  list: { prefix: "- ", suffix: "" },
  check: { prefix: "- [ ] ", suffix: "" },
  quote: { prefix: "> ", suffix: "" },
};

export function DocumentEditorPage() {
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const navigate = useAppStore((s) => s.navigate);
  const selectedItem = useItemStore((s) => s.selectedItem);
  const getItem = useItemStore((s) => s.getItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const items = useItemStore((s) => s.items);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"props" | "activity">("props");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    scheduleSave(value, content);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(title, value);
  }

  function handleFormat(action: FormatAction) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const mark = FORMAT_MARKS[action];
    const before = content.substring(0, start);
    const after = content.substring(end);
    const newContent = before + mark.prefix + selected + mark.suffix + after;
    setContent(newContent);
    scheduleSave(title, newContent);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + mark.prefix.length;
      ta.selectionEnd = start + mark.prefix.length + selected.length;
    }, 0);
  }

  async function handleToggleFavorite() {
    if (!selectedItemId) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateItem(selectedItemId, { favorite: next });
  }

  const relations = items.filter((i) => i.id !== selectedItemId).slice(0, 4);

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

  return (
    <div className="editor-layout">
      <article className="editor-surface" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="doc-breadcrumb">
          <button type="button" onClick={() => navigate("all")}>文件</button>
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

        <div className="format-toolbar">
          {(["h1", "h2", "h3"] as FormatAction[]).map((action) => (
            <button type="button" key={action} className="btn sm" onClick={() => handleFormat(action)}>
              {action.toUpperCase()}
            </button>
          ))}
          {([
            { action: "bold" as FormatAction, Icon: Bold },
            { action: "italic" as FormatAction, Icon: Italic },
            { action: "underline" as FormatAction, Icon: Underline },
            { action: "code" as FormatAction, Icon: Code2 },
            { action: "link" as FormatAction, Icon: Link },
            { action: "list" as FormatAction, Icon: List },
            { action: "check" as FormatAction, Icon: CheckSquare },
            { action: "quote" as FormatAction, Icon: Quote },
          ]).map(({ action, Icon }) => (
            <button type="button" key={action} onClick={() => handleFormat(action)} title={action}>
              <Icon />
            </button>
          ))}
        </div>

        <div className="editor-content" style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.currentTarget.value)}
            placeholder="开始输入内容..."
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
            }}
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
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div className="text-faint text-sm" style={{ marginBottom: '4px', fontWeight: 600 }}>关联记录</div>
                <div className="doc-relations">
                  {relations.map((rel) => (
                    <div className="doc-relation" key={rel.id}>
                      <FileText />
                      <span className="rel-title">{rel.title}</span>
                    </div>
                  ))}
                  {relations.length === 0 && (
                    <div className="text-muted text-sm">暂无关联</div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
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
