import { create } from "zustand";
import { addAttachment, deleteAttachment, getAttachments } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

interface AttachmentDto {
  id: string;
  item_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface AttachmentState {
  attachments: AttachmentDto[];
  loading: boolean;
  error: string | null;
  fetchAttachments: (itemId: string) => Promise<void>;
  addAttachment: (itemId: string, path: string) => Promise<void>;
  deleteAttachment: (id: string) => Promise<void>;
}

export const useAttachmentStore = create<AttachmentState>((set, get) => ({
  attachments: [],
  loading: false,
  error: null,

  fetchAttachments: async (itemId: string) => {
    set({ loading: true, error: null });
    try {
      const attachments = await getAttachments(itemId) as AttachmentDto[];
      set({ attachments, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addAttachment: async (itemId: string, path: string) => {
    try {
      const newAtt = await addAttachment(itemId, path) as AttachmentDto;
      set({ attachments: [...get().attachments, newAtt] });
      useToastStore.getState().addToast("success", i18n.t("common:toast.attachmentAdded"));
    } catch (e) {
      set({ error: String(e) });
      const reason = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));
      useToastStore.getState().addToast("error", `${i18n.t("common:toast.attachmentAddFailed")}: ${reason}`);
    }
  },

  deleteAttachment: async (id: string) => {
    try {
      await deleteAttachment(id);
      set({ attachments: get().attachments.filter((a) => a.id !== id) });
      useToastStore.getState().addToast("success", i18n.t("common:toast.attachmentDeleted"));
    } catch (e) {
      set({ error: String(e) });
      const reason = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));
      useToastStore.getState().addToast("error", `${i18n.t("common:toast.attachmentDeleteFailed")}: ${reason}`);
    }
  },
}));
