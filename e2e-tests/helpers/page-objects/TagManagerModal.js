/**
 * TagManagerModal Page Object — 标签管理弹窗（全 CRUD）
 */

import { observePause } from "../config.js";

class TagManagerModal {
  get modal() { return "[data-testid='tag-manager-modal']"; }
  get searchInput() { return "[data-testid='tag-manager-search']"; }
  get createBtn() { return "[data-testid='tag-manager-create-btn']"; }
  get nameInput() { return "[data-testid='tag-manager-name-input']"; }
  get tagRows() { return "[data-testid='tag-manager-tag-row']"; }

  async isOpen() {
    const el = await $(this.modal);
    return el.isDisplayed();
  }

  async search(query) {
    const input = await $(this.searchInput);
    await input.clearValue();
    await input.setValue(query);
    await observePause();
  }

  async createTag(name) {
    // 点击新建按钮展开创建表单
    await $(this.createBtn).then(b => b.click());
    await observePause();

    // 输入标签名
    const input = await $(this.nameInput);
    await input.clearValue();
    await input.setValue(name);

    // 点击创建按钮（表单内的"创建"按钮）
    const createConfirmBtn = await $("//button[contains(., '创建')]");
    await createConfirmBtn.click();

    // 等待新标签出现在列表中
    await $(`//*[@data-testid='tag-manager-tag-row'][contains(., '${name}')]`).waitForDisplayed({ timeout: 10000 });
    await observePause();
  }

  async renameTag(oldName, newName) {
    const row = await $(`//*[@data-testid='tag-manager-tag-row'][contains(., '${oldName}')]`);
    await row.moveTo();
    await observePause(400);

    const renameBtn = await $(`//*[@data-testid='tag-manager-tag-row'][contains(., '${oldName}')]//*[@data-testid='tag-manager-rename-btn']`);
    await renameBtn.click();
    await observePause();

    const editInput = await $("[data-testid='tag-manager-edit-name']");
    await editInput.clearValue();
    await editInput.setValue(newName);

    const saveBtn = await $("[data-testid='tag-manager-save-btn']");
    await saveBtn.click();
    await observePause();
  }

  async deleteTag(name) {
    const row = await $(`//*[@data-testid='tag-manager-tag-row'][contains(., '${name}')]`);
    await row.moveTo();
    await observePause(400);

    const deleteBtn = await $(`//*[@data-testid='tag-manager-tag-row'][contains(., '${name}')]//*[@data-testid='tag-manager-delete-btn']`);
    await deleteBtn.click();
    await observePause();

    const confirmBtn = await $("[data-testid='tag-manager-delete-confirm']");
    await confirmBtn.click();
    await observePause();
  }

  async close() {
    const btn = await $("//button[contains(@class, 'modal')]//button[contains(@class, 'grid')]");
    // fallback: 关闭按钮
    const closeBtn = await $("[data-testid='modal-close-btn']");
    await closeBtn.click();
    await observePause();
  }
}

export default new TagManagerModal();
