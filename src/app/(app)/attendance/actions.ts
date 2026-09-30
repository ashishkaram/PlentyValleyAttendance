"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, type ActionResult } from "@/lib/actionResult";
import { getPlayersWithPeriods, requireManager } from "@/lib/data";
import { isActiveOn } from "@/lib/domain/activePeriods";
import type { AttendanceStatus } from "@/lib/domain/types";

const STATUSES: AttendanceStatus[] = ["present", "absent", "excused", "injured"];

/**
 * Save the attendance form (FR-08): one row per player active on the
 * session date, and mark attendance as taken. Marks for players who are not
 * active on that date are ignored.
 */
export async function saveAttendance(
  sessionId: string,
  marks: { player_id: string; status: AttendanceStatus }[],
): Promise<ActionResult<{ savedAt: string }>> {
  const { supabase } = await requireManager();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, date, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session) return { ok: false, error: "Session not found." };
  if (session.status === "cancelled") return { ok: false, error: "This session is cancelled. Un-cancel it first." };

  const players = await getPlayersWithPeriods(supabase);
  const active = new Set(players.filter((p) => isActiveOn(p.periods, session.date)).map((p) => p.id));
  const clean = marks.filter((m) => active.has(m.player_id) && STATUSES.includes(m.status));
  if (clean.length !== active.size)
    return { ok: false, error: "The squad list has changed. Reload the page and try again." };

  const { error: saveError } = await supabase.rpc("save_attendance", { p_session_id: sessionId, p_marks: clean });
  if (saveError) return { ok: false, error: dbErrorMessage(saveError) };

  revalidatePath(`/attendance/${session.date}`);
  revalidatePath("/sessions");
  revalidatePath("/reports");
  revalidatePath("/");
  return { ok: true, data: { savedAt: new Date().toISOString() }, message: "Attendance saved." };
}
