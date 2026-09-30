"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert, Badge, Button, Icon, PlayerMark, Segmented, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/actionResult";
import { filterPlayers, type PlayerFilter } from "@/lib/domain/players";
import type { PlayerRecord } from "@/lib/domain/types";
import { deletePlayers } from "./actions";

type Row = PlayerRecord & { attendance_count: number };

const FILTERS: { value: PlayerFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

export function PlayerList({ players }: { players: Row[] }) {
  const [filter, setFilter] = useState<PlayerFilter>("active");
  const [search, setSearch] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActionResult<{ deleted: number }> | null>(null);
  const shown = useMemo(() => filterPlayers(players, filter, search), [players, filter, search]);

  const chosen = players.filter((p) => selected.has(p.id));
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((s) => {
      const next = new Set(s);
      if (allShownSelected) shown.forEach((p) => next.delete(p.id));
      else shown.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      {result && (result.ok ? <Alert kind="success">{result.message}</Alert> : <Alert kind="error">{result.error}</Alert>)}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <label htmlFor="player-search" className="sr-only">Search players</label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            id="player-search"
            type="search"
            placeholder="Search by name or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-10`}
          />
        </div>
        <Segmented label="Show" options={FILTERS} value={filter} onChange={setFilter} />
        {players.length > 0 && (
          <div className="sm:ml-auto">
            {selecting ? (
              <Button variant="secondary" onClick={stopSelecting}>Done</Button>
            ) : (
              <Button variant="secondary" onClick={() => { setSelecting(true); setResult(null); }}>
                Select
              </Button>
            )}
          </div>
        )}
      </div>

      {players.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">No players yet</p>
          <p className="mt-1 text-slate-600">Add them one at a time or upload the squad from a spreadsheet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80">
          <div className="flex min-h-12 items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
            {selecting && (
              <input
                type="checkbox"
                aria-label="Select all shown players"
                checked={allShownSelected}
                onChange={toggleAllShown}
                className="h-5 w-5 rounded accent-brand-700"
              />
            )}
            <span aria-live="polite">
              {selecting ? `${chosen.length} selected · ` : ""}
              {shown.length} player{shown.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {shown.map((p) => {
              const content = (
                <>
                  <PlayerMark name={p.name} number={p.player_number} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{p.name}</span>
                    <span className="block text-sm text-slate-600">
                      {p.player_number ? `#${p.player_number}` : "No number"}
                      {p.attendance_count > 0 && ` · ${p.attendance_count} session${p.attendance_count === 1 ? "" : "s"} recorded`}
                    </span>
                  </span>
                  {!p.is_active && <Badge>Inactive</Badge>}
                </>
              );
              return (
                <li key={p.id}>
                  {selecting ? (
                    <label className={`flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2 ${selected.has(p.id) ? "bg-red-50" : "hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        aria-label={`Select ${p.name}`}
                        className="h-5 w-5 rounded accent-red-700"
                      />
                      {content}
                    </label>
                  ) : (
                    <Link href={`/players/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-slate-50">
                      {content}
                      <Icon name="chevronRight" className="h-5 w-5 text-slate-400" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selecting && chosen.length > 0 && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-float">
            <span className="font-semibold">{chosen.length} selected</span>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              <Icon name="trash" className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDelete
          players={chosen}
          onClose={() => setConfirming(false)}
          onDone={(r) => {
            setResult(r);
            setConfirming(false);
            if (r.ok) stopSelecting();
          }}
        />
      )}
    </div>
  );
}

function ConfirmDelete({
  players,
  onClose,
  onDone,
}: {
  players: Row[];
  onClose: () => void;
  onDone: (r: ActionResult<{ deleted: number }>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [understood, setUnderstood] = useState(false);
  const [pending, startTransition] = useTransition();
  const records = players.reduce((n, p) => n + p.attendance_count, 0);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="delete-title"
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl p-0 shadow-float backdrop:bg-slate-900/50"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <Icon name="trash" />
          </span>
          <div>
            <h2 id="delete-title" className="text-lg font-bold text-slate-900">
              Delete {players.length} player{players.length === 1 ? "" : "s"}?
            </h2>
            <p className="mt-1 text-slate-700">
              This permanently removes {players.length === 1 ? "her" : "them"} from the app
              {records > 0 && <>, including <strong>{records} attendance record{records === 1 ? "" : "s"}</strong>, which will disappear from all reports</>}. This cannot be undone.
            </p>
          </div>
        </div>

        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-200">
          {players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span className="font-medium">{p.player_number ? `#${p.player_number} ` : ""}{p.name}</span>
              <span className="text-slate-600">{p.attendance_count} record{p.attendance_count === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>

        {records > 0 && (
          <Alert kind="warning">
            If a player has left the squad, <strong>deactivate</strong> her instead (open her profile). That keeps her history in the reports.
          </Alert>
        )}

        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 h-5 w-5 accent-red-700" />
          <span>I understand this permanently deletes {players.length === 1 ? "this player" : "these players"} and {players.length === 1 ? "her" : "their"} attendance history.</span>
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => ref.current?.close()}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!understood || pending}
            onClick={() => startTransition(async () => onDone(await deletePlayers(players.map((p) => p.id))))}
          >
            {pending ? "Deleting…" : `Delete ${players.length} player${players.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
