import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Modal } from "./Modal";
import { useTagStore } from "../../stores/tagStore";

const TAG_COLOR_MAP: Record<string, string> = {
  cyan: "#386c5f",
  purple: "#7c3aed",
  yellow: "#c47b12",
  blue: "#2563eb",
  green: "#15803d",
  red: "#b64242",
};

interface TagPickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  onOpenManager?: () => void;
}

export function TagPickerModal({ open, onClose, selectedTags, onChange, onOpenManager }: TagPickerModalProps) {
  const allTags = useTagStore((s) => s.tags);
  const [search, setSearch] = useState("");
  const [localSelectedTags, setLocalSelectedTags] = useState(selectedTags);

  useEffect(() => {
    if (open) setLocalSelectedTags(selectedTags);
  }, [open, selectedTags]);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const q = search.trim().toLowerCase();
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, search]);

  function toggleTag(name: string) {
    const next = localSelectedTags.includes(name)
      ? localSelectedTags.filter((t) => t !== name)
      : [...localSelectedTags, name];
    setLocalSelectedTags(next);
    Promise.resolve(onChange(next)).catch(() => setLocalSelectedTags(selectedTags));
  }

  return (
    <Modal open={open} onClose={onClose} title="选择标签">
      <div className="space-y-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5">
          <Search className="h-4 w-4 text-[var(--muted)]" />
          <input
            className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标签"
            data-testid="tag-picker-search"
          />
        </div>

        {/* Tag grid */}
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => {
            const isSelected = localSelectedTags.includes(tag.name);
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
                  style={{ background: TAG_COLOR_MAP[tag.color] ?? "#386c5f" }}
                />
                #{tag.name}
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
          {filteredTags.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              {search.trim() ? "没有匹配的标签" : "暂无标签"}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
          {onOpenManager && (
            <button
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
              type="button"
              onClick={onOpenManager}
              data-testid="tag-picker-manage-btn"
            >
              管理标签...
            </button>
          )}
          <button
            className="ml-auto rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
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
