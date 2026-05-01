import { cleanupAll, resetAppState } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import CommandPalette from "../helpers/page-objects/CommandPalette.js";

describe("Empty and error states", () => {
  before(async () => {
    await cleanupAll();
    await resetAppState();
  });

  after(async () => {
    await cleanupAll();
  });

  it("library shows empty state with no items", async () => {
    await TopBar.navLibrary();
    await LibraryPage.expectEmptyState();
  });

  it("command palette shows empty prompt with no query", async () => {
    await CommandPalette.open();
    const msg = await $("//*[contains(., '输入关键词搜索笔记')]");
    await expect(msg).toBeDisplayed();
    await CommandPalette.close();
  });

  it("command palette shows no match message", async () => {
    await CommandPalette.open();
    await CommandPalette.search("xyznonexistent123");
    const msg = await $("//*[contains(., '没有匹配的笔记')]");
    await expect(msg).toBeDisplayed();
    await CommandPalette.close();
  });

  it("library search returns empty for non-matching query", async () => {
    await TopBar.navLibrary();
    await LibraryPage.search("xyznonexistent123");
    await LibraryPage.expectEmptyState();
  });
});
