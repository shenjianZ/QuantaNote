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
    await btn.click();
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
    const select = await $("[data-testid='font-select']");
    await select.selectByVisibleText(fontName);
    await observePause();
  }

  async getFontSize() {
    const slider = await $("[data-testid='font-size-slider']");
    return slider.getValue();
  }

  async setFontSize(size) {
    const slider = await $("[data-testid='font-size-slider']");
    await browser.execute((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, slider, size);
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
