import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileSearch,
  Layers,
  Loader2,
  MessageSquare,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { MarkdownRenderer } from "../common/MarkdownRenderer";
import { useAiChatStore } from "../../stores/aiChatStore";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { copyTextToSystemClipboard } from "../../utils/clipboard";
import {
  getAiModels,
  searchItems,
  type SearchResultDto,
} from "../../services/tauriCommands";

interface AiChatPanelProps {
  itemId: string;
  title: string;
  content: string;
  onOpenNote?: (noteId: string) => void;
}

function getRelatedQueries(title: string, content: string): string[] {
  const source = `${title}\n${content}`
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
  const tokens = source.match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
  const seen = new Set<string>();
  return tokens
    .map((token) => token.trim())
    .filter((token) => {
      const key = token.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

/** 点击浮层外部时关闭 */
function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);
  return ref;
}

export function AiChatPanel({ itemId, title, content, onOpenNote }: AiChatPanelProps) {
  const { t } = useTranslation(["document", "common"]);
  const appTheme = useAppStore((s) => s.theme);
  // Markdown 文字配色跟随应用主题（含 system 回退），否则浅色模式下是深色文字配色不可见
  const markdownTheme = appTheme === "light" || appTheme === "dark"
    ? appTheme
    : (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const messages = useAiChatStore((s) => s.messages);
  const sessions = useAiChatStore((s) => s.sessions);
  const currentSession = useAiChatStore((s) => s.sessions.find((session) => session.id === s.sessionId) ?? null);
  const generating = useAiChatStore((s) => s.generating);
  const streamingDraft = useAiChatStore((s) => s.streamingDraft);
  const stopped = useAiChatStore((s) => s.stopped);
  const error = useAiChatStore((s) => s.error);
  const summary = useAiChatStore((s) => s.summary);
  const summarizedUntil = useAiChatStore((s) => s.summarizedUntil);
  const noteRefs = useAiChatStore((s) => s.noteRefs);
  const load = useAiChatStore((s) => s.load);
  const switchSession = useAiChatStore((s) => s.switchSession);
  const createSession = useAiChatStore((s) => s.createSession);
  const renameSession = useAiChatStore((s) => s.renameSession);
  const updateSessionConfig = useAiChatStore((s) => s.updateSessionConfig);
  const removeSession = useAiChatStore((s) => s.removeSession);
  const send = useAiChatStore((s) => s.send);
  const regenerate = useAiChatStore((s) => s.regenerate);
  const removeMessage = useAiChatStore((s) => s.removeMessage);
  const stop = useAiChatStore((s) => s.stop);
  const clear = useAiChatStore((s) => s.clear);
  const compress = useAiChatStore((s) => s.compress);
  const addNoteRef = useAiChatStore((s) => s.addNoteRef);
  const removeNoteRef = useAiChatStore((s) => s.removeNoteRef);

  const chatModel = useSettingsStore((s) => s.settings.aiChatModel);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(24);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [relatedNotes, setRelatedNotes] = useState<SearchResultDto[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  // 加号菜单 / 引用选择器 / 模型选择 / 会话菜单 / 会话设置 浮层
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refSearch, setRefSearch] = useState("");
  const [refResults, setRefResults] = useState<SearchResultDto[]>([]);
  const [refSearching, setRefSearching] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [manualModel, setManualModel] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [renamingSession, setRenamingSession] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<{ systemPrompt: string; temperature: string; model: string }>({ systemPrompt: "", temperature: "", model: "" });

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canChat = Boolean(title.trim() || content.trim());
  const lastAssistantIndex = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
  const compressedIndex = summarizedUntil
    ? messages.findIndex((message) => message.id === summarizedUntil)
    : -1;
  const compressedCount = compressedIndex >= 0 ? compressedIndex + 1 : 0;

  useEffect(() => {
    setRelatedOpen(false);
    setRelatedNotes([]);
    setConfirmingClear(false);
    setPlusMenuOpen(false);
    setRefPickerOpen(false);
    setModelMenuOpen(false);
    setSessionMenuOpen(false);
    setSessionSettingsOpen(false);
    void load(itemId);
  }, [itemId, load]);

  // 输入框随内容自动增高（单行 24px ~ 最高 160px 后内部滚动）
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    setInputHeight(Math.min(160, Math.max(24, element.scrollHeight)));
  }, [input]);

  useLayoutEffect(() => {
    if (stickToBottom) bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, streamingDraft, stickToBottom]);

  const plusMenuRef = useDismiss(() => setPlusMenuOpen(false));
  const refPickerRef = useDismiss(() => setRefPickerOpen(false));
  const modelMenuRef = useDismiss(() => setModelMenuOpen(false));
  const sessionMenuRef = useDismiss(() => { setSessionMenuOpen(false); setRenamingSession(false); });

  function openSessionSettings() {
    setSessionMenuOpen(false);
    setSettingsDraft({
      systemPrompt: currentSession?.systemPrompt ?? "",
      temperature: currentSession?.temperature != null ? String(currentSession.temperature) : "",
      model: currentSession?.model ?? "",
    });
    setSessionSettingsOpen(true);
  }

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setStickToBottom(distance < 48);
  }

  function handleSend() {
    const question = input.trim();
    if (!question || generating || !canChat) return;
    setInput("");
    setStickToBottom(true);
    void send(title, content, question, chatModel);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  async function handleCopy(text: string) {
    try {
      await copyTextToSystemClipboard(text);
      useToastStore.getState().addToast("success", t("common:toast.copySuccess"));
    } catch {
      useToastStore.getState().addToast("error", t("common:toast.copyFailed"));
    }
  }

  async function handleFindRelated() {
    if (relatedLoading) return;
    if (relatedOpen) {
      setRelatedOpen(false);
      return;
    }
    const queries = getRelatedQueries(title, content);
    if (queries.length === 0) {
      setRelatedNotes([]);
      setRelatedOpen(true);
      return;
    }
    setRelatedLoading(true);
    setRelatedOpen(true);
    try {
      const pages = await Promise.all(
        queries.map((query) => searchItems(query, undefined, { scopes: ["content"], limit: 8, offset: 0 })),
      );
      const ranked = new Map<string, SearchResultDto>();
      pages.forEach((page) => {
        page.results.forEach((result) => {
          if (result.id === itemId) return;
          if (!ranked.has(result.id)) ranked.set(result.id, result);
        });
      });
      setRelatedNotes([...ranked.values()].slice(0, 5));
    } catch {
      setRelatedNotes([]);
    } finally {
      setRelatedLoading(false);
    }
  }

  async function handleRefSearch(query: string) {
    if (refSearching) return;
    const keyword = query.trim();
    if (!keyword) {
      setRefResults([]);
      return;
    }
    setRefSearching(true);
    try {
      const page = await searchItems(keyword, undefined, { scopes: ["content"], limit: 12, offset: 0 });
      setRefResults(page.results.filter((result) => result.id !== itemId));
    } catch {
      setRefResults([]);
    } finally {
      setRefSearching(false);
    }
  }

  async function openModelMenu() {
    setModelMenuOpen((open) => !open);
    if (models === null && !modelsLoading) {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const list = await getAiModels();
        setModels(list);
      } catch (error) {
        setModelsError(String(error).replace(/^Error:?\s*/i, ""));
      } finally {
        setModelsLoading(false);
      }
    }
  }

  function selectModel(model: string) {
    updateSetting("aiChatModel", model);
    setModelMenuOpen(false);
  }

  async function handleCompress() {
    if (compressing) return;
    setCompressing(true);
    setPlusMenuOpen(false);
    try {
      await compress();
      useToastStore.getState().addToast("success", t("document:chat.compressed"));
    } catch (compressError) {
      useToastStore.getState().addToast("error", String(compressError).replace(/^Error:?\s*/i, ""));
    } finally {
      setCompressing(false);
    }
  }

  function handleExport() {
    setPlusMenuOpen(false);
    if (messages.length === 0) return;
    const lines = [
      `# ${title.trim() || t("document:chat.untitledExport")} — ${t("document:chat.title")}`,
      "",
      ...messages.flatMap((message) => [
        `## ${message.role === "user" ? t("document:chat.roleUser") : t("document:chat.roleAssistant")}`,
        "",
        message.content,
        "",
      ]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(title.trim() || "note").replace(/[\\/:*?"<>|]/g, "_")}-ai-chat.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const displayModel = chatModel || t("document:chat.defaultModel");

  return (
    <section className="flex h-full min-h-0 flex-col p-3" data-testid="doc-ai-chat">
      {/* 会话选择器：当前会话 + 下拉（切换/新建/重命名/删除/设置） */}
      <div className="relative mb-2 flex shrink-0 items-center gap-1">
        <button
          className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--hover)]"
          type="button"
          data-testid="doc-ai-chat-session-btn"
          onClick={() => { setSessionMenuOpen((open) => !open); setRenamingSession(false); }}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          <span className="truncate">{currentSession?.title || t("document:chat.title")}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-[var(--muted)]" />
        </button>
        <button
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          data-testid="doc-ai-chat-new-session-btn"
          aria-label={t("document:chat.newSession")}
          title={t("document:chat.newSession")}
          onClick={() => { void createSession(itemId); }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          data-testid="doc-ai-chat-related-btn"
          aria-label={t("document:chat.findRelated")}
          title={t("document:chat.findRelated")}
          onClick={() => { void handleFindRelated(); }}
        >
          <FileSearch className="h-3.5 w-3.5" />
        </button>

        {sessionMenuOpen && (
          <div ref={sessionMenuRef} className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl" data-testid="doc-ai-chat-session-menu">
            {renamingSession && currentSession ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  className="min-w-0 flex-1 rounded-lg bg-[var(--field)] px-2 py-1 text-xs text-[var(--text)] outline-none"
                  value={renameDraft}
                  data-testid="doc-ai-chat-rename-input"
                  autoFocus
                  onChange={(event) => setRenameDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && renameDraft.trim()) {
                      void renameSession(currentSession.id, renameDraft.trim());
                      setSessionMenuOpen(false);
                      setRenamingSession(false);
                    }
                  }}
                />
                <button
                  className="shrink-0 rounded-lg bg-[var(--accent)] px-2 py-1 text-xs text-white disabled:opacity-50"
                  type="button"
                  disabled={!renameDraft.trim()}
                  onClick={() => {
                    void renameSession(currentSession.id, renameDraft.trim());
                    setSessionMenuOpen(false);
                    setRenamingSession(false);
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="max-h-56 overflow-y-auto">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--hover)] ${session.id === currentSession?.id ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
                      type="button"
                      data-testid="doc-ai-chat-session-item"
                      onClick={() => {
                        void switchSession(session.id);
                        setSessionMenuOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate">{session.title}</span>
                      {session.id === currentSession?.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="mt-1 border-t border-[var(--line)] pt-1">
                  <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]" type="button" onClick={() => { void createSession(itemId); setSessionMenuOpen(false); }}>
                    <Plus className="h-3.5 w-3.5" />{t("document:chat.newSession")}
                  </button>
                  {currentSession && (
                    <>
                      <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]" type="button" onClick={() => { setRenamingSession(true); setRenameDraft(currentSession.title); }}>
                        <PenLine className="h-3.5 w-3.5" />{t("document:chat.renameSession")}
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]" type="button" onClick={openSessionSettings}>
                        <Settings2 className="h-3.5 w-3.5" />{t("document:chat.sessionSettings")}
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-red-400 hover:bg-[var(--hover)]" type="button" onClick={() => { void removeSession(currentSession.id); setSessionMenuOpen(false); }}>
                        <Trash2 className="h-3.5 w-3.5" />{t("document:chat.deleteSession")}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {sessionSettingsOpen && currentSession && (
        <div className="mb-2 shrink-0 rounded-xl bg-[var(--field)] p-3" data-testid="doc-ai-chat-session-settings">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text)]">{t("document:chat.sessionSettings")}</span>
            <button
              className="grid h-5 w-5 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              type="button"
              aria-label={t("common:buttons.close")}
              onClick={() => setSessionSettingsOpen(false)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <label className="mb-2 block text-[11px] text-[var(--muted)]">
            <span className="mb-1 block">{t("document:chat.systemPrompt")}</span>
            <textarea
              className="max-h-28 min-h-14 w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 text-xs leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={settingsDraft.systemPrompt}
              data-testid="doc-ai-chat-system-prompt"
              placeholder={t("document:chat.systemPromptPlaceholder")}
              rows={3}
              onChange={(event) => setSettingsDraft((draft) => ({ ...draft, systemPrompt: event.currentTarget.value }))}
            />
          </label>
          <label className="mb-2 block text-[11px] text-[var(--muted)]">
            <span className="mb-1 block">{t("document:chat.sessionModel")}</span>
            <input
              className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={settingsDraft.model}
              data-testid="doc-ai-chat-session-model"
              placeholder={t("document:chat.sessionModelPlaceholder")}
              onChange={(event) => setSettingsDraft((draft) => ({ ...draft, model: event.currentTarget.value }))}
            />
          </label>
          <label className="block text-[11px] text-[var(--muted)]">
            <span className="mb-1 flex items-center justify-between">
              {t("document:chat.temperature")}
              <span className="tabular-nums">{settingsDraft.temperature || "0.3"}</span>
            </span>
            <input
              className="w-full accent-[var(--accent)]"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settingsDraft.temperature || "0.3"}
              data-testid="doc-ai-chat-temperature"
              onChange={(event) => setSettingsDraft((draft) => ({ ...draft, temperature: event.currentTarget.value }))}
            />
          </label>
          <button
            className="mt-2 h-8 w-full rounded-lg bg-[var(--accent)] text-xs font-medium text-white transition-opacity hover:opacity-90"
            type="button"
            data-testid="doc-ai-chat-session-settings-save"
            onClick={() => {
              void updateSessionConfig(currentSession.id, {
                systemPrompt: settingsDraft.systemPrompt.trim(),
                model: settingsDraft.model.trim(),
                temperature: settingsDraft.temperature.trim() === "" ? null : Number(settingsDraft.temperature),
              });
              setSessionSettingsOpen(false);
            }}
          >
            {t("common:buttons.save")}
          </button>
        </div>
      )}

      {relatedOpen && (
        <div className="mb-2 shrink-0 rounded-xl bg-[var(--field)] p-2" data-testid="doc-ai-chat-related">
          {relatedLoading ? (
            <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]"><Loader2 className="h-3 w-3 animate-spin" />{t("document:chat.findingRelated")}</p>
          ) : relatedNotes.length > 0 ? (
            <ul className="space-y-1">
              {relatedNotes.map((note) => (
                <li key={note.id}>
                  <button
                    className="block w-full truncate rounded-lg px-2 py-1 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]"
                    type="button"
                    data-testid="doc-ai-chat-related-note"
                    onClick={() => onOpenNote?.(note.id)}
                  >
                    {note.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-xs text-[var(--muted)]">{t("document:chat.noRelated")}</p>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full space-y-3 overflow-y-auto overscroll-contain pr-1" data-testid="doc-ai-chat-messages">
          {messages.length === 0 && !streamingDraft && !generating && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center" data-testid="doc-ai-chat-empty">
              <Sparkles className="h-5 w-5 text-[var(--muted)]" />
              <p className="text-xs leading-relaxed text-[var(--muted)]">{t("document:chat.empty")}</p>
            </div>
          )}

          {compressedCount > 0 && (
            <details className="rounded-xl bg-[var(--field)] px-3 py-2 text-xs text-[var(--muted)]" data-testid="doc-ai-chat-compressed">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 select-none">
                <Layers className="h-3.5 w-3.5" />
                {t("document:chat.compressedBanner", { count: compressedCount })}
              </summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{summary}</p>
            </details>
          )}

          {messages.map((message, index) => (
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end" data-testid="doc-ai-chat-user-message">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--accent-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--text)]">
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={message.id} className="group/message" data-testid="doc-ai-chat-assistant-message">
                <div className="rounded-2xl rounded-bl-md px-0.5 py-1 text-sm">
                  <MarkdownRenderer content={message.content} theme={markdownTheme} compact />
                </div>
                <div className="mt-1 flex justify-start gap-1 opacity-0 transition-opacity group-hover/message:opacity-100">
                  <button
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    type="button"
                    aria-label={t("document:chat.copy")}
                    title={t("document:chat.copy")}
                    onClick={() => { void handleCopy(message.content); }}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--danger)]"
                    type="button"
                    aria-label={t("document:chat.deleteMessage")}
                    title={t("document:chat.deleteMessage")}
                    data-testid={`doc-ai-chat-delete-message-${message.id}`}
                    onClick={() => { void removeMessage(message.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {index === lastAssistantIndex && !generating && (
                    <button
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                      type="button"
                      data-testid="doc-ai-chat-regenerate-btn"
                      aria-label={t("document:chat.regenerate")}
                      title={t("document:chat.regenerate")}
                      onClick={() => { void regenerate(title, content, chatModel); }}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          ))}

          {(generating || streamingDraft) && (
            <div data-testid="doc-ai-chat-streaming">
              {streamingDraft ? (
                <div className="rounded-2xl rounded-bl-md px-0.5 py-1 text-sm">
                  <MarkdownRenderer content={streamingDraft} theme={markdownTheme} compact />
                  {!stopped && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-[var(--accent)] align-[-2px]" />}
                  {stopped && <p className="mt-1 text-[10px] text-[var(--muted)]">{t("document:chat.stoppedHint")}</p>}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 px-1 text-xs text-[var(--muted)]" data-testid="doc-ai-chat-thinking">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("document:chat.thinking")}
                </p>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!stickToBottom && (
          <button
            className="absolute bottom-2 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full border border-[var(--line)] bg-[var(--popover)] text-[var(--muted)] shadow-lg hover:text-[var(--text)]"
            type="button"
            data-testid="doc-ai-chat-jump-bottom"
            aria-label={t("document:chat.jumpBottom")}
            title={t("document:chat.jumpBottom")}
            onClick={() => {
              setStickToBottom(true);
              bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
            }}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 shrink-0 rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-[11px] text-[var(--danger)]" data-testid="doc-ai-chat-error">
          {String(error).replace(/^Error:?\s*/i, "")}
        </p>
      )}

      {/* 一体化输入框：引用 chips + 自动增高输入区 + 左下加号菜单 + 右下模型/发送 */}
      <div className="relative mt-2 shrink-0">
        {plusMenuOpen && (
          <div ref={plusMenuRef} className="absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl" data-testid="doc-ai-chat-plus-menu">
            <button
              className="menu-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              onClick={() => { setPlusMenuOpen(false); setRefPickerOpen(true); }}
            >
              <PenLine className="h-3.5 w-3.5" />
              {t("document:chat.refNote")}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-50"
              type="button"
              onClick={() => { void handleCompress(); }}
              disabled={compressing}
            >
              {compressing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              {t("document:chat.compress")}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-50"
              type="button"
              onClick={handleExport}
              disabled={messages.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              {t("document:chat.export")}
            </button>
            <button
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--hover)] ${confirmingClear ? "text-red-400" : "text-[var(--text)]"}`}
              type="button"
              data-testid="doc-ai-chat-clear-btn"
              onClick={() => {
                if (!confirmingClear) {
                  setConfirmingClear(true);
                  return;
                }
                setConfirmingClear(false);
                setPlusMenuOpen(false);
                void clear();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmingClear ? t("document:chat.clearConfirm") : t("document:chat.clear")}
            </button>
          </div>
        )}

        {refPickerOpen && (
          <div ref={refPickerRef} className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-[var(--line)] bg-[var(--popover)] p-2 shadow-xl" data-testid="doc-ai-chat-ref-picker">
            <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-2.5 py-1">
              <Search className="h-3.5 w-3.5 text-[var(--muted)]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={refSearch}
                placeholder={t("document:chat.refSearchPlaceholder")}
                data-testid="doc-ai-chat-ref-search"
                onChange={(event) => {
                  setRefSearch(event.currentTarget.value);
                  void handleRefSearch(event.currentTarget.value);
                }}
              />
            </div>
            <div className="mt-2 max-h-44 overflow-y-auto">
              {refSearching ? (
                <p className="flex items-center gap-1.5 px-1 py-2 text-xs text-[var(--muted)]"><Loader2 className="h-3 w-3 animate-spin" />{t("document:chat.refSearching")}</p>
              ) : refResults.length > 0 ? (
                refResults.map((result) => (
                  <button
                    key={result.id}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]"
                    type="button"
                    onClick={() => {
                      addNoteRef({ id: result.id, title: result.title, content: result.summary || "" });
                      setRefPickerOpen(false);
                      setRefSearch("");
                      setRefResults([]);
                    }}
                  >
                    <span className="min-w-0 truncate">{result.title}</span>
                    <Plus className="h-3 w-3 shrink-0 text-[var(--muted)]" />
                  </button>
                ))
              ) : (
                <p className="px-1 py-2 text-xs text-[var(--muted)]">{refSearch.trim() ? t("document:chat.refNoResults") : t("document:chat.refHint")}</p>
              )}
            </div>
          </div>
        )}

        {modelMenuOpen && (
          <div ref={modelMenuRef} className="absolute bottom-full right-0 z-20 mb-2 w-60 rounded-xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl" data-testid="doc-ai-chat-model-menu">
            <button
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--hover)] ${!chatModel ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
              type="button"
              onClick={() => selectModel("")}
            >
              {t("document:chat.defaultModel")}
              {!chatModel && <Check className="h-3.5 w-3.5" />}
            </button>
            {modelsLoading && (
              <p className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-[var(--muted)]"><Loader2 className="h-3 w-3 animate-spin" />{t("document:chat.loadingModels")}</p>
            )}
            {modelsError && (
              <p className="px-2 py-1 text-[10px] leading-relaxed text-[var(--muted)]" data-testid="doc-ai-chat-models-error">{modelsError}</p>
            )}
            {models?.map((model) => (
              <button
                key={model}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--hover)] ${chatModel === model ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
                type="button"
                onClick={() => selectModel(model)}
              >
                <span className="min-w-0 truncate">{model}</span>
                {chatModel === model && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
            <div className="mt-1 flex items-center gap-1 border-t border-[var(--line)] px-1 pt-1.5">
              <input
                className="min-w-0 flex-1 rounded-lg bg-[var(--field)] px-2 py-1 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={manualModel}
                placeholder={t("document:chat.manualModelPlaceholder")}
                data-testid="doc-ai-chat-model-input"
                onChange={(event) => setManualModel(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && manualModel.trim()) {
                    selectModel(manualModel.trim());
                    setManualModel("");
                  }
                }}
              />
              <button
                className="shrink-0 rounded-lg bg-[var(--accent)] px-2 py-1 text-xs text-white disabled:opacity-50"
                type="button"
                disabled={!manualModel.trim()}
                onClick={() => {
                  selectModel(manualModel.trim());
                  setManualModel("");
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 pb-2 pt-2.5 transition-colors focus-within:border-[var(--accent)]">
          {noteRefs.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1" data-testid="doc-ai-chat-refs">
              {noteRefs.map((note) => (
                <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[10px] text-[var(--muted)]" key={note.id}>
                  <span className="truncate">{note.title}</span>
                  <button
                    className="grid h-3 w-3 shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100"
                    type="button"
                    aria-label={t("document:chat.removeRef")}
                    onClick={() => removeNoteRef(note.id)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            className="mb-2 block w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed"
            style={{ height: `${inputHeight}px` }}
            data-testid="doc-ai-chat-input"
            value={input}
            rows={1}
            placeholder={t("document:chat.placeholder")}
            disabled={!canChat}
            onChange={(event) => setInput(event.currentTarget.value)}
            onKeyDown={handleInputKeyDown}
          />

          <div className="flex items-center justify-between gap-2">
            <button
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
              type="button"
              data-testid="doc-ai-chat-plus-btn"
              aria-label={t("document:chat.plusMenu")}
              title={t("document:chat.plusMenu")}
              onClick={() => { setPlusMenuOpen((open) => !open); setConfirmingClear(false); }}
            >
              <Plus className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 items-center justify-end gap-1.5">
              <button
                className="inline-flex h-7 min-w-0 shrink items-center gap-1 rounded-full px-2 text-[10px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                type="button"
                data-testid="doc-ai-chat-model-btn"
                title={t("document:chat.switchModel")}
                onClick={() => { void openModelMenu(); }}
              >
                <span className="max-w-28 truncate">{displayModel}</span>
              </button>
              {generating ? (
                <button
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--paper)] text-[var(--text)] transition-colors hover:bg-[var(--hover)]"
                  type="button"
                  data-testid="doc-ai-chat-stop-btn"
                  aria-label={t("document:chat.stop")}
                  title={t("document:chat.stop")}
                  onClick={stop}
                >
                  <Square className="h-3 w-3" fill="currentColor" />
                </button>
              ) : (
                <button
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  data-testid="doc-ai-chat-send-btn"
                  aria-label={t("document:chat.send")}
                  title={t("document:chat.send")}
                  disabled={!input.trim() || !canChat}
                  onClick={handleSend}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
