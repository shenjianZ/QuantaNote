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
    // 等待 1.5 秒自动保存
    await DocumentEditorPage.waitForSaved(3000);

    const updated = await getItemById(testItem.id);
    expect(updated.title).toBe("自动保存测试");
  });

  it("toggles favorite state", async () => {
    await DocumentEditorPage.toggleFavorite();
    const isFav = await DocumentEditorPage.isFavorite();
    expect(isFav).toBe(true);

    const updated = await getItemById(testItem.id);
    expect(updated.favorite).toBe(true);

    // 再次切换
    await DocumentEditorPage.toggleFavorite();
    const isFav2 = await DocumentEditorPage.isFavorite();
    expect(isFav2).toBe(false);
  });

  it("saves a version", async () => {
    const countBefore = await DocumentEditorPage.getVersionCount();
    await DocumentEditorPage.clickSaveVersion();

    // 等待版本数量增加
    await browser.waitUntil(
      async () => {
        const count = await DocumentEditorPage.getVersionCount();
        return count > countBefore;
      },
      { timeout: 5000, timeoutMsg: "Version count did not increase" },
    );

    const countAfter = await DocumentEditorPage.getVersionCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  it("edits version name and description", async () => {
    await DocumentEditorPage.clickVersionEdit(0);
    await DocumentEditorPage.editVersionMeta("测试版本名", "测试版本描述");

    // 验证版本名已更新
    const entries = await DocumentEditorPage.getVersionEntries();
    const text = await entries[0].getText();
    expect(text).toContain("测试版本名");
  });

  it("opens version preview modal", async () => {
    await DocumentEditorPage.clickVersionRestore(0);

    const modal = await $("[data-testid='version-restore-btn']");
    await expect(modal).toBeDisplayed();
  });

  it("restores version content", async () => {
    const restoreBtn = await $("[data-testid='version-restore-btn']");
    // 第一次点击进入确认状态
    await restoreBtn.click();
    await observePause();
    // 第二次点击确认恢复
    await restoreBtn.click();
    await pause(500);

    // 编辑器内容应恢复为版本内容
    const content = await DocumentEditorPage.getContent();
    expect(content).toContain("初始内容");
  });

  it("navigates back to library preview", async () => {
    await DocumentEditorPage.clickBack();

    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
  });
});
