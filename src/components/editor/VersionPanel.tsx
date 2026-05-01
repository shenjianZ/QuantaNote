import { useMemo, useState } from "react";
import { Eye, Pencil, Search } from "lucide-react";
import { Modal } from "../common/Modal";
import { VersionPreviewModal } from "../common/VersionPreviewModal";
import type { VersionDto } from "../../types";

export type { VersionDto };

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

interface VersionPanelProps {
  open: boolean;
  versions: VersionDto[];
  onClose: () => void;
  onRestore: (version: VersionDto) => void;
  onUpdateMeta: (versionId: string, name: string, description: string) => void;
  theme: "light" | "dark";
}

export function VersionPanel({ open, versions, onClose, onRestore, onUpdateMeta, theme }: VersionPanelProps) {
  const [search, setSearch] = useState("");
  const [previewVersion, setPreviewVersion] = useState<VersionDto | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return versions;
    const q = search.trim().toLowerCase();
    return versions.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        `v${v.version_number}`.includes(q)
    );
  }, [versions, search]);

  function startEdit(v: VersionDto) {
    setEditingId(v.id);
    setEditName(v.name);
    setEditDesc(v.description);
  }

  async function saveEdit(id: string) {
    await onUpdateMeta(id, editName, editDesc);
    setEditingId(null);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`版本记录 (${versions.length})`} maxWidth="max-w-lg">
        <div className="space-y-3" data-testid="version-panel">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <input
              className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索版本"
              data-testid="version-panel-search"
            />
          </div>

          {/* Version list */}
          <div className="max-h-64 space-y-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted)]">
                {search.trim() ? "没有匹配的版本" : "暂无版本记录，点击\"保存版本\"创建"}
              </div>
            ) : (
              filtered.map((version) => (
                <div key={version.id} className="group rounded-xl px-3 py-2 hover:bg-[var(--hover)]" data-testid="version-panel-entry">
                  {editingId === version.id ? (
                    <div className="space-y-1.5">
                      <input
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="版本名称"
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(version.id)}
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
                          onClick={() => saveEdit(version.id)}
                        >
                          保存
                        </button>
                        <button
                          className="rounded-full bg-[var(--field)] px-2.5 py-0.5 text-xs text-[var(--muted)]"
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text)]">
                            {version.name || `v${version.version_number}`}
                          </span>
                          <span className="shrink-0 text-xs text-[var(--muted)]">
                            {formatRelativeTime(version.created_at)}
                          </span>
                        </div>
                        {version.description && (
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{version.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--field)] hover:text-[var(--text)]"
                          type="button"
                          title="编辑"
                          onClick={() => startEdit(version)}
                          data-testid="version-panel-edit-btn"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="grid h-6 w-6 place-items-center rounded-full text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          type="button"
                          title="查看并恢复"
                          onClick={() => setPreviewVersion(version)}
                          data-testid="version-panel-view-btn"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <VersionPreviewModal
        open={previewVersion !== null}
        version={previewVersion}
        onClose={() => setPreviewVersion(null)}
        onRestore={(v) => {
          onRestore(v);
          setPreviewVersion(null);
          onClose();
        }}
        theme={theme}
      />
    </>
  );
}
