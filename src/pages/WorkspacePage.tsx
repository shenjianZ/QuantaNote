import { useEffect, useState } from "react";
import {
  Copy,
  Edit3,
  Grid2X2,
  List,
  Paperclip,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { TagEditor } from "../components/common/TagEditor";
import { TagPill } from "../components/common/TagPill";
import { useAttachmentStore } from "../stores/attachmentStore";
import { useItemStore } from "../stores/itemStore";
import { useTagStore } from "../stores/tagStore";
import { getItemTags as getItemTagsCmd } from "../services/tauriCommands";
import type { AppPage } from "../types";
import type { Item } from "../types";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

type TabKey = "pinned" | "recent" | "favorite";
type ViewMode = "list" | "grid";

interface WorkspacePageProps {
  page: AppPage;
  items: Item[];
  selectedItem: Item;
  onSelectItem: (id: string) => void;
  onCreateItem: () => void;
  onOpenDocument: () => void;
}

export function WorkspacePage({
  page,
  items,
  selectedItem,
  onSelectItem,
  onCreateItem,
  onOpenDocument,
}: WorkspacePageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [copied, setCopied] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [activeTag, setActiveTag] = useState<string>("all");
  const [itemTagNames, setItemTagNames] = useState<Record<string, string[]>>({});
  const deleteItem = useItemStore((s) => s.deleteItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const attachments = useAttachmentStore((s) => s.attachments);
  const fetchAttachments = useAttachmentStore((s) => s.fetchAttachments);
  const addAttachmentAction = useAttachmentStore((s) => s.addAttachment);
  const deleteAttachmentAction = useAttachmentStore((s) => s.deleteAttachment);
  const itemTags = useTagStore((s) => s.itemTags) as { name: string; color: string }[];
  const allTags = useTagStore((s) => s.tags) as { name: string; color: string }[];
  const fetchTags = useTagStore((s) => s.fetchTags);
  const fetchItemTags = useTagStore((s) => s.fetchItemTags);
  const updateItemTagsAction = useTagStore((s) => s.updateItemTags);

  useEffect(() => {
    if (selectedItem.id && showAttachments) {
      fetchAttachments(selectedItem.id);
    }
  }, [selectedItem.id, showAttachments, fetchAttachments]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    setActiveTab("recent");
  }, [page]);

  useEffect(() => {
    if (selectedItem.id) {
      fetchItemTags(selectedItem.id);
    }
  }, [selectedItem.id, fetchItemTags]);

  useEffect(() => {
    if (page !== "tags" || items.length === 0) {
      setItemTagNames({});
      return;
    }

    let cancelled = false;
    Promise.all(
      items.map(async (item) => {
        const tags = await getItemTagsCmd(item.id) as { name: string; color: string }[];
        return [item.id, tags.map((tag) => tag.name)] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setItemTagNames(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setItemTagNames({});
      });

    return () => {
      cancelled = true;
    };
  }, [items, page]);

  async function handleTagChange(tagNames: string[]) {
    if (!selectedItem.id) return;
    await updateItemTagsAction(selectedItem.id, tagNames);
  }

  const filteredItems = (() => {
    const pageItems = page === "tags" && activeTag !== "all"
      ? items.filter((item) => itemTagNames[item.id]?.includes(activeTag))
      : items;
    switch (activeTab) {
      case "pinned":
        return pageItems.filter((i) => i.pinned);
      case "favorite":
        return pageItems.filter((i) => i.favorite);
      default:
        return pageItems;
    }
  })();

  async function handleDelete(id: string) {
    await deleteItem(id);
  }

  async function handleToggleFavorite() {
    if (!selectedItem.id) return;
    await updateItem(selectedItem.id, { favorite: !selectedItem.favorite });
  }

  async function handleTogglePin() {
    if (!selectedItem.id) return;
    await updateItem(selectedItem.id, { pinned: !selectedItem.pinned });
  }

  async function handleCopy() {
    const text = selectedItem.summary || selectedItem.title;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  function handleEdit() {
    if (!selectedItem.id) return;
    onSelectItem(selectedItem.id);
    onOpenDocument();
  }

  async function handleAddAttachment() {
    if (!selectedItem.id) return;
    const selected = await open({ multiple: false });
    if (selected) {
      await addAttachmentAction(selectedItem.id, selected);
    }
  }

  async function handleDeleteAttachment(id: string) {
    await deleteAttachmentAction(id);
  }

  async function handleOpenAttachment(path: string) {
    await openPath(path);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const SelectedIcon = selectedItem.icon;

  return (
    <div className="workspace-layout">
      <section>
        <div className="action-bar">
          <button className="btn primary" type="button" onClick={onCreateItem}>
            <Edit3 />
            新建
          </button>
          <button className={`btn ${showAttachments ? "active" : ""}`} type="button" title="附件" onClick={() => setShowAttachments(!showAttachments)}>
            <Paperclip />
            附件
          </button>
          <div style={{ flex: 1 }} />
          <button
            className={`btn sm ${viewMode === "list" ? "active" : ""}`}
            type="button"
            onClick={() => setViewMode("list")}
            title="列表视图"
          >
            <List />
          </button>
          <button
            className={`btn sm ${viewMode === "grid" ? "active" : ""}`}
            type="button"
            onClick={() => setViewMode("grid")}
            title="网格视图"
          >
            <Grid2X2 />
          </button>
        </div>

        <div className="tabs-row">
          {([
            { key: "pinned", label: "置顶" },
            { key: "recent", label: "最近" },
            { key: "favorite", label: "收藏" },
          ] as const).map((tab) => (
            <button
              className={`tab ${tab.key === activeTab ? "active" : ""}`}
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {page === "tags" && (
          <div className="tabs-row">
            <button
              className={`tab ${activeTag === "all" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTag("all")}
            >
              全部标签
            </button>
            {allTags.map((tag) => (
              <button
                className={`tab ${activeTag === tag.name ? "active" : ""}`}
                key={tag.name}
                type="button"
                onClick={() => setActiveTag(tag.name)}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}

        <div className={`item-list ${viewMode === "grid" ? "grid-mode" : ""}`}>
          {filteredItems.length === 0 && (
            <div className="text-muted text-sm" style={{ padding: 12, textAlign: "center" }}>
              暂无记录
            </div>
          )}
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const selected = item.id === selectedItem.id;
            return (
              <button
                className={`item-card ${selected ? "selected" : ""}`}
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                type="button"
              >
                <div className={`item-icon accent-${item.accent}`}>
                  <Icon />
                </div>
                <div className="item-info">
                  <div className="item-title">{item.title}</div>
                  <div className="item-summary">{item.summary}</div>
                </div>
                <div className="item-badges">
                  {item.pinned && <Star style={{ width: 12, height: 12, color: 'var(--yellow)' }} />}
                </div>
                <span className="item-time">{item.time}</span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="detail-pane">
        <div className="detail-header">
          <div className="flex items-center gap-6">
            <div className={`item-icon accent-${selectedItem.accent}`}>
              <SelectedIcon />
            </div>
            <h3>{selectedItem.title}</h3>
          </div>
          <div className="detail-meta">
            {itemTags.map((tag) => (
              <TagPill tag={tag} key={tag.name} />
            ))}
            {itemTags.length === 0 && (
              <span className="text-faint text-sm">无标签</span>
            )}
          </div>
          <div style={{ padding: '4px 0' }}>
            <TagEditor
              selectedTags={itemTags.map((t) => t.name)}
              onChange={handleTagChange}
            />
          </div>
        </div>

        <div className="detail-body">
          <pre>{selectedItem.summary || "暂无内容"}</pre>
        </div>

        {showAttachments && (
          <div className="attachment-panel">
            <div className="attachment-panel-header">
              <span className="text-sm text-faint">附件 ({attachments.length})</span>
              <button className="btn sm" type="button" onClick={handleAddAttachment}>
                <Plus /> 添加
              </button>
            </div>
            {attachments.length === 0 && (
              <div className="text-muted text-sm" style={{ padding: '8px 0' }}>暂无附件</div>
            )}
            {attachments.map((att) => (
              <div className="attachment-item" key={att.id}>
                <Paperclip style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                <button
                  className="attachment-filename"
                  type="button"
                  onClick={() => handleOpenAttachment(att.file_path)}
                  style={{ background: "none", border: "none", color: "inherit", textAlign: "left", cursor: "pointer" }}
                >
                  {att.filename}
                </button>
                <span className="attachment-size">{formatFileSize(att.file_size)}</span>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => handleDeleteAttachment(att.id)}
                  title="删除附件"
                >
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="detail-actions">
          <button className="btn sm" type="button" onClick={handleTogglePin}>
            <Star /> {selectedItem.pinned ? "取消置顶" : "置顶"}
          </button>
          <button className="btn sm" type="button" onClick={handleToggleFavorite}>
            <Star /> {selectedItem.favorite ? "取消收藏" : "收藏"}
          </button>
          <button className="btn sm" type="button" onClick={handleCopy}>
            <Copy /> {copied ? "已复制" : "复制"}
          </button>
          <button className="btn sm" type="button" onClick={handleEdit}>
            <Edit3 /> 编辑
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn sm" type="button" onClick={() => handleDelete(selectedItem.id)}>
            <Trash2 /> 删除
          </button>
        </div>
      </aside>
    </div>
  );
}
