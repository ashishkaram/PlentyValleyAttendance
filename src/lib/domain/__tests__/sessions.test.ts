import { describe, expect, it } from "vitest";
import { isoWeekday } from "../dates";
import {
  defaultAttendanceDate,
  expectedSessionDates,
  isEmptyPlan,
  planRegeneration,
  type ExistingSession,
} from "../sessions";
import { CHRISTMAS, SEASON_2026 } from "./fixtures";

/** Apply a plan to an in-memory session list, the way the database does. */
function apply(existing: ExistingSession[], plan: ReturnType<typeof planRegeneration>): ExistingSession[] {
  const deleted = new Set(plan.toDelete.map((s) => s.id));
  const flagged = new Set(plan.toFlag.map((s) => s.id));
  const unflagged = new Set(plan.toUnflag.map((s) => s.id));
  const kept = existing
    .filter((s) => !deleted.has(s.id))
    .map((s) => ({
      ...s,
      needs_review: flagged.has(s.id) ? true : unflagged.has(s.id) ? false : s.needs_review,
    }));
  const added = plan.toAdd.map((date) => ({
    id: `gen-${date}`,
    date,
    source: "generated" as const,
    attendance_taken: false,
    needs_review: false,
    attendance_count: 0,
  }));
  return [...kept, ...added].sort((a, b) => (a.date < b.date ? -1 : 1));
}

describe("expectedSessionDates", () => {
  const dates = expectedSessionDates(SEASON_2026, [CHRISTMAS]);

  it("produces exactly 44 sessions for 2026-27", () => {
    expect(dates).toHaveLength(44);
  });

  it("has the expected first, last and break-boundary dates", () => {
    expect(dates[0]).toBe("2026-09-29");
    expect(dates.at(-1)).toBe("2027-03-30");
    expect(dates.filter((d) => d < CHRISTMAS.start_date).at(-1)).toBe("2026-12-15");
    expect(dates.find((d) => d > CHRISTMAS.end_date)).toBe("2027-01-19");
  });

  it("has no sessions from 16 Dec 2026 to 15 Jan 2027", () => {
    expect(dates.filter((d) => d >= "2026-12-16" && d <= "2027-01-15")).toEqual([]);
  });

  it("only includes Tuesdays and Thursdays", () => {
    expect(dates.every((d) => [2, 4].includes(isoWeekday(d)))).toBe(true);
  });

  it("has 53 Tue/Thu dates without the break (9 in the break)", () => {
    expect(expectedSessionDates(SEASON_2026, [])).toHaveLength(53);
  });

  it("is unaffected by the daylight-saving changes (4 Oct 2026, 4 Apr 2027)", () => {
    expect(dates.filter((d) => d >= "2026-09-29" && d <= "2026-10-08")).toEqual([
      "2026-09-29",
      "2026-10-01",
      "2026-10-06",
      "2026-10-08",
    ]);
    const extended = expectedSessionDates({ ...SEASON_2026, end_date: "2027-04-10" }, [CHRISTMAS]);
    expect(extended.filter((d) => d >= "2027-03-30")).toEqual([
      "2027-03-30",
      "2027-04-01",
      "2027-04-06",
      "2027-04-08",
    ]);
  });
});

