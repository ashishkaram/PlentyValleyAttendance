import type { Metadata } from "next";
import Link from "next/link";
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
      <p className="mb-2">
        <Link href="/players" className="text-brand-700 underline">‹ Players</Link>
      </p>
      <PageHeader title="Bulk upload players" />
      <UploadFlow
        existing={existing}
        season={{ start_date: season.start_date, end_date: season.end_date }}
        initialDefaultDate={defaultUploadActiveFrom(existing.length, season.start_date, todayInMelbourne())}
      />
    </>
  );
}
