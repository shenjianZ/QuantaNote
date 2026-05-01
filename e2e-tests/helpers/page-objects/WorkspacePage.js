/**
 * WorkspacePage Page Object — 工作台快速记录页
 */

import { waitForDisplayed, waitForSavedStatus, waitForText } from "../waits.js";
import { clearVditor, getVditorText, setVditorValue } from "../vditor.js";

class WorkspacePage {
  get editorPanel() { return "[data-testid='workspace-editor']"; }
  get saveBtn() { return "[data-testid='workspace-save-btn']"; }
  get status() { return "[data-testid='workspace-status']"; }

  async isDisplayed() {
    const h1 = await $("//h1[contains(., '随手记录')]");
    return h1.isDisplayed();
  }

  async typeContent(text) {
    await setVditorValue(text, this.editorPanel);
  }

  async getContent() {
    return getVditorText(this.editorPanel);
  }

  async clickSave() {
    const btn = await $(this.saveBtn);
    await btn.click();
  }

  async saveViaKeyboard() {
    await browser.keys(["Control", "Enter"]);
  }

  async waitForSaved(timeout = 5000) {
    await waitForSavedStatus(this.status, "已保存", timeout);
  }

  async getStatusText() {
    const el = await $(this.status);
    return el.getText();
  }

  async isDraftCleared() {
    const text = await getVditorText(this.editorPanel);
    return text.trim() === "";
  }

  async clearContent() {
    await clearVditor(this.editorPanel);
  }
}

export default new WorkspacePage();
