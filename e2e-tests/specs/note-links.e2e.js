import { cleanupAllItems, getAllItems, seedItem } from "../helpers/commands.js";
import { waitForDisplayed } from "../helpers/waits.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import TopBar from "../helpers/page-objects/TopBar.js";

describe("Note links workflow", () => {
  before(async () => {
    await cleanupAllItems();
    await seedItem({ title: "链接目标", content: "目标正文" });
    await seedItem({ title: "链接来源", content: "前往 [[链接目标]]，也可以创建 [[待创建链接]]" });
    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAllItems();
  });

  it("renders forward and backlink sections and navigates to an existing note", async () => {
    await LibraryPage.clickItem("链接来源");
    await waitForDisplayed(LibraryPage.noteLinksPanel);
    await expect($(`[data-testid='reader-forward-link'][data-note-target='链接目标']`)).toBeDisplayed();
    await LibraryPage.clickForwardLink("链接目标");
    await browser.waitUntil(
      async () => (await LibraryPage.getReaderTitle()) === "链接目标",
      { timeout: 8000, timeoutMsg: "Existing wiki-link target was not opened" },
    );
    await expect($(`[data-testid='reader-backlink'][data-note-target='链接来源']`)).toBeDisplayed();
  });

  it("creates an unresolved target from the reader and opens the relationship graph", async () => {
    await LibraryPage.closeReader();
    await LibraryPage.clickItem("链接来源");
    await waitForDisplayed(LibraryPage.noteLinksPanel);
    await LibraryPage.clickForwardLink("待创建链接");
    await browser.waitUntil(
      async () => (await LibraryPage.getReaderTitle()) === "待创建链接",
      { timeout: 8000, timeoutMsg: "Unresolved wiki-link target was not created" },
    );
    const items = await getAllItems();
    await expect(items.some((item) => item.title === "待创建链接")).toBe(true);

    await LibraryPage.openNoteGraph();
    await expect($("[data-testid='note-link-graph-svg']")).toBeDisplayed();
    await browser.keys("Escape");
  });
});
