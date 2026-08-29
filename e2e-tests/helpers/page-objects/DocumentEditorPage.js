/**
 * DocumentEditorPage Page Object — 全屏文档编辑器
 */

import { waitForDisplayed, waitForSavedStatus } from "../waits.js";
import { typeInVditor, clearVditor, getVditorText, setVditorValue } from "../vditor.js";
import { pause, observePause } from "../config.js";

class DocumentEditorPage {
  get titleInput() { return "[data-testid='doc-title-input']"; }
  get summaryInput() { return "[data-testid='doc-summary-input']"; }
  get saveStatus() { return "[data-testid='doc-save-status']"; }
  get saveVersionBtn() { return "[data-testid='doc-save-version-btn']"; }
  get favoriteBtn() { return "[data-testid='doc-favorite-btn']"; }
  get attachmentsBtn() { return "[data-testid='doc-attachments-btn']"; }
  get imageToolbarBtn() { return "button[data-type='quantanote-image']"; }
  get attachmentToolbarBtn() { return "button[data-type='quantanote-attachment']"; }
  get backBtn() { return "[data-testid='doc-back-btn']"; }
  get contentWidthControl() { return "[data-testid='document-editor-content-width-control']"; }
  get contentWidthTarget() { return "[data-testid='document-editor-content']"; }
  get outline() { return "[data-testid='document-outline']"; }
  get outlineToggle() { return "[data-testid='document-outline-toggle']"; }
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

  async getSummary() {
    const input = await $(this.summaryInput);
    return input.getValue();
  }

  async setSummary(summary) {
    const input = await $(this.summaryInput);
    await input.clearValue();
    await input.setValue(summary);
  }

  async typeContent(text) {
    await typeInVditor(text);
  }

  async setContent(markdown) {
    await setVditorValue(markdown);
  }

  async clearContent() {
    await clearVditor();
    try {
      await browser.waitUntil(
        async () => (await getVditorText()).trim() === "",
        { timeout: 800, timeoutMsg: "Vditor keyboard clear did not finish" },
      );
    } catch {
      await setVditorValue("");
    }
  }

  async getContent() {
    return getVditorText();
  }

  async getOutlineItemCount() {
    return browser.execute(() => document.querySelectorAll("[data-testid^='document-outline-item-']").length);
  }

  async isOutlineVisible() {
    const toggle = await $(this.outlineToggle);
    return (await toggle.getAttribute("aria-pressed")) === "true";
  }

  async setOutlineVisible(visible) {
    if ((await this.isOutlineVisible()) !== visible) {
      await $(this.outlineToggle).click();
      await observePause();
    }
  }

  async clickOutlineItem(index) {
    await $(`[data-testid='document-outline-item-${index}']`).click();
    await observePause();
  }

  async hasToolbarCharacterCount() {
    return browser.execute(() => Boolean(document.querySelector("[data-testid='document-editor-toolbar']")?.textContent?.match(/\d+\s*字/)));
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

  async isSaveVersionEnabled() {
    const btn = await $(this.saveVersionBtn);
    return btn.isEnabled();
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

  async hasAttachmentToolbar() {
    return (await $(this.attachmentsBtn)).isDisplayed();
  }

  async hasImageInsertionToolbar() {
    return (await $(this.imageToolbarBtn)).isDisplayed();
  }

  async hasAttachmentInsertionToolbar() {
    return (await $(this.attachmentToolbarBtn)).isDisplayed();
  }

  async setContentWidth(value) {
    const control = await $(this.contentWidthControl);
    const trigger = await control.$("button");
    const expanded = await trigger.getAttribute("aria-expanded");
    if (expanded !== "true") await trigger.click();
    await browser.execute((nextValue) => {
      const input = document.querySelector("[data-testid='document-editor-content-width-control-slider']");
      if (!input) throw new Error("Document editor content width slider not found");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(nextValue));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await browser.waitUntil(
      async () => browser.execute((expected) => document.querySelector("[data-testid='document-editor-content-width-control-slider']")?.value === String(expected), value),
      { timeout: 3000, timeoutMsg: `Document editor content width did not become ${value}` },
    );
  }

  async getContentWidth() {
    return browser.execute(() => document.querySelector("[data-testid='document-editor-content-width-control-slider']")?.value);
  }

  async getContentAreaWidth() {
    return browser.execute((selector) => document.querySelector(selector)?.getBoundingClientRect().width ?? 0, this.contentWidthTarget);
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

  // --- Version Panel Extended ---

  async searchVersions(query) {
    const input = await $("[data-testid='version-panel-search']");
    await input.clearValue();
    await input.setValue(query);
    await observePause();
  }

  async getVersionEntryCount() {
    const entries = await $$("[data-testid='version-panel-entry']");
    return entries.length;
  }

  async toggleCompareMode() {
    const btn = await $("[data-testid='version-panel-compare-toggle']");
    await btn.click();
    await observePause();
  }

  async selectVersionCheckbox(index) {
    const checkboxes = await $$("[data-testid='version-panel-checkbox']");
    if (checkboxes[index]) {
      await checkboxes[index].click();
      await observePause();
    }
  }

  async clickCompareBtn() {
    const btn = await $("[data-testid='version-panel-compare-btn']");
    await btn.click();
    await observePause();
  }

  async clickDeleteVersion(index) {
    await this.hoverVersion(index);
    const btns = await $$("[data-testid='version-panel-delete-btn']");
    if (btns[index]) {
      await btns[index].click();
      await observePause();
    }
  }

  async clickDeleteConfirm() {
    const btn = await $("[data-testid='version-panel-delete-confirm']");
    await btn.click();
    await observePause();
  }
}

export default new DocumentEditorPage();
