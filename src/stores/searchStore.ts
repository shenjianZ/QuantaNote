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
  search: (q: string) => Promise<void>;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  results: [],
  searching: false,

  setQuery: (q) => set({ query: q }),

  search: async (q) => {
    if (!q.trim()) {
      set({ results: [], searching: false });
      return;
    }
    set({ searching: true });
    try {
      const results = await invoke<SearchResultDto[]>("search_items", { query: q });
      set({ results, searching: false });
    } catch {
      set({ results: [], searching: false });
    }
  },
}));
