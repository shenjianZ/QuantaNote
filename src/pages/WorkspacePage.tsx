import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Edit3 } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { VditorEditor, type VditorEditorHandle } from "../components/editor/VditorEditor";

interface WorkspacePageProps {
  onQuickCreate: (content: string) => Promise<void>;
}

export function WorkspacePage({ onQuickCreate }: WorkspacePageProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<VditorEditorHandle>(null);
  const theme = useAppStore((s) => s.theme);

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
  }, [draft, saving, onQuickCreate]);

  async function handleQuickSave() {
    const currentValue = editorRef.current?.getValue() ?? draft;
    const text = currentValue.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await onQuickCreate(text);
      setDraft("");
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] px-[clamp(1rem,4vw,4rem)] py-4">
      <section className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">随手记录</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">写下内容，保存为新的笔记。</p>
          </div>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90"
            type="button"
            aria-disabled={!draft.trim() || saving}
            onClick={() => handleQuickSave().catch(() => {})}
          >
            <Edit3 className="h-4 w-4" />
            {saving ? "保存中" : "记录"}
          </button>
        </div>

        <article className="workspace-editor-panel flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-4">
          <div className="min-h-0 flex-1 overflow-hidden">
            <VditorEditor
              ref={editorRef}
              initialValue={draft}
              onChange={setDraft}
              theme={theme === "light" ? "light" : "dark"}
              toolbar={["table", "link", "code"]}
              placeholder="今天想记什么？"
            />
          </div>
          <footer className="mt-3 flex shrink-0 items-center justify-between">
            <div className="min-w-0 text-xs text-[var(--muted)]">
              {saved ? (
                <span className="inline-flex items-center gap-1 text-[var(--accent)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已保存
                </span>
              ) : (
                "Ctrl/⌘ + Enter 保存"
              )}
            </div>
          </footer>
        </article>
      </section>
    </div>
  );
}
