"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, type ActionResult } from "@/lib/actionResult";
import { countBySession, getAttendanceForSessions, getSeason, getSessions, requireManager } from "@/lib/data";
import { planRegeneration } from "@/lib/domain/sessions";
import { validateSettings, type BreakDraft, type SeasonDraft } from "@/lib/domain/settings";

export interface SaveSummary {
  added: number;
  deleted: number;
  flagged: number;
}

/**
 * Save season settings and breaks, then regenerate sessions (section 7.1).
 * The plan is recomputed here from the database so it reflects the latest
 * sessions and attendance, and applied in one transaction.
 */
export async function saveSettings(season: SeasonDraft, breaks: BreakDraft[]): Promise<ActionResult<SaveSummary>> {
  const { supabase } = await requireManager();
  const clean: SeasonDraft = {
    ...season,
    name: season.name.trim(),
    training_weekdays: [...new Set(season.training_weekdays)].sort(),
  };
  const cleanBreaks = breaks.map((b) => ({ ...b, name: b.name.trim() }));
  const errors = validateSettings(clean, cleanBreaks);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };

  const current = await getSeason(supabase);
  const sessions = current ? await getSessions(supabase, current.id) : [];
  const counts = countBySession(await getAttendanceForSessions(supabase, sessions.map((s) => s.id)));
  const plan = planRegeneration(
    clean,
    cleanBreaks,
    sessions.map((s) => ({ ...s, attendance_count: counts.get(s.id) ?? 0 })),
  );

  const { data, error } = await supabase.rpc("save_season_settings", {
    p_season_id: current?.id ?? null,
    p_season: clean,
    p_breaks: cleanBreaks.map((b) => ({ id: b.id ?? null, name: b.name, start_date: b.start_date, end_date: b.end_date })),
    p_add: plan.toAdd,
    p_delete: plan.toDelete.map((s) => s.id),
    p_flag: plan.toFlag.map((s) => s.id),
    p_unflag: plan.toUnflag.map((s) => s.id),
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  const result = data as SaveSummary;
  return { ok: true, data: { added: result.added, deleted: result.deleted, flagged: result.flagged } };
}
