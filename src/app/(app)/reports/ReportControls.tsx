"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Segmented, inputClass } from "@/components/ui";
import { formatDisplayDate } from "@/lib/domain/dates";
import type { DateRange } from "@/lib/domain/reports";

export function ReportControls({
  weeks,
  today,
  selectedWeek,
  customRange,
  seasonStart,
  seasonEnd,
}: {
  weeks: DateRange[];
  today?: string;
  selectedWeek?: string;
  customRange?: { start: string; end: string };
  seasonStart: string;
  seasonEnd: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"week" | "range">(customRange ? "range" : "week");
  const [start, setStart] = useState(customRange?.start ?? seasonStart);
  const [end, setEnd] = useState(customRange?.end ?? (today && today < seasonEnd ? today : seasonEnd));

  return (
    <div className="no-print space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
      <Segmented
        label="Report type"
        options={[{ value: "week", label: "Weekly" }, { value: "range", label: "Custom range" }]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          if (m === "week" && customRange) router.push("/reports");
        }}
      />

      {mode === "week" ? (
        <Field label="Report week (Wednesday to Tuesday)" htmlFor="week">
          <select
            id="week"
            value={selectedWeek ?? ""}
            onChange={(e) => router.push(e.target.value ? `/reports?week=${e.target.value}` : "/reports")}
            className={`${inputClass} max-w-md`}
          >
            {!selectedWeek && <option value="">Latest completed week</option>}
            {[...weeks].reverse().map((w) => (
              <option key={w.start} value={w.start}>
                {formatDisplayDate(w.start, false)} – {formatDisplayDate(w.end, false)}
                {today && w.start > today ? " (upcoming)" : today && w.end >= today ? " (in progress)" : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/reports?${new URLSearchParams({ start, end })}`);
          }}
        >
          <Field label="From" htmlFor="range-start">
            <input id="range-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={`${inputClass} w-48`} />
          </Field>
          <Field label="To" htmlFor="range-end">
            <input id="range-end" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputClass} w-48`} />
          </Field>
          <Button type="submit">Show report</Button>
        </form>
      )}
    </div>
  );
}
