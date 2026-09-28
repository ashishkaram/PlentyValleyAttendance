import "server-only";
import {
  getAttendanceForSessions,
  getBreaks,
  getPlayersWithPeriods,
  getSeason,
  getSessions,
  type Supabase,
} from "./data";
import { isValidISODate, todayInMelbourne } from "./domain/dates";
import {
  buildReport,
  defaultReportWeek,
  isEntirelyInBreak,
  reportWeekContaining,
  seasonReportWeeks,
  type DateRange,
} from "./domain/reports";
import type { AttendanceStatus } from "./domain/types";

export type ReportRequest =
  | { kind: "week"; start?: string }
  | { kind: "range"; start: string; end: string };

/** Parse report search params: ?week=YYYY-MM-DD or ?start=..&end=.. */
export function parseReportParams(params: Record<string, string | string[] | undefined>): ReportRequest {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const start = one("start");
  const end = one("end");
  if (start && end) return { kind: "range", start, end };
  return { kind: "week", start: one("week") };
}

export async function loadReport(supabase: Supabase, request: ReportRequest) {
  const season = await getSeason(supabase);
  if (!season) return { status: "no-season" as const };
  const breaks = await getBreaks(supabase, season.id);
  const today = todayInMelbourne();
  const weeks = seasonReportWeeks(season, breaks);

  let range: DateRange | null;
  if (request.kind === "range") {
    if (!isValidISODate(request.start) || !isValidISODate(request.end))
      return { status: "error" as const, season, weeks, message: "Enter valid start and end dates." };
    if (request.end < request.start)
      return { status: "error" as const, season, weeks, message: "The end date must be on or after the start date." };
    range = { start: request.start, end: request.end };
  } else if (request.start && isValidISODate(request.start)) {
    range = reportWeekContaining(request.start, season.report_weekday);
    if (isEntirelyInBreak(range, breaks))
      return { status: "break" as const, season, weeks, range };
  } else {
    range = defaultReportWeek(today, season, breaks);
    if (!range) return { status: "not-yet" as const, season, weeks };
  }

  const [sessions, players] = await Promise.all([getSessions(supabase, season.id), getPlayersWithPeriods(supabase)]);
  const rows = await getAttendanceForSessions(
    supabase,
    sessions.filter((s) => s.date <= range.end).map((s) => s.id),
  );
  const attendance = new Map<string, Map<string, AttendanceStatus>>();
  for (const r of rows) {
    if (!attendance.has(r.player_id)) attendance.set(r.player_id, new Map());
    attendance.get(r.player_id)!.set(r.session_id, r.status);
  }

  const report = buildReport({
    range,
    seasonStart: season.start_date,
    threshold: season.low_attendance_threshold,
    players,
    sessions,
    attendance,
  });
  return { status: "ok" as const, season, weeks, report, isWeek: request.kind === "week", today };
}
