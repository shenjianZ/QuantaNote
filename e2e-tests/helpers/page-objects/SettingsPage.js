/**
 * SettingsPage Page Object — 设置页面
 */

import { pause, observePause } from "../config.js";

class SettingsPage {
  async selectSection(label) {
    // "外观" / "字体" / "数据" / "关于"
    const btn = await $(`//nav//button[contains(., '${label}')]`);
    await btn.click();
    await observePause();
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

  async toggleSetting(label) {
    // 通过 label 文本找到对应的 toggle 按钮
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
}

export default new SettingsPage();
