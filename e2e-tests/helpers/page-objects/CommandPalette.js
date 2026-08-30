/**
 * CommandPalette Page Object — 全局命令面板 (Ctrl+K)
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { pause, observePause } from "../config.js";

class CommandPalette {
  get searchInput() { return "[data-testid='palette-search-input']"; }
  get results() { return "[data-testid='palette-result']"; }
  get commands() { return "[data-testid='palette-command']"; }

  async open() {
    const existing = await $(this.searchInput);
    if (await existing.isDisplayed().catch(() => false)) {
      await existing.click();
      return;
    }
    await browser.keys(["Control", "k"]);
    await waitForDisplayed(this.searchInput);
  }

  async close() {
    await browser.keys("Escape");
    await waitForHidden(this.searchInput);
  }

  async isOpen() {
    const input = await $(this.searchInput);
    return input.isDisplayed();
  }

  async search(query) {
    const input = await $(this.searchInput);
    await input.clearValue();
    await input.setValue(query);
    await pause(300); // 等待防抖
  }

  async getResultCount() {
    const results = await $$(this.results);
    return results.length;
  }

  async getCommandTexts() {
    const commands = await $$(this.commands);
    const texts = [];
    for (const command of commands) texts.push(await command.getText());
    return texts;
  }

  async selectCommandByLabel(label) {
    const command = await $(`//*[@data-testid='palette-command'][contains(., '${label}')]`);
    await command.click();
    await observePause();
  }

  async getResults() {
    const results = await $$(this.results);
    const texts = [];
    for (const r of results) {
      const title = await r.$(".truncate.text-sm.font-semibold");
      texts.push(await title.getText());
    }
    return texts;
  }

  async selectResult(index) {
    const results = await $$(this.results);
    if (results[index]) {
      await results[index].click();
    }
  }

  async selectResultByTitle(title) {
    const btn = await $(`//*[@data-testid='palette-result'][contains(., '${title}')]`);
    await btn.click();
  }

  async navigateWithArrows(direction, count = 1) {
    for (let i = 0; i < count; i++) {
      await browser.keys(direction === "down" ? "ArrowDown" : "ArrowUp");
      await observePause(400);
    }
  }

  async pressEnter() {
    await browser.keys("Enter");
  }
}

export default new CommandPalette();
