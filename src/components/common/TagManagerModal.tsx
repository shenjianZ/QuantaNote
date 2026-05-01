import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Palette } from "lucide-react";
import { Modal } from "./Modal";
import { useTagStore } from "../../stores/tagStore";
import { getTagItemCounts } from "../../services/tauriCommands";

const TAG_COLORS = [
  { key: "cyan", value: "#386c5f" },
  { key: "purple", value: "#7c3aed" },
  { key: "yellow", value: "#c47b12" },
  { key: "blue", value: "#2563eb" },
  { key: "green", value: "#15803d" },
  { key: "red", value: "#b64242" },
];

const TAG_COLOR_MAP: Record<string, string> = Object.fromEntries(
  TAG_COLORS.map((c) => [c.key, c.value])
);

interface TagManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function TagManagerModal({ open, onClose }: TagManagerModalProps) {
  const allTags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const removeTag = useTagStore((s) => s.removeTag);
  const renameTag = useTagStore((s) => s.renameTag);
  const updateTagColor = useTagStore((s) => s.updateTagColor);

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("cyan");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getTagItemCounts()
      .then((rows) => {
        const map: Record<string, number> = {};
        for (const [name, , count] of rows) {
          map[name] = count;
        }
        setTagCounts(map);
      })
      .catch(() => {});
  }, [open, allTags]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCreating(false);
      setEditingName(null);
      setDeleteConfirm(null);
      setColorPickerFor(null);
    }
  }, [open]);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const q = search.trim().toLowerCase();
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, search]);

  async function handleCreate() {
    if (!newName.trim()) return;
    await createTag(newName.trim(), newColor);
    setNewName("");
    setCreating(false);
  }

  function startEdit(name: string, color: string) {
    setEditingName(name);
    setEditName(name);
    setEditColor(color);
    setColorPickerFor(null);
  }

  async function handleSaveEdit() {
    if (!editingName) return;
    if (editName.trim() !== editingName) {
      await renameTag(editingName, editName.trim());
    }
    if (editColor !== allTags.find((t) => t.name === editingName)?.color) {
      const targetName = editName.trim() !== editingName ? editName.trim() : editingName;
      await updateTagColor(targetName, editColor);
    }
    setEditingName(null);
  }

  async function handleDelete(name: string) {
    await removeTag(name);
    setDeleteConfirm(null);
  }

  return (
    <Modal open={open} onClose={onClose} title="标签管理" maxWidth="max-w-lg">
      <div className="space-y-3" data-testid="tag-manager-modal">
        {/* Search + Create button */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <input
              className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标签"
              data-testid="tag-manager-search"
            />
          </div>
          <button
            className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-sm text-white hover:opacity-90"
            type="button"
            onClick={() => setCreating(!creating)}
            data-testid="tag-manager-create-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            新建
          </button>
        </div>

        {/* Creation form */}
        {creating && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--field)] p-3 space-y-2">
            <input
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="标签名"
              data-testid="tag-manager-name-input"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    c.key === newColor ? "scale-110 border-[var(--text)]" : "border-transparent"
                  }`}
                  style={{ background: c.value }}
                  onClick={() => setNewColor(c.key)}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs text-white hover:opacity-90"
                type="button"
                onClick={handleCreate}
              >
                创建
              </button>
              <button
                className="rounded-full bg-[var(--field)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                type="button"
                onClick={() => setCreating(false)}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Tag list */}
        <div className="max-h-64 space-y-1 overflow-auto">
          {filteredTags.map((tag) => {
            const isEditing = editingName === tag.name;
            const isDeleteConfirm = deleteConfirm === tag.name;
            const count = tagCounts[tag.name] ?? 0;
            const colorValue = TAG_COLOR_MAP[tag.color] ?? "#386c5f";

            if (isEditing) {
              return (
                <div key={tag.name} className="rounded-xl bg-[var(--field)] p-2 space-y-2" data-testid="tag-manager-edit-row">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                      data-testid="tag-manager-edit-name"
                    />
                    <button
                      className="rounded-full bg-[var(--accent)] px-2 py-1 text-xs text-white"
                      type="button"
                      onClick={handleSaveEdit}
                      data-testid="tag-manager-save-btn"
                    >
                      保存
                    </button>
                    <button
                      className="rounded-full px-2 py-1 text-xs text-[var(--muted)]"
                      type="button"
                      onClick={() => setEditingName(null)}
                    >
                      取消
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className={`h-5 w-5 rounded-full border-2 transition-transform ${
                          c.key === editColor ? "scale-110 border-[var(--text)]" : "border-transparent"
                        }`}
                        style={{ background: c.value }}
                        onClick={() => setEditColor(c.key)}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={tag.name}
                className="group flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-[var(--hover)]"
                data-testid="tag-manager-tag-row"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: colorValue }}
                />
                <span className="flex-1 truncate text-sm text-[var(--text)]">#{tag.name}</span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{count} 条</span>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {isDeleteConfirm ? (
                    <>
                      <button
                        className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/20"
                        type="button"
                        onClick={() => handleDelete(tag.name)}
                        data-testid="tag-manager-delete-confirm"
                      >
                        确认删除
                      </button>
                      <button
                        className="rounded-full px-2 py-0.5 text-xs text-[var(--muted)]"
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--field)] hover:text-[var(--text)]"
                        type="button"
                        title="重命名"
                        onClick={() => startEdit(tag.name, tag.color)}
                        data-testid="tag-manager-rename-btn"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--field)] hover:text-[var(--text)]"
                        type="button"
                        title="颜色"
                        onClick={() => setColorPickerFor(colorPickerFor === tag.name ? null : tag.name)}
                      >
                        <Palette className="h-3 w-3" />
                      </button>
                      <button
                        className="grid h-6 w-6 place-items-center rounded-full text-red-400 hover:bg-red-500/10"
                        type="button"
                        title="删除"
                        onClick={() => setDeleteConfirm(tag.name)}
                        data-testid="tag-manager-delete-btn"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                {/* Inline color picker */}
                {colorPickerFor === tag.name && !isDeleteConfirm && (
                  <div className="flex shrink-0 items-center gap-1">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className={`h-4 w-4 rounded-full border ${
                          c.value === colorValue ? "border-[var(--text)]" : "border-transparent"
                        }`}
                        style={{ background: c.value }}
                        onClick={async () => {
                          await updateTagColor(tag.name, c.key);
                          setColorPickerFor(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredTags.length === 0 && (
            <p className="py-3 text-center text-sm text-[var(--muted)]">
              {search.trim() ? "没有匹配的标签" : "暂无标签，点击上方按钮创建"}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
