import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createItem,
  getItems,
  updateItem,
  deleteItem,
  searchItems,
  addAttachment,
  getVersions,
  getAllItemTagMappings,
} from "./tauriCommands";

describe("tauriCommands", () => {
  let captured: { cmd: string; args: Record<string, unknown> } | null;

  beforeEach(() => {
    captured = null;
    mockIPC((cmd, args) => {
      captured = { cmd, args: args as Record<string, unknown> };
      return [];
    });
  });

  it("createItem calls invoke with correct args", async () => {
    await createItem("Title", "note", "body");
    expect(captured?.cmd).toBe("create_item");
    expect(captured?.args).toMatchObject({ title: "Title", itemType: "note", content: "body" });
  });

  it("getItems passes default limit and offset", async () => {
    await getItems();
    expect(captured?.cmd).toBe("get_items");
    expect(captured?.args).toMatchObject({ itemType: null, limit: 50, offset: 0 });
  });

  it("updateItem spreads updates into args", async () => {
    await updateItem("id-1", { title: "new" });
    expect(captured?.cmd).toBe("update_item");
    expect(captured?.args).toMatchObject({ id: "id-1", title: "new" });
  });

  it("deleteItem calls invoke", async () => {
    await deleteItem("id-1");
    expect(captured?.cmd).toBe("delete_item");
    expect(captured?.args).toMatchObject({ id: "id-1" });
  });

  it("searchItems passes query and itemType", async () => {
    await searchItems("rust", "note");
    expect(captured?.cmd).toBe("search_items");
    expect(captured?.args).toMatchObject({ query: "rust", itemType: "note" });
  });

  it("addAttachment passes itemId and path", async () => {
    await addAttachment("item-1", "/file.txt");
    expect(captured?.cmd).toBe("add_attachment");
    expect(captured?.args).toMatchObject({ itemId: "item-1", path: "/file.txt" });
  });

  it("getVersions passes itemId", async () => {
    await getVersions("item-1");
    expect(captured?.cmd).toBe("get_versions");
    expect(captured?.args).toMatchObject({ itemId: "item-1" });
  });

  it("getAllItemTagMappings returns tuple array", async () => {
    mockIPC(() => [["id-1", "rust"]]);
    const result = await getAllItemTagMappings();
    expect(result).toEqual([["id-1", "rust"]]);
  });
});
