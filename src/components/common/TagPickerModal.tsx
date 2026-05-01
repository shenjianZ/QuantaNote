import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Modal } from "./Modal";
import { useTagStore } from "../../stores/tagStore";

const TAG_COLORS = [
  { key: "cyan", value: "#386c5f" },
  { key: "purple", value: "#7c3aed" },
  { key: "yellow", value: "#c47b12" },
  { key: "blue", value: "#2563eb" },
  { key: "green", value: "#15803d" },
  { key: "red", value: "#b64242" },
];

interface TagPickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagPickerModal({ open, onClose, selectedTags, onChange }: TagPickerModalProps) {
  const allTags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("cyan");

  function toggleTag(name: string) {
    if (selectedTags.includes(name)) {
      onChange(selectedTags.filter((t) => t !== name));
    } else {
      onChange([...selectedTags, name]);
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    const exists = allTags.some((t) => t.name === newTagName.trim());
    if (!exists) {
      await createTag(newTagName.trim(), newTagColor);
    }
    setNewTagName("");
  }

  return (
    <Modal open={open} onClose={onClose} title="管理标签">
      <div className="space-y-4">
        {/* Tag grid */}
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.name);
            const colorEntry = TAG_COLORS.find((c) => c.key === tag.color);
            return (
              <button
                key={tag.name}
                type="button"
                data-testid="tag-option"
                onClick={() => toggleTag(tag.name)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: colorEntry?.value ?? "#386c5f" }}
                />
                #{tag.name}
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
          {allTags.length === 0 && (
            <p className="text-sm text-[var(--muted)]">暂无标签，在下方创建</p>
          )}
        </div>

        {/* Create new tag */}
        <div className="border-t border-[var(--line)] pt-3">
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">新建标签</p>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="标签名"
              data-testid="tag-create-input"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
            />
            <div className="flex gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    c.key === newTagColor ? "scale-110 border-[var(--text)]" : "border-transparent"
                  }`}
                  style={{ background: c.value }}
                  onClick={() => setNewTagColor(c.key)}
                />
              ))}
            </div>
            <button
              className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-sm text-white hover:opacity-90"
              type="button"
              data-testid="tag-create-btn"
              onClick={handleCreateTag}
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </button>
          </div>
        </div>

        {/* Done button */}
        <div className="flex justify-end border-t border-[var(--line)] pt-3">
          <button
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
            type="button"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      </div>
    </Modal>
  );
}
