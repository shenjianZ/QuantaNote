import { cleanupAll, seedItem, getItemById, getVersions } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";

describe("Document editor", () => {
  let testItem;

  before(async () => {
    await cleanupAll();
    testItem = await seedItem({ title: "编辑器测试笔记", content: "初始内容" });
    await TopBar.navLibrary();
    await LibraryPage.clickItem("编辑器测试笔记");
    await LibraryPage.clickEdit();
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

  it("supports native copy and paste shortcuts in editor", async () => {
    await DocumentEditorPage.clearContent();
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

    await DocumentEditorPage.clearContent();
    await DocumentEditorPage.typeContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("keeps editor table border aligned with cells", async () => {
    await DocumentEditorPage.setContent("| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|     |     | 01   |\n|     |     | 01   |");

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
    const countBefore = await DocumentEditorPage.getVersionCount();
    expect(await DocumentEditorPage.isSaveVersionEnabled()).toBe(false);

    await DocumentEditorPage.clearContent();
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

  it("navigates back to library preview", async () => {
    await DocumentEditorPage.clickBack();

    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
  });
});
