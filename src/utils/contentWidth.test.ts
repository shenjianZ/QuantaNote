import { describe, expect, it } from "vitest";
import {
  clampContentWidthProgress,
  interpolateContentWidth,
} from "./contentWidth";

describe("content width helpers", () => {
  it("normalizes missing, invalid, fractional, and out-of-range values", () => {
    expect(clampContentWidthProgress(undefined)).toBe(0);
    expect(clampContentWidthProgress("not-a-number")).toBe(0);
    expect(clampContentWidthProgress(-1)).toBe(0);
    expect(clampContentWidthProgress(100.6)).toBe(50);
    expect(clampContentWidthProgress(50)).toBe(50);
    expect(clampContentWidthProgress(42.4)).toBe(42.5);
    expect(clampContentWidthProgress(42.2)).toBe(42);
  });

  it("interpolates from the current width to the available width", () => {
    expect(interpolateContentWidth(896, 1600, 0)).toBe(896);
    expect(interpolateContentWidth(896, 1600, 25)).toBe(1072);
    expect(interpolateContentWidth(896, 1600, 50)).toBe(1248);
  });

  it("clamps the base width when the available area is narrower", () => {
    expect(interpolateContentWidth(896, 640, 0)).toBe(640);
    expect(interpolateContentWidth(896, 640, 50)).toBe(640);
  });
});
