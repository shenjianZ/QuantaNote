import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  cleanupTrash,
  getAllItemTagMappings,
  getAllTags,
  getItemsPage,
  getTrashItems,
  permanentlyDeleteAllTrash as permanentlyDeleteAllTrashCommand,
  permanentlyDeleteItem,
  restoreItem,
  type ItemDto,
  type ItemPageOptions,
  regenerateSummary,
  type TagDto,
  type TrashItemDto,
} from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

export type { ItemDto };
export type { TrashItemDto };

interface LibraryResult {
  items: ItemDto[];
  tags: TagDto[];
  mappings: Record<string, string[]>;
  total: number;
}

interface ItemState {
  items: ItemDto[];
  itemTagNames: Record<string, string[]>;
  selectedItem: ItemDto | null;
  pinnedItems: ItemDto[];
  recentItems: ItemDto[];
  trashItems: TrashItemDto[];
  libraryTotal: number;
  libraryLoadingMore: boolean;
  loading: boolean;
  error: string | null;
  fetchItems: (itemType?: string) => Promise<void>;
  fetchLibraryData: (options?: ItemPageOptions, append?: boolean) => Promise<LibraryResult>;
  setItemTagNames: (id: string, names: string[]) => void;
  getItem: (id: string) => Promise<void>;
  createItem: (title: string, itemType: string, content?: string) => Promise<ItemDto>;
  updateItem: (id: string, updates: Record<string, unknown>) => Promise<void>;
  regenerateSummary: (id: string) => Promise<ItemDto>;
  deleteItem: (id: string) => Promise<void>;
  fetchTrashItems: () => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentlyDeleteItem: (id: string) => Promise<void>;
  permanentlyDeleteAllTrash: () => Promise<number>;
  cleanupTrash: (olderThanDays?: number) => Promise<number>;
  fetchPinned: () => Promise<void>;
  fetchRecent: (limit?: number) => Promise<void>;
}

let _librarySeq = 0;

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  itemTagNames: {},
  selectedItem: null,
  pinnedItems: [],
  recentItems: [],
  trashItems: [],
  libraryTotal: 0,
  libraryLoadingMore: false,
  loading: false,
  error: null,

  fetchItems: async (itemType) => {
    set({ loading: true, error: null });
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

  fetchLibraryData: async (options = {}, append = false) => {
    const seq = ++_librarySeq;
    set(append ? { libraryLoadingMore: true } : { loading: true, libraryLoadingMore: false });
    try {
      const pageOptions = append
        ? { ...options, offset: options.offset ?? get().items.length }
        : options;
      const [page, tags, rawMappings] = await Promise.all([
        getItemsPage(pageOptions),
        getAllTags(),
        getAllItemTagMappings(),
      ]);
      const mappings: Record<string, string[]> = {};
      for (const [itemId, tagName] of rawMappings) {
        (mappings[itemId] ??= []).push(tagName);
      }
      if (seq !== _librarySeq) {
        return { items: [], tags, mappings: {}, total: 0 };
      }
      set((state) => {
        const nextItems = append
          ? [...state.items, ...page.items.filter((item) => !state.items.some((existing) => existing.id === item.id))]
          : page.items;
        return {
          items: nextItems,
          itemTagNames: mappings,
          libraryTotal: page.total,
          loading: false,
          libraryLoadingMore: false,
        };
      });
      return { items: page.items, tags, mappings, total: page.total };
    } catch (e) {
      if (seq === _librarySeq) {
        set({ error: String(e), loading: false, libraryLoadingMore: false });
      }
      return { items: [], tags: [], mappings: {}, total: 0 };
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

  regenerateSummary: async (id) => {
    set({ error: null });
    try {
      const updated = await regenerateSummary(id);
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
        selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
      }));
      return updated;
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", i18n.t("common:toast.itemUpdateFailed"));
      throw e;
    }
  },

  fetchTrashItems: async () => {
    try {
      const trashItems = await getTrashItems();
      set({ trashItems });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  restoreItem: async (id) => {
    set({ error: null });
    try {
      const restored = await restoreItem(id);
      set((state) => ({
        items: [restored, ...state.items.filter((item) => item.id !== id)],
        trashItems: state.trashItems.filter((trashItem) => trashItem.item.id !== id),
      }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  permanentlyDeleteItem: async (id) => {
    set({ error: null });
    try {
      await permanentlyDeleteItem(id);
      set((state) => ({
        trashItems: state.trashItems.filter((trashItem) => trashItem.item.id !== id),
      }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  permanentlyDeleteAllTrash: async () => {
    set({ error: null });
    try {
      const deletedCount = await permanentlyDeleteAllTrashCommand();
      set({ trashItems: [] });
      return deletedCount;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  cleanupTrash: async (olderThanDays) => {
    try {
      const deletedCount = await cleanupTrash(olderThanDays);
      return deletedCount;
    } catch (e) {
      set({ error: String(e) });
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
