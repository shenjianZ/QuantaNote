import { create } from "zustand";
import { addAttachment, addAttachmentData, deleteAttachment, getAttachments, type AttachmentResult } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

export interface AttachmentDto {
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
  addAttachment: (itemId: string, path: string) => Promise<AttachmentDto | null>;
  addAttachmentData: (itemId: string, filename: string, mimeType: string, data: string) => Promise<AttachmentDto | null>;
  deleteAttachment: (id: string) => Promise<boolean>;
}

export const useAttachmentStore = create<AttachmentState>((set, get) => ({
  attachments: [],
  loading: false,
  error: null,

  fetchAttachments: async (itemId: string) => {
    set((state) => state.attachments.length === 0
      ? { loading: true, error: null }
      : { attachments: [], loading: true, error: null });
    try {
      const attachments = await getAttachments(itemId) as AttachmentDto[] | null;
      const nextAttachments = Array.isArray(attachments) ? attachments : [];
      set((state) => ({
        attachments: state.attachments.length === nextAttachments.length
          && state.attachments.every((attachment, index) => attachment.id === nextAttachments[index]?.id)
          ? state.attachments
          : nextAttachments,
        loading: false,
      }));
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addAttachment: async (itemId: string, path: string) => {
    try {
      const newAtt = await addAttachment(itemId, path) as AttachmentDto;
      set({ attachments: [...get().attachments, newAtt] });
      useToastStore.getState().addToast("success", i18n.t("common:toast.attachmentAdded"));
      return newAtt;
    } catch (e) {
      set({ error: String(e) });
      const reason = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));
      useToastStore.getState().addToast("error", `${i18n.t("common:toast.attachmentAddFailed")}: ${reason}`);
      return null;
    }
  },

  addAttachmentData: async (itemId: string, filename: string, mimeType: string, data: string) => {
    try {
      const newAtt = await addAttachmentData(itemId, filename, mimeType, data) as AttachmentResult;
      set({ attachments: [...get().attachments, newAtt] });
      useToastStore.getState().addToast("success", i18n.t("common:toast.attachmentAdded"));
      return newAtt;
    } catch (e) {
      set({ error: String(e) });
      const reason = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));
      useToastStore.getState().addToast("error", `${i18n.t("common:toast.attachmentAddFailed")}: ${reason}`);
      return null;
    }
  },

  deleteAttachment: async (id: string) => {
    try {
      await deleteAttachment(id);
      set({ attachments: get().attachments.filter((a) => a.id !== id) });
      useToastStore.getState().addToast("success", i18n.t("common:toast.attachmentDeleted"));
      return true;
    } catch (e) {
      set({ error: String(e) });
      const reason = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));
      useToastStore.getState().addToast("error", `${i18n.t("common:toast.attachmentDeleteFailed")}: ${reason}`);
      return false;
    }
  },
}));
