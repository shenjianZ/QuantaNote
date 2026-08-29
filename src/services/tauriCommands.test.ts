import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createItem,
  getItems,
  getItemsPage,
  updateItem,
  deleteItem,
  getTrashItems,
  restoreItem,
  permanentlyDeleteItem,
  cleanupTrash,
  searchItems,
  addAttachment,
  exportAttachment,
  getStorageConsistencyReport,
  repairStorageConsistency,
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

  it("searchItems passes advanced mode and selected scopes", async () => {
    await searchItems("rust OR sqlite -draft", "note", {
      mode: "advanced",
      scopes: ["content", "tags", "versions"],
      limit: 20,
      offset: 40,
    });
    expect(captured?.args).toMatchObject({
      mode: "advanced",
      scopes: ["content", "tags", "versions"],
      limit: 20,
      offset: 40,
    });
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

  it("getItemsPage passes list filters and pagination", async () => {
    await getItemsPage({ tab: "pinned", tag: "rust", sort: "title", limit: 20, offset: 40 });
    expect(captured?.cmd).toBe("get_items_page");
    expect(captured?.args).toMatchObject({
      tab: "pinned",
      tag: "rust",
      sort: "title",
      limit: 20,
      offset: 40,
    });
  });

  it("calls trash lifecycle commands with stable arguments", async () => {
    await getTrashItems();
    expect(captured?.cmd).toBe("get_trash_items");

    await restoreItem("id-1");
    expect(captured?.cmd).toBe("restore_item");
    expect(captured?.args).toMatchObject({ id: "id-1" });

    await permanentlyDeleteItem("id-1");
    expect(captured?.cmd).toBe("permanently_delete_item");

    await cleanupTrash(30);
    expect(captured?.cmd).toBe("cleanup_trash");
    expect(captured?.args).toMatchObject({ olderThanDays: 30 });
  });

  it("exportAttachment passes source and destination paths", async () => {
    await exportAttachment("C:/data/image.png", "D:/export/image.png");
    expect(captured?.cmd).toBe("export_attachment");
    expect(captured?.args).toMatchObject({
      sourcePath: "C:/data/image.png",
      destinationPath: "D:/export/image.png",
    });
  });

  it("calls storage consistency commands", async () => {
    await getStorageConsistencyReport();
    expect(captured?.cmd).toBe("get_storage_consistency_report");

    await repairStorageConsistency();
    expect(captured?.cmd).toBe("repair_storage_consistency");
  });

  it("getAllItemTagMappings returns tuple array", async () => {
    mockIPC(() => [["id-1", "rust"]]);
    const result = await getAllItemTagMappings();
    expect(result).toEqual([["id-1", "rust"]]);
  });
});
