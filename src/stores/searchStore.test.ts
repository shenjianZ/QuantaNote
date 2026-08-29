import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "./searchStore";

describe("searchStore", () => {
  beforeEach(() => {
    useSearchStore.setState({
      query: "",
      results: [],
      total: 0,
      searching: false,
      loadingMore: false,
      hasMore: false,
    });
  });

  it("skips backend calls for blank queries", async () => {
    const spy = vi.fn();
    mockIPC((cmd, args) => {
      spy(cmd, args);
      return [];
    });

    await useSearchStore.getState().search("   ");

    expect(spy).not.toHaveBeenCalled();
    expect(useSearchStore.getState().results).toEqual([]);
    expect(useSearchStore.getState().searching).toBe(false);
  });

  it("calls search_items with itemType and stores results", async () => {
    mockIPC((cmd, args) => {
      expect(cmd).toBe("search_items");
      expect(args).toMatchObject({
        query: "rust",
        itemType: "note",
        tab: null,
        tag: null,
        sort: null,
        limit: 50,
        offset: 0,
      });
      return {
        results: [{ id: "item-1", title: "Rust", item_type: "note", summary: "FTS" }],
        total: 1,
      };
    });

    await useSearchStore.getState().search("rust", "note");

    expect(useSearchStore.getState().results).toEqual([
      { id: "item-1", title: "Rust", item_type: "note", summary: "FTS" },
    ]);
    expect(useSearchStore.getState().searching).toBe(false);
    expect(useSearchStore.getState().total).toBe(1);
  });

  it("loads additional search pages and tracks whether more results exist", async () => {
    mockIPC((cmd, args) => {
      expect(cmd).toBe("search_items");
      const offset = (args as { offset: number }).offset;
      return offset === 0
        ? { results: [{ id: "item-1", title: "One", item_type: "note", summary: "" }], total: 2 }
        : { results: [{ id: "item-2", title: "Two", item_type: "note", summary: "" }], total: 2 };
    });

    await useSearchStore.getState().search("note", "note");
    expect(useSearchStore.getState().hasMore).toBe(true);

    await useSearchStore.getState().loadMore("note");

    expect(useSearchStore.getState().results.map((result) => result.id)).toEqual(["item-1", "item-2"]);
    expect(useSearchStore.getState().hasMore).toBe(false);
  });

  it("clears results when backend search fails", async () => {
    useSearchStore.setState({
      results: [{ id: "old", title: "old", item_type: "note", summary: "" }],
    });
    mockIPC(() => {
      throw new Error("search failed");
    });

    await useSearchStore.getState().search("rust");

    expect(useSearchStore.getState().results).toEqual([]);
    expect(useSearchStore.getState().searching).toBe(false);
  });
});
