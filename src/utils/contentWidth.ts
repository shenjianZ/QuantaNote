export const CONTENT_WIDTH_DEFAULT = 0;
export const CONTENT_WIDTH_COMFORTABLE = 25;
export const CONTENT_WIDTH_IMMERSIVE = 50;
export const CONTENT_WIDTH_MAX_PROGRESS = 50;
export const CONTENT_WIDTH_PROGRESS_SCALE = 100;
export const CONTENT_WIDTH_CONTROL_MAX_PROGRESS = 100;
export const CONTENT_WIDTH_CONTROL_SCALE = CONTENT_WIDTH_CONTROL_MAX_PROGRESS / CONTENT_WIDTH_MAX_PROGRESS;

export const CONTENT_WIDTH_EDITOR_BASE = 56 * 16;
export const CONTENT_WIDTH_WORKSPACE_BASE = 42 * 16;
export const CONTENT_WIDTH_PREVIEW_BASE = 42 * 16;
export const CONTENT_WIDTH_OUTLINE_LAYOUT = 18 * 16 + 12;

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
