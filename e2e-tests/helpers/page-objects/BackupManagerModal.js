/**
 * BackupManagerModal Page Object — 备份管理器
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause } from "../config.js";

class BackupManagerModal {
  get modal() { return "[data-testid='backup-manager-modal']"; }
  get emptyState() { return "[data-testid='backup-empty']"; }
  get list() { return "[data-testid='backup-list']"; }
  get items() { return "[data-testid='backup-item']"; }
  get deleteBtns() { return "[data-testid='backup-delete-btn']"; }
  get closeBtn() { return "[data-testid='backup-close-btn']"; }

  async isOpen() {
    const el = await $(this.modal);
    return el.isExisting() && el.isDisplayed();
  }

  async waitOpen(timeout = 5000) {
    await waitForDisplayed(this.modal, timeout);
  }

  async isEmptyStateVisible() {
    const el = await $(this.emptyState);
    return el.isExisting() && el.isDisplayed();
  }

  async getBackupCount() {
    const items = await $$(this.items);
    return items.length;
  }

  async deleteBackup(index) {
    const items = await $$(this.items);
    if (items[index]) {
      await items[index].moveTo();
      await observePause(400);
      const btns = await $$(this.deleteBtns);
      if (btns[index]) {
        await btns[index].click();
        await observePause();
      }
    }
  }

  async close() {
    await $(this.closeBtn).then(b => b.click());
    await observePause();
  }
}

export default new BackupManagerModal();
