import { formatInTimeZone } from "date-fns-tz";

/**
 * All calendar dates in the app are ISO strings ("YYYY-MM-DD") with no time
 * component, matching Postgres `date`. Arithmetic is done in UTC on those
 * plain dates so daylight-saving changes can never shift a day.
 */
export type ISODate = string;

export const TIME_ZONE = "Australia/Melbourne";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

function toUTC(date: ISODate): Date {
  if (!isValidISODate(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt: Date): ISODate {
  return dt.toISOString().slice(0, 10);
}

export function makeISODate(year: number, month: number, day: number): ISODate {
  return fromUTC(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(date: ISODate, days: number): ISODate {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTC(dt);
}

/** ISO weekday: Monday = 1 ... Sunday = 7. */
export function isoWeekday(date: ISODate): number {
  const day = toUTC(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

/** Inclusive range check on ISO dates. */
export function isWithin(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

/** Today's calendar date in Melbourne for the given instant. */
export function todayInMelbourne(now: Date = new Date()): ISODate {
  return formatInTimeZone(now, TIME_ZONE, "yyyy-MM-dd");
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** e.g. "Tue 29 Sep 2026" */
export function formatDisplayDate(date: ISODate, withWeekday = true): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = `${d} ${MONTHS[m - 1]} ${y}`;
  return withWeekday ? `${WEEKDAYS[isoWeekday(date) - 1]} ${base}` : base;
}

/** e.g. "29/09/2026" (Australian format) */
export function formatShortDate(date: ISODate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
