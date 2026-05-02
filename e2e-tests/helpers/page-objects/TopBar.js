/**
 * TopBar Page Object — 顶部导航栏和窗口控制
 */

import { waitForDisplayed } from "../waits.js";

async function clickByDom(element) {
  await browser.execute((el) => el.click(), element);
}

class TopBar {
  // --- 导航 ---
  async navWorkspace() {
    const btn = await $("[data-testid='nav-workspace']");
    await clickByDom(btn);
    await waitForDisplayed("//h1[contains(., '随手记录')]");
  }

  async navLibrary() {
    const btn = await $("[data-testid='nav-library']");
    await clickByDom(btn);
    await waitForDisplayed("//h1[contains(., '记录库')]");
    await browser.execute(() => {
      window.dispatchEvent(new Event("quantanote:e2e-data-changed"));
    });
  }

  // --- 菜单 ---
  async openMenu() {
    const btn = await $("button[aria-haspopup='menu']");
    if ((await btn.getAttribute("aria-expanded")) !== "true") {
      await clickByDom(btn);
    }
    await waitForDisplayed("[role='menu']");
  }

  async openSettings() {
    await this.openMenu();
    const settingsBtn = await $("//div[@role='menu']//button[contains(., '设置')]");
    await clickByDom(settingsBtn);
    await waitForDisplayed("//nav//button[contains(., '外观')]");
  }

  async openSearch() {
    // 搜索按钮没有 data-testid，用文本定位
    const btn = await $("//header//button[contains(., '搜索')]");
    await clickByDom(btn);
  }

  // --- 窗口控制 ---
  async togglePin() {
    const btn = await $("[data-testid='window-pin']");
    await clickByDom(btn);
  }

  async isPinned() {
    const btn = await $("[data-testid='window-pin']");
    return (await btn.getAttribute("aria-pressed")) === "true";
  }

  async minimize() {
    const btn = await $("[data-testid='window-minimize']");
    await clickByDom(btn);
  }

  async maximize() {
    const btn = await $("[data-testid='window-maximize']");
    await clickByDom(btn);
  }

  async maximizeTitle() {
    const btn = await $("[data-testid='window-maximize']");
    return btn.getAttribute("title");
  }
}

export default new TopBar();
