import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTagStore } from "../../stores/tagStore";

const TAG_COLORS = [
  { key: "cyan", value: "#386c5f" },
  { key: "purple", value: "#7c3aed" },
  { key: "yellow", value: "#c47b12" },
  { key: "blue", value: "#2563eb" },
  { key: "green", value: "#15803d" },
  { key: "red", value: "#b64242" },
];

interface TagEditorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ selectedTags, onChange }: TagEditorProps) {
  const allTags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("cyan");
  const [showInput, setShowInput] = useState(false);

  async function handleAddTag() {
    if (!newTagName.trim()) return;
    const exists = allTags.some((t) => t.name === newTagName.trim());
    if (!exists) {
      await createTag(newTagName.trim(), newTagColor);
    }
    if (!selectedTags.includes(newTagName.trim())) {
      onChange([...selectedTags, newTagName.trim()]);
    }
    setNewTagName("");
    setShowInput(false);
  }

  function handleRemoveTag(name: string) {
    onChange(selectedTags.filter((t) => t !== name));
  }

  const availableTags = allTags.filter((t) => !selectedTags.includes(t.name));

  return (
    <div className="tag-editor">
      <div className="tag-list">
        {selectedTags.map((name) => {
          const tag = allTags.find((t) => t.name === name);
          return (
            <span className={`tag tag-${tag?.color || "cyan"}`} key={name}>
              #{name}
              <button type="button" className="tag-remove" onClick={() => handleRemoveTag(name)}>
                <X />
              </button>
            </span>
          );
        })}
        {availableTags.length > 0 && (
          <select
            className="tag-select"
            value=""
            onChange={(e) => {
              if (e.target.value) onChange([...selectedTags, e.target.value]);
            }}
          >
            <option value="">+ 添加标签</option>
            {availableTags.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        )}
        <button className="grid h-8 w-8 place-items-center rounded-full bg-[var(--field)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" onClick={() => setShowInput(!showInput)} title="新建标签">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {showInput && (
        <div className="tag-create-form">
          <input
            className="tag-input"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="标签名"
            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
          />
          <div className="tag-color-options">
            {TAG_COLORS.map((c) => (
              <button
                key={c.key}
                className={`color-swatch ${c.key === newTagColor ? "active" : ""}`}
                style={{ background: c.value }}
                onClick={() => setNewTagColor(c.key)}
                type="button"
              />
            ))}
          </div>
          <button className="h-8 rounded-full bg-[var(--accent)] px-3 text-sm text-white" type="button" onClick={handleAddTag}>添加</button>
        </div>
      )}
    </div>
  );
}
