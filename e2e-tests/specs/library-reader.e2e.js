import {
  cleanupAll,
  seedItem,
  getItemById,
  notifyDataChanged,
  tauriInvoke,
  seedTag,
  setItemTags,
  seedVersion,
  createTestFile,
  seedAttachment,
} from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

async function completeInitialLanguageSetup() {
  await browser.waitUntil(
    async () => {
      return browser.execute(() => {
        const hasNavigation = Boolean(document.querySelector("[data-testid='nav-library']"));
        const hasLanguageSetup = Array.from(document.querySelectorAll("button")).some((button) => {
          return /开始使用|Get Started/.test(button.textContent || "");
        });
        return hasNavigation || hasLanguageSetup;
      });
    },
    { timeout: 10000, timeoutMsg: "Application did not reach the main shell or language setup" },
  );

  const continueButton = await $("//button[contains(., '开始使用') or contains(., 'Get Started')]");
  if (await continueButton.isExisting()) {
    const chineseButton = await $("//button[contains(., '简体中文')]");
    if (await chineseButton.isExisting()) {
      await chineseButton.click();
    }
    await continueButton.click();
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(document.querySelector("[data-testid='nav-library']"))),
      { timeout: 10000, timeoutMsg: "Language setup did not transition to the main shell" },
    );
  }
}

describe("Library reader and item actions", () => {
  let pinnedItem, favoriteItem, normalItem;

  before(async () => {
    await completeInitialLanguageSetup();
    await cleanupAll();
    normalItem = await seedItem({ title: "普通笔记", content: "普通内容" });
    await seedTag("项目");
    await setItemTags(normalItem.id, ["项目"]);
    await seedVersion(normalItem.id, "旧版本合同内容", "历史版本");
    const attachmentPath = await createTestFile("invoice-search.txt");
    await seedAttachment(normalItem.id, attachmentPath);
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
        "",
        "Markdown",
        ": 一种轻量级标记语言。",
        "",
        "```mermaid",
        "graph TD",
        "  A[开始] --> B[结束]",
        "```",
        "",
        "```flowchart",
        "st=>start: 开始",
        "e=>end: 结束",
        "st->e",
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
        return browser.execute(() => {
          const root = document.querySelector("[data-testid='reader-drawer'] .markdown-preview");
          return Boolean(
            root?.querySelector(".markdown-code-block") &&
            root?.querySelector("dl dt") &&
            root?.querySelector(".markdown-diagram-block[data-language='mermaid'] svg") &&
            root?.querySelector(".markdown-diagram-block[data-language='flowchart'] svg"),
          );
        });
      },
      { timeout: 8000, timeoutMsg: "Rich markdown preview or diagrams were not rendered" },
    );

    const preview = await browser.execute(() => {
      const root = document.querySelector("[data-testid='reader-drawer'] .markdown-preview");
      return {
        heading: root?.querySelector("h1")?.textContent ?? "",
        callout: root?.querySelector(".markdown-callout--tip")?.textContent ?? "",
        task: root?.querySelector(".markdown-task-box.is-checked") !== null,
        code: root?.querySelector(".markdown-code-block code.hljs")?.textContent ?? "",
        definition: root?.querySelector("dl dt")?.textContent ?? "",
        mermaid: root?.querySelector(".markdown-diagram-block[data-language='mermaid'] svg") !== null,
        flowchart: root?.querySelector(".markdown-diagram-block[data-language='flowchart'] svg") !== null,
      };
    });

    expect(preview.heading).toContain("阅读标题");
    expect(preview.callout).toContain("这是一条阅读提示");
    expect(preview.task).toBe(true);
    expect(preview.code).toContain("const answer = 42;");
    expect(preview.definition).toContain("Markdown");
    expect(preview.mermaid).toBe(true);
    expect(preview.flowchart).toBe(true);
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

  it("restores deleted item from trash", async () => {
    await LibraryPage.openTrash();
    await expect($("//*[@role='dialog'][@aria-label='回收站']")).toBeDisplayed();
    await LibraryPage.restoreTrashItem("收藏笔记");
    await pause(500);
    await expect($("//*[@role='dialog'][@aria-label='回收站']//*[contains(., '回收站是空的')]")).toBeDisplayed();
    await $("[data-testid='modal-close-btn']").click();
    await LibraryPage.expectItemVisible("收藏笔记");
  });

  it("supports advanced search, highlights matches, and searches attachment names", async () => {
    await LibraryPage.selectSearchMode("advanced");
    await LibraryPage.search("普通 OR 收藏");

    await browser.waitUntil(
      async () => (await LibraryPage.getSearchHighlightCount()) > 0,
      { timeout: 10000, timeoutMsg: "Advanced search did not render highlighted matches" },
    );
    expect(await LibraryPage.getMatchedFieldText()).toContain("正文");
    await LibraryPage.expectItemVisible("普通笔记");
    await LibraryPage.expectItemVisible("收藏笔记");

    await LibraryPage.setSearchScope("content", false);
    await LibraryPage.setSearchScope("attachments", true);
    await LibraryPage.search("invoice");
    await LibraryPage.expectItemVisible("普通笔记");
    expect(await LibraryPage.getMatchedFieldText()).toContain("附件");

    // 恢复默认搜索状态，避免影响后续分页场景。
    await LibraryPage.setSearchScope("attachments", false);
    await LibraryPage.setSearchScope("content", true);
    await LibraryPage.selectSearchMode("normal");
    await LibraryPage.search("");
  });

  it("loads additional library pages while keeping the rendered window virtualized", async () => {
    const extraCount = 65;
    for (let index = 0; index < extraCount; index += 1) {
      await tauriInvoke("create_item", {
        title: `分页测试笔记 ${index + 1}`,
        itemType: "note",
        content: `分页内容 ${index + 1}`,
      });
    }
    await notifyDataChanged();

    const expectedTotal = 5 + extraCount;
    await browser.waitUntil(
      async () => browser.execute((total) => {
        const counter = document.querySelector("[data-testid='library-result-count']");
        return counter?.textContent?.includes(String(total)) ?? false;
      }, expectedTotal),
      { timeout: 10000, timeoutMsg: "Library total count did not update" },
    );

    const loadedBefore = await LibraryPage.getLoadedItemCount();
    expect(loadedBefore).toBeLessThan(expectedTotal);
    expect(await LibraryPage.getItemCount()).toBeLessThan(expectedTotal);

    await LibraryPage.scrollListToEnd();
    await browser.waitUntil(
      async () => (await LibraryPage.getLoadedItemCount()) === expectedTotal,
      { timeout: 10000, timeoutMsg: "Library did not load the next page" },
    );

    // 页面只挂载可视窗口附近的行，即使数据全部加载也不会一次性渲染全部记录。
    expect(await LibraryPage.getItemCount()).toBeLessThan(expectedTotal);
  });
});
