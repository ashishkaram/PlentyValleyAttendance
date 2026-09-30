import type { Metadata } from "next";
import { Icon, LinkButton, PageHeader } from "@/components/ui";
import { getAttendanceCountsByPlayer, getPlayersWithPeriods, requireManager } from "@/lib/data";
import { PlayerList } from "./PlayerList";

export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage() {
  const { supabase } = await requireManager();
  const [players, counts] = await Promise.all([getPlayersWithPeriods(supabase), getAttendanceCountsByPlayer(supabase)]);
  const active = players.filter((p) => p.is_active).length;
  return (
    <>
      <PageHeader title="Players" subtitle={`${active} active · ${players.length - active} inactive`}>
        <LinkButton href="/players/new">
          <Icon name="plus" className="h-4 w-4" />
          Add player
        </LinkButton>
        <LinkButton href="/players/upload" variant="secondary">
          <Icon name="upload" className="h-4 w-4" />
          Bulk upload
        </LinkButton>
      </PageHeader>
      <PlayerList
        players={players.map(({ id, name, player_number, is_active }) => ({
          id,
          name,
          player_number,
          is_active,
          attendance_count: counts.get(id) ?? 0,
        }))}
      />
    </>
  );
}
