import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "../common/Modal";

interface AiTagSuggestionsModalProps {
  open: boolean;
  suggestions: string[];
  selectedTags: string[];
  applying: boolean;
  onClose: () => void;
  onToggle: (tag: string) => void;
  onApply: () => void;
}

export function AiTagSuggestionsModal({
  open,
  suggestions,
  selectedTags,
  applying,
  onClose,
  onToggle,
  onApply,
}: AiTagSuggestionsModalProps) {
  const { t } = useTranslation(["document", "common"]);

  return (
    <Modal open={open} onClose={onClose} title={t("document:aiTagsTitle")}>
      <div className="space-y-4" data-testid="ai-tag-suggestions-modal">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {t("document:aiTagsHint")}
        </p>
        <div className="space-y-2" data-testid="ai-tag-suggestions">
          {suggestions.map((tag, index) => (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--text)] hover:border-[var(--accent)]"
              key={tag}
            >
              <input
                className="h-4 w-4 accent-[var(--accent)]"
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => onToggle(tag)}
                data-testid={`ai-tag-suggestion-${index}`}
              />
              <span>#{tag}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
          <button
            className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onClose}
            disabled={applying}
          >
            {t("common:buttons.cancel")}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onApply}
            disabled={applying || selectedTags.length === 0}
            data-testid="ai-tag-apply-btn"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("document:aiTagsApply")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
