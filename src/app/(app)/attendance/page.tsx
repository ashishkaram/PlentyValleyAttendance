import { redirect } from "next/navigation";
import { Alert, LinkButton } from "@/components/ui";
import { getSeason, getSessions, requireManager } from "@/lib/data";
import { todayInMelbourne } from "@/lib/domain/dates";
import { defaultAttendanceDate } from "@/lib/domain/sessions";

/** Opens today's session, else the most recent past session (FR-08). */
export default async function AttendanceIndex() {
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  const sessions = season ? await getSessions(supabase, season.id) : [];
  const date = defaultAttendanceDate(sessions.map((s) => s.date), todayInMelbourne());
  if (date) redirect(`/attendance/${date}`);
  return (
    <div className="space-y-3">
      <Alert kind="warning">There are no sessions yet.</Alert>
      <LinkButton href="/settings">Set up the season</LinkButton>
    </div>
  );
}
