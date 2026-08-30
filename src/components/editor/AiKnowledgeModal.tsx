import { Loader2, MessageCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "../common/Modal";
import type { SearchResultDto } from "../../services/tauriCommands";

interface AiKnowledgeModalProps {
  open: boolean;
  question: string;
  answer: string;
  answering: boolean;
  relatedNotes: SearchResultDto[];
  relatedLoading: boolean;
  relatedSearched: boolean;
  onClose: () => void;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onFindRelated: () => void;
}

export function AiKnowledgeModal({
  open,
  question,
  answer,
  answering,
  relatedNotes,
  relatedLoading,
  relatedSearched,
  onClose,
  onQuestionChange,
  onAsk,
  onFindRelated,
}: AiKnowledgeModalProps) {
  const { t } = useTranslation(["document", "common"]);

  return (
    <Modal open={open} onClose={onClose} title={t("document:aiKnowledge")} maxWidth="max-w-2xl">
      <div className="space-y-5" data-testid="ai-knowledge-modal">
        <section className="space-y-2">
          <label className="block text-sm font-semibold text-[var(--text)]" htmlFor="ai-question-input">
            {t("document:aiQuestionLabel")}
          </label>
          <textarea
            id="ai-question-input"
            className="min-h-24 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm leading-relaxed text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            data-testid="ai-question-input"
            value={question}
            onChange={(event) => onQuestionChange(event.currentTarget.value)}
            placeholder={t("document:aiQuestionPlaceholder")}
            rows={3}
          />
          <div className="flex justify-end">
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="ai-ask-btn"
              disabled={answering || !question.trim()}
              onClick={onAsk}
            >
              {answering ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {t(answering ? "document:aiAnswering" : "document:aiAsk")}
            </button>
          </div>
        </section>

        {answer && (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--field)] p-4" data-testid="ai-answer">
            <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">{t("document:aiAnswerLabel")}</h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{answer}</p>
          </section>
        )}

        <section className="space-y-3 border-t border-[var(--line)] pt-4" data-testid="related-notes-section">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text)]">{t("document:relatedNotes")}</h4>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{t("document:relatedNotesHint")}</p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            data-testid="related-notes-btn"
            disabled={relatedLoading}
            onClick={onFindRelated}
          >
            {relatedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t(relatedLoading ? "document:findingRelatedNotes" : "document:findRelatedNotes")}
          </button>
          {relatedSearched && relatedNotes.length > 0 && (
            <div className="space-y-2" data-testid="related-notes">
              {relatedNotes.map((note, index) => (
                <article
                  className="rounded-xl border border-[var(--line)] px-3 py-2"
                  key={note.id}
                  data-testid={`related-note-${index}`}
                >
                  <h5 className="text-sm font-medium text-[var(--text)]">{note.title}</h5>
                  {(note.summary || note.context) && (
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">
                      {note.summary || note.context}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
          {relatedSearched && relatedNotes.length === 0 && (
            <p className="text-xs text-[var(--muted)]">{t("document:relatedNotesEmpty")}</p>
          )}
          {!relatedSearched && (
            <p className="text-xs text-[var(--muted)]">{t("document:relatedNotesNotSearched")}</p>
          )}
        </section>
      </div>
    </Modal>
  );
}
