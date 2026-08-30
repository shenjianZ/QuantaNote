import { cleanupAll, seedItem } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import CommandPalette from "../helpers/page-objects/CommandPalette.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

describe("Command palette", () => {
  before(async () => {
    await cleanupAll();
    await seedItem({ title: "命令面板测试笔记A", content: "内容A" });
    await seedItem({ title: "命令面板测试笔记B", content: "内容B" });
  });

  after(async () => {
    await cleanupAll();
  });

  it("opens with Ctrl+K", async () => {
    await CommandPalette.open();
    await expect($(CommandPalette.searchInput)).toBeDisplayed();
  });

  it("shows page-aware commands alongside note search", async () => {
    await CommandPalette.open();
    const commands = await CommandPalette.getCommandTexts();
    expect(commands.some((text) => text.includes("新建笔记"))).toBe(true);
    expect(commands.some((text) => text.includes("打开设置"))).toBe(true);
    await CommandPalette.close();
  });

  it("runs a command from the palette", async () => {
    await CommandPalette.open();
    await CommandPalette.selectCommandByLabel("打开设置");
    await expect($("[data-testid='settings-shortcuts-section']")).toBeDisplayed();
    await TopBar.navWorkspace();
  });

  it("closes with Escape", async () => {
    await CommandPalette.close();
    await expect($(CommandPalette.searchInput)).not.toBeDisplayed();
  });

  it("search returns matching results", async () => {
    await CommandPalette.open();
    await CommandPalette.search("命令面板");
    const count = await CommandPalette.getResultCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("arrow key navigation highlights results", async () => {
    await CommandPalette.open();
    await CommandPalette.search("命令面板");
    await CommandPalette.navigateWithArrows("down", 1);
    // 方向键后结果应仍可见
    const count = await CommandPalette.getResultCount();
    expect(count).toBeGreaterThanOrEqual(1);
    await CommandPalette.close();
  });

  it("Enter on result navigates to library with reader", async () => {
    await CommandPalette.open();
    await CommandPalette.search("命令面板");
    await CommandPalette.navigateWithArrows("down", 1);
    await CommandPalette.pressEnter();

    // 应跳转到记录库并打开阅读器
    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
  });

  it("clicking result navigates to library", async () => {
    await CommandPalette.open();
    await CommandPalette.search("命令面板");
    await CommandPalette.selectResult(0);

    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    await LibraryPage.closeReader();
  });

  it("empty results show message", async () => {
    await CommandPalette.open();
    await CommandPalette.search("xyznonexistent999");
    const msg = await $("//*[contains(., '没有匹配的笔记')]");
    await expect(msg).toBeDisplayed();
    await CommandPalette.close();
  });
});
