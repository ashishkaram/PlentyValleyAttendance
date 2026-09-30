import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { ISODate } from "./domain/dates";
import type {
  ActivePeriod,
  AttendanceStatus,
  PlayerRecord,
  SeasonBreak,
  SeasonSettings,
  SessionRecord,
} from "./domain/types";
import { createClient } from "./supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface Profile {
  user_id: string;
  display_name: string;
  role: "manager" | "committee" | "coach";
}

export interface Season extends SeasonSettings {
  id: string;
  name: string;
}

export interface SeasonBreakRow extends SeasonBreak {
  id: string;
  season_id: string;
}

export interface SessionRow extends SessionRecord {
  season_id: string;
  note: string | null;
}

export interface PeriodRow extends ActivePeriod {
  id: string;
  player_id: string;
}

export interface PlayerWithPeriods extends PlayerRecord {
  periods: PeriodRow[];
}

export interface AttendanceRow {
  session_id: string;
  player_id: string;
  status: AttendanceStatus;
  updated_at: string;
  updated_by: string | null;
}

/** The signed-in user and their profile, or a redirect to /login. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, role")
    .eq("user_id", data.user.id)
    .maybeSingle<Profile>();
  return { supabase, user: data.user, profile };
});

/** For pages and actions that only the manager may use (MVP: all of them). */
export async function requireManager() {
  const viewer = await getViewer();
  if (viewer.profile?.role !== "manager") redirect("/no-access");
  return viewer;
}

/** Page through a query to get past PostgREST's default 1000-row limit. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

/** The current season (MVP: one season; the schema supports more). */
export async function getSeason(supabase: Supabase): Promise<Season | null> {
  const { data, error } = await supabase
    .from("season")
    .select("id, name, start_date, end_date, training_weekdays, report_weekday, low_attendance_threshold")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle<Season>();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBreaks(supabase: Supabase, seasonId: string): Promise<SeasonBreakRow[]> {
  const { data, error } = await supabase
    .from("season_breaks")
    .select("id, season_id, name, start_date, end_date")
    .eq("season_id", seasonId)
    .order("start_date");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSessions(supabase: Supabase, seasonId: string): Promise<SessionRow[]> {
  return fetchAll<SessionRow>((from, to) =>
    supabase
      .from("sessions")
      .select("id, season_id, date, source, status, note, attendance_taken, needs_review")
      .eq("season_id", seasonId)
      .order("date")
      .range(from, to),
  );
}

export async function getSessionByDate(
  supabase: Supabase,
  seasonId: string,
  date: ISODate,
): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, season_id, date, source, status, note, attendance_taken, needs_review")
    .eq("season_id", seasonId)
    .eq("date", date)
    .maybeSingle<SessionRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPlayersWithPeriods(supabase: Supabase): Promise<PlayerWithPeriods[]> {
  const [players, periods] = await Promise.all([
    fetchAll<PlayerRecord>((from, to) =>
      supabase.from("players").select("id, name, player_number, is_active").order("name").range(from, to),
    ),
    fetchAll<PeriodRow>((from, to) =>
      supabase
        .from("player_active_periods")
        .select("id, player_id, start_date, end_date")
        .order("start_date")
        .range(from, to),
    ),
  ]);
  const byPlayer = new Map<string, PeriodRow[]>();
  for (const p of periods) byPlayer.set(p.player_id, [...(byPlayer.get(p.player_id) ?? []), p]);
  return players.map((p) => ({ ...p, periods: byPlayer.get(p.id) ?? [] }));
}

export async function getAttendanceForSessions(
  supabase: Supabase,
  sessionIds: string[],
): Promise<AttendanceRow[]> {
  const rows: AttendanceRow[] = [];
  // Chunk the id list to keep URLs short.
  for (let i = 0; i < sessionIds.length; i += 100) {
    const chunk = sessionIds.slice(i, i + 100);
    rows.push(
      ...(await fetchAll<AttendanceRow>((from, to) =>
        supabase
          .from("attendance")
          .select("session_id, player_id, status, updated_at, updated_by")
          .in("session_id", chunk)
          .order("id")
          .range(from, to),
      )),
    );
  }
  return rows;
}

/** Number of attendance records per player id (all seasons). */
export async function getAttendanceCountsByPlayer(supabase: Supabase): Promise<Map<string, number>> {
  const rows = await fetchAll<{ player_id: string }>((from, to) =>
    supabase.from("attendance").select("player_id").order("id").range(from, to),
  );
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.player_id, (counts.get(r.player_id) ?? 0) + 1);
  return counts;
}

/** Count of attendance rows per session id. */
export function countBySession(rows: Pick<AttendanceRow, "session_id">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + 1);
  return counts;
}

/** Display names for audit info. */
export async function getDisplayNames(supabase: Supabase): Promise<Map<string, string>> {
  const { data } = await supabase.from("profiles").select("user_id, display_name");
  return new Map((data ?? []).map((p) => [p.user_id as string, (p.display_name as string) || "Manager"]));
}
