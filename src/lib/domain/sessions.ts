import { addDays, isoWeekday, isWithin, type ISODate } from "./dates";
import type { SeasonBreak, SeasonSettings, SessionRecord } from "./types";

/** True if the date falls inside any break (inclusive at both ends). */
export function isInBreak(date: ISODate, breaks: SeasonBreak[]): boolean {
  return breaks.some((b) => isWithin(date, b.start_date, b.end_date));
}

/** True if the date is an expected session date (section 7.1). */
export function isExpectedSessionDate(
  date: ISODate,
  season: Pick<SeasonSettings, "start_date" | "end_date" | "training_weekdays">,
  breaks: SeasonBreak[],
): boolean {
  return (
    isWithin(date, season.start_date, season.end_date) &&
    season.training_weekdays.includes(isoWeekday(date)) &&
    !isInBreak(date, breaks)
  );
}

/** All expected session dates for a season, in date order. */
export function expectedSessionDates(
  season: Pick<SeasonSettings, "start_date" | "end_date" | "training_weekdays">,
  breaks: SeasonBreak[],
): ISODate[] {
  const dates: ISODate[] = [];
  if (season.start_date > season.end_date) return dates;
  for (let d = season.start_date; d <= season.end_date; d = addDays(d, 1)) {
    if (isExpectedSessionDate(d, season, breaks)) dates.push(d);
  }
  return dates;
}

export interface ExistingSession extends Pick<
  SessionRecord,
  "id" | "date" | "source" | "attendance_taken" | "needs_review"
> {
  /** Number of attendance rows recorded for the session. */
  attendance_count: number;
}

export interface RegenerationPlan {
  /** Dates that need a new `generated` session. */
  toAdd: ISODate[];
  /** Generated sessions with no attendance that are no longer expected. */
  toDelete: ExistingSession[];
  /** Generated sessions with attendance that are no longer expected. */
  toFlag: ExistingSession[];
  /**
   * Generated sessions previously flagged for review whose date is expected
   * again (e.g. a break was removed); their flag is cleared.
   */
  toUnflag: ExistingSession[];
}

/**
 * Plan a (re)generation run (section 7.1). Pure: the caller shows the plan to
 * the manager and applies it. Running it against its own result is a no-op.
 */
export function planRegeneration(
  season: Pick<SeasonSettings, "start_date" | "end_date" | "training_weekdays">,
  breaks: SeasonBreak[],
  existing: ExistingSession[],
): RegenerationPlan {
  const expected = expectedSessionDates(season, breaks);
  const expectedSet = new Set(expected);
  const existingDates = new Set(existing.map((s) => s.date));

  const plan: RegenerationPlan = {
    toAdd: expected.filter((d) => !existingDates.has(d)),
    toDelete: [],
    toFlag: [],
    toUnflag: [],
  };

  for (const s of existing) {
    if (s.source !== "generated") continue; // manual sessions are never touched
    if (expectedSet.has(s.date)) {
      if (s.needs_review) plan.toUnflag.push(s);
      continue;
    }
    const hasAttendance = s.attendance_count > 0 || s.attendance_taken;
    if (!hasAttendance) plan.toDelete.push(s);
    else if (!s.needs_review) plan.toFlag.push(s);
  }

  return plan;
}

export function isEmptyPlan(plan: RegenerationPlan): boolean {
  return (
    plan.toAdd.length === 0 &&
    plan.toDelete.length === 0 &&
    plan.toFlag.length === 0 &&
    plan.toUnflag.length === 0
  );
}

/**
 * The session the attendance form opens on by default (FR-08): today's
 * session, otherwise the most recent past session, otherwise the first
 * upcoming one.
 */
export function defaultAttendanceDate(
  sessionDates: ISODate[],
  today: ISODate,
): ISODate | null {
  const sorted = [...sessionDates].sort();
  if (sorted.length === 0) return null;
  if (sorted.includes(today)) return today;
  const past = sorted.filter((d) => d < today);
  if (past.length > 0) return past[past.length - 1];
  return sorted[0];
}
