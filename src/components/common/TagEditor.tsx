import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTagStore } from "../../stores/tagStore";

const TAG_COLORS = ["cyan", "purple", "yellow", "blue", "green", "red"];

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
                <X style={{ width: 8, height: 8 }} />
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
        <button className="btn sm" type="button" onClick={() => setShowInput(!showInput)} title="新建标签">
          <Plus style={{ width: 10, height: 10 }} />
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
                key={c}
                className={`color-swatch sm ${c === newTagColor ? "active" : ""}`}
                style={{ background: `var(--${c})` }}
                onClick={() => setNewTagColor(c)}
                type="button"
              />
            ))}
          </div>
          <button className="btn primary sm" type="button" onClick={handleAddTag}>添加</button>
        </div>
      )}
    </div>
  );
}
