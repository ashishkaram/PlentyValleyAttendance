import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getSeason, requireManager, type PeriodRow } from "@/lib/data";
import { sortPeriods, openPeriod } from "@/lib/domain/activePeriods";
import { addDays, formatDisplayDate, maxDate, todayInMelbourne } from "@/lib/domain/dates";
import { EditPlayerForm, StatusControls } from "./PlayerForms";

export const metadata: Metadata = { title: "Player" };

export default async function PlayerPage({ params }: PageProps<"/players/[id]">) {
  const { id } = await params;
  const { supabase } = await requireManager();
  const [{ data: player }, { data: periodData }, season] = await Promise.all([
    supabase.from("players").select("id, name, player_number, is_active").eq("id", id).maybeSingle(),
    supabase.from("player_active_periods").select("id, player_id, start_date, end_date").eq("player_id", id),
    getSeason(supabase),
  ]);
  if (!player || !season) notFound();

  const periods = sortPeriods((periodData ?? []) as PeriodRow[]);
  const today = todayInMelbourne();
  const lastEnd = periods.at(-1)?.end_date ?? null;
  const open = openPeriod(periods);

  return (
    <>
      <p className="mb-2">
        <Link href="/players" className="text-brand-700 underline">‹ Players</Link>
      </p>
      <PageHeader title={player.name}>
        {player.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Details</h2>
          <EditPlayerForm
            player={player}
            firstPeriod={periods[0] ?? null}
            seasonStart={season.start_date}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Active periods</h2>
            {periods.length === 0 ? (
              <p>No active periods.</p>
            ) : (
              <ul className="space-y-2">
                {periods.map((p) => (
                  <li key={p.id} className="rounded-lg bg-slate-100 px-3 py-2">
                    From <strong>{formatDisplayDate(p.start_date)}</strong>
                    {p.end_date ? (
                      <>
                        {" "}to <strong>{formatDisplayDate(addDays(p.end_date, -1))}</strong>
                        <span className="block text-sm text-slate-700">Left on {formatDisplayDate(p.end_date)}</span>
                      </>
                    ) : (
                      <> — still in the squad</>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Squad status</h2>
            <StatusControls
              playerId={player.id}
              name={player.name}
              isActive={!!open}
              today={today}
              minReactivate={maxDate(lastEnd ?? season.start_date, season.start_date)}
              maxReactivate={season.end_date}
              defaultReactivate={maxDate(today, lastEnd ?? season.start_date)}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
