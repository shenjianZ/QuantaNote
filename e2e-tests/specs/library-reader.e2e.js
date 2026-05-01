import { cleanupAll, seedItem, getItemById } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

describe("Library reader and item actions", () => {
  let pinnedItem, favoriteItem, normalItem;

  before(async () => {
    await cleanupAll();
    normalItem = await seedItem({ title: "普通笔记", content: "普通内容" });
    pinnedItem = await seedItem({ title: "置顶笔记", content: "置顶内容", pinned: true });
    favoriteItem = await seedItem({ title: "收藏笔记", content: "收藏内容", favorite: true });
    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAll();
  });

  it("clicking item opens reader drawer", async () => {
    await LibraryPage.clickItem("普通笔记");
    await expect(LibraryPage.readerIsOpen()).resolves.toBe(true);
  });

  it("reader drawer shows markdown content", async () => {
    const drawer = await $(LibraryPage.readerDrawer);
    const text = await drawer.getText();
    expect(text).toContain("普通笔记");
  });

  it("closing reader drawer", async () => {
    await LibraryPage.closeReader();
    await expect($(LibraryPage.readerDrawer)).not.toBeDisplayed();
  });

  it("pin via action menu", async () => {
    await LibraryPage.clickItem("普通笔记");
    await LibraryPage.togglePin();

    const updated = await getItemById(normalItem.id);
    expect(updated.pinned).toBe(true);
    await LibraryPage.closeReader();
  });

  it("unpin via action menu", async () => {
    await LibraryPage.clickItem("普通笔记");
    await LibraryPage.togglePin();

    const updated = await getItemById(normalItem.id);
    expect(updated.pinned).toBe(false);
    await LibraryPage.closeReader();
  });

  it("favorite via action menu", async () => {
    await LibraryPage.clickItem("普通笔记");
    await LibraryPage.toggleFavorite();

    const updated = await getItemById(normalItem.id);
    expect(updated.favorite).toBe(true);
    await LibraryPage.closeReader();
  });

  it("unfavorite via action menu", async () => {
    await LibraryPage.clickItem("普通笔记");
    await LibraryPage.toggleFavorite();

    const updated = await getItemById(normalItem.id);
    expect(updated.favorite).toBe(false);
    await LibraryPage.closeReader();
  });

  it("copy content via action menu", async () => {
    await LibraryPage.clickItem("普通笔记");
    await LibraryPage.clickCopy();
    // "已复制" 应短暂出现
    await pause(300);
    await LibraryPage.closeReader();
  });

  it("delete item via action menu", async () => {
    await LibraryPage.clickItem("收藏笔记");
    await LibraryPage.clickDelete();
    await pause(500);

    await LibraryPage.expectItemNotVisible("收藏笔记");
  });
});
