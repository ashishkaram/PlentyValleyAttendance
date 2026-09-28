"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, type ActionResult } from "@/lib/actionResult";
import { getSeason, requireManager } from "@/lib/data";
import {
  validateActiveFrom,
  validateFirstStartDate,
  validateReactivation,
  sortPeriods,
} from "@/lib/domain/activePeriods";
import { normaliseName, normaliseNumber, validateName, validateNumber } from "@/lib/domain/players";
import { planImport, type DuplicateAction, type PreviewRow } from "@/lib/domain/upload";

function revalidatePlayers(id?: string) {
  revalidatePath("/players");
  if (id) revalidatePath(`/players/${id}`);
  revalidatePath("/attendance", "layout");
  revalidatePath("/reports");
}

async function seasonOrError() {
  const viewer = await requireManager();
  const season = await getSeason(viewer.supabase);
  return { ...viewer, season };
}

export async function addPlayer(_: ActionResult<string> | null, formData: FormData): Promise<ActionResult<string>> {
  const { supabase, season } = await seasonOrError();
  if (!season) return { ok: false, error: "Set up the season first." };
  const name = normaliseName(String(formData.get("name") ?? ""));
  const number = normaliseNumber(String(formData.get("player_number") ?? ""));
  const activeFrom = String(formData.get("active_from") ?? "");
  const error = validateName(name) ?? validateNumber(number) ?? validateActiveFrom(activeFrom, season);
  if (error) return { ok: false, error };

  const { data, error: dbError } = await supabase.rpc("create_player", {
    p_name: name,
    p_number: number,
    p_active_from: activeFrom,
  });
  if (dbError) return { ok: false, error: dbErrorMessage(dbError) };
  revalidatePlayers();
  return { ok: true, data: data as string, message: `${name} added.` };
}

export async function updatePlayer(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, season } = await seasonOrError();
  const id = String(formData.get("id"));
  const name = normaliseName(String(formData.get("name") ?? ""));
  const number = normaliseNumber(String(formData.get("player_number") ?? ""));
  const error = validateName(name) ?? validateNumber(number);
  if (error) return { ok: false, error };

  const { error: dbError } = await supabase.from("players").update({ name, player_number: number }).eq("id", id);
  if (dbError) return { ok: false, error: dbErrorMessage(dbError) };

  const firstStart = formData.get("first_start_date");
  if (firstStart && season) {
    const { data: periods } = await supabase
      .from("player_active_periods")
      .select("id, start_date, end_date")
      .eq("player_id", id);
    const sorted = sortPeriods(periods ?? []);
    if (sorted[0] && sorted[0].start_date !== firstStart) {
      const periodError = validateFirstStartDate(sorted, String(firstStart), season.start_date);
      if (periodError) return { ok: false, error: periodError };
      const { error: pErr } = await supabase
        .from("player_active_periods")
        .update({ start_date: firstStart })
        .eq("id", sorted[0].id);
      if (pErr) return { ok: false, error: dbErrorMessage(pErr) };
    }
  }
  revalidatePlayers(id);
  return { ok: true, message: "Changes saved." };
}

export async function deactivatePlayer(id: string): Promise<ActionResult> {
  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("deactivate_player", { p_player_id: id });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePlayers(id);
  return { ok: true, message: "Player deactivated." };
}

export async function reactivatePlayer(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, season } = await seasonOrError();
  if (!season) return { ok: false, error: "Set up the season first." };
  const id = String(formData.get("id"));
  const start = String(formData.get("start_date") ?? "");
  const { data: periods } = await supabase
    .from("player_active_periods")
    .select("id, start_date, end_date")
    .eq("player_id", id);
  const error = validateReactivation(periods ?? [], start, season.start_date);
  if (error) return { ok: false, error };
  const { error: dbError } = await supabase.rpc("reactivate_player", { p_player_id: id, p_start: start });
  if (dbError) return { ok: false, error: dbErrorMessage(dbError) };
  revalidatePlayers(id);
  return { ok: true, message: "Player reactivated." };
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  errors: { rowNumber: number; messages: string[] }[];
}

/**
 * Bulk import (FR-03). The preview is recomputed by the client from the file;
 * the server re-validates every row before writing.
 */
export async function importPlayers(
  preview: PreviewRow[],
  choices: [number, DuplicateAction][],
): Promise<ActionResult<ImportSummary>> {
  const { supabase, season } = await seasonOrError();
  if (!season) return { ok: false, error: "Set up the season first." };

  // Re-validate on the server: never trust the client's preview.
  const checked = preview.map((row) => {
    const errors = [...row.errors];
    const name = normaliseName(row.name);
    const nameError = validateName(name);
    if (nameError && !errors.includes(nameError)) errors.push(nameError);
    const numberError = validateNumber(row.playerNumber);
    if (numberError && !errors.includes(numberError)) errors.push(numberError);
    if (row.activeFrom) {
      const dateError = validateActiveFrom(row.activeFrom, season);
      if (dateError && errors.length === 0) errors.push(dateError);
    } else if (errors.length === 0) errors.push("Missing active-from date");
    return { ...row, name, errors };
  });

  const plan = planImport(checked, new Map(choices));
  const ops = plan.operations.map((op) =>
    op.kind === "add"
      ? { kind: "add", name: op.name, player_number: op.playerNumber, active_from: op.activeFrom }
      : { kind: "update_number", player_id: op.playerId, player_number: op.playerNumber },
  );
  let added = 0;
  let updated = 0;
  if (ops.length > 0) {
    const { data, error } = await supabase.rpc("import_players", { p_ops: ops });
    if (error) return { ok: false, error: `Nothing was imported: ${dbErrorMessage(error)}` };
    added = (data as { added: number }).added;
    updated = (data as { updated: number }).updated;
  }
  revalidatePlayers();
  return { ok: true, data: { added, updated, skipped: plan.skipped.length, errors: plan.errors } };
}
