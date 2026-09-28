import Link from "next/link";
import { Alert, Badge, Card, LinkButton } from "@/components/ui";
import { getBreaks, getSeason, getSessions, requireManager } from "@/lib/data";
import { formatDisplayDate, todayInMelbourne } from "@/lib/domain/dates";
import { defaultReportWeek } from "@/lib/domain/reports";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { supabase } = await requireManager();
  const { password } = await searchParams;
  const today = todayInMelbourne();
  const season = await getSeason(supabase);

  if (!season) {
    return (
      <Card>
        <h1 className="mb-2 text-2xl font-bold">Welcome</h1>
        <p className="mb-4">No season has been set up yet.</p>
        <LinkButton href="/settings">Set up the season</LinkButton>
      </Card>
    );
  }

  const [sessions, breaks] = await Promise.all([getSessions(supabase, season.id), getBreaks(supabase, season.id)]);
  const todaySession = sessions.find((s) => s.date === today);
  const nextSession = sessions.find((s) => s.date > today && s.status === "scheduled");
  const reviewCount = sessions.filter((s) => s.needs_review).length;
  const untaken = sessions.filter((s) => s.date < today && s.status === "scheduled" && !s.attendance_taken);
  const week = defaultReportWeek(today, season, breaks);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{formatDisplayDate(today)}</h1>
      {password === "updated" && <Alert kind="success">Your password has been changed.</Alert>}

      {sessions.length === 0 && (
        <Alert kind="warning">
          No sessions have been generated for {season.name}.{" "}
          <Link href="/settings" className="font-semibold underline">
            Generate them in Settings
          </Link>
          .
        </Alert>
      )}

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Today&apos;s session</h2>
        {todaySession ? (
          todaySession.status === "cancelled" ? (
            <p>
              Today&apos;s session is <Badge tone="red">Cancelled</Badge> {todaySession.note}
            </p>
          ) : (
            <div className="space-y-3">
              <p>
                Training today.{" "}
                {todaySession.attendance_taken ? <Badge tone="green">Attendance saved</Badge> : <Badge tone="amber">Not taken yet</Badge>}
              </p>
              <LinkButton href={`/attendance/${today}`} className="w-full sm:w-auto">
                {todaySession.attendance_taken ? "Review attendance" : "Take attendance"}
              </LinkButton>
            </div>
          )
        ) : (
          <p>
            No training today.
            {nextSession && <> Next session: {formatDisplayDate(nextSession.date)}.</>}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Weekly report</h2>
        {week ? (
          <LinkButton href="/reports" variant="secondary">
            View report for {formatDisplayDate(week.start, false)} – {formatDisplayDate(week.end, false)}
          </LinkButton>
        ) : (
          <p>The first weekly report will be ready after the first week of the season.</p>
        )}
      </Card>

      {(reviewCount > 0 || untaken.length > 0) && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Needs attention</h2>
          <ul className="space-y-2">
            {reviewCount > 0 && (
              <li>
                <Link href="/sessions?filter=review" className="font-semibold text-brand-700 underline">
                  {reviewCount} session{reviewCount === 1 ? "" : "s"} need{reviewCount === 1 ? "s" : ""} review
                </Link>
              </li>
            )}
            {untaken.length > 0 && (
              <li>
                <Link href={`/attendance/${untaken[untaken.length - 1].date}`} className="font-semibold text-brand-700 underline">
                  {untaken.length} past session{untaken.length === 1 ? "" : "s"} without attendance
                </Link>
              </li>
            )}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:hidden">
        <LinkButton href="/sessions" variant="secondary">Sessions</LinkButton>
        <LinkButton href="/settings" variant="secondary">Settings</LinkButton>
      </div>
    </div>
  );
}
