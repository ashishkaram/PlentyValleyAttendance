import type { Metadata } from "next";
import { LinkButton, PageHeader } from "@/components/ui";
import { getPlayersWithPeriods, requireManager } from "@/lib/data";
import { PlayerList } from "./PlayerList";

export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage() {
  const { supabase } = await requireManager();
  const players = await getPlayersWithPeriods(supabase);
  return (
    <>
      <PageHeader title="Players">
        <LinkButton href="/players/new">Add player</LinkButton>
        <LinkButton href="/players/upload" variant="secondary">
          Bulk upload
        </LinkButton>
      </PageHeader>
      <PlayerList players={players.map(({ id, name, player_number, is_active }) => ({ id, name, player_number, is_active }))} />
    </>
  );
}
