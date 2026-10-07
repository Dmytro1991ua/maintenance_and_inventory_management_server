import { addDays, startOfUtcDay, toUtcDateString } from "../../../src/utils/date";

describe("startOfUtcDay", () => {
  it("should return midnight UTC of the same calendar day", () => {
    expect(startOfUtcDay(new Date("2026-11-14T17:45:30.123Z")).toISOString()).toBe(
      "2026-11-14T00:00:00.000Z",
    );
  });

  it("should leave a UTC midnight unchanged", () => {
    expect(startOfUtcDay(new Date("2026-11-14T00:00:00.000Z")).toISOString()).toBe(
      "2026-11-14T00:00:00.000Z",
    );
  });

  it("should not roll over at the last millisecond of the day", () => {
    expect(startOfUtcDay(new Date("2026-11-14T23:59:59.999Z")).toISOString()).toBe(
      "2026-11-14T00:00:00.000Z",
    );
  });

  it("should anchor a lead window that includes today's date however late it is", () => {
    // Late in the day "now" is past midnight; the anchor keeps today inside the window.
    const now = new Date("2026-11-14T22:00:00.000Z");
    const windowStart = startOfUtcDay(now);
    const expiresToday = new Date("2026-11-14T00:00:00.000Z");

    expect(expiresToday.getTime()).toBeLessThan(now.getTime());
    expect(expiresToday.getTime()).toBeGreaterThanOrEqual(windowStart.getTime());
    expect(addDays(windowStart, 30).toISOString()).toBe("2026-12-14T00:00:00.000Z");
  });
});

describe("toUtcDateString", () => {
  it("should format as YYYY-MM-DD in UTC", () => {
    expect(toUtcDateString(new Date("2026-11-14T00:00:00.000Z"))).toBe("2026-11-14");
  });

  it("should ignore the time of day", () => {
    expect(toUtcDateString(new Date("2026-11-14T23:59:59.999Z"))).toBe("2026-11-14");
  });

  it("should treat different times on the same day as equal", () => {
    expect(toUtcDateString(new Date("2026-11-14T00:00:00.000Z"))).toBe(
      toUtcDateString(new Date("2026-11-14T10:00:00.000Z")),
    );
  });
});
