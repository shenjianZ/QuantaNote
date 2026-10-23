import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Select } from "../common/Select";
import type { SummaryMode } from "../../services/tauriCommands";

interface SummarySectionProps {
  summary: string;
  onSummaryChange: (value: string) => void;
  summaryMode: SummaryMode;
  onSummaryModeChange: (value: string) => void;
  aiGenerating: boolean;
  canGenerate: boolean;
  onRegenerate: () => void;
  onGenerateAi: () => void;
  /** 预览态：只读展示，隐藏编辑与生成控件 */
  readOnly?: boolean;
}

export function SummarySection({
  summary,
  onSummaryChange,
  summaryMode,
  onSummaryModeChange,
  aiGenerating,
  canGenerate,
  onRegenerate,
  onGenerateAi,
  readOnly = false,
}: SummarySectionProps) {
  const { t } = useTranslation(["document"]);

  return (
    <section className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="block text-sm font-semibold text-[var(--text)]" htmlFor="doc-summary-input">
          {t("document:summaryLabel")}
        </label>
        <span className="rounded-full bg-[var(--field)] px-2 py-0.5 text-[10px] text-[var(--muted)]" data-testid="doc-summary-mode-badge">
          {t(summaryMode === "auto" ? "document:summaryAuto" : "document:summaryManual")}
        </span>
      </div>
      <textarea
        id="doc-summary-input"
        className="min-h-24 w-full flex-1 resize-none overflow-y-auto rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm leading-relaxed text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] read-only:focus:border-transparent"
        data-testid="doc-summary-input"
        value={summary}
        onChange={(e) => onSummaryChange(e.currentTarget.value)}
        readOnly={readOnly}
        placeholder={t("document:summaryPlaceholder")}
        rows={4}
      />
      {!readOnly && (
      <div className="mt-2 space-y-2">
        <label className="block text-xs text-[var(--muted)]">
          <span className="mb-1 block">{t("document:summaryModeLabel")}</span>
          <span data-testid="doc-summary-mode-select">
            <Select
              value={summaryMode}
              onChange={onSummaryModeChange}
              options={[
                { value: "auto", label: t("document:summaryAuto") },
                { value: "manual", label: t("document:summaryManual") },
              ]}
            />
          </span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
            type="button"
            data-testid="doc-summary-regenerate-btn"
            onClick={onRegenerate}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("document:summaryRegenerate")}
          </button>
          <button
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            data-testid="doc-ai-summary-btn"
            disabled={aiGenerating || !canGenerate}
            onClick={onGenerateAi}
          >
            {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t(aiGenerating ? "document:aiSummaryGenerating" : "document:aiSummary")}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--muted)]">
          {t("document:aiSummaryHint")}
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--muted)]">
          {t(summaryMode === "auto" ? "document:summaryAutoHint" : "document:summaryManualHint")}
        </p>
      </div>
      )}
    </section>
  );
}
