export const CONTENT_WIDTH_DEFAULT = 0;
export const CONTENT_WIDTH_COMFORTABLE = 25;
export const CONTENT_WIDTH_IMMERSIVE = 50;
export const CONTENT_WIDTH_MAX_PROGRESS = 50;
export const CONTENT_WIDTH_PROGRESS_SCALE = 100;
export const CONTENT_WIDTH_CONTROL_MAX_PROGRESS = 100;
export const CONTENT_WIDTH_CONTROL_SCALE = CONTENT_WIDTH_CONTROL_MAX_PROGRESS / CONTENT_WIDTH_MAX_PROGRESS;

// 编辑器与预览共用同一基准宽度：两页的内容留白保持一致观感。
export const CONTENT_WIDTH_EDITOR_BASE = 42 * 16;
export const CONTENT_WIDTH_WORKSPACE_BASE = 42 * 16;
export const CONTENT_WIDTH_PREVIEW_BASE = 42 * 16;
export const CONTENT_WIDTH_OUTLINE_LAYOUT = 18 * 16 + 12;

/** dock 图标列与间隙占位（面板宽度之外）。 */
export const DOCK_RAIL_RESERVED = 64;

/** dock 开启时内容区需要避让的总宽度（面板 + 图标列 + 间隙）。 */
export function getDockReservedWidth(panelWidth: number): number {
  return panelWidth + DOCK_RAIL_RESERVED;
}

export function clampContentWidthProgress(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return CONTENT_WIDTH_DEFAULT;
  const clampedValue = Math.min(
    CONTENT_WIDTH_MAX_PROGRESS,
    Math.max(CONTENT_WIDTH_DEFAULT, numericValue),
  );
  return Math.round(clampedValue * 2) / 2;
}

export function toContentWidthControlProgress(value: unknown): number {
  return Math.round(
    clampContentWidthProgress(value) * CONTENT_WIDTH_CONTROL_SCALE,
  );
}

export function fromContentWidthControlProgress(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return CONTENT_WIDTH_DEFAULT;
  return clampContentWidthProgress(numericValue / CONTENT_WIDTH_CONTROL_SCALE);
}

export function interpolateContentWidth(
  baseWidth: number,
  availableWidth: number,
  progress: number,
): number {
  const safeAvailableWidth = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  const safeBaseWidth = Math.min(Math.max(0, baseWidth), safeAvailableWidth);
  const normalizedProgress = clampContentWidthProgress(progress) / CONTENT_WIDTH_PROGRESS_SCALE;

  return Math.round(
    safeBaseWidth + (safeAvailableWidth - safeBaseWidth) * normalizedProgress,
  );
}
