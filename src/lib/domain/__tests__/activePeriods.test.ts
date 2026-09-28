import { describe, expect, it } from "vitest";
import {
  isActiveOn,
  planDeactivation,
  validateActiveFrom,
  validateFirstStartDate,
  validatePeriods,
  validateReactivation,
} from "../activePeriods";
import type { ActivePeriod } from "../types";
import { SEASON_2026 } from "./fixtures";

const leftAndRejoined: ActivePeriod[] = [
  { start_date: "2026-09-29", end_date: "2026-10-20" },
  { start_date: "2026-11-10", end_date: null },
];

describe("isActiveOn", () => {
  it("includes the start date and excludes the end date", () => {
    const periods: ActivePeriod[] = [{ start_date: "2026-10-06", end_date: "2026-10-20" }];
    expect(isActiveOn(periods, "2026-10-05")).toBe(false);
    expect(isActiveOn(periods, "2026-10-06")).toBe(true);
    expect(isActiveOn(periods, "2026-10-19")).toBe(true);
    expect(isActiveOn(periods, "2026-10-20")).toBe(false);
  });

  it("treats a null end date as still active", () => {
    expect(isActiveOn([{ start_date: "2026-09-29", end_date: null }], "2027-03-30")).toBe(true);
  });

  it("handles a gap between periods", () => {
    expect(isActiveOn(leftAndRejoined, "2026-10-15")).toBe(true);
    expect(isActiveOn(leftAndRejoined, "2026-10-27")).toBe(false);
    expect(isActiveOn(leftAndRejoined, "2026-11-10")).toBe(true);
  });

  it("is false with no periods", () => {
    expect(isActiveOn([], "2026-10-01")).toBe(false);
  });
});

describe("validatePeriods", () => {
  it("accepts non-overlapping periods", () => {
    expect(validatePeriods(leftAndRejoined)).toEqual([]);
  });
  it("accepts a period starting on the previous period's end date", () => {
    expect(
      validatePeriods([
        { start_date: "2026-09-29", end_date: "2026-10-20" },
        { start_date: "2026-10-20", end_date: null },
      ]),
    ).toEqual([]);
  });
  it("rejects overlaps, two open periods and end <= start", () => {
    expect(validatePeriods([{ start_date: "2026-10-01", end_date: "2026-10-01" }])).not.toEqual([]);
    expect(
      validatePeriods([
        { start_date: "2026-09-29", end_date: null },
        { start_date: "2026-10-29", end_date: null },
      ]).length,
    ).toBeGreaterThan(0);
    expect(
      validatePeriods([
        { start_date: "2026-09-29", end_date: "2026-10-21" },
        { start_date: "2026-10-20", end_date: null },
      ]).length,
    ).toBeGreaterThan(0);
  });
});

describe("planDeactivation", () => {
  it("closes the open period with end_date = today", () => {
    expect(planDeactivation([{ id: "p1", start_date: "2026-09-29", end_date: null }], "2026-10-14")).toEqual({
      ok: true,
      change: { kind: "close", periodId: "p1", end_date: "2026-10-14" },
    });
  });
  it("removes an open period that starts today or later", () => {
    expect(planDeactivation([{ id: "p1", start_date: "2026-10-14", end_date: null }], "2026-10-14")).toEqual({
      ok: true,
      change: { kind: "delete", periodId: "p1" },
    });
  });
  it("refuses when already inactive", () => {
    expect(planDeactivation([{ start_date: "2026-09-29", end_date: "2026-10-01" }], "2026-10-14").ok).toBe(false);
  });
});

describe("validateReactivation", () => {
  const closed: ActivePeriod[] = [{ start_date: "2026-09-29", end_date: "2026-10-20" }];
  it("allows a start on or after the previous end", () => {
    expect(validateReactivation(closed, "2026-10-20", SEASON_2026.start_date)).toBeNull();
    expect(validateReactivation(closed, "2026-11-10", SEASON_2026.start_date)).toBeNull();
  });
  it("rejects a start before the previous end", () => {
    expect(validateReactivation(closed, "2026-10-19", SEASON_2026.start_date)).not.toBeNull();
  });
  it("rejects when already active", () => {
    expect(validateReactivation(leftAndRejoined, "2026-12-01", SEASON_2026.start_date)).not.toBeNull();
  });
});

describe("validateFirstStartDate / validateActiveFrom", () => {
  it("allows backdating to the season start but not before", () => {
    const periods: ActivePeriod[] = [{ start_date: "2026-10-06", end_date: null }];
    expect(validateFirstStartDate(periods, "2026-09-29", SEASON_2026.start_date)).toBeNull();
    expect(validateFirstStartDate(periods, "2026-09-28", SEASON_2026.start_date)).not.toBeNull();
    expect(validateActiveFrom("2026-09-29", SEASON_2026)).toBeNull();
    expect(validateActiveFrom("2026-09-28", SEASON_2026)).not.toBeNull();
    expect(validateActiveFrom("2027-03-31", SEASON_2026)).not.toBeNull();
    expect(validateActiveFrom("2026-02-30", SEASON_2026)).not.toBeNull();
  });
  it("does not let the first period start on or after its end", () => {
    expect(validateFirstStartDate(leftAndRejoined, "2026-10-20", SEASON_2026.start_date)).not.toBeNull();
  });
});
