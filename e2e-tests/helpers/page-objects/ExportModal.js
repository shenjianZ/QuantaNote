/**
 * ExportModal Page Object — 导出弹窗
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause } from "../config.js";

class ExportModal {
  get modal() { return "[data-testid='export-modal']"; }
  get includeTags() { return "[data-testid='export-include-tags']"; }
  get includeAttachments() { return "[data-testid='export-include-attachments']"; }
  get includeVersions() { return "[data-testid='export-include-versions']"; }
  get sizeEstimate() { return "[data-testid='export-size-estimate']"; }
  get exportBtn() { return "[data-testid='export-btn']"; }
  get cancelBtn() { return "[data-testid='export-cancel-btn']"; }

  async isOpen() {
    const el = await $(this.modal);
    return el.isExisting() && el.isDisplayed();
  }

  async waitOpen(timeout = 5000) {
    await waitForDisplayed(this.modal, timeout);
  }

  async isIncludeTagsChecked() {
    const el = await $(this.includeTags);
    return el.isSelected();
  }

  async toggleIncludeTags() {
    await $(this.includeTags).then(b => b.click());
    await observePause();
  }

  async isIncludeAttachmentsChecked() {
    const el = await $(this.includeAttachments);
    return el.isSelected();
  }

  async toggleIncludeAttachments() {
    await $(this.includeAttachments).then(b => b.click());
    await observePause();
  }

  async isIncludeVersionsChecked() {
    const el = await $(this.includeVersions);
    return el.isSelected();
  }

  async toggleIncludeVersions() {
    await $(this.includeVersions).then(b => b.click());
    await observePause();
  }

  async getSizeEstimateText() {
    const el = await $(this.sizeEstimate);
    if (!(await el.isExisting())) return null;
    return el.getText();
  }

  async close() {
    await $(this.cancelBtn).then(b => b.click());
    await observePause();
  }
}

export default new ExportModal();
