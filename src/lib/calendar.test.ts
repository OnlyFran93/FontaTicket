import { describe, expect, it } from "vitest";
import { calendarDays, dateFromKey, dateKey, formatDateKey, formatMonthKey } from "./calendar";

describe("calendar helpers", () => {
  it("builds Monday-first calendar weeks and handles leap February", () => {
    const days = calendarDays(2024, 1);
    expect(days).toHaveLength(35);
    expect(days.slice(0, 3)).toEqual([null, null, null]);
    expect(days.slice(3, 8)).toEqual([1, 2, 3, 4, 5]);
    expect(days.filter((day) => day !== null)).toEqual(Array.from({ length: 29 }, (_, index) => index + 1));
  });

  it("formats date and month keys for Spanish labels", () => {
    expect(formatDateKey("2026-08-01")).toBe("01/08/2026");
    expect(formatMonthKey("2026-08")).toBe("agosto de 2026");
    expect(formatMonthKey("2026-13")).toBe("");
  });

  it("parses only real ISO dates without timezone drift", () => {
    expect(dateFromKey("2026-08-31")).toEqual(new Date(2026, 7, 31));
    expect(dateFromKey("2026-02-29")).toBeNull();
    expect(dateFromKey("not-a-date")).toBeNull();
    expect(dateKey(2026, 7, 1)).toBe("2026-08-01");
  });
});
