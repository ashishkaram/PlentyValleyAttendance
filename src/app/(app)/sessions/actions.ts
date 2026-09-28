"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, type ActionResult } from "@/lib/actionResult";
import { getSeason, requireManager } from "@/lib/data";
import { isValidISODate, isWithin } from "@/lib/domain/dates";

function revalidateSessions() {
  revalidatePath("/sessions");
  revalidatePath("/");
  revalidatePath("/attendance", "layout");
  revalidatePath("/reports");
}

async function update(id: string, values: Record<string, unknown>, message: string): Promise<ActionResult> {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("sessions").update(values).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateSessions();
  return { ok: true, message };
}

export async function cancelSession(id: string, note: string): Promise<ActionResult> {
  const trimmed = note.trim().slice(0, 200);
  return update(id, { status: "cancelled", note: trimmed || null, needs_review: false }, "Session cancelled.");
}

export async function uncancelSession(id: string): Promise<ActionResult> {
  return update(id, { status: "scheduled", note: null }, "Session restored.");
}

/** "Keep" a session flagged for review: it stays as a normal session. */
export async function keepSession(id: string): Promise<ActionResult> {
  return update(id, { needs_review: false }, "Session kept.");
}

export async function addSession(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  if (!season) return { ok: false, error: "Set up the season first." };
  const date = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  if (!isValidISODate(date)) return { ok: false, error: "Choose a date." };
  if (!isWithin(date, season.start_date, season.end_date))
    return { ok: false, error: "The date must be within the season." };
  const { error } = await supabase
    .from("sessions")
    .insert({ season_id: season.id, date, source: "manual", note: note || null });
  if (error)
    return { ok: false, error: error.code === "23505" ? "There is already a session on that date." : dbErrorMessage(error) };
  revalidateSessions();
  return { ok: true, message: "Extra session added." };
}

/** Remove an extra (manual) session that has no attendance recorded. */
export async function removeManualSession(id: string): Promise<ActionResult> {
  const { supabase } = await requireManager();
  const { count } = await supabase.from("attendance").select("id", { count: "exact", head: true }).eq("session_id", id);
  if ((count ?? 0) > 0) return { ok: false, error: "This session has attendance recorded. Cancel it instead." };
  const { error } = await supabase.from("sessions").delete().eq("id", id).eq("source", "manual").eq("attendance_taken", false);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateSessions();
  return { ok: true, message: "Session removed." };
}
