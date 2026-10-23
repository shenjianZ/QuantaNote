import { useTranslation } from "react-i18next";
import { Loader2, PenLine, Sparkles, Tags, X } from "lucide-react";

interface TagsSectionProps {
  tags: { name: string; color: string }[];
  aiGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onManageTags: () => void;
  onRemoveTag: (name: string) => void;
  /** 预览态隐藏 AI 建议按钮 */
  showAiSuggest?: boolean;
}

export function TagsSection({ tags, aiGenerating, canGenerate, onGenerate, onManageTags, onRemoveTag, showAiSuggest = true }: TagsSectionProps) {
  const { t } = useTranslation(["document"]);

  return (
    <section className="flex min-h-0 flex-1 flex-col p-3" data-testid="doc-tags-section">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
          <Tags className="h-3.5 w-3.5" />
          {t("document:aiTagsLabel")}
        </h3>
        <button
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          data-testid="doc-manage-tags-btn"
          onClick={onManageTags}
        >
          <PenLine className="h-3 w-3" />
          {t("document:aiTagsManage")}
        </button>
      </div>
      <div className="mb-3 flex min-h-6 flex-wrap gap-1.5">
        {tags.length > 0
          ? tags.map((tag) => (
            <span className={`tag tag-${tag.color}`} key={tag.name} data-testid={`doc-tag-pill-${tag.name}`}>
              #{tag.name}
              <button
                className="grid h-3.5 w-3.5 place-items-center rounded-full opacity-60 transition-opacity hover:opacity-100"
                type="button"
                aria-label={t("document:aiTagsRemove", { name: tag.name })}
                data-testid={`doc-tag-remove-${tag.name}`}
                onClick={() => onRemoveTag(tag.name)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
          : <span className="text-xs text-[var(--muted)]">{t("document:aiTagsNone")}</span>}
      </div>
      {showAiSuggest && (
        <button
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          data-testid="doc-ai-tags-btn"
          title={t("document:aiTagsPrivacyHint")}
          disabled={aiGenerating || !canGenerate}
          onClick={onGenerate}
        >
          {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {t(aiGenerating ? "document:aiTagsGenerating" : "document:aiTagsSuggest")}
        </button>
      )}
    </section>
  );
}
