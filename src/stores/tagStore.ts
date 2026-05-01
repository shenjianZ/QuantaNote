import { create } from "zustand";
import { getAllTags, createTag as createTagCmd, deleteTag as deleteTagCmd, getItemTags, setItemTags, renameTag as renameTagCmd, updateTagColor as updateTagColorCmd } from "../services/tauriCommands";

export interface TagDto {
  name: string;
  color: string;
}

interface TagState {
  tags: TagDto[];
  itemTags: TagDto[];
  loading: boolean;
  error: string | null;
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
    } catch (e) {
      set({ error: String(e) });
    }
  },

  removeTag: async (name: string) => {
    try {
      await deleteTagCmd(name);
      set({
        tags: get().tags.filter((t) => t.name !== name),
        itemTags: get().itemTags.filter((t) => t.name !== name),
      });
    } catch (e) {
      set({ error: String(e) });
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
    }
  },
}));
