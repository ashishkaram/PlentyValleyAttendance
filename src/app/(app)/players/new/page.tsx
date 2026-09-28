import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getSeason, requireManager } from "@/lib/data";
import { todayInMelbourne } from "@/lib/domain/dates";
import { AddPlayerForm } from "./AddPlayerForm";

export const metadata: Metadata = { title: "Add player" };

export default async function NewPlayerPage() {
  const { supabase } = await requireManager();
  const season = await getSeason(supabase);
  const today = todayInMelbourne();
  if (!season) return <Alert kind="warning">Set up the season in Settings first.</Alert>;
  const defaultDate = today < season.start_date ? season.start_date : today > season.end_date ? season.end_date : today;
  return (
    <>
      <p className="mb-2">
        <Link href="/players" className="text-brand-700 underline">‹ Players</Link>
      </p>
      <PageHeader title="Add player" />
      <Card className="max-w-lg">
        <AddPlayerForm defaultDate={defaultDate} minDate={season.start_date} maxDate={season.end_date} />
      </Card>
    </>
  );
}
