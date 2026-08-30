import { cleanupAll, getItemById, notifyDataChanged, seedItem } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";

describe("Note properties and Frontmatter", () => {
  let doneItem;
  let inboxItem;

  before(async () => {
    await cleanupAll();
    doneItem = await seedItem({
      title: "已完成属性笔记",
      content: `---
status: done
priority: high
due: 2026-09-12
aliases: [搜索, Search]
---
# 正文

这是正文内容。`,
    });
    inboxItem = await seedItem({ title: "收件箱笔记", content: "普通内容" });
    await notifyDataChanged();
    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAll();
  });

  it("filters notes by Frontmatter status and priority", async () => {
    await LibraryPage.openFilterPanel();
    await LibraryPage.selectPropertyStatus("已完成");
    await LibraryPage.expectItemVisible("已完成属性笔记");
    await LibraryPage.expectItemNotVisible("收件箱笔记");

    await LibraryPage.selectPropertyStatus("全部状态");
    await LibraryPage.selectPropertyPriority("高");
    await LibraryPage.expectItemVisible("已完成属性笔记");
    await LibraryPage.expectItemNotVisible("收件箱笔记");
    await LibraryPage.selectPropertyPriority("全部优先级");
  });

  it("renders properties in the reader and edits them from the editor panel", async () => {
    await LibraryPage.clickItem("已完成属性笔记");
    await browser.waitUntil(
      async () => (await $(`[data-testid='markdown-properties']`)).isDisplayed(),
      { timeout: 5000, timeoutMsg: "Reader did not render Frontmatter properties" },
    );
    const readerText = await $(`[data-testid='reader-drawer']`).getText();
    expect(readerText).toContain("已完成");
    expect(readerText).not.toContain("status: done");

    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => (await $(`[data-testid='doc-note-properties']`)).isDisplayed(),
      { timeout: 5000, timeoutMsg: "Editor property panel did not load" },
    );
    await DocumentEditorPage.setPropertyStatus("已归档");
    await DocumentEditorPage.setPropertyAliases("归档, Archived");
    await DocumentEditorPage.waitForSaved(3000);

    const updated = await getItemById(doneItem.id);
    expect(updated.content).toContain("status: \"archived\"");
    expect(updated.content).toContain("- \"归档\"");
    expect(updated.content).toContain("- \"Archived\"");

    await DocumentEditorPage.clickBack();
    await LibraryPage.closeReader();
  });
});
