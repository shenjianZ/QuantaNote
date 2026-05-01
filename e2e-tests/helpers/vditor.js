/**
 * Vditor 编辑器交互工具 — 处理第三方 Vditor 编辑器的 E2E 交互
 *
 * Vditor IR 模式 DOM 结构:
 *   .vditor-container > .vditor > .vditor-ir > [contenteditable]
 */

import { waitForVditorReady } from "./waits.js";

const DEFAULT_CONTAINER = ".vditor-container";

/** 获取 contenteditable 元素的选择器 */
export function ceSelector(containerSel = DEFAULT_CONTAINER) {
  return `${containerSel} .vditor-ir [contenteditable]`;
}

/** 等待 Vditor 就绪并聚焦编辑器 */
export async function focusVditor(containerSel = DEFAULT_CONTAINER) {
  await waitForVditorReady(containerSel);
  const ce = await $(ceSelector(containerSel));
  await ce.click();
}

/** 在 Vditor 中输入文本 */
export async function typeInVditor(text, containerSel = DEFAULT_CONTAINER) {
  await focusVditor(containerSel);
  await browser.keys(text);
}

/** 清空 Vditor 内容 (Ctrl+A 后 Delete) */
export async function clearVditor(containerSel = DEFAULT_CONTAINER) {
  await focusVditor(containerSel);
  await browser.keys(["Control", "a"]);
  await browser.keys("Delete");
}

/** 读取 Vditor 渲染后的可见文本 */
export async function getVditorText(containerSel = DEFAULT_CONTAINER) {
  await waitForVditorReady(containerSel);
  const value = await browser.execute((sel) => {
    const root = document.querySelector(sel);
    const container = root?.classList?.contains("vditor-container")
      ? root
      : root?.querySelector(".vditor-container");
    return container?.__vditor?.getValue?.() ?? null;
  }, containerSel);
  if (value !== null) return value;
  const ce = await $(ceSelector(containerSel));
  if (!(await ce.isExisting())) return "";
  return ce.getText();
}

/** 通过 browser.execute 直接设置 Vditor 的值 */
export async function setVditorValue(markdown, containerSel = DEFAULT_CONTAINER) {
  await waitForVditorReady(containerSel);
  await browser.execute((sel, value) => {
    const root = document.querySelector(sel);
    const container = root?.classList?.contains("vditor-container")
      ? root
      : root?.querySelector(".vditor-container");
    if (!container) return;
    // 尝试通过 Vditor 实例的 setValue 方法
    const vditorInstance = container.__vditor;
    let updatedByInstance = false;
    if (vditorInstance?.setValue) {
      try {
        vditorInstance.setValue(value);
        updatedByInstance = true;
      } catch {
        // Vditor may expose the instance before all mode helpers are ready.
      }
    }
    // 同步触发编辑器输入事件，确保宿主 React 状态收到变更。
    const ce = container.querySelector(".vditor-ir [contenteditable]");
    if (ce) {
      if (!updatedByInstance) {
        ce.textContent = value;
      }
      ce.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    }
    vditorInstance?.options?.input?.(value);
  }, containerSel, markdown);
}
