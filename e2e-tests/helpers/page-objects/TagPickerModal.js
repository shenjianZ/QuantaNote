/**
 * TagPickerModal Page Object — 标签选择弹窗（简化版）
 */

import { observePause } from "../config.js";

class TagPickerModal {
  get searchInput() { return "[data-testid='tag-picker-search']"; }
  get tagOptions() { return "[data-testid='tag-option']"; }
  get manageBtn() { return "[data-testid='tag-picker-manage-btn']"; }

  async isOpen() {
    const input = await $(this.searchInput);
    return input.isDisplayed();
  }

  async search(query) {
    const input = await $(this.searchInput);
    await input.clearValue();
    await input.setValue(query);
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

  async openManager() {
    await $(this.manageBtn).then(b => b.click());
    await observePause();
  }

  async close() {
    const btn = await $("//button[contains(., '完成')]");
    await btn.click();
    await observePause();
  }
}

export default new TagPickerModal();
