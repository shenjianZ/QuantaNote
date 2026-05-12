import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CheckCircle2, Loader2, Send, X, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { useItemStore } from "../../stores/itemStore";
import { useToastStore } from "../../stores/toastStore";
import { useAppStore } from "../../stores/appStore";
import { deriveRecordTitle } from "../../utils/recordTitle";
import { getVditorLang } from "../../utils/vditorConfig";
import type { VditorEditorHandle } from "../editor/VditorEditor";

const VditorEditor = lazy(() =>
    import("../editor/VditorEditor").then((m) => ({ default: m.VditorEditor })),
);

export function QuickNotePage() {
    const { t } = useTranslation(["floating-ball", "common"]);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const editorRef = useRef<VditorEditorHandle>(null);
    const theme = useAppStore((s) => s.theme);
    const createItem = useItemStore((s) => s.createItem);
    const selectItem = useAppStore((s) => s.selectItem);
    const savingRef = useRef(saving);
    const canSave = Boolean(draft.trim()) && !saving;
    const [shortcutModifier] = useState(() =>
        navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl",
    );

    useEffect(() => {
        document.documentElement.classList.add("quick-note-mode");
        useSettingsStore.getState().init();
        return () => document.documentElement.classList.remove("quick-note-mode");
    }, []);

    useEffect(() => {
        savingRef.current = saving;
    }, [saving]);

    useEffect(() => {
        if (!saved) return;
        const timer = setTimeout(() => setSaved(false), 2000);
        return () => clearTimeout(timer);
    }, [saved]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                handleQuickSave().catch(() => {});
            }
            if (event.key === "Escape") {
                event.preventDefault();
                handleClose();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleClose = useCallback(() => {
        try {
            getCurrentWindow().close();
        } catch { /* ignore */ }
    }, []);

    async function handleQuickSave() {
        const currentValue = editorRef.current?.getValue() ?? draft;
        const text = currentValue.trim();
        if (!text || savingRef.current) return;

        setSaving(true);
        try {
            const title = deriveRecordTitle(text);
            const item = await createItem(title, "note", text);
            selectItem(item.id);
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

    const isDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--app-bg)]">
            {/* 标题栏 */}
            <header
                className="relative flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)]/50 bg-gradient-to-r from-[var(--chrome)] to-[var(--chrome)]/80 px-4"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
                {/* 左侧装饰 */}
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/60">
                        <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold tracking-wide text-[var(--text)]/80">
                        {t("floating-ball:quickNoteTitle")}
                    </span>
                </div>

                {/* 关闭按钮 */}
                <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--field)] text-[var(--muted)] transition-all hover:bg-red-500/20 hover:text-red-500"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={handleClose}
                    aria-label="Close"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </header>

            {/* 编辑器区域 */}
            <div className="workspace-editor-panel flex min-h-0 flex-1 flex-col p-0">
                <div className="min-h-0 flex-1 overflow-hidden">
                    <Suspense
                        fallback={
                            <div className="flex h-full items-center justify-center gap-2 text-[var(--muted)]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Loading...</span>
                            </div>
                        }
                    >
                        <VditorEditor
                            ref={editorRef}
                            initialValue={draft}
                            onChange={(value) => {
                                setDraft(value);
                                if (saved) setSaved(false);
                            }}
                            theme={isDark ? "dark" : "light"}
                            lang={getVditorLang()}
                            toolbar={["table", "link", "code"]}
                            placeholder={t("floating-ball:placeholder")}
                        />
                    </Suspense>
                </div>
            </div>

            {/* 底部工具栏 */}
            <footer className="flex shrink-0 items-center justify-between border-t border-[var(--line)]/50 bg-[var(--chrome)]/80 px-4 py-2.5">
                {/* 左侧状态 */}
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    {saved ? (
                        <span className="flex items-center gap-1.5 text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="font-medium">Saved</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-[var(--line)] bg-[var(--field)] px-1 py-0.5 text-[10px] font-medium">
                                {shortcutModifier}
                            </kbd>
                            <span>+</span>
                            <kbd className="rounded border border-[var(--line)] bg-[var(--field)] px-1 py-0.5 text-[10px] font-medium">
                                Enter
                            </kbd>
                            <span className="ml-1">to save</span>
                        </span>
                    )}
                </div>

                {/* 右侧按钮 */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        onClick={handleClose}
                    >
                        {t("floating-ball:cancelBtn")}
                    </button>
                    <button
                        type="button"
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 ${
                            canSave
                                ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/80 hover:shadow-md hover:shadow-[var(--accent)]/25 active:scale-95"
                                : "cursor-not-allowed bg-[var(--field)] text-[var(--faint)]"
                        }`}
                        disabled={!canSave}
                        onClick={() => handleQuickSave().catch(() => {})}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t("floating-ball:savingBtn")}
                            </>
                        ) : (
                            <>
                                <Send className="h-3 w-3" />
                                {t("floating-ball:saveBtn")}
                            </>
                        )}
                    </button>
                </div>
            </footer>
        </div>
    );
}
