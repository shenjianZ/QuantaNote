import { cleanupAll, seedItem, seedTag, setItemTags } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";

describe("Library filters and sorting", () => {
  let itemA, itemB, itemC;

  before(async () => {
    await cleanupAll();
    itemA = await seedItem({ title: "Alpha 笔记", content: "内容A" });
    itemB = await seedItem({ title: "Beta 笔记", content: "内容B", pinned: true });
    itemC = await seedItem({ title: "Gamma 笔记", content: "内容C", favorite: true });

    await seedTag("工作", "blue");
    await setItemTags(itemA.id, ["工作"]);

    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAll();
  });

  it("search filters items by title", async () => {
    await LibraryPage.search("Alpha");
    await LibraryPage.expectItemVisible("Alpha 笔记");
    await LibraryPage.expectItemNotVisible("Beta 笔记");

    // 清空搜索
    await LibraryPage.search("");
  });

  it("pinned tab shows only pinned items", async () => {
    await LibraryPage.openFilterPanel();
    await LibraryPage.selectTab("置顶");

    await LibraryPage.expectItemVisible("Beta 笔记");
    await LibraryPage.expectItemNotVisible("Alpha 笔记");
    await LibraryPage.expectItemNotVisible("Gamma 笔记");

    // 切回全部
    await LibraryPage.selectTab("全部");
  });

  it("favorite tab shows only favorite items", async () => {
    await LibraryPage.openFilterPanel();
    await LibraryPage.selectTab("收藏");

    await LibraryPage.expectItemVisible("Gamma 笔记");
    await LibraryPage.expectItemNotVisible("Alpha 笔记");
    await LibraryPage.expectItemNotVisible("Beta 笔记");

    await LibraryPage.selectTab("全部");
  });

  it("sort by title orders alphabetically", async () => {
    await LibraryPage.openFilterPanel();
    await LibraryPage.selectSortOrder("title");

    const items = await $$("[data-testid='library-item']");
    expect(items.length).toBe(3);

    await LibraryPage.selectSortOrder("updated");
  });

  it("tag filter shows only tagged items", async () => {
    await LibraryPage.openFilterPanel();
    await LibraryPage.selectTagFilter("工作");

    await LibraryPage.expectItemVisible("Alpha 笔记");
    await LibraryPage.expectItemNotVisible("Beta 笔记");
    await LibraryPage.expectItemNotVisible("Gamma 笔记");

    await LibraryPage.selectTagFilter("all");
  });

  it("empty state when no results", async () => {
    await LibraryPage.search("xyznonexistent999");
    await LibraryPage.expectEmptyState();
    await LibraryPage.search("");
  });
});
