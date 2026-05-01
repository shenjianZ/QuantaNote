import { useEffect, useMemo, useState } from "react";
import { Eye, GitCompare, Pencil, Search, Trash2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { VersionPreviewModal } from "../common/VersionPreviewModal";
import { VersionDiffModal } from "../version/VersionDiffModal";
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
  onDelete: (versionId: string) => void;
  theme: "light" | "dark";
}

export function VersionPanel({ open, versions, onClose, onRestore, onUpdateMeta, onDelete, theme }: VersionPanelProps) {
  const [search, setSearch] = useState("");
  const [previewVersion, setPreviewVersion] = useState<VersionDto | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([]);
  const [diffVersions, setDiffVersions] = useState<{ a: VersionDto; b: VersionDto } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 关闭面板时重置临时状态
  useEffect(() => {
    if (!open) {
      setCompareMode(false);
      setSelectedForDiff([]);
      setDiffVersions(null);
      setDeleteConfirm(null);
      setSearch("");
    }
  }, [open]);

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

  function toggleVersionSelect(id: string) {
    setSelectedForDiff((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleCompare() {
    if (selectedForDiff.length !== 2) return;
    const a = versions.find((v) => v.id === selectedForDiff[0]);
    const b = versions.find((v) => v.id === selectedForDiff[1]);
    if (a && b) {
      const [older, newer] = new Date(a.created_at) < new Date(b.created_at) ? [a, b] : [b, a];
      setDiffVersions({ a: older, b: newer });
    }
  }

  function startEdit(v: VersionDto) {
    setEditingId(v.id);
    setEditName(v.name);
    setEditDesc(v.description);
  }

  async function saveEdit(id: string) {
    await onUpdateMeta(id, editName, editDesc);
    setEditingId(null);
  }

  function handleDelete(id: string) {
    onDelete(id);
    setDeleteConfirm(null);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`版本记录 (${versions.length})`} maxWidth="max-w-lg">
        <div className="space-y-3" data-testid="version-panel">
          {/* Search + Compare */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <input
                className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索版本"
                data-testid="version-panel-search"
              />
            </div>
            {compareMode && selectedForDiff.length === 2 && (
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-xs font-medium text-white hover:opacity-90"
                type="button"
                onClick={handleCompare}
                data-testid="version-panel-compare-btn"
              >
                <GitCompare className="h-3.5 w-3.5" />
                对比
              </button>
            )}
            <button
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                compareMode
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              type="button"
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedForDiff([]);
              }}
              data-testid="version-panel-compare-toggle"
            >
              <GitCompare className="h-3.5 w-3.5" />
              {compareMode ? "取消" : "对比"}
            </button>
          </div>
          {compareMode && selectedForDiff.length > 0 && selectedForDiff.length < 2 && (
            <div className="text-xs text-[var(--muted)]">
              已选择 1 个版本，请再选择 1 个进行对比
            </div>
          )}

          {/* Version list */}
          <div className="max-h-64 space-y-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted)]">
                {search.trim() ? "没有匹配的版本" : "暂无版本记录，点击\"保存版本\"创建"}
              </div>
            ) : (
              filtered.map((version) => {
                const isDeleteConfirm = deleteConfirm === version.id;
                return (
                  <div key={version.id} className="group rounded-xl px-3 py-2 hover:bg-[var(--hover)]" data-testid="version-panel-entry">
                    {compareMode && (
                      <label className="mb-1 flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-[var(--line)] accent-[var(--accent)]"
                          checked={selectedForDiff.includes(version.id)}
                          onChange={() => toggleVersionSelect(version.id)}
                          data-testid="version-panel-checkbox"
                        />
                        <span className="text-[10px] text-[var(--muted)]">选择对比</span>
                      </label>
                    )}
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
                          {isDeleteConfirm ? (
                            <button
                              className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/20"
                              type="button"
                              onClick={() => handleDelete(version.id)}
                              data-testid="version-panel-delete-confirm"
                            >
                              确认删除
                            </button>
                          ) : (
                            <button
                              className="grid h-6 w-6 place-items-center rounded-full text-red-400 hover:bg-red-500/10"
                              type="button"
                              title="删除"
                              onClick={() => setDeleteConfirm(version.id)}
                              data-testid="version-panel-delete-btn"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
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

      <VersionDiffModal
        open={diffVersions !== null}
        versionA={diffVersions?.a ?? null}
        versionB={diffVersions?.b ?? null}
        onClose={() => {
          setDiffVersions(null);
          setSelectedForDiff([]);
        }}
      />
    </>
  );
}
