"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, inputClass } from "@/components/ui";
import { filterPlayers, type PlayerFilter } from "@/lib/domain/players";
import type { PlayerRecord } from "@/lib/domain/types";

const FILTERS: { value: PlayerFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

export function PlayerList({ players }: { players: PlayerRecord[] }) {
  const [filter, setFilter] = useState<PlayerFilter>("active");
  const [search, setSearch] = useState("");
  const shown = useMemo(() => filterPlayers(players, filter, search), [players, filter, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="player-search" className="sr-only">
          Search players
        </label>
        <input
          id="player-search"
          type="search"
          placeholder="Search by name or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} sm:max-w-xs`}
        />
        <div role="group" aria-label="Show" className="inline-flex overflow-hidden rounded-lg border border-slate-500">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`min-h-11 px-4 font-semibold ${filter === f.value ? "bg-brand-700 text-white" : "bg-white text-slate-900 hover:bg-slate-100"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-700" aria-live="polite">
        {shown.length} player{shown.length === 1 ? "" : "s"}
      </p>

      {players.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 p-6 text-center">
          No players yet. Add them one at a time or use bulk upload.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 bg-white">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/players/${p.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-slate-50">
                <span className="w-10 shrink-0 text-right font-mono text-lg font-semibold text-slate-700">{p.player_number ?? ""}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                {!p.is_active && <Badge>Inactive</Badge>}
                <span aria-hidden="true" className="text-slate-500">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
