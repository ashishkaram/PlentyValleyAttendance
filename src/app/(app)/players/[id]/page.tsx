import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
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
      <PageHeader
        title={player.name}
        back={{ href: "/players", label: "Players" }}
        subtitle={
          <span className="flex items-center gap-2">
            {player.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
            {player.player_number ? `#${player.player_number}` : "No number"}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Details</CardTitle>
          <EditPlayerForm
            player={player}
            firstPeriod={periods[0] ?? null}
            seasonStart={season.start_date}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Active periods</CardTitle>
            {periods.length === 0 ? (
              <p>No active periods.</p>
            ) : (
              <ul className="space-y-2">
                {periods.map((p) => (
                  <li key={p.id} className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200">
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
            <CardTitle>Squad status</CardTitle>
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
