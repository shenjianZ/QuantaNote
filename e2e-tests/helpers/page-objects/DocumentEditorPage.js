/**
 * DocumentEditorPage Page Object — 全屏文档编辑器
 */

import { waitForDisplayed, waitForSavedStatus, waitForText } from "../waits.js";
import { typeInVditor, clearVditor, getVditorText } from "../vditor.js";
import { pause, observePause } from "../config.js";

class DocumentEditorPage {
  get titleInput() { return "[data-testid='doc-title-input']"; }
  get saveStatus() { return "[data-testid='doc-save-status']"; }
  get saveVersionBtn() { return "[data-testid='doc-save-version-btn']"; }
  get favoriteBtn() { return "[data-testid='doc-favorite-btn']"; }
  get backBtn() { return "[data-testid='doc-back-btn']"; }
  get versionList() { return "[data-testid='doc-version-list']"; }

  async isDisplayed() {
    const input = await $(this.titleInput);
    return input.isDisplayed();
  }

  async getTitle() {
    const input = await $(this.titleInput);
    return input.getValue();
  }

  async setTitle(title) {
    const input = await $(this.titleInput);
    await input.clearValue();
    await input.setValue(title);
  }

  async typeContent(text) {
    await typeInVditor(text);
  }

  async clearContent() {
    await clearVditor();
  }

  async getContent() {
    return getVditorText();
  }

  async getSaveStatus() {
    const el = await $(this.saveStatus);
    return el.getText();
  }

  async waitForSaved(timeout = 5000) {
    await waitForSavedStatus(this.saveStatus, "已保存", timeout);
  }

  async clickSaveVersion() {
    await $(this.saveVersionBtn).then(b => b.click());
    await observePause();
  }

  async toggleFavorite() {
    await $(this.favoriteBtn).then(b => b.click());
    await observePause();
  }

  async isFavorite() {
    // 检查按钮样式中是否包含 accent-soft
    const btn = await $(this.favoriteBtn);
    const cls = await btn.getAttribute("class");
    return cls.includes("accent-soft");
  }

  async clickBack() {
    await $(this.backBtn).then(b => b.click());
  }

  async getVersionCount() {
    const summary = await $(`${this.versionList} summary`);
    const text = await summary.getText();
    // "版本记录 (N)"
    const match = text.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async getVersionEntries() {
    const entries = await $$(`${this.versionList} .group.rounded-xl`);
    return entries;
  }

  async hoverVersion(index) {
    const entries = await this.getVersionEntries();
    if (entries[index]) {
      await entries[index].moveTo();
      await observePause(400);
    }
  }

  async clickVersionRestore(index) {
    await this.hoverVersion(index);
    const btn = await $(`${this.versionList} .group.rounded-xl:nth-child(${index + 1}) button[title='预览并恢复']`);
    await btn.click();
  }

  async clickVersionEdit(index) {
    await this.hoverVersion(index);
    const btn = await $(`${this.versionList} .group.rounded-xl:nth-child(${index + 1}) button[title='编辑']`);
    await btn.click();
  }

  async editVersionMeta(name, description) {
    const nameInput = await $("input[placeholder='版本名称']");
    await nameInput.clearValue();
    await nameInput.setValue(name);
    if (description !== undefined) {
      const descInput = await $("input[placeholder='版本描述（可选）']");
      await descInput.clearValue();
      await descInput.setValue(description);
    }
    const saveBtn = await $("//button[contains(., '保存')][ancestor::div[contains(@class, 'space-y')]]");
    await saveBtn.click();
    await observePause();
  }
}

export default new DocumentEditorPage();
