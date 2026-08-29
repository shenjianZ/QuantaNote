import { create } from "zustand";
import { searchItems, type SearchPageOptions, type SearchResultDto } from "../services/tauriCommands";

export type { SearchResultDto } from "../services/tauriCommands";

interface SearchState {
  query: string;
  results: SearchResultDto[];
  total: number;
  searching: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  setQuery: (q: string) => void;
  search: (q: string, itemType?: string, options?: SearchPageOptions) => Promise<void>;
  loadMore: (itemType?: string, options?: SearchPageOptions) => Promise<void>;
}

let _searchSeq = 0;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  results: [],
  total: 0,
  searching: false,
  loadingMore: false,
  hasMore: false,

  setQuery: (q) => set({ query: q }),

  search: async (q, itemType, options) => {
    const seq = ++_searchSeq;
    if (!q.trim()) {
      set({ query: q, results: [], total: 0, searching: false, loadingMore: false, hasMore: false });
      return;
    }
    set({
      query: q,
      results: [],
      total: 0,
      hasMore: false,
      searching: true,
      loadingMore: false,
    });
    try {
      const page = await searchItems(q, itemType, { ...options, offset: 0 });
      // 如果已有更新的搜索请求，丢弃本次结果
      if (seq !== _searchSeq) return;
      set({
        results: page.results,
        total: page.total,
        hasMore: page.results.length < page.total,
        searching: false,
      });
    } catch {
      if (seq !== _searchSeq) return;
      set({ results: [], total: 0, hasMore: false, searching: false });
    }
  },

  loadMore: async (itemType, options) => {
    const state = get();
    if (!state.query.trim() || state.searching || state.loadingMore || !state.hasMore) return;
    const seq = _searchSeq;
    set({ loadingMore: true });
    try {
      const page = await searchItems(state.query, itemType, {
        ...options,
        offset: state.results.length,
      });
      if (seq !== _searchSeq) return;
      set((current) => {
        const existing = new Set(current.results.map((result) => result.id));
        const nextResults = [
          ...current.results,
          ...page.results.filter((result) => !existing.has(result.id)),
        ];
        return {
          results: nextResults,
          total: page.total,
          hasMore: nextResults.length < page.total,
          loadingMore: false,
        };
      });
    } catch {
      if (seq === _searchSeq) set({ loadingMore: false });
    }
  },
}));
