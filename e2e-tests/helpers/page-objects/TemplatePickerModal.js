import { waitForDisplayed, waitForHidden } from "../waits.js";

class TemplatePickerModal {
  get modal() { return "[data-testid='template-picker-modal']"; }
  get blankButton() { return "[data-testid='template-blank-btn']"; }
  get manageButton() { return "[data-testid='template-manage-btn']"; }
  get createButton() { return "[data-testid='template-create-btn']"; }
  get nameInput() { return "[data-testid='template-name-input']"; }
  get descriptionInput() { return "[data-testid='template-description-input']"; }
  get contentInput() { return "[data-testid='template-content-input']"; }
  get saveButton() { return "[data-testid='template-save-btn']"; }

  templateUseButton(id) {
    return `[data-testid='template-use-${id}']`;
  }

  templateOption(id) {
    return `[data-testid='template-option-${id}']`;
  }

  templateDeleteButton(id) {
    return `[data-testid='template-delete-${id}']`;
  }

  async openFromLibrary() {
    await $("[data-testid='library-new-btn']").click();
    await waitForDisplayed(this.modal);
  }

  async chooseBlank() {
    await $(this.blankButton).click();
    await waitForHidden(this.modal);
    await waitForDisplayed("input[placeholder='文档标题']");
  }

  async chooseTemplate(id) {
    await waitForDisplayed(this.templateOption(id));
    await $(this.templateUseButton(id)).click();
    await waitForHidden(this.modal);
    await waitForDisplayed("input[placeholder='文档标题']");
  }

  async openManage() {
    await $(this.manageButton).click();
    await waitForDisplayed(this.createButton);
  }

  async createTemplate({ name, description = "", content }) {
    await $(this.createButton).click();
    await waitForDisplayed(this.nameInput);
    await $(this.nameInput).setValue(name);
    await $(this.descriptionInput).setValue(description);
    await $(this.contentInput).setValue(content);
    await $(this.saveButton).click();
    await browser.waitUntil(
      async () => browser.execute(() => document.querySelectorAll("[data-testid^='template-delete-']").length > 0),
      { timeout: 5000, timeoutMsg: "Custom template was not saved" },
    );
  }
}

export default new TemplatePickerModal();
