"use client";

import { useRouter } from "next/navigation";
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
    <div className="no-print flex items-end gap-2">
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && go(prev.date)}
        aria-label="Previous session"
        className="min-h-11 min-w-11 rounded-lg border border-slate-500 bg-white text-xl font-bold disabled:opacity-40"
      >
        ‹
      </button>
      <div className="flex-1">
        <label htmlFor="session-picker" className="block text-sm font-medium">
          Session
        </label>
        <select
          id="session-picker"
          value={idx >= 0 ? current : ""}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 text-base"
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
        className="min-h-11 min-w-11 rounded-lg border border-slate-500 bg-white text-xl font-bold disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
