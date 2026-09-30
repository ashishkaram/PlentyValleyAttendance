import Link from "next/link";
import { Alert, Badge, Card, CardTitle, Icon, LinkButton, StatTile } from "@/components/ui";
import { getBreaks, getSeason, getSessions, requireManager } from "@/lib/data";
import { formatDisplayDate, todayInMelbourne } from "@/lib/domain/dates";
import { defaultReportWeek } from "@/lib/domain/reports";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { supabase, profile } = await requireManager();
  const { password } = await searchParams;
  const today = todayInMelbourne();
  const season = await getSeason(supabase);
  const firstName = profile?.display_name?.split(" ")[0];

  if (!season) {
    return (
      <Card>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Welcome{firstName ? `, ${firstName}` : ""}</h1>
        <p className="mb-4 text-slate-700">No season has been set up yet.</p>
        <LinkButton href="/settings">Set up the season</LinkButton>
      </Card>
    );
  }

  const [sessions, breaks, { count: activePlayers }] = await Promise.all([
    getSessions(supabase, season.id),
    getBreaks(supabase, season.id),
    supabase.from("players").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const todaySession = sessions.find((s) => s.date === today);
  const nextSession = sessions.find((s) => s.date > today && s.status === "scheduled");
  const reviewCount = sessions.filter((s) => s.needs_review).length;
  const held = sessions.filter((s) => s.date <= today && s.status === "scheduled");
  const untaken = held.filter((s) => !s.attendance_taken);
  const remaining = sessions.filter((s) => s.date > today && s.status === "scheduled").length;
  const week = defaultReportWeek(today, season, breaks);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{formatDisplayDate(today)}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {firstName ? `Hi ${firstName}` : "Welcome"}
        </h1>
      </div>
      {password === "updated" && <Alert kind="success">Your password has been changed.</Alert>}

      {sessions.length === 0 && (
        <Alert kind="warning">
          No sessions have been generated for {season.name}.{" "}
          <Link href="/settings" className="font-semibold underline">Generate them in Settings</Link>.
        </Alert>
      )}

      {/* Today's session */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-5 text-white shadow-float sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-100">Today&apos;s session</p>
        {todaySession ? (
          todaySession.status === "cancelled" ? (
            <p className="mt-2 text-xl font-bold">Cancelled{todaySession.note ? ` — ${todaySession.note}` : ""}</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold">Training today</p>
              <p className="mt-1 text-brand-50">
                {todaySession.attendance_taken ? "Attendance saved. You can still make changes." : `${activePlayers ?? 0} players in the squad. Attendance not taken yet.`}
              </p>
              <Link
                href={`/attendance/${today}`}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 font-bold text-brand-900 shadow-sm hover:bg-brand-50 sm:w-auto"
              >
                <Icon name="clipboard" />
                {todaySession.attendance_taken ? "Review attendance" : "Take attendance"}
              </Link>
            </>
          )
        ) : (
          <>
            <p className="mt-2 text-2xl font-bold">No training today</p>
            {nextSession && <p className="mt-1 text-brand-50">Next session: {formatDisplayDate(nextSession.date)}</p>}
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active players" value={activePlayers ?? 0} />
        <StatTile label="Sessions held" value={held.length} detail={`of ${sessions.filter((s) => s.status === "scheduled").length} this season`} />
        <StatTile label="Sessions to go" value={remaining} />
        <StatTile label="Missing attendance" value={untaken.length} tone={untaken.length > 0 ? "amber" : "green"} detail={untaken.length > 0 ? "past sessions" : "All up to date"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Weekly report</CardTitle>
          {week ? (
            <>
              <p className="mb-3 text-slate-700">
                {formatDisplayDate(week.start, false)} – {formatDisplayDate(week.end, false)}
              </p>
              <LinkButton href="/reports" variant="secondary">
                <Icon name="chart" className="h-4 w-4" />
                View report
              </LinkButton>
            </>
          ) : (
            <p className="text-slate-700">The first weekly report will be ready after the first week of the season.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Needs attention</CardTitle>
          {reviewCount === 0 && untaken.length === 0 ? (
            <p className="flex items-center gap-2 text-slate-700">
              <Icon name="check" className="h-5 w-5 text-emerald-700" /> Nothing needs your attention.
            </p>
          ) : (
            <ul className="space-y-2">
              {reviewCount > 0 && (
                <li>
                  <Link href="/sessions?filter=review" className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 font-semibold text-amber-950 ring-1 ring-inset ring-amber-200">
                    {reviewCount} session{reviewCount === 1 ? "" : "s"} to review
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </Link>
                </li>
              )}
              {untaken.length > 0 && (
                <li>
                  <Link href={`/attendance/${untaken[untaken.length - 1].date}`} className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 font-semibold text-amber-950 ring-1 ring-inset ring-amber-200">
                    {untaken.length} past session{untaken.length === 1 ? "" : "s"} without attendance
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:hidden">
        <LinkButton href="/sessions" variant="secondary">
          <Icon name="calendar" className="h-4 w-4" /> Sessions
        </LinkButton>
        <LinkButton href="/settings" variant="secondary">
          <Icon name="settings" className="h-4 w-4" /> Settings
        </LinkButton>
      </div>
      <p className="text-center text-sm text-slate-600">
        Season {season.name} <Badge>{formatDisplayDate(season.start_date, false)} – {formatDisplayDate(season.end_date, false)}</Badge>
      </p>
    </div>
  );
}
