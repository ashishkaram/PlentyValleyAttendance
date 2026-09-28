import type { Metadata } from "next";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { countBySession, getAttendanceForSessions, getSeason, getSessions, requireManager } from "@/lib/data";
import { todayInMelbourne } from "@/lib/domain/dates";
import { SessionList } from "./SessionList";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage({ searchParams }: PageProps<"/sessions">) {
  const { filter } = await searchParams;
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  if (!season) return <Alert kind="warning">Set up the season in Settings first.</Alert>;
  const sessions = await getSessions(supabase, season.id);
  const counts = countBySession(await getAttendanceForSessions(supabase, sessions.map((s) => s.id)));

  return (
    <>
      <PageHeader title={`Sessions ${season.name}`}>
        <LinkButton href="/settings" variant="secondary">Season settings</LinkButton>
      </PageHeader>
      {sessions.length === 0 && (
        <div className="mb-4">
          <Alert kind="warning">No sessions yet. Generate them from the season settings.</Alert>
        </div>
      )}
      <SessionList
        sessions={sessions.map((s) => ({ ...s, attendance_count: counts.get(s.id) ?? 0 }))}
        today={todayInMelbourne()}
        season={{ start_date: season.start_date, end_date: season.end_date }}
        initialFilter={filter === "review" ? "review" : "all"}
      />
    </>
  );
}
