import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, PageHeader } from "@/components/ui";
import {
  getAttendanceForSessions,
  getDisplayNames,
  getPlayersWithPeriods,
  getSeason,
  getSessionByDate,
  getSessions,
  requireManager,
} from "@/lib/data";
import { isActiveOn } from "@/lib/domain/activePeriods";
import { formatDisplayDate, isValidISODate, todayInMelbourne } from "@/lib/domain/dates";
import { comparePlayers } from "@/lib/domain/players";
import { AttendanceForm } from "./AttendanceForm";
import { SessionPicker } from "./SessionPicker";

export const metadata: Metadata = { title: "Attendance" };

const TIME_FMT = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AttendancePage({ params }: PageProps<"/attendance/[date]">) {
  const { date } = await params;
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  if (!season) return <Alert kind="warning">Set up the season in Settings first.</Alert>;
  if (!isValidISODate(date)) return <Alert kind="error">That is not a valid date.</Alert>;

  const [allSessions, session] = await Promise.all([getSessions(supabase, season.id), getSessionByDate(supabase, season.id, date)]);
  const today = todayInMelbourne();
  const picker = <SessionPicker dates={allSessions.map((s) => ({ date: s.date, cancelled: s.status === "cancelled", taken: s.attendance_taken }))} current={date} />;

  if (!session) {
    return (
      <>
        <PageHeader title="Attendance" />
        <div className="space-y-4">
          {picker}
          <Alert kind="info">There is no session on {formatDisplayDate(date)}. Choose a session above, or add an extra session on the <Link className="underline" href="/sessions">Sessions page</Link>.</Alert>
        </div>
      </>
    );
  }

  const [players, rows, names] = await Promise.all([
    getPlayersWithPeriods(supabase),
    getAttendanceForSessions(supabase, [session.id]),
    getDisplayNames(supabase),
  ]);
  const listed = players.filter((p) => isActiveOn(p.periods, date)).sort(comparePlayers);
  const recorded = Object.fromEntries(rows.map((r) => [r.player_id, r.status]));
  const lastEdit = rows.reduce<(typeof rows)[number] | null>((a, r) => (!a || r.updated_at > a.updated_at ? r : a), null);

  return (
    <>
      <PageHeader title={formatDisplayDate(date)}>
        {date === today && <Badge tone="blue">Today</Badge>}
        {session.source === "manual" && <Badge>Extra session</Badge>}
        {session.attendance_taken ? <Badge tone="green">Saved</Badge> : <Badge tone="amber">Not taken yet</Badge>}
      </PageHeader>
      <div className="space-y-4">
        {picker}
        {session.needs_review && (
          <Alert kind="warning">
            This date is no longer a regular training date. Keep or cancel it on the <Link className="font-semibold underline" href="/sessions?filter=review">Sessions page</Link>.
          </Alert>
        )}
        {date > today && <Alert kind="info">This session is in the future.</Alert>}
        {lastEdit && (
          <p className="text-sm text-slate-700">
            Last edited by {names.get(lastEdit.updated_by ?? "") ?? "unknown"} on {TIME_FMT.format(new Date(lastEdit.updated_at))}
          </p>
        )}
        {session.status === "cancelled" ? (
          <Alert kind="warning">
            This session was cancelled{session.note ? `: ${session.note}` : "."} To record attendance, un-cancel it on the{" "}
            <Link className="font-semibold underline" href="/sessions">Sessions page</Link>.
          </Alert>
        ) : listed.length === 0 ? (
          <Alert kind="info">
            No players were in the squad on this date. <Link className="font-semibold underline" href="/players">Add players</Link> first.
          </Alert>
        ) : (
          <AttendanceForm
            key={session.id}
            sessionId={session.id}
            attendanceTaken={session.attendance_taken}
            players={listed.map((p) => ({ id: p.id, name: p.name, player_number: p.player_number }))}
            recorded={recorded}
          />
        )}
      </div>
    </>
  );
}
