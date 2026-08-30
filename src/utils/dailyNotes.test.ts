import { describe, expect, it } from "vitest";
import {
  formatDateKey,
  getCalendarDays,
  getMonthRange,
  isSameMonth,
  isToday,
  parseDateKey,
  shiftMonth,
} from "./dailyNotes";

describe("daily note date helpers", () => {
  it("uses the local calendar date instead of UTC conversion", () => {
    const date = new Date(2026, 7, 30, 23, 30);
    expect(formatDateKey(date)).toBe("2026-08-30");
    expect(formatDateKey(parseDateKey("2026-08-30"))).toBe("2026-08-30");
  });

  it("rejects impossible date keys", () => {
    expect(() => parseDateKey("2026-02-30")).toThrow();
    expect(() => parseDateKey("2026-8-30")).toThrow();
  });

  it("returns a complete six-week calendar grid and month range", () => {
    const month = new Date(2026, 7, 15);
    const days = getCalendarDays(month);
    expect(days).toHaveLength(42);
    expect(formatDateKey(days[0])).toBe("2026-07-26");
    expect(formatDateKey(days[41])).toBe("2026-09-05");
    expect(getMonthRange(month)).toEqual({ startDate: "2026-08-01", endDate: "2026-08-31" });
  });

  it("shifts months without changing the calendar semantics", () => {
    const shifted = shiftMonth(new Date(2026, 11, 15), 1);
    expect(formatDateKey(shifted)).toBe("2027-01-01");
    expect(isSameMonth(shifted, new Date(2027, 0, 20))).toBe(true);
    expect(isToday(new Date(2026, 7, 30), new Date(2026, 7, 30, 9))).toBe(true);
  });
});
