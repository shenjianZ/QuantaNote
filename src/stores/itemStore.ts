import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getLibraryData, type ItemDto, type TagDto } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

export type { ItemDto };

interface LibraryResult {
  items: ItemDto[];
  tags: TagDto[];
  mappings: Record<string, string[]>;
}

interface ItemState {
  items: ItemDto[];
  itemTagNames: Record<string, string[]>;
  selectedItem: ItemDto | null;
  pinnedItems: ItemDto[];
  recentItems: ItemDto[];
  loading: boolean;
  error: string | null;
  fetchItems: (itemType?: string) => Promise<void>;
  fetchLibraryData: () => Promise<LibraryResult>;
  setItemTagNames: (id: string, names: string[]) => void;
  getItem: (id: string) => Promise<void>;
  createItem: (title: string, itemType: string, content?: string) => Promise<ItemDto>;
  updateItem: (id: string, updates: Record<string, unknown>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  fetchPinned: () => Promise<void>;
  fetchRecent: (limit?: number) => Promise<void>;
}

export const useItemStore = create<ItemState>((set) => ({
  items: [],
  itemTagNames: {},
  selectedItem: null,
  pinnedItems: [],
  recentItems: [],
  loading: false,
  error: null,

  fetchItems: async (itemType) => {
    set({ loading: true });
    try {
      const items = await invoke<ItemDto[]>("get_items", {
        itemType: itemType ?? null,
        limit: 50,
        offset: 0,
      });
      set({ items, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchLibraryData: async () => {
    set({ loading: true });
    try {
      const data = await getLibraryData();
      const mappings: Record<string, string[]> = {};
      for (const [itemId, tagName] of data.mappings) {
        (mappings[itemId] ??= []).push(tagName);
      }
      set({ items: data.items, itemTagNames: mappings, loading: false });
      return { items: data.items, tags: data.tags, mappings };
    } catch (e) {
      set({ error: String(e), loading: false });
      return { items: [], tags: [], mappings: {} };
    }
  },

  setItemTagNames: (id, names) => {
    set((state) => ({
      itemTagNames: { ...state.itemTagNames, [id]: names },
    }));
  },

  getItem: async (id) => {
    try {
      const item = await invoke<ItemDto>("get_item", { id });
      set({ selectedItem: item });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createItem: async (title, itemType, content) => {
    set({ error: null });
    try {
      const item = await invoke<ItemDto>("create_item", {
        title,
        itemType,
        content: content ?? null,
      });
      set((state) => ({ items: [item, ...state.items] }));
      return item;
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.itemCreateFailed"));
      throw e;
    }
  },

  updateItem: async (id, updates) => {
    set({ error: null });
    try {
      const updated = await invoke<ItemDto>("update_item", { id, ...updates });
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? updated : i)),
        selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
      }));
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.itemUpdateFailed"));
      throw e;
    }
  },

  deleteItem: async (id) => {
    set({ error: null });
    try {
      await invoke("delete_item", { id });
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
      }));
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.itemDeleteFailed"));
      throw e;
    }
  },

  fetchPinned: async () => {
    try {
      const items = await invoke<ItemDto[]>("get_pinned_items");
      set({ pinnedItems: items });
    } catch {
      /* ignore */
    }
  },

  fetchRecent: async (limit) => {
    try {
      const items = await invoke<ItemDto[]>("get_recent_items", { limit: limit ?? 20 });
      set({ recentItems: items });
    } catch {
      /* ignore */
    }
  },
}));
