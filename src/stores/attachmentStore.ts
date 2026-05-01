import { create } from "zustand";
import { addAttachment, deleteAttachment, getAttachments } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";

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
      useToastStore.getState().addToast("success", "附件已添加");
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", "添加附件失败");
    }
  },

  deleteAttachment: async (id: string) => {
    try {
      await deleteAttachment(id);
      set({ attachments: get().attachments.filter((a) => a.id !== id) });
      useToastStore.getState().addToast("success", "附件已删除");
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", "删除附件失败");
    }
  },
}));
