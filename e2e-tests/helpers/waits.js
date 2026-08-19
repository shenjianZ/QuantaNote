/**
 * 显式等待工具 — 替代 browser.pause 的硬编码等待
 */

export async function waitForDisplayed(selector, timeout = 5000) {
  const el = await $(selector);
  await el.waitForDisplayed({ timeout });
  return el;
}

export async function waitForClickable(selector, timeout = 5000) {
  const el = await $(selector);
  await el.waitForClickable({ timeout });
  return el;
}

export async function waitForHidden(selector, timeout = 5000) {
  const el = await $(selector);
  await el.waitForDisplayed({ timeout, reverse: true });
}

export async function waitForText(selector, text, timeout = 5000) {
  await browser.waitUntil(
    async () => {
      const el = await $(selector);
      if (!(await el.isDisplayed())) return false;
      const elText = await el.getText();
      return elText.includes(text);
    },
    { timeout, timeoutMsg: `Expected "${text}" in ${selector} within ${timeout}ms` },
  );
}

export async function waitForVditorReady(containerSelector = ".vditor-container", timeout = 8000) {
  await browser.waitUntil(
    async () => {
      return browser.execute((selector) => {
        const root = document.querySelector(selector);
        const container = root?.classList?.contains("vditor-container")
          ? root
          : root?.querySelector(".vditor-container");
        return container?.getAttribute("data-vditor-ready") === "true"
          && Boolean(container.__vditor)
          && Boolean(container.querySelector(".vditor-ir [contenteditable]"));
      }, containerSelector);
    },
    { timeout, timeoutMsg: `Vditor not ready within ${timeout}ms` },
  );
}

export async function waitForSavedStatus(selector, expectedText = "已保存", timeout = 5000) {
  await browser.waitUntil(
    async () => {
      const el = await $(selector);
      if (!(await el.isExisting())) return false;
      const text = await el.getText();
      return text.includes(expectedText);
    },
    { timeout, timeoutMsg: `Save status "${expectedText}" not found within ${timeout}ms` },
  );
}

export async function waitForItemCount(selector, expectedCount, timeout = 5000) {
  await browser.waitUntil(
    async () => {
      const items = await $$(selector);
      return items.length === expectedCount;
    },
    { timeout, timeoutMsg: `Expected ${expectedCount} items in ${selector} within ${timeout}ms` },
  );
}
