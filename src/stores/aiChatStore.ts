import { create } from "zustand";
import {
  clearAiChatMessages,
  compressAiChatMessages,
  createAiChatSession,
  deleteAiChatMessage,
  deleteAiChatSession,
  getAiChatMessages,
  getAiChatSummary,
  listAiChatSessions,
  regenerateAiChatReply,
  sendAiChatMessage,
  updateAiChatSession,
  type AiChatExtraNote,
  type AiChatMessage,
  type AiChatSession,
  type AiChatStreamEvent,
} from "../services/tauriCommands";

/** 输入框“引用其他笔记”的条目（会话内存级） */
export interface ChatNoteRef {
  id: string;
  title: string;
  content: string;
}

interface AiChatState {
  /** 当前笔记 id */
  itemId: string | null;
  /** 当前会话 id */
  sessionId: string | null;
  sessions: AiChatSession[];
  messages: AiChatMessage[];
  /** 上下文压缩状态（早期对话摘要与分界） */
  summary: string;
  summarizedUntil: string;
  /** 引用的其他笔记（发送时随附） */
  noteRefs: ChatNoteRef[];
  loading: boolean;
  /** 正在生成回复（流式进行中） */
  generating: boolean;
  /** 流式中的临时回答（尚未入库） */
  streamingDraft: string;
  /** 用户主动停止接收后，UI 停止追加但保留已收内容 */
  stopped: boolean;
  error: string | null;
  load: (itemId: string) => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createSession: (itemId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  updateSessionConfig: (sessionId: string, updates: { model?: string; systemPrompt?: string; temperature?: number | null }) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  send: (title: string, content: string, question: string, model: string) => Promise<void>;
  regenerate: (title: string, content: string, model: string) => Promise<void>;
  removeMessage: (messageId: string) => Promise<void>;
  stop: () => void;
  clear: () => Promise<void>;
  compress: () => Promise<void>;
  addNoteRef: (note: ChatNoteRef) => void;
  removeNoteRef: (id: string) => void;
}

/** 单例流式会话序号：新的请求使旧请求的回调失效 */
let streamEpoch = 0;

function toExtraNotes(noteRefs: ChatNoteRef[]): AiChatExtraNote[] {
  return noteRefs.map((note) => ({ title: note.title, content: note.content }));
}

export const useAiChatStore = create<AiChatState>((set, get) => {
  async function loadSessionMessages(sessionId: string, epoch: number) {
    set({ messages: [], summary: "", summarizedUntil: "" });
    const [messages, summaryState] = await Promise.all([
      getAiChatMessages(sessionId),
      getAiChatSummary(sessionId),
    ]);
    if (epoch !== streamEpoch || get().sessionId !== sessionId) return;
    set({
      messages,
      summary: summaryState.summary,
      summarizedUntil: summaryState.summarizedUntil,
    });
  }

  function handleStreamEvent(event: AiChatStreamEvent, epoch: number) {
    if (epoch !== streamEpoch) return;
    if (event.type === "user_message") {
      set((state) => ({
        messages: [...state.messages, event.message],
        streamingDraft: "",
        stopped: false,
      }));
    } else if (event.type === "chunk") {
      set((state) => (state.stopped ? state : { streamingDraft: state.streamingDraft + event.delta }));
    } else if (event.type === "done") {
      set((state) => ({
        messages: [...state.messages, event.message],
        streamingDraft: "",
        generating: false,
      }));
    } else if (event.type === "compressed") {
      set({ summary: event.summary, summarizedUntil: event.summarizedUntil });
    }
  }

  return {
    itemId: null,
    sessionId: null,
    sessions: [],
    messages: [],
    summary: "",
    summarizedUntil: "",
    noteRefs: [],
    loading: false,
    generating: false,
    streamingDraft: "",
    stopped: false,
    error: null,

    load: async (itemId) => {
      const epoch = ++streamEpoch;
      set({
        itemId,
        sessionId: null,
        sessions: [],
        messages: [],
        summary: "",
        summarizedUntil: "",
        noteRefs: [],
        loading: true,
        generating: false,
        streamingDraft: "",
        stopped: false,
        error: null,
      });
      try {
        const sessions = await listAiChatSessions(itemId);
        if (epoch !== streamEpoch || get().itemId !== itemId) return;
        set({ sessions });
        const latest = sessions[0];
        if (latest) {
          set({ sessionId: latest.id });
          await loadSessionMessages(latest.id, epoch);
        }
      } catch (error) {
        if (epoch !== streamEpoch) return;
        set({ error: String(error) });
      } finally {
        if (epoch === streamEpoch) set({ loading: false });
      }
    },

    switchSession: async (sessionId) => {
      if (get().sessionId === sessionId) return;
      const epoch = ++streamEpoch;
      set({
        sessionId,
        messages: [],
        summary: "",
        summarizedUntil: "",
        generating: false,
        streamingDraft: "",
        stopped: false,
        error: null,
      });
      try {
        await loadSessionMessages(sessionId, epoch);
      } catch (error) {
        if (epoch === streamEpoch) set({ error: String(error) });
      }
    },

    createSession: async (itemId) => {
      try {
        const session = await createAiChatSession(itemId);
        set((state) => ({
          sessions: [session, ...state.sessions],
          sessionId: session.id,
          messages: [],
          summary: "",
          summarizedUntil: "",
          generating: false,
          streamingDraft: "",
          error: null,
        }));
      } catch (error) {
        set({ error: String(error) });
      }
    },

    renameSession: async (sessionId, title) => {
      try {
        const updated = await updateAiChatSession(sessionId, { title });
        set((state) => ({
          sessions: state.sessions.map((session) => (session.id === sessionId ? updated : session)),
        }));
      } catch (error) {
        set({ error: String(error) });
      }
    },

    updateSessionConfig: async (sessionId, updates) => {
      try {
        const updated = await updateAiChatSession(sessionId, updates);
        set((state) => ({
          sessions: state.sessions.map((session) => (session.id === sessionId ? updated : session)),
        }));
      } catch (error) {
        set({ error: String(error) });
      }
    },

    removeSession: async (sessionId) => {
      try {
        await deleteAiChatSession(sessionId);
        const itemId = get().itemId;
        const remaining = get().sessions.filter((session) => session.id !== sessionId);
        set({ sessions: remaining });
        if (get().sessionId === sessionId) {
          const next = remaining[0];
          if (next) {
            await get().switchSession(next.id);
          } else if (itemId) {
            // 删光了则重建一个空会话
            await get().createSession(itemId);
          }
        }
      } catch (error) {
        set({ error: String(error) });
      }
    },

    send: async (title, content, question, model) => {
      const sessionId = get().sessionId;
      if (!sessionId || get().generating) return;
      const epoch = ++streamEpoch;
      const noteRefs = get().noteRefs;
      set({ generating: true, error: null, streamingDraft: "", stopped: false });
      try {
        await sendAiChatMessage(sessionId, title, content, question, (event) => handleStreamEvent(event, epoch), {
          model: model || undefined,
          extraNotes: toExtraNotes(noteRefs),
        });
        if (epoch === streamEpoch) {
          set({ generating: false });
          // 自动命名后刷新会话标题
          const itemId = get().itemId;
          if (itemId) {
            const sessions = await listAiChatSessions(itemId);
            if (epoch === streamEpoch) set({ sessions });
          }
        }
      } catch (error) {
        if (epoch === streamEpoch) set({ generating: false, error: String(error) });
      }
    },

    regenerate: async (title, content, model) => {
      const sessionId = get().sessionId;
      if (!sessionId || get().generating) return;
      const epoch = ++streamEpoch;
      const noteRefs = get().noteRefs;
      set({ generating: true, error: null, streamingDraft: "", stopped: false });
      set((state) => {
        const messages = [...state.messages];
        if (messages.length > 0 && messages[messages.length - 1].role === "assistant") messages.pop();
        return { messages };
      });
      try {
        await regenerateAiChatReply(sessionId, title, content, (event) => handleStreamEvent(event, epoch), {
          model: model || undefined,
          extraNotes: toExtraNotes(noteRefs),
        });
        if (epoch === streamEpoch) set({ generating: false });
      } catch (error) {
        if (epoch === streamEpoch) set({ generating: false, error: String(error) });
      }
    },

    removeMessage: async (messageId) => {
      set((state) => ({ messages: state.messages.filter((message) => message.id !== messageId) }));
      try {
        await deleteAiChatMessage(messageId);
      } catch (error) {
        set({ error: String(error) });
      }
    },

    stop: () => {
      // 仅停止 UI 追加；后端该条仍会完整落库。串行锁保证后续提问排在旧流之后，不会乱序。
      set({ stopped: true, generating: false });
    },

    clear: async () => {
      const sessionId = get().sessionId;
      if (!sessionId) return;
      streamEpoch++;
      set({
        generating: false,
        streamingDraft: "",
        stopped: false,
        messages: [],
        summary: "",
        summarizedUntil: "",
      });
      try {
        await clearAiChatMessages(sessionId);
      } catch (error) {
        set({ error: String(error) });
      }
    },

    compress: async () => {
      const sessionId = get().sessionId;
      if (!sessionId) return;
      try {
        const summaryState = await compressAiChatMessages(sessionId);
        set({ summary: summaryState.summary, summarizedUntil: summaryState.summarizedUntil });
      } catch (error) {
        set({ error: String(error) });
      }
    },

    addNoteRef: (note) => {
      set((state) => (
        state.noteRefs.some((existing) => existing.id === note.id)
          ? state
          : { noteRefs: [...state.noteRefs, note] }
      ));
    },

    removeNoteRef: (id) => {
      set((state) => ({ noteRefs: state.noteRefs.filter((note) => note.id !== id) }));
    },
  };
});
