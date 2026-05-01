/**
 * E2E 测试配置 — 有头/无头模式控制
 *
 * 环境变量:
 *   E2E_HEADED=1  — 有头模式：应用窗口可见，操作间添加停顿方便观察
 *   E2E_HEADED=0  — 无头模式（默认）：无停顿，全速运行
 */

const HEADED = process.env.E2E_HEADED === "1" || process.env.E2E_HEADED === "true";

/** 是否为有头模式 */
export const isHeaded = HEADED;

/**
 * 功能性暂停 — 用于等待防抖、动画、UI 更新等
 * 无头模式下执行实际等待，有头模式下额外增加时间方便观察
 * @param {number} ms - 基础等待毫秒数
 */
export async function pause(ms) {
  const actual = HEADED ? ms + 800 : ms;
  await browser.pause(actual);
}

/**
 * 观察性暂停 — 仅在有头模式下停顿，方便肉眼观察操作效果
 * 无头模式下不等待
 * @param {number} ms - 有头模式下的等待毫秒数，默认 1200
 */
export async function observePause(ms = 1200) {
  if (HEADED) {
    await browser.pause(ms);
  }
}
