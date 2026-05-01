import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "./searchStore";

describe("searchStore", () => {
  beforeEach(() => {
    useSearchStore.setState({ query: "", results: [], searching: false });
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
      expect(args).toEqual({ query: "rust", itemType: "note" });
      return [{ id: "item-1", title: "Rust", item_type: "note", summary: "FTS" }];
    });

    await useSearchStore.getState().search("rust", "note");

    expect(useSearchStore.getState().results).toEqual([
      { id: "item-1", title: "Rust", item_type: "note", summary: "FTS" },
    ]);
    expect(useSearchStore.getState().searching).toBe(false);
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
