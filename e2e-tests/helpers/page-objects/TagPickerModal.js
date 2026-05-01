/**
 * TagPickerModal Page Object — 标签管理弹窗
 */

import { waitForDisplayed } from "../waits.js";
import { observePause } from "../config.js";

class TagPickerModal {
  get createInput() { return "[data-testid='tag-create-input']"; }
  get createBtn() { return "[data-testid='tag-create-btn']"; }
  get tagOptions() { return "[data-testid='tag-option']"; }

  async isOpen() {
    const input = await $(this.createInput);
    return input.isDisplayed();
  }

  async createTag(name, colorKey) {
    const input = await $(this.createInput);
    await input.clearValue();
    await input.setValue(name);

    if (colorKey) {
      // 选择颜色色块 (通过 style background 匹配)
      const colorBtns = await $$(`${this.createInput} ~ div button`);
      // 简化：直接用第一个或指定索引
      if (colorBtns.length > 0) {
        await colorBtns[0].click();
      }
    }

    await $(this.createBtn).then(b => b.click());
    await $(`//*[@data-testid='tag-option'][contains(., '${name}')]`).waitForDisplayed({ timeout: 10000 });
    await observePause();
  }

  async toggleTag(name) {
    const btn = await $(`//*[@data-testid='tag-option'][contains(., '${name}')]`);
    await btn.waitForDisplayed({ timeout: 10000 });
    await btn.click();
    await observePause();
  }

  async isTagSelected(name) {
    const btn = await $(`//*[@data-testid='tag-option'][contains(., '${name}')]`);
    const cls = await btn.getAttribute("class");
    return cls.includes("accent-soft");
  }

  async getTagNames() {
    const tags = await $$(this.tagOptions);
    const names = [];
    for (const tag of tags) {
      const text = await tag.getText();
      names.push(text.replace(/^#\s*/, "").replace(/\s*✓$/, "").trim());
    }
    return names;
  }

  async close() {
    const btn = await $("//button[contains(., '完成')]");
    await btn.click();
    await observePause();
  }
}

export default new TagPickerModal();
