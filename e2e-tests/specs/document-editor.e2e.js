import { cleanupAll, seedItem, getItemById, getVersions, loadAppSettings } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";

async function completeInitialLanguageSetup() {
  await browser.waitUntil(
    async () => browser.execute(() => {
      const hasNavigation = Boolean(document.querySelector("[data-testid='nav-library']"));
      const hasLanguageSetup = Array.from(document.querySelectorAll("button")).some((button) => {
        return /开始使用|Get Started/.test(button.textContent || "");
      });
      return hasNavigation || hasLanguageSetup;
    }),
    { timeout: 10000, timeoutMsg: "Application did not reach the main shell or language setup" },
  );

  const continueButton = await $("//button[contains(., '开始使用') or contains(., 'Get Started')]");
  if (await continueButton.isExisting()) {
    const chineseButton = await $("//button[contains(., '简体中文')]");
    if (await chineseButton.isExisting()) await chineseButton.click();
    await continueButton.click();
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(document.querySelector("[data-testid='nav-library']"))),
      { timeout: 10000, timeoutMsg: "Language setup did not transition to the main shell" },
    );
  }
}

describe("Document editor", () => {
  let testItem;

  before(async () => {
    await completeInitialLanguageSetup();
    await cleanupAll();
    testItem = await seedItem({ title: "编辑器测试笔记", content: "初始内容" });
    await TopBar.navLibrary();
    await LibraryPage.clickItem("编辑器测试笔记");
    await LibraryPage.clickEdit();
    await DocumentEditorPage.setOutlineVisible(true);
  });

  after(async () => {
    await cleanupAll();
  });

  it("loads item title and content in editor", async () => {
    const title = await DocumentEditorPage.getTitle();
    expect(title).toBe("编辑器测试笔记");
  });

  it("auto-saves after 1 second debounce", async () => {
    await DocumentEditorPage.setTitle("自动保存测试");
    await DocumentEditorPage.waitForSaved(3000);

    const updated = await getItemById(testItem.id);
    expect(updated.title).toBe("自动保存测试");
  });

  it("auto-saves summary after 1 second debounce", async () => {
    await DocumentEditorPage.setSummary("手动修改后的摘要");
    await DocumentEditorPage.waitForSaved(3000);

    const updated = await getItemById(testItem.id);
    expect(updated.summary).toBe("手动修改后的摘要");
  });

  it("shows and toggles the live document outline", async () => {
    await DocumentEditorPage.clearContent();
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getContent()).trim() === "",
      { timeout: 3000, timeoutMsg: "Editor did not finish clearing before outline input" },
    );
    await DocumentEditorPage.typeContent("# 一级标题\n\n## 二级标题\n\n### 重复标题\n\n### 重复标题");
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getContent()).includes("一级标题"),
      { timeout: 3000, timeoutMsg: "Editor content did not update from the test fixture" },
    );
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getOutlineItemCount()) === 4,
      { timeout: 3000, timeoutMsg: "Document outline did not update from editor content" },
    );

    expect(await DocumentEditorPage.hasToolbarCharacterCount()).toBe(false);
    await DocumentEditorPage.clickOutlineItem(1);
    await DocumentEditorPage.setOutlineVisible(false);
    expect(await DocumentEditorPage.getOutlineItemCount()).toBe(0);
    await DocumentEditorPage.setOutlineVisible(true);
    expect(await DocumentEditorPage.getOutlineItemCount()).toBe(4);

    await DocumentEditorPage.clearContent();
    await pause(150);
    await DocumentEditorPage.typeContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("supports native copy and paste shortcuts in editor", async () => {
    await DocumentEditorPage.clearContent();
    await pause(150);
    await DocumentEditorPage.typeContent("剪贴板快捷键测试");

    await browser.keys(["Control", "a"]);
    await browser.keys(["Control", "c"]);
    await browser.keys("ArrowRight");
    await browser.keys("Enter");
    await browser.keys(["Control", "v"]);

    await browser.waitUntil(
      async () => {
        const content = await DocumentEditorPage.getContent();
        const matches = content.match(/剪贴板快捷键测试/g) ?? [];
        return matches.length >= 2;
      },
      { timeout: 3000, timeoutMsg: "Editor did not paste copied content" },
    );
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        const matches = updated.content.match(/剪贴板快捷键测试/g) ?? [];
        return matches.length >= 2;
      },
      { timeout: 5000, timeoutMsg: "Pasted editor content was not auto-saved" },
    );

    await DocumentEditorPage.clearContent();
    await DocumentEditorPage.typeContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("keeps editor table border aligned with cells", async () => {
    await DocumentEditorPage.setContent("正文颜色\n\n| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|     |     | 01   |\n|     |     | 01   |");

    await browser.waitUntil(
      async () => {
        return browser.execute(() => Boolean(document.querySelector(".vditor-ir table")));
      },
      { timeout: 3000, timeoutMsg: "Editor table was not rendered" },
    );

    const geometry = await browser.execute(() => {
      const table = document.querySelector(".vditor-ir table");
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

    const colors = await browser.execute(() => {
      const editor = document.querySelector(".vditor-ir");
      const expected = getComputedStyle(document.body).color;
      const cells = Array.from(editor?.querySelectorAll("td, th") ?? []);
      return {
        expected,
        editor: editor ? getComputedStyle(editor).color : "",
        cells: cells.map((cell) => getComputedStyle(cell).color),
      };
    });

    expect(colors.editor).toBe(colors.expected);
    expect(colors.cells.length).toBeGreaterThan(0);
    expect(colors.cells.every((color) => color === colors.expected)).toBe(true);

    await DocumentEditorPage.setContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("toggles favorite state", async () => {
    await DocumentEditorPage.toggleFavorite();
    const isFav = await DocumentEditorPage.isFavorite();
    expect(isFav).toBe(true);

    const updated = await getItemById(testItem.id);
    expect(updated.favorite).toBe(true);

    await DocumentEditorPage.toggleFavorite();
    const isFav2 = await DocumentEditorPage.isFavorite();
    expect(isFav2).toBe(false);
  });

  it("saves a version", async () => {
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getVersionCount()) > 0,
      { timeout: 5000, timeoutMsg: "Initial version was not loaded" },
    );
    const countBefore = await DocumentEditorPage.getVersionCount();

    await DocumentEditorPage.clearContent();
    await pause(150);
    await DocumentEditorPage.typeContent("manual version change");
    await DocumentEditorPage.waitForSaved(3000);
    await browser.waitUntil(
      async () => DocumentEditorPage.isSaveVersionEnabled(),
      { timeout: 3000, timeoutMsg: "Save version button did not become enabled after content changed" },
    );

    await DocumentEditorPage.clickSaveVersion();

    await browser.waitUntil(
      async () => {
        const count = await DocumentEditorPage.getVersionCount();
        return count > countBefore;
      },
      { timeout: 5000, timeoutMsg: "Version count did not increase" },
    );

    const countAfter = await DocumentEditorPage.getVersionCount();
    expect(countAfter).toBe(countBefore + 1);
    expect(await DocumentEditorPage.isSaveVersionEnabled()).toBe(false);
  });

  it("edits version name and description", async () => {
    // 打开版本面板
    await DocumentEditorPage.openVersionPanel();

    await DocumentEditorPage.clickVersionEdit(0);
    await DocumentEditorPage.editVersionMeta("测试版本名", "测试版本描述");

    const entries = await DocumentEditorPage.getVersionEntries();
    const text = await entries[0].getText();
    expect(text).toContain("测试版本名");
  });

  it("opens version preview modal", async () => {
    await DocumentEditorPage.clickVersionView(0);

    const modal = await $("[data-testid='version-restore-btn']");
    await expect(modal).toBeDisplayed();
    await expect($("[data-testid='version-preview-layout']")).toBeDisplayed();
    await expect($("[data-testid='document-outline']")).toBeDisplayed();
  });

  it("restores version content", async () => {
    const restoreBtn = await $("[data-testid='version-restore-btn']");
    await restoreBtn.click();
    await observePause();
    await restoreBtn.click();
    await pause(500);

    const content = await DocumentEditorPage.getContent();
    expect(content).toContain("manual version change");
  });

  it("adjusts editor width and shares the setting with the reader", async () => {
    await pause(300);

    await DocumentEditorPage.setContentWidth(0);
    const narrowEditorWidth = await DocumentEditorPage.getContentAreaWidth();

    await DocumentEditorPage.setContentWidth(100);
    const fullEditorWidth = await DocumentEditorPage.getContentAreaWidth();
    expect(fullEditorWidth).toBeGreaterThan(narrowEditorWidth);

    await DocumentEditorPage.setContentWidth(10);
    expect(await DocumentEditorPage.getContentWidth()).toBe("10");
    await DocumentEditorPage.setContentWidth(37);
    expect(await DocumentEditorPage.getContentWidth()).toBe("37");
    const savedSettings = await loadAppSettings();
    expect(savedSettings.contentWidthProgress).toBe(18.5);

    await DocumentEditorPage.clickBack();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    await expect($("[data-testid='reader-preview-layout']")).toBeDisplayed();
    await expect($("[data-testid='document-outline']")).toBeDisplayed();
    expect(await LibraryPage.getContentWidth()).toBe("37");
    expect(await LibraryPage.getContentAreaWidth()).toBeGreaterThan(0);

    await browser.setWindowSize(480, 800);
    await pause(300);
    const hasHorizontalOverflow = await browser.execute(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
    await browser.setWindowSize(1400, 900);

    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => DocumentEditorPage.isDisplayed(),
      { timeout: 5000, timeoutMsg: "Editor did not reopen after reader width check" },
    );
    await DocumentEditorPage.setContentWidth(0);
  });

  it("navigates back to library preview", async () => {
    await DocumentEditorPage.clickBack();

    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
  });
});
