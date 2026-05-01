import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useItemStore, type ItemDto } from "./itemStore";

const item: ItemDto = {
  id: "item-1",
  title: "测试笔记",
  item_type: "note",
  content: "正文",
  summary: "正文",
  pinned: false,
  favorite: false,
  encrypted: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("itemStore", () => {
  beforeEach(() => {
    useItemStore.setState({
      items: [],
      selectedItem: null,
      pinnedItems: [],
      recentItems: [],
      loading: false,
      error: null,
    });
  });

  it("fetches items through the Tauri command contract", async () => {
    mockIPC((cmd, args) => {
      expect(cmd).toBe("get_items");
      expect(args).toMatchObject({ itemType: null, limit: 50, offset: 0 });
      return [item];
    });

    await useItemStore.getState().fetchItems();

    expect(useItemStore.getState().items).toEqual([item]);
    expect(useItemStore.getState().loading).toBe(false);
  });

  it("prepends created items", async () => {
    const spy = vi.fn();
    mockIPC((cmd, args) => {
      spy(cmd, args);
      return item;
    });

    const created = await useItemStore.getState().createItem("测试笔记", "note", "正文");

    expect(created).toEqual(item);
    expect(useItemStore.getState().items).toEqual([item]);
    expect(spy).toHaveBeenCalledWith("create_item", {
      title: "测试笔记",
      itemType: "note",
      content: "正文",
    });
  });

  it("records fetch errors without throwing", async () => {
    mockIPC(() => {
      throw new Error("database down");
    });

    await useItemStore.getState().fetchItems();

    expect(useItemStore.getState().items).toEqual([]);
    expect(useItemStore.getState().error).toContain("database down");
    expect(useItemStore.getState().loading).toBe(false);
  });
});
