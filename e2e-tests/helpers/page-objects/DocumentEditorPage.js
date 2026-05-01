/**
 * DocumentEditorPage Page Object — 全屏文档编辑器
 */

import { waitForDisplayed, waitForSavedStatus } from "../waits.js";
import { typeInVditor, clearVditor, getVditorText } from "../vditor.js";
import { pause, observePause } from "../config.js";

class DocumentEditorPage {
  get titleInput() { return "[data-testid='doc-title-input']"; }
  get saveStatus() { return "[data-testid='doc-save-status']"; }
  get saveVersionBtn() { return "[data-testid='doc-save-version-btn']"; }
  get favoriteBtn() { return "[data-testid='doc-favorite-btn']"; }
  get backBtn() { return "[data-testid='doc-back-btn']"; }
  get versionToggle() { return "[data-testid='doc-version-toggle']"; }
  get versionPanel() { return "[data-testid='version-panel']"; }

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
    const btn = await $(this.favoriteBtn);
    const cls = await btn.getAttribute("class");
    return cls.includes("accent-soft");
  }

  async clickBack() {
    await $(this.backBtn).then(b => b.click());
  }

  // --- Version Panel ---

  async openVersionPanel() {
    await $(this.versionToggle).then(b => b.click());
    await waitForDisplayed(this.versionPanel);
  }

  async closeVersionPanel() {
    const closeBtn = await $(`${this.versionPanel} button[title]`);
    // 找到面板头部的 X 关闭按钮
    const panel = await $(this.versionPanel);
    const header = await panel.$("div:first-child");
    const btns = await header.$$("button");
    if (btns.length > 0) {
      await btns[btns.length - 1].click();
    }
    await observePause();
  }

  async getVersionCount() {
    const btn = await $(this.versionToggle);
    const text = await btn.getText();
    // "版本 (N)"
    const match = text.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async getVersionEntries() {
    const entries = await $$("[data-testid='version-panel-entry']");
    return entries;
  }

  async hoverVersion(index) {
    const entries = await this.getVersionEntries();
    if (entries[index]) {
      await entries[index].moveTo();
      await observePause(400);
    }
  }

  async clickVersionView(index) {
    await this.hoverVersion(index);
    const btn = await $$("[data-testid='version-panel-view-btn']");
    if (btn[index]) {
      await btn[index].click();
    }
  }

  async clickVersionEdit(index) {
    await this.hoverVersion(index);
    const btn = await $$("[data-testid='version-panel-edit-btn']");
    if (btn[index]) {
      await btn[index].click();
    }
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
    await browser.waitUntil(
      async () => {
        const entries = await this.getVersionEntries();
        if (!entries[0]) return false;
        const text = await entries[0].getText();
        return text.includes(name);
      },
      { timeout: 5000, timeoutMsg: `Version name "${name}" was not saved` },
    );
  }
}

export default new DocumentEditorPage();
