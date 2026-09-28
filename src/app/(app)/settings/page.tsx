import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { countBySession, getAttendanceForSessions, getBreaks, getSeason, getSessions, requireManager } from "@/lib/data";
import { DEFAULT_BREAKS, DEFAULT_SEASON } from "@/lib/domain/settings";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  const [breaks, sessions] = season
    ? await Promise.all([getBreaks(supabase, season.id), getSessions(supabase, season.id)])
    : [[], []];
  const counts = countBySession(await getAttendanceForSessions(supabase, sessions.map((s) => s.id)));

  return (
    <>
      <PageHeader title={season ? "Season settings" : "Set up the season"} />
      <SettingsForm
        isNew={!season}
        initialSeason={
          season
            ? {
                name: season.name,
                start_date: season.start_date,
                end_date: season.end_date,
                training_weekdays: season.training_weekdays,
                report_weekday: season.report_weekday,
                low_attendance_threshold: season.low_attendance_threshold,
              }
            : DEFAULT_SEASON
        }
        initialBreaks={season ? breaks.map(({ id, name, start_date, end_date }) => ({ id, name, start_date, end_date })) : DEFAULT_BREAKS}
        sessions={sessions.map((s) => ({
          id: s.id,
          date: s.date,
          source: s.source,
          attendance_taken: s.attendance_taken,
          needs_review: s.needs_review,
          attendance_count: counts.get(s.id) ?? 0,
        }))}
      />
    </>
  );
}
