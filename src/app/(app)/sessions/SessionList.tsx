"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Alert, Badge, Button, Card, Field, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/actionResult";
import type { SessionRow } from "@/lib/data";
import { formatDisplayDate } from "@/lib/domain/dates";
import { addSession, cancelSession, keepSession, removeManualSession, uncancelSession } from "./actions";

type Row = SessionRow & { attendance_count: number };

const MONTH_FMT = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

function monthLabel(date: string) {
  return MONTH_FMT.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
}

export function SessionList({
  sessions,
  today,
  season,
  initialFilter,
}: {
  sessions: Row[];
  today: string;
  season: { start_date: string; end_date: string };
  initialFilter: "all" | "review";
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [result, setResult] = useState<ActionResult | null>(null);
  const reviewCount = sessions.filter((s) => s.needs_review).length;
  const shown = filter === "review" ? sessions.filter((s) => s.needs_review) : sessions;

  const byMonth = new Map<string, Row[]>();
  for (const s of shown) byMonth.set(s.date.slice(0, 7), [...(byMonth.get(s.date.slice(0, 7)) ?? []), s]);

  return (
    <div className="space-y-4">
      {reviewCount > 0 && (
        <Alert kind="warning">
          <strong>{reviewCount} session{reviewCount === 1 ? "" : "s"} need{reviewCount === 1 ? "s" : ""} review.</strong>{" "}
          The season settings changed and these dates are no longer regular training dates, but attendance was already recorded. Keep or cancel each one.
        </Alert>
      )}
      {result && (result.ok ? <Alert kind="success">{result.message}</Alert> : <Alert kind="error">{result.error}</Alert>)}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="inline-flex overflow-hidden rounded-lg border border-slate-500">
          {(["all", "review"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-11 px-4 font-semibold ${filter === f ? "bg-brand-700 text-white" : "bg-white hover:bg-slate-100"}`}
            >
              {f === "all" ? `All (${sessions.length})` : `Needs review (${reviewCount})`}
            </button>
          ))}
        </div>
      </div>

      <AddSessionForm season={season} />

      {[...byMonth.entries()].map(([month, rows]) => (
        <section key={month} aria-labelledby={`m-${month}`}>
          <h2 id={`m-${month}`} className="mb-2 text-lg font-semibold">{monthLabel(rows[0].date)}</h2>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 bg-white">
            {rows.map((s) => (
              <SessionItem key={s.id} session={s} today={today} onResult={setResult} />
            ))}
          </ul>
        </section>
      ))}
      {shown.length === 0 && sessions.length > 0 && <p>No sessions need review.</p>}
    </div>
  );
}

function SessionItem({ session: s, today, onResult }: { session: Row; today: string; onResult: (r: ActionResult) => void }) {
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      onResult(await fn());
      setCancelling(false);
    });

  return (
    <li className={`px-4 py-3 ${s.needs_review ? "bg-amber-50" : ""} ${s.date === today ? "border-l-4 border-brand-700" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href={`/attendance/${s.date}`} className="min-w-40 font-semibold text-brand-700 underline">
          {formatDisplayDate(s.date)}
        </Link>
        <div className="flex flex-1 flex-wrap gap-1">
          {s.date === today && <Badge tone="blue">Today</Badge>}
          {s.status === "cancelled" ? <Badge tone="red">Cancelled</Badge> : s.attendance_taken ? <Badge tone="green">Attendance taken</Badge> : s.date < today ? <Badge tone="amber">Not taken</Badge> : null}
          {s.source === "manual" && <Badge>Extra session</Badge>}
          {s.needs_review && <Badge tone="amber">Needs review</Badge>}
          {s.note && <span className="text-sm text-slate-700">{s.note}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {s.needs_review && (
            <>
              <Button variant="secondary" disabled={pending} onClick={() => run(() => keepSession(s.id))}>Keep</Button>
              <Button variant="danger" disabled={pending} onClick={() => run(() => cancelSession(s.id, "Cancelled - no longer a training date"))}>Cancel</Button>
            </>
          )}
          {!s.needs_review && s.status === "scheduled" && !cancelling && (
            <Button variant="secondary" disabled={pending} onClick={() => setCancelling(true)}>Cancel session</Button>
          )}
          {s.status === "cancelled" && (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => uncancelSession(s.id))}>Un-cancel</Button>
          )}
          {s.source === "manual" && s.attendance_count === 0 && !s.attendance_taken && (
            <Button variant="ghost" disabled={pending} onClick={() => run(() => removeManualSession(s.id))}>Remove</Button>
          )}
        </div>
      </div>
      {cancelling && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => cancelSession(s.id, note));
          }}
        >
          <div className="min-w-56 flex-1">
            <Field label="Note (optional)" htmlFor={`note-${s.id}`}>
              <input id={`note-${s.id}`} value={note} maxLength={200} placeholder="e.g. Cancelled - rain" onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Button type="submit" variant="danger" disabled={pending}>Confirm cancel</Button>
          <Button type="button" variant="secondary" onClick={() => setCancelling(false)}>Back</Button>
        </form>
      )}
    </li>
  );
}

function AddSessionForm({ season }: { season: { start_date: string; end_date: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addSession, null);
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add extra session
      </Button>
    );
  return (
    <Card>
      <form action={action} className="space-y-3">
        <h2 className="text-lg font-semibold">Add an extra session</h2>
        {state && (state.ok ? <Alert kind="success">{state.message}</Alert> : <Alert kind="error">{state.error}</Alert>)}
        <div className="flex flex-wrap gap-3">
          <Field label="Date" htmlFor="new-date">
            <input id="new-date" name="date" type="date" required min={season.start_date} max={season.end_date} className={`${inputClass} w-52`} />
          </Field>
          <div className="min-w-56 flex-1">
            <Field label="Note (optional)" htmlFor="new-note">
              <input id="new-note" name="note" maxLength={200} placeholder="e.g. Extra session before finals" className={inputClass} />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add session"}</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </form>
    </Card>
  );
}
