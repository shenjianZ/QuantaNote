import { cleanupAllTemplates } from "../helpers/commands.js";
import { waitForDisplayed } from "../helpers/waits.js";
import TemplatePickerModal from "../helpers/page-objects/TemplatePickerModal.js";
import TopBar from "../helpers/page-objects/TopBar.js";

describe("Template workflow", () => {
  before(async () => {
    await cleanupAllTemplates();
    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAllTemplates();
  });

  it("opens the template picker with blank and built-in choices", async () => {
    await TemplatePickerModal.openFromLibrary();
    await expect($(TemplatePickerModal.blankButton)).toBeDisplayed();
    await expect($(TemplatePickerModal.templateOption("builtin-daily"))).toBeDisplayed();
    await expect($(TemplatePickerModal.templateOption("builtin-meeting"))).toBeDisplayed();
    await browser.keys("Escape");
  });

  it("creates a note from a built-in template", async () => {
    await TemplatePickerModal.openFromLibrary();
    await TemplatePickerModal.chooseTemplate("builtin-daily");

    await expect($("input[placeholder='文档标题']")).toHaveValue("每日记录");
    await waitForDisplayed("[data-testid='doc-version-toggle']");
    await browser.waitUntil(
      async () => browser.execute(() => document.querySelector(".vditor-ir")?.textContent?.includes("今日记录") ?? false),
      { timeout: 8000, timeoutMsg: "Built-in template content was not loaded" },
    );
    await TopBar.navLibrary();
  });

  it("creates a custom template from the manage view", async () => {
    await TemplatePickerModal.openFromLibrary();
    await TemplatePickerModal.openManage();
    await TemplatePickerModal.createTemplate({
      name: "E2E 自定义模板",
      description: "E2E 模板说明",
      content: "# 自定义记录",
    });

    await expect($("[data-testid^='template-delete-']")).toBeDisplayed();
    await TopBar.navLibrary();
  });

  it("keeps the blank-note path available after opening the picker", async () => {
    await TemplatePickerModal.openFromLibrary();
    await TemplatePickerModal.chooseBlank();
    await expect($("input[placeholder='文档标题']")).toHaveValue("");
    await TopBar.navLibrary();
  });
});
