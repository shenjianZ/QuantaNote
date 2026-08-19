/**
 * TopBar Page Object — 顶部导航栏和窗口控制
 */

import { waitForDisplayed } from "../waits.js";

async function clickByDom(element) {
  await browser.execute((el) => el.click(), element);
}

async function getDisplayedElement(selector) {
  return waitForDisplayed(selector, 10000);
}

async function openOverflowMenu() {
  const menuButton = await getDisplayedElement("button[aria-haspopup='menu']");
  if ((await menuButton.getAttribute("aria-expanded")) !== "true") {
    await clickByDom(menuButton);
  }
  await waitForDisplayed("[role='menu']");
}

async function clickNavigation(selector, menuLabel) {
  const desktopButton = await $(selector);
  if (await desktopButton.isExisting() && await desktopButton.isDisplayed()) {
    await clickByDom(desktopButton);
    return;
  }

  await openOverflowMenu();
  const menuButton = await getDisplayedElement(`//div[@role='menu']//button[contains(., '${menuLabel}')]`);
  await clickByDom(menuButton);
}

class TopBar {
  // --- 导航 ---
  async navWorkspace() {
    await clickNavigation("[data-testid='nav-workspace']", "工作台");
    await waitForDisplayed("//h1[contains(., '随手记录')]");
  }

  async navLibrary() {
    await clickNavigation("[data-testid='nav-library']", "记录库");
    await waitForDisplayed("//h1[contains(., '记录库')]");
    await browser.execute(() => {
      window.dispatchEvent(new Event("quantanote:e2e-data-changed"));
    });
  }

  // --- 菜单 ---
  async openMenu() {
    await openOverflowMenu();
  }

  async openSettings() {
    await this.openMenu();
    const settingsBtn = await getDisplayedElement("//div[@role='menu']//button[contains(., '设置')]");
    await clickByDom(settingsBtn);
    await waitForDisplayed("//nav//button[contains(., '外观')]");
  }

  async openAccount() {
    await this.openMenu();
    const accountBtn = await getDisplayedElement("//div[@role='menu']//button[contains(., '账号')]");
    await clickByDom(accountBtn);
    await waitForDisplayed("//button[normalize-space(.)='登录']");
  }

  async openSearch() {
    // 搜索按钮没有 data-testid，用文本定位
    const btn = await getDisplayedElement("//header//button[contains(., '搜索')]");
    await clickByDom(btn);
  }

  // --- 窗口控制 ---
  async togglePin() {
    const btn = await getDisplayedElement("[data-testid='window-pin']");
    await clickByDom(btn);
  }

  async isPinned() {
    const btn = await getDisplayedElement("[data-testid='window-pin']");
    return (await btn.getAttribute("aria-pressed")) === "true";
  }

  async minimize() {
    const btn = await getDisplayedElement("[data-testid='window-minimize']");
    await clickByDom(btn);
  }

  async maximize() {
    const btn = await getDisplayedElement("[data-testid='window-maximize']");
    await clickByDom(btn);
  }

  async maximizeTitle() {
    const btn = await getDisplayedElement("[data-testid='window-maximize']");
    return btn.getAttribute("title");
  }
}

export default new TopBar();
