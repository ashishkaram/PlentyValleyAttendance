import { isValidISODate, type ISODate } from "./dates";
import type { ActivePeriod } from "./types";

/** Active on date D if start_date <= D and (end_date is null or D < end_date). */
export function isActiveOn(periods: ActivePeriod[], date: ISODate): boolean {
  return periods.some(
    (p) => p.start_date <= date && (p.end_date === null || date < p.end_date),
  );
}

export function sortPeriods<T extends ActivePeriod>(periods: T[]): T[] {
  return [...periods].sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
}

export function openPeriod<T extends ActivePeriod>(periods: T[]): T | undefined {
  return periods.find((p) => p.end_date === null);
}

/** Returns a list of problems; empty when the periods are valid. */
export function validatePeriods(periods: ActivePeriod[]): string[] {
  const errors: string[] = [];
  for (const p of periods) {
    if (!isValidISODate(p.start_date)) errors.push(`Invalid start date ${p.start_date}`);
    if (p.end_date !== null && !isValidISODate(p.end_date))
      errors.push(`Invalid end date ${p.end_date}`);
    if (p.end_date !== null && p.end_date <= p.start_date)
      errors.push(`End date ${p.end_date} must be after start date ${p.start_date}`);
  }
  if (periods.filter((p) => p.end_date === null).length > 1)
    errors.push("Only one open period is allowed");
  const sorted = sortPeriods(periods);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.end_date === null || prev.end_date > sorted[i].start_date)
      errors.push(`Periods starting ${prev.start_date} and ${sorted[i].start_date} overlap`);
  }
  return errors;
}

export type PeriodChange =
  | { kind: "close"; periodId?: string; end_date: ISODate }
  | { kind: "delete"; periodId?: string }
  | { kind: "open"; start_date: ISODate };

/**
 * Deactivate (FR-05): close the open period with end_date = today. If the
 * open period starts today or later she was never in the squad under it, so
 * it is removed instead (end_date must be after start_date).
 */
export function planDeactivation(
  periods: ActivePeriod[],
  today: ISODate,
): { ok: true; change: PeriodChange } | { ok: false; error: string } {
  const open = openPeriod(periods);
  if (!open) return { ok: false, error: "Player is already inactive" };
  if (open.start_date >= today) return { ok: true, change: { kind: "delete", periodId: open.id } };
  return { ok: true, change: { kind: "close", periodId: open.id, end_date: today } };
}

/**
 * Reactivate (FR-05): open a new period. The start date may not be before the
 * end of her previous period, nor before the season start.
 */
export function validateReactivation(
  periods: ActivePeriod[],
  startDate: ISODate,
  seasonStart: ISODate,
): string | null {
  if (!isValidISODate(startDate)) return "Enter a valid date";
  if (openPeriod(periods)) return "Player is already active";
  if (startDate < seasonStart) return "Date cannot be before the season start";
  const lastEnd = sortPeriods(periods).at(-1)?.end_date;
  if (lastEnd && startDate < lastEnd)
    return "Date cannot be before the end of her previous period";
  return null;
}

/** Validate a new start date for her first period (FR-04, fix a joining date). */
export function validateFirstStartDate(
  periods: ActivePeriod[],
  newStart: ISODate,
  seasonStart: ISODate,
): string | null {
  if (!isValidISODate(newStart)) return "Enter a valid date";
  if (newStart < seasonStart) return "Date cannot be before the season start";
  const first = sortPeriods(periods)[0];
  if (!first) return "Player has no active periods";
  if (first.end_date !== null && newStart >= first.end_date)
    return "Start date must be before the end of that period";
  return null;
}

/** Validate an "Active from" date for a new player (FR-02, FR-03). */
export function validateActiveFrom(
  date: ISODate,
  season: { start_date: ISODate; end_date: ISODate },
): string | null {
  if (!isValidISODate(date)) return "Invalid date";
  if (date < season.start_date) return "Date is before the season start";
  if (date > season.end_date) return "Date is after the season end";
  return null;
}
