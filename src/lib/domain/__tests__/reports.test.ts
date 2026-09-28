import { describe, expect, it } from "vitest";
import { buildReport, defaultReportWeek, lastCompletedReportWeek, reportWeekContaining, seasonReportWeeks, type ReportPlayer } from "../reports";
import type { SessionForStats } from "../attendance";
import type { AttendanceStatus } from "../types";
import { CHRISTMAS, SEASON_2026 } from "./fixtures";

describe("report weeks", () => {
  it("runs Wednesday to the following Tuesday", () => {
    expect(reportWeekContaining("2026-10-01")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
    expect(reportWeekContaining("2026-09-30")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
    expect(reportWeekContaining("2026-10-06")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
  });

  it("on a Wednesday, covers the 7 days ending the previous day", () => {
    expect(lastCompletedReportWeek("2026-10-07")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
  });

  it("on a Tuesday, the current week is not yet complete", () => {
    expect(lastCompletedReportWeek("2026-10-13")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
  });

  it("is unaffected by the daylight-saving changes", () => {
    // DST starts Sun 4 Oct 2026 and ends Sun 4 Apr 2027 in Melbourne.
    expect(reportWeekContaining("2026-10-04")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
    expect(reportWeekContaining("2026-10-05")).toEqual({ start: "2026-09-30", end: "2026-10-06" });
    expect(reportWeekContaining("2027-04-04")).toEqual({ start: "2027-03-31", end: "2027-04-06" });
    expect(lastCompletedReportWeek("2027-04-07")).toEqual({ start: "2027-03-31", end: "2027-04-06" });
  });

  it("skips weeks that fall entirely within the break", () => {
    const weeks = seasonReportWeeks(SEASON_2026, [CHRISTMAS]);
    expect(weeks[0]).toEqual({ start: "2026-09-23", end: "2026-09-29" });
    expect(weeks.at(-1)).toEqual({ start: "2027-03-24", end: "2027-03-30" });
    // 16 Dec - 15 Jan: weeks starting 16 Dec, 23 Dec, 30 Dec, 6 Jan are entirely in the break.
    const starts = weeks.map((w) => w.start);
    expect(starts).toContain("2026-12-09");
    expect(starts).not.toContain("2026-12-16");
    expect(starts).not.toContain("2027-01-06");
    expect(starts).toContain("2027-01-13");
  });

  it("defaults to the most recent completed week, stepping back over the break", () => {
    expect(defaultReportWeek("2026-10-07", SEASON_2026, [CHRISTMAS])).toEqual({ start: "2026-09-30", end: "2026-10-06" });
    expect(defaultReportWeek("2027-01-01", SEASON_2026, [CHRISTMAS])).toEqual({ start: "2026-12-09", end: "2026-12-15" });
    expect(defaultReportWeek("2026-09-28", SEASON_2026, [CHRISTMAS])).toBeNull();
  });
});

describe("buildReport", () => {
  const sessions: SessionForStats[] = [
    { id: "s1", date: "2026-09-29", status: "scheduled", attendance_taken: true },
    { id: "s2", date: "2026-10-01", status: "scheduled", attendance_taken: true },
    { id: "s3", date: "2026-10-06", status: "scheduled", attendance_taken: true },
    { id: "s4", date: "2026-10-08", status: "cancelled", attendance_taken: false },
  ];
  const players: ReportPlayer[] = [
    { id: "a", name: "Amy", player_number: "10", is_active: true, periods: [{ start_date: "2026-09-29", end_date: null }] },
    { id: "b", name: "Bea", player_number: "2", is_active: false, periods: [{ start_date: "2026-09-29", end_date: "2026-10-01" }] },
    { id: "c", name: "Cat", player_number: null, is_active: true, periods: [{ start_date: "2026-10-08", end_date: null }] },
  ];
  const attendance = new Map<string, Map<string, AttendanceStatus>>([
    ["a", new Map<string, AttendanceStatus>([["s1", "present"], ["s2", "absent"], ["s3", "present"]])],
    ["b", new Map<string, AttendanceStatus>([["s1", "present"]])],
  ]);

  it("covers the week, season to date, and includes now-inactive players", () => {
    const report = buildReport({
      range: { start: "2026-09-30", end: "2026-10-06" },
      seasonStart: "2026-09-29",
      threshold: 75,
      players,
      sessions,
      attendance,
    });
    // Bea was not active on any session date in the week (she left on 1 Oct); Cat joined after.
    expect(report.rows.map((r) => r.player.id)).toEqual(["a"]);
    expect(report.rows[0].range).toMatchObject({ held: 2, present: 1, absent: 1, pct: 50 });
    expect(report.rows[0].season).toMatchObject({ held: 3, present: 2, pct: 67 });
    expect(report.rows[0].low).toBe(true);
  });

  it("sorts by number then name and includes inactive players active in the range", () => {
    const report = buildReport({
      range: { start: "2026-09-29", end: "2026-10-08" },
      seasonStart: "2026-09-29",
      threshold: 75,
      players,
      sessions,
      attendance,
    });
    // Cat's only session date (8 Oct) was cancelled, so she is not included.
    expect(report.rows.map((r) => r.player.id)).toEqual(["b", "a"]);
    expect(report.rows[0].season.pct).toBe(100);
    expect(report.rows[0].low).toBe(false);
  });
});
