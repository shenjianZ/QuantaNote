/**
 * VersionDiffModal Page Object — 版本对比弹窗
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause } from "../config.js";

class VersionDiffModal {
  get modal() { return "[data-testid='version-diff-modal']"; }
  get stats() { return "[data-testid='version-diff-stats']"; }
  get content() { return "[data-testid='version-diff-content']"; }
  get identical() { return "[data-testid='version-diff-identical']"; }
  get closeBtn() { return "[data-testid='version-diff-close-btn']"; }

  async isOpen() {
    const el = await $(this.modal);
    return el.isExisting() && el.isDisplayed();
  }

  async waitOpen(timeout = 5000) {
    await waitForDisplayed(this.modal, timeout);
  }

  async getStatsText() {
    const el = await $(this.stats);
    return el.getText();
  }

  async isIdenticalMessageVisible() {
    const el = await $(this.identical);
    return el.isExisting() && el.isDisplayed();
  }

  async getDiffContentText() {
    const el = await $(this.content);
    return el.getText();
  }

  async close() {
    await $(this.closeBtn).then(b => b.click());
    await observePause();
  }
}

export default new VersionDiffModal();
