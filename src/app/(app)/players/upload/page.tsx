import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";
import { getSeason, requireManager } from "@/lib/data";
import { todayInMelbourne } from "@/lib/domain/dates";
import { defaultUploadActiveFrom } from "@/lib/domain/upload";
import { UploadFlow } from "./UploadFlow";

export const metadata: Metadata = { title: "Bulk upload" };

export default async function UploadPage() {
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  if (!season) return <Alert kind="warning">Set up the season in Settings first.</Alert>;
  const { data: players } = await supabase.from("players").select("id, name, player_number");
  const existing = players ?? [];
  return (
    <>
      <PageHeader title="Bulk upload players" subtitle="Import the squad from a CSV or Excel file." back={{ href: "/players", label: "Players" }} />
      <UploadFlow
        existing={existing}
        season={{ start_date: season.start_date, end_date: season.end_date }}
        initialDefaultDate={defaultUploadActiveFrom(existing.length, season.start_date, todayInMelbourne())}
      />
    </>
  );
}
