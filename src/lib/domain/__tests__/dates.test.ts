import { describe, expect, it } from "vitest";
import { addDays, formatDisplayDate, isoWeekday, isValidISODate, todayInMelbourne } from "../dates";

describe("todayInMelbourne", () => {
  it("uses the Melbourne calendar date, not UTC or the machine's zone", () => {
    // 29 Sep 2026 23:30 UTC = 30 Sep 09:30 AEST
    expect(todayInMelbourne(new Date("2026-09-29T23:30:00Z"))).toBe("2026-09-30");
    expect(todayInMelbourne(new Date("2026-09-29T13:59:00Z"))).toBe("2026-09-29");
    expect(todayInMelbourne(new Date("2026-09-29T14:00:00Z"))).toBe("2026-09-30");
  });

  it("handles the start of daylight saving (Sun 4 Oct 2026, UTC+10 -> +11)", () => {
    expect(todayInMelbourne(new Date("2026-10-03T13:59:00Z"))).toBe("2026-10-03"); // 23:59 AEST
    expect(todayInMelbourne(new Date("2026-10-03T14:00:00Z"))).toBe("2026-10-04"); // 00:00 AEST
    expect(todayInMelbourne(new Date("2026-10-04T12:59:00Z"))).toBe("2026-10-04"); // 23:59 AEDT
    expect(todayInMelbourne(new Date("2026-10-04T13:00:00Z"))).toBe("2026-10-05"); // 00:00 AEDT
  });

  it("handles the end of daylight saving (Sun 4 Apr 2027, UTC+11 -> +10)", () => {
    expect(todayInMelbourne(new Date("2027-04-03T12:59:00Z"))).toBe("2027-04-03"); // 23:59 AEDT
    expect(todayInMelbourne(new Date("2027-04-03T13:00:00Z"))).toBe("2027-04-04"); // 00:00 AEDT
    expect(todayInMelbourne(new Date("2027-04-04T13:59:00Z"))).toBe("2027-04-04"); // 23:59 AEST
    expect(todayInMelbourne(new Date("2027-04-04T14:00:00Z"))).toBe("2027-04-05"); // 00:00 AEST
  });
});

describe("date arithmetic", () => {
  it("adds days across DST changes without drift", () => {
    expect(addDays("2026-10-03", 1)).toBe("2026-10-04");
    expect(addDays("2026-10-04", 1)).toBe("2026-10-05");
    expect(addDays("2027-04-04", 1)).toBe("2027-04-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("computes ISO weekdays", () => {
    expect(isoWeekday("2026-09-29")).toBe(2); // Tuesday
    expect(isoWeekday("2026-10-01")).toBe(4); // Thursday
    expect(isoWeekday("2026-10-04")).toBe(7); // Sunday
  });
  it("validates ISO dates", () => {
    expect(isValidISODate("2026-09-29")).toBe(true);
    expect(isValidISODate("2027-02-29")).toBe(false);
    expect(isValidISODate("29/09/2026")).toBe(false);
  });
  it("formats for display", () => {
    expect(formatDisplayDate("2026-09-29")).toBe("Tue 29 Sep 2026");
  });
});
