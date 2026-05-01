/**
 * LibraryPage Page Object — 记录库页面（含阅读器抽屉）
 */

import { waitForDisplayed, waitForHidden, waitForText, waitForClickable } from "../waits.js";
import { pause, observePause } from "../config.js";

class LibraryPage {
  // --- 选择器 ---
  get newBtn() { return "[data-testid='library-new-btn']"; }
  get searchInput() { return "[data-testid='library-search-input']"; }
  get filterBtn() { return "[data-testid='library-filter-btn']"; }
  get items() { return "[data-testid='library-item']"; }
  get readerDrawer() { return "[data-testid='reader-drawer']"; }
  get readerCloseBtn() { return "[data-testid='reader-close-btn']"; }
  get readerEditBtn() { return "[data-testid='reader-edit-btn']"; }
  get readerMenuBtn() { return "[data-testid='reader-menu-btn']"; }
  get readerTagsBtn() { return "[data-testid='reader-tags-btn']"; }
  get readerAttachmentsBtn() { return "[data-testid='reader-attachments-btn']"; }

  // --- 页面导航 ---
  async isDisplayed() {
    const h1 = await $("//h1[contains(., '记录库')]");
    return h1.isDisplayed();
  }

  async clickNew() {
    await $(this.newBtn).then(b => b.click());
    await waitForDisplayed("input[placeholder='文档标题']");
  }

  // --- 搜索 ---
  async search(query) {
    const input = await $(this.searchInput);
    await browser.execute((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, input, query);
    // 等待防抖搜索完成
    await pause(300);
  }

  // --- 筛选面板 ---
  async openFilterPanel() {
    const btn = await $(this.filterBtn);
    const isOpen = await browser.execute((selector) => {
      const summary = document.querySelector(selector);
      return summary?.parentElement?.hasAttribute("open") ?? false;
    }, this.filterBtn);
    if (!isOpen) {
      await btn.click();
    }
    await waitForDisplayed("//*[@data-testid='library-filter-panel']");
  }

  async selectTab(tabName) {
    // "全部" / "置顶" / "收藏"
    const btn = await $(`//*[@data-testid='library-filter-panel']//button[contains(., '${tabName}')]`);
    await btn.click();
    await observePause();
  }

  async selectSortOrder(value) {
    // value: "updated" / "created" / "title"
    const select = await $("//*[@data-testid='library-filter-panel']//select[../span[contains(., '排序')]]");
    await select.selectByAttribute("value", value);
    await observePause();
  }

  async selectTagFilter(tagName) {
    // tagName: "all" 或具体标签名
    const select = await $("//*[@data-testid='library-filter-panel']//select[../span[contains(., '标签')]]");
    await select.selectByAttribute("value", tagName);
    await observePause();
  }

  // --- 列表项 ---
  async getItemCount() {
    const items = await $$(this.items);
    return items.length;
  }

  async clickItem(title) {
    const item = await $(`//*[@data-testid='library-item'][contains(., '${title}')]`);
    await item.waitForDisplayed({ timeout: 10000 });
    await item.click();
    await waitForDisplayed(this.readerDrawer);
  }

  async expectItemVisible(title) {
    const item = await $(`//*[@data-testid='library-item'][contains(., '${title}')]`);
    await item.waitForDisplayed({ timeout: 10000 });
    await expect(item).toBeDisplayed();
  }

  async expectItemNotVisible(title) {
    const item = await $(`//*[@data-testid='library-item'][contains(., '${title}')]`);
    await expect(item).not.toBeDisplayed();
  }

  async expectEmptyState() {
    const empty = await $("//*[contains(., '还没有可显示的记录')]");
    await expect(empty).toBeDisplayed();
  }

  // --- 阅读器抽屉 ---
  async readerIsOpen() {
    const drawer = await $(this.readerDrawer);
    return drawer.isDisplayed();
  }

  async closeReader() {
    await $(this.readerCloseBtn).then(b => b.click());
    await waitForHidden(this.readerDrawer);
  }

  async clickEdit() {
    await $(this.readerEditBtn).then(b => b.click());
  }

  // --- 阅读器菜单操作 ---
  async openReaderMenu() {
    await $(this.readerMenuBtn).then(b => b.click());
    await waitForDisplayed(".menu-item");
  }

  async togglePin() {
    await this.openReaderMenu();
    const btn = await $("//button[contains(@class, 'menu-item')][contains(., '置顶') or contains(., '取消置顶')]");
    await btn.click();
    await observePause();
  }

  async toggleFavorite() {
    await this.openReaderMenu();
    const btn = await $("//button[contains(@class, 'menu-item')][contains(., '收藏') or contains(., '取消收藏')]");
    await btn.click();
    await observePause();
  }

  async clickCopy() {
    await this.openReaderMenu();
    const btn = await $("//button[contains(@class, 'menu-item')][contains(., '复制内容') or contains(., '已复制')]");
    await btn.click();
  }

  async clickDelete() {
    await this.openReaderMenu();
    const btn = await $("//button[contains(@class, 'menu-item')][contains(., '删除')]");
    await btn.click();
  }

  async openTagPicker() {
    await $(this.readerTagsBtn).then(b => b.click());
    await waitForDisplayed("[data-testid='tag-create-input']");
  }

  async openAttachmentManager() {
    await $(this.readerAttachmentsBtn).then(b => b.click());
    await waitForDisplayed("[data-testid='attachment-add-btn']");
  }
}

export default new LibraryPage();
