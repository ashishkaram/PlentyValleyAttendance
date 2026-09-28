import { isActiveOn } from "./activePeriods";
import { computePlayerStats, isLowAttendance, type PlayerStats, type SessionForStats } from "./attendance";
import { addDays, isoWeekday, isWithin, maxDate, type ISODate } from "./dates";
import { comparePlayers } from "./players";
import { isInBreak } from "./sessions";
import type { ActivePeriod, AttendanceStatus, PlayerRecord, SeasonBreak } from "./types";

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/**
 * The report week (FR-10) containing a date: Wednesday to the following
 * Tuesday. `reportWeekday` is the ISO weekday the week starts on (3 = Wed).
 */
export function reportWeekContaining(date: ISODate, reportWeekday = 3): DateRange {
  const offset = (isoWeekday(date) - reportWeekday + 7) % 7;
  const start = addDays(date, -offset);
  return { start, end: addDays(start, 6) };
}

/** The most recent report week that has fully ended before `today`. */
export function lastCompletedReportWeek(today: ISODate, reportWeekday = 3): DateRange {
  const current = reportWeekContaining(today, reportWeekday);
  return reportWeekContaining(addDays(current.start, -1), reportWeekday);
}

/** True if every day of the range is inside a season break. */
export function isEntirelyInBreak(range: DateRange, breaks: SeasonBreak[]): boolean {
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    if (!isInBreak(d, breaks)) return false;
  }
  return true;
}

/** All report weeks overlapping the season, excluding weeks entirely in a break. */
export function seasonReportWeeks(
  season: { start_date: ISODate; end_date: ISODate; report_weekday: number },
  breaks: SeasonBreak[],
): DateRange[] {
  const weeks: DateRange[] = [];
  let week = reportWeekContaining(season.start_date, season.report_weekday);
  while (week.start <= season.end_date) {
    if (!isEntirelyInBreak(week, breaks)) weeks.push(week);
    week = { start: addDays(week.start, 7), end: addDays(week.end, 7) };
  }
  return weeks;
}

/**
 * The week the Reports page opens on: the most recent completed report week
 * that is in the season and not entirely within a break. Null before the
 * first week of the season has finished.
 */
export function defaultReportWeek(
  today: ISODate,
  season: { start_date: ISODate; end_date: ISODate; report_weekday: number },
  breaks: SeasonBreak[],
): DateRange | null {
  const completed = seasonReportWeeks(season, breaks).filter((w) => w.end < today);
  return completed.at(-1) ?? null;
}

export interface ReportPlayer extends Pick<PlayerRecord, "id" | "name" | "player_number" | "is_active"> {
  periods: ActivePeriod[];
}

export interface ReportRow {
  player: ReportPlayer;
  range: PlayerStats;
  season: PlayerStats;
  low: boolean;
}

export interface Report {
  range: DateRange;
  seasonRange: DateRange;
  rows: ReportRow[];
  /** Scheduled sessions in the range with attendance taken. */
  sessionsInRange: SessionForStats[];
}

/**
 * Build a report (FR-10, FR-11). Season-to-date runs from the season start to
 * the end of the report range. Includes every player active on at least one
 * scheduled session date in the range, including players now inactive.
 */
export function buildReport(args: {
  range: DateRange;
  seasonStart: ISODate;
  threshold: number;
  players: ReportPlayer[];
  sessions: SessionForStats[];
  /** player id -> (session id -> status) */
  attendance: ReadonlyMap<string, ReadonlyMap<string, AttendanceStatus>>;
}): Report {
  const { range, seasonStart, threshold, players, sessions, attendance } = args;
  const seasonRange = { start: seasonStart, end: maxDate(range.end, seasonStart) };
  const scheduledInRange = sessions.filter(
    (s) => s.status === "scheduled" && isWithin(s.date, range.start, range.end),
  );
  const empty = new Map<string, AttendanceStatus>();

  const rows = players
    .filter((p) => scheduledInRange.some((s) => isActiveOn(p.periods, s.date)))
    .sort(comparePlayers)
    .map((player) => {
      const att = attendance.get(player.id) ?? empty;
      const seasonStats = computePlayerStats(sessions, player.periods, att, seasonRange);
      return {
        player,
        range: computePlayerStats(sessions, player.periods, att, range),
        season: seasonStats,
        low: isLowAttendance(seasonStats.pct, threshold),
      };
    });

  return {
    range,
    seasonRange,
    rows,
    sessionsInRange: scheduledInRange.filter((s) => s.attendance_taken),
  };
}
