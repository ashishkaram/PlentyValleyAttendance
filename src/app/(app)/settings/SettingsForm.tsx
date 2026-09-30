"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button, Card, Field, inputClass } from "@/components/ui";
import { formatDisplayDate } from "@/lib/domain/dates";
import { isEmptyPlan, planRegeneration, type ExistingSession } from "@/lib/domain/sessions";
import { validateSettings, type BreakDraft, type SeasonDraft } from "@/lib/domain/settings";
import { saveSettings, type SaveSummary } from "./actions";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function SettingsForm({
  isNew,
  initialSeason,
  initialBreaks,
  sessions,
}: {
  isNew: boolean;
  initialSeason: SeasonDraft;
  initialBreaks: BreakDraft[];
  sessions: ExistingSession[];
}) {
  const [season, setSeason] = useState(initialSeason);
  const [breaks, setBreaks] = useState(initialBreaks);
  const [reviewing, setReviewing] = useState(false);
  const [saved, setSaved] = useState<SaveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errors = validateSettings(season, breaks);
  const plan = reviewing && errors.length === 0 ? planRegeneration(season, breaks, sessions) : null;

  const set = <K extends keyof SeasonDraft>(key: K, value: SeasonDraft[K]) => {
    setSeason((s) => ({ ...s, [key]: value }));
    setReviewing(false);
    setSaved(null);
  };
  const setBreak = (i: number, patch: Partial<BreakDraft>) => {
    setBreaks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    setReviewing(false);
    setSaved(null);
  };

  function apply() {
    startTransition(async () => {
      setError(null);
      const res = await saveSettings(season, breaks);
      if (res.ok) {
        setSaved(res.data!);
        setReviewing(false);
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Season</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" htmlFor="season-name">
            <input id="season-name" value={season.name} maxLength={50} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="First day" htmlFor="season-start">
            <input id="season-start" type="date" value={season.start_date} onChange={(e) => set("start_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Last day" htmlFor="season-end">
            <input id="season-end" type="date" value={season.end_date} onChange={(e) => set("end_date", e.target.value)} className={inputClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1 font-medium">Training days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, i) => {
              const day = i + 1;
              const checked = season.training_weekdays.includes(day);
              return (
                <label key={day} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 font-semibold ring-1 ring-inset ${checked ? "bg-brand-50 text-brand-900 ring-brand-600" : "bg-white ring-slate-300"}`}>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={checked}
                    onChange={() =>
                      set(
                        "training_weekdays",
                        checked ? season.training_weekdays.filter((d) => d !== day) : [...season.training_weekdays, day].sort(),
                      )
                    }
                  />
                  {label.slice(0, 3)}
                  <span className="sr-only">{label.slice(3)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Weekly report day" htmlFor="report-day" hint="Each report week starts on this day and covers the 7 days before it.">
            <select id="report-day" value={season.report_weekday} onChange={(e) => set("report_weekday", Number(e.target.value))} className={inputClass}>
              {WEEKDAYS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
            </select>
          </Field>
          <Field label="Low attendance threshold (%)" htmlFor="threshold" hint="Players below this season-to-date % are highlighted.">
            <input
              id="threshold"
              type="number"
              min={0}
              max={100}
              step={1}
              value={Number.isNaN(season.low_attendance_threshold) ? "" : season.low_attendance_threshold}
              onChange={(e) => set("low_attendance_threshold", e.target.value === "" ? NaN : Number(e.target.value))}
              className={`${inputClass} max-w-28`}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Breaks</h2>
        <p className="text-slate-700">No sessions are generated on dates inside a break (first and last day included).</p>
        {breaks.length === 0 && <p>No breaks.</p>}
        {breaks.map((b, i) => (
          <div key={b.id ?? `new-${i}`} className="grid items-end gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200 sm:grid-cols-[1fr_auto_auto_auto]">
            <Field label="Name" htmlFor={`break-name-${i}`}>
              <input id={`break-name-${i}`} value={b.name} maxLength={100} onChange={(e) => setBreak(i, { name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="First day" htmlFor={`break-start-${i}`}>
              <input id={`break-start-${i}`} type="date" value={b.start_date} onChange={(e) => setBreak(i, { start_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Last day" htmlFor={`break-end-${i}`}>
              <input id={`break-end-${i}`} type="date" value={b.end_date} onChange={(e) => setBreak(i, { end_date: e.target.value })} className={inputClass} />
            </Field>
            <Button
              variant="secondary"
              onClick={() => {
                setBreaks((bs) => bs.filter((_, j) => j !== i));
                setReviewing(false);
                setSaved(null);
              }}
              aria-label={`Remove ${b.name || "break"}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() => {
            setBreaks((bs) => [...bs, { name: "", start_date: season.start_date, end_date: season.start_date }]);
            setReviewing(false);
          }}
        >
          Add break
        </Button>
      </Card>

      {errors.length > 0 && (
        <Alert kind="error">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Alert>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {saved && (
        <Alert kind="success">
          Settings saved. Sessions: {saved.added} added, {saved.deleted} removed, {saved.flagged} flagged for review.{" "}
          <Link href="/sessions" className="font-semibold underline">View sessions</Link>
        </Alert>
      )}

      {!reviewing ? (
        <Button onClick={() => setReviewing(true)} disabled={errors.length > 0}>
          {isNew ? "Preview season" : "Review changes"}
        </Button>
      ) : (
        plan && (
          <Card className="space-y-3 ring-2 ring-brand-600">
            <h2 className="text-base font-semibold">Changes to sessions</h2>
            {isEmptyPlan(plan) ? (
              <p>No sessions will change.</p>
            ) : (
              <>
                <PlanList title={`${plan.toAdd.length} session${plan.toAdd.length === 1 ? "" : "s"} to add`} dates={plan.toAdd} />
                <PlanList title={`${plan.toDelete.length} session${plan.toDelete.length === 1 ? "" : "s"} to remove (no attendance recorded)`} dates={plan.toDelete.map((s) => s.date)} />
                <PlanList title={`${plan.toFlag.length} session${plan.toFlag.length === 1 ? "" : "s"} to flag for review (attendance already recorded, never deleted)`} dates={plan.toFlag.map((s) => s.date)} />
                <PlanList title={`${plan.toUnflag.length} flagged session${plan.toUnflag.length === 1 ? "" : "s"} that are regular training dates again`} dates={plan.toUnflag.map((s) => s.date)} />
                <p className="text-sm text-slate-700">Extra sessions you added yourself are never changed.</p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={apply} disabled={pending}>{pending ? "Saving…" : "Save and apply"}</Button>
              <Button variant="secondary" onClick={() => setReviewing(false)}>Keep editing</Button>
            </div>
          </Card>
        )
      )}
    </div>
  );
}

function PlanList({ title, dates }: { title: string; dates: string[] }) {
  if (dates.length === 0) return null;
  return (
    <details open={dates.length <= 10}>
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <ul className="mt-1 grid gap-x-4 pl-5 text-sm sm:grid-cols-3">
        {dates.map((d) => <li key={d} className="list-disc">{formatDisplayDate(d)}</li>)}
      </ul>
    </details>
  );
}
