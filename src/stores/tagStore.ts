import { create } from "zustand";
import { getAllTags, createTag as createTagCmd, deleteTag as deleteTagCmd, getItemTags, setItemTags, renameTag as renameTagCmd, updateTagColor as updateTagColorCmd } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

export interface TagDto {
  name: string;
  color: string;
}

interface TagState {
  tags: TagDto[];
  itemTags: TagDto[];
  loading: boolean;
  error: string | null;
  setTags: (tags: TagDto[]) => void;
  fetchTags: () => Promise<void>;
  createTag: (name: string, color: string) => Promise<void>;
  removeTag: (name: string) => Promise<void>;
  fetchItemTags: (itemId: string) => Promise<void>;
  updateItemTags: (itemId: string, tagNames: string[]) => Promise<void>;
  renameTag: (oldName: string, newName: string) => Promise<void>;
  updateTagColor: (name: string, color: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  itemTags: [],
  loading: false,
  error: null,

  setTags: (tags) => set({ tags }),

  fetchTags: async () => {
    try {
      const tags = await getAllTags();
      set({ tags });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createTag: async (name: string, color: string) => {
    try {
      const newTag = await createTagCmd(name, color);
      set({ tags: [...get().tags, newTag] });
      useToastStore.getState().addToast("success", i18n.t("common:toast.tagCreated"));
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.tagCreateFailed"));
    }
  },

  removeTag: async (name: string) => {
    try {
      await deleteTagCmd(name);
      set({
        tags: get().tags.filter((t) => t.name !== name),
        itemTags: get().itemTags.filter((t) => t.name !== name),
      });
      useToastStore.getState().addToast("success", i18n.t("common:toast.tagDeleted"));
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.tagDeleteFailed"));
    }
  },

  fetchItemTags: async (itemId: string) => {
    try {
      const itemTags = await getItemTags(itemId);
      set({ itemTags });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateItemTags: async (itemId: string, tagNames: string[]) => {
    try {
      await setItemTags(itemId, tagNames);
      // 重新获取更新后的标签
      const itemTags = await getItemTags(itemId);
      set({ itemTags });
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.tagUpdateFailed"));
    }
  },

  renameTag: async (oldName: string, newName: string) => {
    try {
      const updated = await renameTagCmd(oldName, newName);
      set({
        tags: get().tags.map((t) => (t.name === oldName ? updated : t)),
        itemTags: get().itemTags.map((t) => (t.name === oldName ? updated : t)),
      });
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.tagRenameFailed"));
    }
  },

  updateTagColor: async (name: string, color: string) => {
    try {
      const updated = await updateTagColorCmd(name, color);
      set({
        tags: get().tags.map((t) => (t.name === name ? updated : t)),
        itemTags: get().itemTags.map((t) => (t.name === name ? updated : t)),
      });
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.tagColorFailed"));
    }
  },
}));
