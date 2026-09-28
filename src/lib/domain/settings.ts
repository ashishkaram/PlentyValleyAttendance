import { isValidISODate } from "./dates";
import type { SeasonBreak, SeasonSettings } from "./types";

export interface SeasonDraft extends SeasonSettings {
  name: string;
}

export interface BreakDraft extends SeasonBreak {
  id?: string;
}

export const DEFAULT_SEASON: SeasonDraft = {
  name: "2026-27",
  start_date: "2026-09-29",
  end_date: "2027-03-30",
  training_weekdays: [2, 4],
  report_weekday: 3,
  low_attendance_threshold: 75,
};

export const DEFAULT_BREAKS: BreakDraft[] = [
  { name: "Christmas break", start_date: "2026-12-16", end_date: "2027-01-15" },
];

/** Returns a list of problems with the settings; empty when valid. */
export function validateSettings(season: SeasonDraft, breaks: BreakDraft[]): string[] {
  const errors: string[] = [];
  if (!season.name.trim()) errors.push("Season name is required.");
  if (season.name.trim().length > 50) errors.push("Season name must be 50 characters or fewer.");
  if (!isValidISODate(season.start_date)) errors.push("Enter a valid season start date.");
  if (!isValidISODate(season.end_date)) errors.push("Enter a valid season end date.");
  if (isValidISODate(season.start_date) && isValidISODate(season.end_date) && season.end_date < season.start_date)
    errors.push("The season must end on or after its start date.");
  if (season.training_weekdays.length === 0) errors.push("Choose at least one training day.");
  if (season.training_weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) errors.push("Invalid training day.");
  if (!Number.isInteger(season.report_weekday) || season.report_weekday < 1 || season.report_weekday > 7)
    errors.push("Invalid report day.");
  if (
    !Number.isInteger(season.low_attendance_threshold) ||
    season.low_attendance_threshold < 0 ||
    season.low_attendance_threshold > 100
  )
    errors.push("The low-attendance threshold must be a whole number from 0 to 100.");

  breaks.forEach((b, i) => {
    const label = b.name.trim() || `Break ${i + 1}`;
    if (!b.name.trim()) errors.push(`Break ${i + 1} needs a name.`);
    if (b.name.trim().length > 100) errors.push(`${label}: name must be 100 characters or fewer.`);
    if (!isValidISODate(b.start_date) || !isValidISODate(b.end_date)) errors.push(`${label}: enter valid dates.`);
    else if (b.end_date < b.start_date) errors.push(`${label}: the end date must be on or after the start date.`);
  });
  return errors;
}
