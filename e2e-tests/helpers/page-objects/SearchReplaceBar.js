/**
 * SearchReplaceBar Page Object — 搜索替换栏
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause, pause } from "../config.js";

class SearchReplaceBar {
  get bar() { return "[data-testid='search-replace-bar']"; }
  get searchInput() { return "[data-testid='search-input']"; }
  get matchCount() { return "[data-testid='search-match-count']"; }
  get prevBtn() { return "[data-testid='search-prev-btn']"; }
  get nextBtn() { return "[data-testid='search-next-btn']"; }
  get caseSensitiveBtn() { return "[data-testid='search-case-sensitive-btn']"; }
  get closeBtn() { return "[data-testid='search-close-btn']"; }
  get replaceInput() { return "[data-testid='replace-input']"; }
  get replaceBtn() { return "[data-testid='replace-btn']"; }
  get replaceAllBtn() { return "[data-testid='replace-all-btn']"; }

  async isOpen() {
    const el = await $(this.bar);
    return el.isExisting() && el.isDisplayed();
  }

  async waitOpen(timeout = 5000) {
    await waitForDisplayed(this.bar, timeout);
  }

  async search(query) {
    const input = await $(this.searchInput);
    await input.clearValue();
    await input.setValue(query);
    await pause(500);
  }

  async getMatchCountText() {
    const el = await $(this.matchCount);
    return el.getText();
  }

  async clickNext() {
    await $(this.nextBtn).then(b => b.click());
    await observePause();
  }

  async clickPrev() {
    await $(this.prevBtn).then(b => b.click());
    await observePause();
  }

  async isCaseSensitive() {
    const btn = await $(this.caseSensitiveBtn);
    const cls = await btn.getAttribute("class");
    return cls.includes("accent-soft");
  }

  async toggleCaseSensitive() {
    await $(this.caseSensitiveBtn).then(b => b.click());
    await observePause();
  }

  async close() {
    await $(this.closeBtn).then(b => b.click());
    await observePause();
  }

  async setReplace(text) {
    const input = await $(this.replaceInput);
    await input.clearValue();
    await input.setValue(text);
  }

  async clickReplace() {
    await $(this.replaceBtn).then(b => b.click());
    await observePause();
  }

  async clickReplaceAll() {
    await $(this.replaceAllBtn).then(b => b.click());
    await observePause();
  }
}

export default new SearchReplaceBar();
