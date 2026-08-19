/**
 * SettingsPage Page Object — 设置页面
 */

import { pause, observePause } from "../config.js";

class SettingsPage {
  async selectSection(label) {
    // "外观" / "字体" / "数据" / "关于" / "同步"
    const btn = await $(`//nav//button[contains(., '${label}')]`);
    await btn.click();
    await observePause();
  }

  async selectSectionByIndex(index) {
    const btns = await $$("//nav//button");
    if (btns[index]) {
      await btns[index].click();
      await observePause();
    }
  }

  async setTheme(mode) {
    // mode: "system" / "light" / "dark"
    const btn = await $(`[data-testid='theme-${mode}']`);
    await browser.execute((el) => el.click(), btn);
    await observePause();
  }

  async getTheme() {
    return browser.execute(() => document.documentElement.getAttribute("data-theme"));
  }

  async setAccentColor(index) {
    const buttons = await $$("[data-testid='accent-color']");
    if (buttons[index]) {
      await buttons[index].click();
      await observePause();
    }
  }

  async getAccentColor() {
    return browser.execute(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
    );
  }

  async selectFont(fontName) {
    const select = await $("//div[contains(@class, 'min-h-12')][.//span[contains(., '界面字体')]]//button");
    await select.click();
    const option = await $(`//button[normalize-space(.)='${fontName}']`);
    await option.click();
    await observePause();
  }

  async selectMonoFont(fontName) {
    const select = await $("//div[contains(@class, 'min-h-12')][.//span[contains(., '等宽字体')]]//button");
    await select.click();
    const option = await $(`//button[normalize-space(.)='${fontName}']`);
    await option.click();
    await observePause();
  }

  async getFontSize() {
    const select = await $("//div[contains(@class, 'min-h-12')][.//span[contains(., '界面字号')]]//button");
    const text = await select.getText();
    return text.replace(/\D/g, "");
  }

  async setFontSize(size) {
    const select = await $("//div[contains(@class, 'min-h-12')][.//span[contains(., '界面字号')]]//button");
    await select.click();
    const option = await $(`//button[normalize-space(.)='${size} px']`);
    await option.click();
    await observePause();
  }

  async setContentWidth(value) {
    const control = await $("[data-testid='settings-content-width-control']");
    const trigger = await control.$("button");
    const expanded = await trigger.getAttribute("aria-expanded");
    if (expanded !== "true") await trigger.click();
    await browser.execute((nextValue) => {
      const input = document.querySelector("[data-testid='settings-content-width-control-slider']");
      if (!input) throw new Error("Content width slider not found");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(nextValue));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await browser.waitUntil(
      async () => browser.execute((expected) => document.querySelector("[data-testid='settings-content-width-control-slider']")?.value === String(expected), value),
      { timeout: 3000, timeoutMsg: `Content width did not become ${value}` },
    );
    await observePause();
  }

  async getContentWidth() {
    return browser.execute(() => document.querySelector("[data-testid='settings-content-width-control-slider']")?.value);
  }

  async setDocumentOutlineVisible(visible) {
    const toggle = await $("[data-testid='settings-document-outline-toggle']");
    const current = (await toggle.getAttribute("aria-checked")) === "true";
    if (current !== visible) {
      await toggle.click();
      await observePause();
    }
  }

  async toggleSetting(label) {
    const toggle = await $(`//div[contains(@class, 'min-h-12')][.//span[contains(., '${label}')]]//button[contains(@class, 'rounded-full')]`);
    await toggle.click();
    await observePause();
  }

  async clickOptimizeDb() {
    await $("[data-testid='optimize-db-btn']").then(b => b.click());
    await pause(500);
  }

  async getDbSize() {
    const el = await $("//div[.//span[contains(., '数据库大小')]]/span[2]");
    return el.getText();
  }

  async clickExport() {
    const btn = await $("//button[contains(., '导出')]");
    await btn.click();
  }

  async clickImport() {
    const btn = await $("//button[contains(., '导入')]");
    await btn.click();
  }

  // --- Extended settings methods ---

  async clickAddCustomColor() {
    await $("[data-testid='settings-add-custom-color-btn']").then(b => b.click());
    await observePause();
  }

  async getCustomColorCount() {
    const colors = await $$("//div[contains(@class, 'group relative')]");
    return colors.length;
  }

  async clickBackupNow() {
    await $("[data-testid='settings-backup-now-btn']").then(b => b.click());
    await observePause();
  }

  async clickBackupManager() {
    await $("[data-testid='settings-backup-manager-btn']").then(b => b.click());
    await observePause();
  }

  async clickClearSqlLog() {
    await $("[data-testid='settings-clear-sql-log-btn']").then(b => b.click());
    await observePause();
  }

  async getAboutVersion() {
    const el = await $("[data-testid='settings-about-version']");
    return el.getText();
  }

  async toggleAutostart() {
    await this.toggleSetting("开机自启");
  }

  async selectLocale(locale) {
    // Find the locale Select by its label text
    const select = await $("//div[contains(@class, 'min-h-12')][.//span[contains(., '语言')]]//button");
    await select.click();
    const option = await $(`//button[normalize-space(.)='${locale}']`);
    await option.click();
    await observePause();
  }
}

export default new SettingsPage();
