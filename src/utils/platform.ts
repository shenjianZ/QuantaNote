/**
 * 平台检测工具，用于区分桌面端和移动端
 */

let _isMobile: boolean | null = null;

export const MOBILE_BACK_EVENT = "quantanote:mobile-back";

/**
 * 检测当前是否在移动设备上运行
 * 结果缓存，首次调用后不再重新检测
 */
export function isMobile(): boolean {
  if (_isMobile !== null) return _isMobile;
  _isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return _isMobile;
}
