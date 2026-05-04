/**
 * ImportModal Page Object — 导入弹窗
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause } from "../config.js";

class ImportModal {
  get modal() { return "[data-testid='import-modal']"; }
  get includeTags() { return "[data-testid='import-include-tags']"; }
  get includeAttachments() { return "[data-testid='import-include-attachments']"; }
  get includeVersions() { return "[data-testid='import-include-versions']"; }
  get conflictSkip() { return "[data-testid='import-conflict-skip']"; }
  get conflictOverwrite() { return "[data-testid='import-conflict-overwrite']"; }
  get importBtn() { return "[data-testid='import-btn']"; }
  get cancelBtn() { return "[data-testid='import-cancel-btn']"; }

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

  async isIncludeAttachmentsChecked() {
    const el = await $(this.includeAttachments);
    return el.isSelected();
  }

  async isIncludeVersionsChecked() {
    const el = await $(this.includeVersions);
    return el.isSelected();
  }

  async isConflictSkipSelected() {
    const el = await $(this.conflictSkip);
    return el.isSelected();
  }

  async isConflictOverwriteSelected() {
    const el = await $(this.conflictOverwrite);
    return el.isSelected();
  }

  async selectConflictOverwrite() {
    await $(this.conflictOverwrite).then(b => b.click());
    await observePause();
  }

  async close() {
    await $(this.cancelBtn).then(b => b.click());
    await observePause();
  }
}

export default new ImportModal();
