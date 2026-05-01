import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SearchResultDto {
  id: string;
  title: string;
  item_type: string;
  summary: string;
}

interface SearchState {
  query: string;
  results: SearchResultDto[];
  searching: boolean;
  setQuery: (q: string) => void;
  search: (q: string, itemType?: string) => Promise<void>;
}

let _searchSeq = 0;

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  results: [],
  searching: false,

  setQuery: (q) => set({ query: q }),

  search: async (q, itemType) => {
    if (!q.trim()) {
      set({ results: [], searching: false });
      return;
    }
    const seq = ++_searchSeq;
    set({ searching: true });
    try {
      const results = await invoke<SearchResultDto[]>("search_items", {
        query: q,
        itemType: itemType ?? null,
      });
      // 如果已有更新的搜索请求，丢弃本次结果
      if (seq !== _searchSeq) return;
      set({ results, searching: false });
    } catch {
      if (seq !== _searchSeq) return;
      set({ results: [], searching: false });
    }
  },
}));
