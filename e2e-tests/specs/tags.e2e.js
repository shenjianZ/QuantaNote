import { cleanupAll, seedItem, getAllTags } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import TagPickerModal from "../helpers/page-objects/TagPickerModal.js";

describe("Tag management", () => {
  before(async () => {
    await cleanupAll();
    await seedItem({ title: "标签测试笔记", content: "内容" });
    await TopBar.navLibrary();
    await LibraryPage.clickItem("标签测试笔记");
  });

  after(async () => {
    await cleanupAll();
  });

  it("opens tag picker modal", async () => {
    await LibraryPage.openTagPicker();
    await expect(TagPickerModal.isOpen()).resolves.toBe(true);
  });

  it("creates a new tag", async () => {
    await TagPickerModal.createTag("E2E标签");
    const tags = await TagPickerModal.getTagNames();
    expect(tags).toContain("E2E标签");
  });

  it("toggles tag assignment", async () => {
    await TagPickerModal.toggleTag("E2E标签");
    const selected = await TagPickerModal.isTagSelected("E2E标签");
    expect(selected).toBe(true);

    // 取消选择
    await TagPickerModal.toggleTag("E2E标签");
    const selected2 = await TagPickerModal.isTagSelected("E2E标签");
    expect(selected2).toBe(false);
  });

  it("tag filter in library reflects assigned tags", async () => {
    // 先选中标签
    await TagPickerModal.toggleTag("E2E标签");
    await TagPickerModal.close();

    // 验证后端有标签
    const allTags = await getAllTags();
    const found = allTags.some((t) => t.name === "E2E标签");
    expect(found).toBe(true);

    // 关闭阅读器，用标签筛选
    await LibraryPage.closeReader();
    await LibraryPage.openFilterPanel();
    await LibraryPage.selectTagFilter("E2E标签");
    await LibraryPage.expectItemVisible("标签测试笔记");
    await LibraryPage.selectTagFilter("all");
  });
});
