"use client";

import { useRouter } from "next/navigation";
import { Icon, inputClass } from "@/components/ui";
import { formatDisplayDate } from "@/lib/domain/dates";

export function SessionPicker({
  dates,
  current,
}: {
  dates: { date: string; cancelled: boolean; taken: boolean }[];
  current: string;
}) {
  const router = useRouter();
  const idx = dates.findIndex((d) => d.date === current);
  const prev = idx > 0 ? dates[idx - 1] : idx === -1 ? [...dates].reverse().find((d) => d.date < current) : undefined;
  const next = idx >= 0 ? dates[idx + 1] : dates.find((d) => d.date > current);

  const go = (date: string) => router.push(`/attendance/${date}`);

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && go(prev.date)}
        aria-label="Previous session"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
      >
        <Icon name="chevronLeft" />
      </button>
      <div className="flex-1">
        <label htmlFor="session-picker" className="sr-only">
          Session
        </label>
        <select
          id="session-picker"
          value={idx >= 0 ? current : ""}
          onChange={(e) => e.target.value && go(e.target.value)}
          className={inputClass}
        >
          {idx === -1 && <option value="">Choose a session…</option>}
          {dates.map((d) => (
            <option key={d.date} value={d.date}>
              {formatDisplayDate(d.date)}
              {d.cancelled ? " (cancelled)" : d.taken ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && go(next.date)}
        aria-label="Next session"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  );
}
