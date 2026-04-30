import { useEffect, useState } from "react";
import { CheckCircle2, Eye, PenLine, SendHorizontal } from "lucide-react";
import { MarkdownRenderer } from "../components/common/MarkdownRenderer";
import { useAppStore } from "../stores/appStore";

interface WorkspacePageProps {
  onQuickCreate: (content: string) => Promise<void>;
}

export function WorkspacePage({ onQuickCreate }: WorkspacePageProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  async function handleQuickSave() {
    const text = draft.trim();
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
    <div className="h-full overflow-auto bg-[var(--app-bg)] px-[clamp(1rem,4vw,4rem)] py-4">
      <section className="mx-auto flex min-h-[34rem] w-full max-w-none flex-col">
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">随手记录</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">写下内容，右侧会即时预览 Markdown。</p>
          </div>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--field)] px-3 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            type="button"
            onClick={() => navigate("library")}
          >
            <Eye className="h-4 w-4" />
            查看记录
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(18rem,1.25fr)_minmax(12rem,0.75fr)] gap-3 md:grid-cols-2 md:grid-rows-1">
          <article className="flex min-h-72 flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] md:min-h-0">
            <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 text-sm font-medium text-[var(--muted)]">
              <PenLine className="h-4 w-4" />
              输入
            </header>
            <textarea
              className="min-h-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-4 text-[15px] leading-7 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={draft}
              placeholder={"今天想记什么？\n\n支持 Markdown，例如：\n- 想法\n- 待办\n- 片段"}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleQuickSave().catch(() => {});
                }
              }}
            />
            <footer className="flex shrink-0 items-center justify-between border-t border-[var(--line)] px-3 py-3">
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
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                type="button"
                disabled={!draft.trim() || saving}
                onClick={() => handleQuickSave().catch(() => {})}
              >
                <SendHorizontal className="h-4 w-4" />
                {saving ? "保存中" : "记录"}
              </button>
            </footer>
          </article>

          <article className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)]">
            <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 text-sm font-medium text-[var(--muted)]">
              <Eye className="h-4 w-4" />
              预览
            </header>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <MarkdownRenderer
                content={draft}
                theme={theme === "light" ? "light" : "dark"}
                emptyText="开始输入后，这里会显示 Markdown 预览"
              />
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
