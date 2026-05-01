/**
 * AttachmentManagerModal Page Object — 附件管理弹窗
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { pause, observePause } from "../config.js";

class AttachmentManagerModal {
  get addBtn() { return "[data-testid='attachment-add-btn']"; }
  get items() { return "[data-testid='attachment-item']"; }

  async isOpen() {
    const btn = await $(this.addBtn);
    return btn.isDisplayed();
  }

  async getAttachmentCount() {
    const items = await $$(this.items);
    return items.length;
  }

  async getAttachmentNames() {
    const items = await $$(this.items);
    const names = [];
    for (const item of items) {
      const nameEl = await item.$(".truncate.text-sm.font-medium");
      names.push(await nameEl.getText());
    }
    return names;
  }

  async deleteAttachment(index) {
    const items = await $$(this.items);
    if (items[index]) {
      const deleteBtn = await items[index].$("button[title='删除附件']");
      await deleteBtn.click();
      await observePause();
    }
  }

  async close() {
    const closeBtn = await $("[data-testid='modal-close-btn']");
    await closeBtn.click();
    await observePause();
  }
}

export default new AttachmentManagerModal();
