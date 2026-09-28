/**
 * Seed script: creates the manager account, the 2026-27 season with its
 * Christmas break, generates the sessions, and (optionally) 10 sample players.
 *
 *   npm run seed                    # manager + season + sessions
 *   npm run seed -- --sample-players  # also add 10 sample players (dev/test only)
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (never expose it to the browser), plus
 * NEXT_PUBLIC_SUPABASE_URL, MANAGER_EMAIL, MANAGER_PASSWORD and optionally
 * MANAGER_NAME. Safe to re-run: existing records are kept.
 */
import { createClient } from "@supabase/supabase-js";
import { planRegeneration } from "../src/lib/domain/sessions";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) loadEnvFile(".env.local");

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See .env.example.`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEASON = {
  name: "2026-27",
  start_date: "2026-09-29",
  end_date: "2027-03-30",
  training_weekdays: [2, 4],
  report_weekday: 3,
  low_attendance_threshold: 75,
};
const CHRISTMAS = { name: "Christmas break", start_date: "2026-12-16", end_date: "2027-01-15" };

/** Sample squad: some without numbers, one joined mid-season, one left and rejoined. */
const SAMPLE_PLAYERS: { name: string; number: string | null; periods: [string, string | null][] }[] = [
  { name: "Ava Sample", number: "1", periods: [["2026-09-29", null]] },
  { name: "Bella Sample", number: "2", periods: [["2026-09-29", null]] },
  { name: "Chloe Sample", number: "07", periods: [["2026-09-29", null]] },
  { name: "Daisy Sample", number: "10", periods: [["2026-09-29", null]] },
  { name: "Ella Sample", number: "11", periods: [["2026-09-29", null]] },
  { name: "Freya Sample", number: "14", periods: [["2026-09-29", null]] },
  { name: "Grace Sample", number: null, periods: [["2026-09-29", null]] },
  { name: "Harper Sample", number: null, periods: [["2026-09-29", null]] },
  // Joined mid-season
  { name: "Isla Sample", number: "21", periods: [["2026-10-20", null]] },
  // Left and rejoined
  { name: "Jade Sample", number: "5", periods: [["2026-09-29", "2026-10-27"], ["2026-11-17", null]] },
];

async function must<R extends { data: unknown; error: { message: string } | null }>(
  p: PromiseLike<R>,
): Promise<NonNullable<R["data"]>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<R["data"]>;
}

async function seedManager() {
  const email = env("MANAGER_EMAIL");
  const name = process.env.MANAGER_NAME ?? "Team Manager";
  const users = await must(supabase.auth.admin.listUsers({ perPage: 1000 }));
  let user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const created = await must(
      supabase.auth.admin.createUser({ email, password: env("MANAGER_PASSWORD"), email_confirm: true }),
    );
    user = created.user!;
    console.log(`Created manager user ${email}`);
  } else {
    console.log(`Manager user ${email} already exists`);
  }
  await must(
    supabase.from("profiles").upsert({ user_id: user.id, display_name: name, role: "manager" }, { onConflict: "user_id" }),
  );
}

async function seedSeason(): Promise<string> {
  const existing = await must(supabase.from("season").select("id").eq("name", SEASON.name).maybeSingle());
  let seasonId = existing?.id as string | undefined;
  if (!seasonId) {
    seasonId = (await must(supabase.from("season").insert(SEASON).select("id").single())).id as string;
    await must(supabase.from("season_breaks").insert({ season_id: seasonId, ...CHRISTMAS }));
    console.log(`Created season ${SEASON.name} with ${CHRISTMAS.name}`);
  }
  const breaks = await must(supabase.from("season_breaks").select("name, start_date, end_date").eq("season_id", seasonId));
  const sessions = await must(
    supabase.from("sessions").select("id, date, source, attendance_taken, needs_review").eq("season_id", seasonId),
  );
  const plan = planRegeneration(
    SEASON,
    breaks ?? [],
    (sessions ?? []).map((s) => ({ ...s, attendance_count: 0 })),
  );
  if (plan.toAdd.length > 0) {
    await must(
      supabase.from("sessions").insert(plan.toAdd.map((date) => ({ season_id: seasonId, date, source: "generated" }))),
    );
  }
  console.log(`Sessions: ${plan.toAdd.length} added, ${(sessions ?? []).length} already present`);
  return seasonId;
}

async function seedSamplePlayers() {
  const existing = await must(supabase.from("players").select("name"));
  const names = new Set((existing ?? []).map((p) => p.name as string));
  let added = 0;
  for (const p of SAMPLE_PLAYERS) {
    if (names.has(p.name)) continue;
    const player = await must(
      supabase.from("players").insert({ name: p.name, player_number: p.number }).select("id").single(),
    );
    await must(
      supabase
        .from("player_active_periods")
        .insert(p.periods.map(([start_date, end_date]) => ({ player_id: player.id, start_date, end_date }))),
    );
    added++;
  }
  console.log(`Sample players: ${added} added`);
}

async function main() {
  await seedManager();
  await seedSeason();
  if (process.argv.includes("--sample-players")) await seedSamplePlayers();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
