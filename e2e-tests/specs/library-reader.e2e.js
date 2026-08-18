import { cleanupAll, seedItem, getItemById } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

describe("Library reader and item actions", () => {
  let pinnedItem, favoriteItem, normalItem;

  before(async () => {
    await cleanupAll();
    normalItem = await seedItem({ title: "普通笔记", content: "普通内容" });
    await seedItem({
      title: "表格笔记",
      content: "| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|     |     | 01   |\n|     |     | 01   |",
    });
    await seedItem({
      title: "丰富预览笔记",
      content: [
        "# 阅读标题",
        "",
        "> [!TIP]",
        "> 这是一条阅读提示。",
        "",
        "- [x] 已完成",
        "",
        "```ts",
        "const answer = 42;",
        "```",
      ].join("\n"),
    });
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

  it("keeps preview table border aligned with cells", async () => {
    await LibraryPage.closeReader();
    await LibraryPage.clickItem("表格笔记");

    await browser.waitUntil(
      async () => {
        return browser.execute(() => Boolean(document.querySelector("[data-testid='reader-drawer'] .markdown-preview table")));
      },
      { timeout: 3000, timeoutMsg: "Preview table was not rendered" },
    );

    const geometry = await browser.execute(() => {
      const table = document.querySelector("[data-testid='reader-drawer'] .markdown-preview table");
      const rows = Array.from(table?.querySelectorAll("tr") ?? []);
      const rightmostCells = rows
        .map((row) => row.querySelector(":scope > th:last-child, :scope > td:last-child"))
        .filter(Boolean);
      const tableRect = table?.getBoundingClientRect();
      const lastRight = Math.max(...rightmostCells.map((cell) => cell.getBoundingClientRect().right));
      return {
        tableWidth: tableRect?.width ?? 0,
        trailingGap: tableRect ? tableRect.right - lastRight : 999,
      };
    });

    expect(geometry.tableWidth).toBeGreaterThan(0);
    expect(geometry.trailingGap).toBeLessThan(4);
  });

  it("renders rich markdown blocks in the reader", async () => {
    await LibraryPage.closeReader();
    await LibraryPage.clickItem("丰富预览笔记");

    await browser.waitUntil(
      async () => {
        return browser.execute(() => Boolean(document.querySelector("[data-testid='reader-drawer'] .markdown-preview .markdown-code-block")));
      },
      { timeout: 3000, timeoutMsg: "Rich markdown preview was not rendered" },
    );

    const preview = await browser.execute(() => {
      const root = document.querySelector("[data-testid='reader-drawer'] .markdown-preview");
      return {
        heading: root?.querySelector("h1#阅读标题")?.textContent ?? "",
        callout: root?.querySelector(".markdown-callout--tip")?.textContent ?? "",
        task: root?.querySelector(".markdown-task-box.is-checked") !== null,
        code: root?.querySelector(".markdown-code-block code.hljs")?.textContent ?? "",
      };
    });

    expect(preview.heading).toContain("阅读标题");
    expect(preview.callout).toContain("这是一条阅读提示");
    expect(preview.task).toBe(true);
    expect(preview.code).toContain("const answer = 42;");
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