describe("planRegeneration", () => {
  it("generates all 44 sessions on first setup", () => {
    const plan = planRegeneration(SEASON_2026, [CHRISTMAS], []);
    expect(plan.toAdd).toHaveLength(44);
    expect(plan.toDelete).toHaveLength(0);
  });

  it("is idempotent: running twice creates no duplicates", () => {
    const first = apply([], planRegeneration(SEASON_2026, [CHRISTMAS], []));
    const second = planRegeneration(SEASON_2026, [CHRISTMAS], first);
    expect(isEmptyPlan(second)).toBe(true);
    const after = apply(first, second);
    expect(after).toHaveLength(44);
    expect(new Set(after.map((s) => s.date)).size).toBe(44);
  });

  it("adding a break deletes empty sessions in it and flags ones with attendance", () => {
    let sessions = apply([], planRegeneration(SEASON_2026, [CHRISTMAS], []));
    sessions = sessions.map((s) =>
      s.date === "2026-11-03" ? { ...s, attendance_taken: true, attendance_count: 20 } : s,
    );
    const cup = { name: "Cup week", start_date: "2026-11-02", end_date: "2026-11-06" };
    const plan = planRegeneration(SEASON_2026, [CHRISTMAS, cup], sessions);
    expect(plan.toAdd).toEqual([]);
    expect(plan.toDelete.map((s) => s.date)).toEqual(["2026-11-05"]);
    expect(plan.toFlag.map((s) => s.date)).toEqual(["2026-11-03"]);

    const after = apply(sessions, plan);
    expect(after).toHaveLength(43);
    expect(after.find((s) => s.date === "2026-11-03")?.needs_review).toBe(true);
    // Re-running does not re-flag or delete the kept session.
    expect(isEmptyPlan(planRegeneration(SEASON_2026, [CHRISTMAS, cup], after))).toBe(true);
  });

  it("keeps a session that has attendance rows even if attendance_taken is false", () => {
    const sessions = apply([], planRegeneration(SEASON_2026, [CHRISTMAS], [])).map((s) =>
      s.date === "2026-11-05" ? { ...s, attendance_count: 1 } : s,
    );
    const plan = planRegeneration(SEASON_2026, [CHRISTMAS, { name: "x", start_date: "2026-11-05", end_date: "2026-11-05" }], sessions);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toFlag.map((s) => s.date)).toEqual(["2026-11-05"]);
  });

  it("never touches a manual session inside a new break", () => {
    const sessions: ExistingSession[] = [
      ...apply([], planRegeneration(SEASON_2026, [CHRISTMAS], [])),
      { id: "manual-1", date: "2026-11-04", source: "manual", attendance_taken: false, needs_review: false, attendance_count: 0 },
    ];
    const cup = { name: "Cup week", start_date: "2026-11-02", end_date: "2026-11-06" };
    const plan = planRegeneration(SEASON_2026, [CHRISTMAS, cup], sessions);
    const touched = [...plan.toDelete, ...plan.toFlag, ...plan.toUnflag].map((s) => s.id);
    expect(touched).not.toContain("manual-1");
  });

  it("does not generate a session on a date that already has a manual session", () => {
    const sessions: ExistingSession[] = [
      { id: "manual-1", date: "2026-09-29", source: "manual", attendance_taken: false, needs_review: false, attendance_count: 0 },
    ];
    const plan = planRegeneration(SEASON_2026, [CHRISTMAS], sessions);
    expect(plan.toAdd).not.toContain("2026-09-29");
    expect(plan.toAdd).toHaveLength(43);
  });

  it("changing the season end date removes empty sessions beyond it", () => {
    const sessions = apply([], planRegeneration(SEASON_2026, [CHRISTMAS], []));
    const plan = planRegeneration({ ...SEASON_2026, end_date: "2027-03-23" }, [CHRISTMAS], sessions);
    expect(plan.toDelete.map((s) => s.date)).toEqual(["2027-03-25", "2027-03-30"]);
  });

  it("clears the review flag when a flagged date becomes expected again", () => {
    const sessions: ExistingSession[] = [
      { id: "g1", date: "2026-11-03", source: "generated", attendance_taken: true, needs_review: true, attendance_count: 5 },
    ];
    const plan = planRegeneration(SEASON_2026, [CHRISTMAS], sessions);
    expect(plan.toUnflag.map((s) => s.id)).toEqual(["g1"]);
  });
});

describe("defaultAttendanceDate", () => {
  const dates = ["2026-09-29", "2026-10-01", "2026-10-06"];
  it("opens on today's session", () => {
    expect(defaultAttendanceDate(dates, "2026-10-01")).toBe("2026-10-01");
  });
  it("falls back to the most recent past session", () => {
    expect(defaultAttendanceDate(dates, "2026-10-04")).toBe("2026-10-01");
  });
  it("falls back to the first session before the season starts", () => {
    expect(defaultAttendanceDate(dates, "2026-09-28")).toBe("2026-09-29");
  });
  it("returns null with no sessions", () => {
    expect(defaultAttendanceDate([], "2026-09-28")).toBeNull();
  });
});
