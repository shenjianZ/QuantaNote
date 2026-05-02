import { cleanupAll, resetAppState, seedItem, waitForSetting } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import WorkspacePage from "../helpers/page-objects/WorkspacePage.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

describe("Persistence across interactions", () => {
  before(async () => {
    await cleanupAll();
    await resetAppState();
  });

  after(async () => {
    await cleanupAll();
    await resetAppState();
  });

  it("theme persists after navigating away and back", async () => {
    await TopBar.openSettings();
    await SettingsPage.selectSection("外观");
    await SettingsPage.setTheme("dark");

    let theme = await SettingsPage.getTheme();
    expect(theme).toBe("dark");

    // 导航离开
    await TopBar.navLibrary();
    theme = await browser.execute(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("dark");

    // 导航到工作台
    await TopBar.navWorkspace();
    theme = await browser.execute(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("dark");
  });

  it("notes persist after creating and navigating", async () => {
    await TopBar.navWorkspace();
    await WorkspacePage.typeContent("持久化测试笔记");
    await WorkspacePage.clickSave();
    await WorkspacePage.waitForSaved();

    // 导航到记录库
    await TopBar.navLibrary();
    await LibraryPage.expectItemVisible("持久化测试笔记");
  });

  it("SQLite page restore records current page", async () => {
    await TopBar.navLibrary();
    await waitForSetting("currentPage", "library");

    await TopBar.navWorkspace();
    await waitForSetting("currentPage", "workspace");
  });

  it("settings persist after navigation", async () => {
    await TopBar.openSettings();
    await SettingsPage.selectSection("字体");
    await SettingsPage.setFontSize(17);

    const size1 = await SettingsPage.getFontSize();
    expect(size1).toBe("17");

    // 导航离开再回来
    await TopBar.navLibrary();
    await TopBar.openSettings();
    await SettingsPage.selectSection("字体");
    const size2 = await SettingsPage.getFontSize();
    expect(size2).toBe("17");
  });
});
