import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Edit3, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/appStore";
import { useToastStore } from "../stores/toastStore";
import { getVditorLang } from "../utils/vditorConfig";
import type { VditorEditorHandle } from "../components/editor/VditorEditor";

const VditorEditor = lazy(() => import("../components/editor/VditorEditor").then((m) => ({ default: m.VditorEditor })));

interface WorkspacePageProps {
  onQuickCreate: (content: string) => Promise<void>;
  onViewSaved?: () => void;
}

export function WorkspacePage({ onQuickCreate, onViewSaved }: WorkspacePageProps) {
  const { t } = useTranslation(["workspace", "common"]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shortcutModifier] = useState(() => navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl");
  const editorRef = useRef<VditorEditorHandle>(null);
  const theme = useAppStore((s) => s.theme);
  const savingRef = useRef(saving);
  const onQuickCreateRef = useRef(onQuickCreate);
  const canSave = Boolean(draft.trim()) && !saving;

  useEffect(() => { savingRef.current = saving; }, [saving]);
  useEffect(() => { onQuickCreateRef.current = onQuickCreate; }, [onQuickCreate]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleQuickSave().catch(() => {});
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onQuickCreate]);

  async function handleQuickSave() {
    const currentValue = editorRef.current?.getValue() ?? draft;
    const text = currentValue.trim();
    if (!text || savingRef.current) {
      setSaved(false);
      return;
    }
    setSaving(true);
    try {
      await onQuickCreateRef.current(text);
      editorRef.current?.setValue("");
      setDraft("");
      setSaved(true);
      useToastStore.getState().addToast("success", t("common:toast.saveSuccess"));
    } catch {
      useToastStore.getState().addToast("error", t("common:toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] px-3 py-3 sm:px-[clamp(1rem,4vw,4rem)] sm:py-4">
      <section className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <h1 className="app-hero-title text-[var(--text)]">{t("workspace:title")}</h1>
            <p className="mt-1 hidden text-sm text-[var(--muted)] sm:block">{t("workspace:subtitle")}</p>
          </div>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            data-testid="workspace-save-btn"
            disabled={!canSave}
            aria-disabled={!canSave}
            onClick={() => handleQuickSave().catch(() => {})}
          >
            <Edit3 className="h-4 w-4" />
            {saving ? t("workspace:savingBtn") : t("workspace:saveBtn")}
          </button>
        </div>

        <article className="workspace-editor-panel flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-4" data-testid="workspace-editor">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-[var(--muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("workspace:loadingEditor")}</div>}>
              <VditorEditor
                ref={editorRef}
                initialValue={draft}
                onChange={(value) => {
                  setDraft(value);
                  if (saved) setSaved(false);
                }}
                theme={theme === "light" ? "light" : "dark"}
                lang={getVditorLang()}
                toolbar={["table", "link", "code"]}
                placeholder={t("workspace:placeholder")}
              />
            </Suspense>
          </div>
          <footer className="mt-3 flex shrink-0 items-center justify-between">
            <div className="min-w-0 text-xs text-[var(--muted)]" data-testid="workspace-status">
              {saved ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[var(--accent)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("workspace:savedStatus")}
                  </span>
                  {onViewSaved && (
                    <button
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                      type="button"
                      data-testid="workspace-view-saved-btn"
                      onClick={onViewSaved}
                    >
                      {t("workspace:viewSaved")}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                  <span className="hidden sm:inline">{t("workspace:shortcutHint", { mod: shortcutModifier })}</span>
              )}
            </div>
          </footer>
        </article>
      </section>
    </div>
  );
}
