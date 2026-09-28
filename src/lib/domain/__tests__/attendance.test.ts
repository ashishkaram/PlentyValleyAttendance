import { describe, expect, it } from "vitest";
import { attendancePercent, computePlayerStats, formatPercent, isLowAttendance, toggleStatus, type SessionForStats } from "../attendance";
import { expectedSessionDates } from "../sessions";
import type { ActivePeriod, AttendanceStatus } from "../types";
import { CHRISTMAS, SEASON_2026 } from "./fixtures";

const ALL_SEASON = { start: SEASON_2026.start_date, end: SEASON_2026.end_date };
const ALWAYS: ActivePeriod[] = [{ start_date: "2026-09-29", end_date: null }];

const seasonDates = expectedSessionDates(SEASON_2026, [CHRISTMAS]);
const first10 = seasonDates.slice(0, 10);

function sessions(dates: string[], overrides: Partial<SessionForStats> = {}): SessionForStats[] {
  return dates.map((date) => ({ id: date, date, status: "scheduled", attendance_taken: true, ...overrides }));
}

function marks(entries: [string, AttendanceStatus][]): Map<string, AttendanceStatus> {
  return new Map(entries);
}

/** Map the first N dates to statuses in order. */
function sequence(dates: string[], statuses: AttendanceStatus[]): Map<string, AttendanceStatus> {
  return marks(statuses.map((s, i) => [dates[i], s]));
}

describe("attendancePercent", () => {
  it("rounds half up with integer maths", () => {
    expect(attendancePercent(8, 10)).toBe(80);
    expect(attendancePercent(7, 8)).toBe(88); // 87.5
    expect(attendancePercent(1, 8)).toBe(13); // 12.5
    expect(attendancePercent(5, 8)).toBe(63); // 62.5
    expect(attendancePercent(2, 3)).toBe(67); // 66.7
    expect(attendancePercent(1, 3)).toBe(33); // 33.3
    expect(attendancePercent(0, 5)).toBe(0);
    expect(attendancePercent(5, 5)).toBe(100);
  });
  it("returns null (n/a) when nothing is counted", () => {
    expect(attendancePercent(0, 0)).toBeNull();
    expect(formatPercent(null)).toBe("n/a");
    expect(formatPercent(88)).toBe("88%");
  });
  it("never highlights n/a as low attendance", () => {
    expect(isLowAttendance(null, 75)).toBe(false);
    expect(isLowAttendance(74, 75)).toBe(true);
    expect(isLowAttendance(75, 75)).toBe(false);
  });
});

describe("computePlayerStats", () => {
  it("present 8 of 10 -> 80%", () => {
    const att = sequence(first10, ["present", "present", "present", "present", "present", "present", "present", "present", "absent", "absent"]);
    const stats = computePlayerStats(sessions(first10), ALWAYS, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 10, present: 8, excused: 0, absent: 2, counted: 10, pct: 80 });
  });

  it("present 7, excused 2, absent 1 -> 7/8 = 88%", () => {
    const att = sequence(first10, ["present", "present", "present", "present", "present", "present", "present", "excused", "excused", "absent"]);
    const stats = computePlayerStats(sessions(first10), ALWAYS, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 10, present: 7, excused: 2, absent: 1, counted: 8, pct: 88 });
  });

  it("does not penalise a player who joined mid-season for earlier sessions", () => {
    const joinedPeriods: ActivePeriod[] = [{ start_date: first10[5], end_date: null }];
    // Earlier sessions have no rows for her (she wasn't listed) - and even stray
    // "absent" rows before her start date are ignored.
    const att = sequence(first10, ["absent", "absent", "absent", "absent", "absent", "present", "present", "present", "present", "absent"]);
    const stats = computePlayerStats(sessions(first10), joinedPeriods, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 5, present: 4, absent: 1, counted: 5, pct: 80 });
  });

  it("does not count sessions on or after a deactivated player's end date", () => {
    const periods: ActivePeriod[] = [{ start_date: "2026-09-29", end_date: first10[4] }];
    const att = sequence(first10, ["present", "present", "present", "absent", "absent", "absent", "absent", "absent", "absent", "absent"]);
    const stats = computePlayerStats(sessions(first10), periods, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 4, present: 3, absent: 1, pct: 75 });
  });

  it("left and rejoined: gap sessions not counted, both periods are", () => {
    const periods: ActivePeriod[] = [
      { start_date: first10[0], end_date: first10[3] }, // sessions 0-2
      { start_date: first10[7], end_date: null }, // sessions 7-9
    ];
    const att = sequence(first10, ["present", "present", "absent", "absent", "absent", "absent", "absent", "present", "present", "present"]);
    const stats = computePlayerStats(sessions(first10), periods, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 6, present: 5, absent: 1, counted: 6, pct: 83 });
  });

  it("does not count a session where she was active but has no attendance row", () => {
    const att = sequence(first10, ["present", "present", "present", "present"]); // rows for 4 of 10
    const stats = computePlayerStats(sessions(first10), ALWAYS, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 4, counted: 4, pct: 100 });
  });

  it("ignores cancelled sessions and sessions where attendance was not taken", () => {
    const list = sessions(first10.slice(0, 4));
    list[0] = { ...list[0], status: "cancelled" };
    list[1] = { ...list[1], attendance_taken: false };
    const att = sequence(first10, ["absent", "absent", "present", "absent"]);
    const stats = computePlayerStats(list, ALWAYS, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 2, present: 1, absent: 1, pct: 50 });
  });

  it("all sessions excused -> n/a", () => {
    const att = sequence(first10, Array(10).fill("excused"));
    const stats = computePlayerStats(sessions(first10), ALWAYS, att, ALL_SEASON);
    expect(stats).toMatchObject({ held: 10, excused: 10, counted: 0, pct: null });
  });

  it("only counts sessions inside the date range", () => {
    const att = sequence(first10, Array(10).fill("present"));
    const stats = computePlayerStats(sessions(first10), ALWAYS, att, { start: first10[2], end: first10[3] });
    expect(stats.held).toBe(2);
  });
});

describe("toggleStatus", () => {
  it("makes Present and Excused mutually exclusive", () => {
    expect(toggleStatus("absent", "present")).toBe("present");
    expect(toggleStatus("excused", "present")).toBe("present");
    expect(toggleStatus("present", "excused")).toBe("excused");
    expect(toggleStatus("present", "present")).toBe("absent");
    expect(toggleStatus("excused", "excused")).toBe("absent");
  });
});
