import { cleanupAll, seedItem, createTestFile, seedAttachment, getAttachments } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import AttachmentManagerModal from "../helpers/page-objects/AttachmentManagerModal.js";

describe("Attachments", () => {
  let testItem;
  const testFilePath = "e2e-test-attachment.txt";

  before(async () => {
    await cleanupAll();
    // 创建测试文件
    await createTestFile(testFilePath, "E2E 附件测试内容");
    // 创建测试项并添加附件
    testItem = await seedItem({ title: "附件测试笔记", content: "内容" });
    await seedAttachment(testItem.id, testFilePath);

    await TopBar.navLibrary();
    await LibraryPage.clickItem("附件测试笔记");
  });

  after(async () => {
    await cleanupAll();
  });

  it("opens attachment manager modal", async () => {
    await LibraryPage.openAttachmentManager();
    await expect(AttachmentManagerModal.isOpen()).resolves.toBe(true);
  });

  it("displays seeded attachment", async () => {
    const names = await AttachmentManagerModal.getAttachmentNames();
    expect(names.some((n) => n.includes("e2e-test-attachment"))).toBe(true);
  });

  it("shows correct attachment count", async () => {
    const count = await AttachmentManagerModal.getAttachmentCount();
    expect(count).toBe(1);
  });

  it("deletes attachment", async () => {
    await AttachmentManagerModal.deleteAttachment(0);
    await pause(500);

    const count = await AttachmentManagerModal.getAttachmentCount();
    expect(count).toBe(0);
  });

  it("empty state when no attachments", async () => {
    const msg = await $("//*[contains(., '暂无附件')]");
    await expect(msg).toBeDisplayed();
  });
});
