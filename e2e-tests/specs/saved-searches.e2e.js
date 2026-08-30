import { cleanupAll, seedItem, seedTag, setItemTags } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

describe("Saved searches and smart collections", () => {
  before(async () => {
    await cleanupAll();
    await seedItem({ title: "未分类任务", content: "任务内容", itemType: "task" });
    const taggedNote = await seedItem({ title: "已分类笔记", content: "笔记内容" });
    await seedTag("项目", "blue");
    await setItemTags(taggedNote.id, ["项目"]);
    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAll();
  });

  it("shows the unclassified smart collection", async () => {
    await LibraryPage.clickSmartCollection("unclassified");
    await LibraryPage.expectItemVisible("未分类任务");
    await LibraryPage.expectItemNotVisible("已分类笔记");
  });

  it("saves and reapplies a search with type and time conditions", async () => {
    await LibraryPage.selectItemType("任务");
    await LibraryPage.selectTimeRange("今天");
    await LibraryPage.saveCurrentSearch("今天的任务");
    await LibraryPage.clickSavedSearch("今天的任务");

    await LibraryPage.expectItemVisible("未分类任务");
    await LibraryPage.expectItemNotVisible("已分类笔记");
  });

  it("keeps saved searches after a page reload and allows deletion", async () => {
    await browser.refresh();
    await TopBar.navLibrary();
    await LibraryPage.clickSavedSearch("今天的任务");
    await LibraryPage.expectItemVisible("未分类任务");
    await LibraryPage.deleteSavedSearch("今天的任务");
  });
});
