/**
 * LibraryPage Page Object — 记录库页面（含阅读器抽屉）
 */

import { waitForDisplayed, waitForHidden, waitForText, waitForClickable } from "../waits.js";
import { pause, observePause } from "../config.js";

async function clickByDom(element) {
  await browser.execute((el) => el.click(), element);
}

class LibraryPage {
  // --- 选择器 ---
  get newBtn() { return "[data-testid='library-new-btn']"; }
  get trashBtn() { return "[data-testid='library-trash-btn']"; }
  get searchInput() { return "[data-testid='library-search-input']"; }
  get filterBtn() { return "[data-testid='library-filter-btn']"; }
  get items() { return "[data-testid='library-item']"; }
  get readerDrawer() { return "[data-testid='reader-drawer']"; }
  get readerCloseBtn() { return "[data-testid='reader-close-btn']"; }
  get readerEditBtn() { return "[data-testid='reader-edit-btn']"; }
  get readerMenuBtn() { return "[data-testid='reader-menu-btn']"; }
  get readerTagsBtn() { return "[data-testid='reader-tags-btn']"; }
  get readerAttachmentsBtn() { return "[data-testid='reader-attachments-btn']"; }
  get noteLinksPanel() { return "[data-testid='reader-note-links']"; }
  get noteGraphBtn() { return "[data-testid='reader-note-graph-btn']"; }
  get noteGraphModal() { return "[data-testid='note-link-graph']"; }
  get contentWidthControl() { return "[data-testid='reader-content-width-control']"; }
  get contentWidthTarget() { return "[data-testid='reader-drawer']"; }

  // --- 页面导航 ---
  async isDisplayed() {
    const h1 = await $("//h1[contains(., '记录库')]");
    return h1.isDisplayed();
  }

  async clickNew() {
    await $(this.newBtn).then(b => b.click());
    const blankButton = await $("[data-testid='template-blank-btn']");
    if (await blankButton.isDisplayed()) {
      await blankButton.click();
    }
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
    const tabIds = {
      "全部": "library-tab-recent",
      "置顶": "library-tab-pinned",
      "收藏": "library-tab-favorite",
    };
    const btn = await $(tabIds[tabName] ? `[data-testid='${tabIds[tabName]}']` : `//button[contains(., '${tabName}')]`);
    await btn.click();
    await observePause();
  }

  async selectSortOrder(value) {
    // value: "updated" / "created" / "title"
    const labels = {
      updated: "最近更新",
      created: "创建时间",
      title: "标题排序",
    };
    const select = await $("//*[@data-testid='library-filter-panel']//label[.//span[contains(., '排序')]]//button");
    await clickByDom(select);
    const option = await $(`//*[@data-testid='library-filter-panel']//button[normalize-space(.)='${labels[value]}']`);
    await clickByDom(option);
    await observePause();
  }

  async selectTagFilter(tagName) {
    // tagName: "all" 或具体标签名
    const label = tagName === "all" ? "全部标签" : tagName;
    const select = await $("//*[@data-testid='library-filter-panel']//label[.//span[contains(., '标签')]]//button");
    await clickByDom(select);
    const option = await $(`//*[@data-testid='library-filter-panel']//button[normalize-space(.)='${label}']`);
    await clickByDom(option);
    await observePause();
  }

  async selectSearchMode(mode) {
    const labels = {
      normal: "普通搜索",
      advanced: "高级搜索",
    };
    await this.openFilterPanel();
    const select = await $("//*[@data-testid='library-filter-panel']//label[.//span[contains(., '搜索模式')]]//button");
    await clickByDom(select);
    const option = await $(`//*[@data-testid='library-filter-panel']//button[normalize-space(.)='${labels[mode]}']`);
    await clickByDom(option);
    await observePause();
  }

  async setSearchScope(scope, enabled) {
    await this.openFilterPanel();
    const checkbox = await $(`[data-testid='library-search-scope-${scope}']`);
    if ((await checkbox.isSelected()) !== enabled) {
      await checkbox.click();
      await observePause();
    }
  }

  async getSearchHighlightCount() {
    return (await $$("[data-testid='search-highlight']")).length;
  }

  async getMatchedFieldText() {
    return browser.execute(() => {
      return Array.from(document.querySelectorAll("[data-testid='search-matched-fields']"))
        .map((node) => node.textContent || "")
        .join(" ");
    });
  }

  // --- 列表项 ---
  async getItemCount() {
    const items = await $$(this.items);
    return items.length;
  }

  async getLoadedItemCount() {
    const list = await $("[data-testid='virtual-item-list']");
    return Number(await list.getAttribute("data-loaded-count"));
  }

  async scrollListToEnd() {
    const list = await $("[data-testid='virtual-item-list']");
    await browser.execute((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    }, list);
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

  async clickForwardLink(title) {
    const link = await $(`[data-testid='reader-forward-link'][data-note-target='${title}']`);
    await link.click();
  }

  async openNoteGraph() {
    await $(this.noteGraphBtn).click();
    await waitForDisplayed(this.noteGraphModal);
  }

  async getReaderTitle() {
    return browser.execute(() => document.querySelector("[data-testid='reader-drawer'] h2")?.textContent || "");
  }

  async openTrash() {
    await $(this.trashBtn).then(b => b.click());
    await waitForDisplayed("[role='dialog'][aria-label='回收站']");
  }

  async restoreTrashItem(title) {
    const row = await $(`//*[@role='dialog'][@aria-label='回收站']//*[contains(., '${title}')]/ancestor::div[.//button[contains(@data-testid, 'trash-restore-')]][1]`);
    const restore = await row.$("button[data-testid^='trash-restore-']");
    await restore.click();
  }

  async getContentWidth() {
    const control = await $(this.contentWidthControl);
    const trigger = await control.$("button");
    const expanded = await trigger.getAttribute("aria-expanded");
    if (expanded !== "true") await trigger.click();
    return browser.execute(() => document.querySelector("[data-testid='reader-content-width-control-slider']")?.value);
  }

  async getContentAreaWidth() {
    return browser.execute((selector) => document.querySelector(selector)?.getBoundingClientRect().width ?? 0, this.contentWidthTarget);
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
    const btn = await $("[data-testid='reader-delete-btn']");
    await btn.click();
    await btn.waitForDisplayed({ timeout: 3000 });
    await expect(btn).toHaveText(expect.stringContaining("确认删除"));
    await btn.click();
  }

  async clickDeleteOnce() {
    await this.openReaderMenu();
    const btn = await $("[data-testid='reader-delete-btn']");
    await btn.click();
  }

  async openTagPicker() {
    await $(this.readerTagsBtn).then(b => b.click());
    await waitForDisplayed("[data-testid='tag-picker-search']");
  }

  async openAttachmentManager() {
    await $(this.readerAttachmentsBtn).then(b => b.click());
    await waitForDisplayed("[data-testid='attachment-add-btn']");
  }
}

export default new LibraryPage();
