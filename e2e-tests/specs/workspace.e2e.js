import { cleanupAll, getAllItems } from "../helpers/commands.js";
import { pause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import WorkspacePage from "../helpers/page-objects/WorkspacePage.js";

describe("Workspace quick capture", () => {
  before(async () => {
    await cleanupAll();
    await TopBar.navWorkspace();
  });

  after(async () => {
    await cleanupAll();
  });

  it("renders workspace page with editor and save button", async () => {
    await expect(WorkspacePage.isDisplayed()).resolves.toBe(true);
    await expect($("[data-testid='workspace-save-btn']")).toBeDisplayed();
    await expect($("[data-testid='workspace-editor']")).toBeDisplayed();
  });

  it("types content into Vditor editor", async () => {
    await WorkspacePage.typeContent("Hello E2E 测试内容");
    const text = await WorkspacePage.getContent();
    expect(text).toContain("Hello E2E");
  });

  it("saves note via button click", async () => {
    await WorkspacePage.clearContent();
    await WorkspacePage.typeContent("按钮保存测试");
    await WorkspacePage.clickSave();
    await WorkspacePage.waitForSaved();

    const items = await getAllItems();
    const found = items.some((i) => i.content.includes("按钮保存测试"));
    expect(found).toBe(true);
  });

  it("saves note via Ctrl+Enter", async () => {
    await WorkspacePage.clearContent();
    await WorkspacePage.typeContent("快捷键保存测试");
    await WorkspacePage.saveViaKeyboard();
    await WorkspacePage.waitForSaved();
  });

  it("clears draft after successful save", async () => {
    await WorkspacePage.clearContent();
    await WorkspacePage.typeContent("保存后清空测试");
    await WorkspacePage.clickSave();
    await WorkspacePage.waitForSaved();

    const cleared = await WorkspacePage.isDraftCleared();
    expect(cleared).toBe(true);
  });

  it("does not save empty content", async () => {
    await WorkspacePage.clearContent();
    await WorkspacePage.clickSave();
    await pause(500);

    const statusText = await WorkspacePage.getStatusText();
    expect(statusText).not.toContain("已保存");
  });
});
