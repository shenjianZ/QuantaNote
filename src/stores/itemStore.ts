import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ItemDto {
  id: string;
  title: string;
  item_type: string;
  content: string;
  summary: string;
  pinned: boolean;
  favorite: boolean;
  encrypted: boolean;
  created_at: string;
  updated_at: string;
}

interface ItemState {
  items: ItemDto[];
  selectedItem: ItemDto | null;
  pinnedItems: ItemDto[];
  recentItems: ItemDto[];
  loading: boolean;
  error: string | null;
  fetchItems: (itemType?: string) => Promise<void>;
  getItem: (id: string) => Promise<void>;
  createItem: (title: string, itemType: string, content?: string) => Promise<ItemDto>;
  updateItem: (id: string, updates: Record<string, unknown>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  fetchPinned: () => Promise<void>;
  fetchRecent: (limit?: number) => Promise<void>;
}

export const useItemStore = create<ItemState>((set) => ({
  items: [],
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

  getItem: async (id) => {
    try {
      const item = await invoke<ItemDto>("get_item", { id });
      set({ selectedItem: item });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createItem: async (title, itemType, content) => {
    const item = await invoke<ItemDto>("create_item", {
      title,
      itemType,
      content: content ?? null,
    });
    set((state) => ({ items: [item, ...state.items] }));
    return item;
  },

  updateItem: async (id, updates) => {
    const updated = await invoke<ItemDto>("update_item", { id, ...updates });
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? updated : i)),
      selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
    }));
  },

  deleteItem: async (id) => {
    await invoke("delete_item", { id });
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    }));
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
