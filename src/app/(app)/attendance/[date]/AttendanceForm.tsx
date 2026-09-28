"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { toggleStatus } from "@/lib/domain/attendance";
import type { AttendanceStatus } from "@/lib/domain/types";
import { saveAttendance } from "../actions";

interface Player {
  id: string;
  name: string;
  player_number: string | null;
}

export function AttendanceForm({
  sessionId,
  attendanceTaken,
  players,
  recorded,
}: {
  sessionId: string;
  attendanceTaken: boolean;
  players: Player[];
  recorded: Record<string, AttendanceStatus>;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(players.map((p) => [p.id, recorded[p.id] ?? "absent"])),
  );
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = Object.values(marks).reduce(
    (acc, s) => ({ ...acc, [s]: acc[s] + 1 }),
    { present: 0, excused: 0, absent: 0 } as Record<AttendanceStatus, number>,
  );

  function toggle(playerId: string, box: "present" | "excused") {
    setMarks((m) => ({ ...m, [playerId]: toggleStatus(m[playerId], box) }));
    setDirty(true);
    setResult(null);
  }

  function markAllPresent() {
    setMarks(Object.fromEntries(players.map((p) => [p.id, marks[p.id] === "excused" ? "excused" : "present"])));
    setDirty(true);
    setResult(null);
  }

  function save() {
    startTransition(async () => {
      const res = await saveAttendance(
        sessionId,
        players.map((p) => ({ player_id: p.id, status: marks[p.id] })),
      );
      if (res.ok) {
        setDirty(false);
        setResult({ ok: true, text: `Attendance saved: ${counts.present} present, ${counts.excused} excused, ${counts.absent} absent.` });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium" aria-live="polite">
          {players.length} players · {counts.present} present · {counts.excused} excused · {counts.absent} absent
        </p>
        <Button variant="secondary" type="button" onClick={markAllPresent}>
          Mark all present
        </Button>
      </div>

      <fieldset>
        <legend className="sr-only">Attendance</legend>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 bg-white">
          {players.map((p) => {
            const status = marks[p.id];
            const notRecorded = attendanceTaken && recorded[p.id] === undefined;
            return (
              <li key={p.id} className={`flex items-center gap-2 py-1 pl-3 pr-1 ${status === "present" ? "bg-green-50" : status === "excused" ? "bg-blue-50" : ""}`}>
                <span className="w-9 shrink-0 text-right font-mono text-lg font-bold text-slate-700">{p.player_number ?? ""}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium" id={`name-${p.id}`}>{p.name}</span>
                  {notRecorded && !dirty && <span className="text-sm font-semibold text-amber-800">Not recorded</span>}
                </span>
                <CheckBox label="Present" playerName={p.name} checked={status === "present"} onChange={() => toggle(p.id, "present")} tone="green" />
                <CheckBox label="Excused" playerName={p.name} checked={status === "excused"} onChange={() => toggle(p.id, "excused")} tone="blue" />
              </li>
            );
          })}
        </ul>
      </fieldset>
      <p className="text-sm text-slate-700">Neither ticked = absent.</p>

      <div className="sticky bottom-16 z-10 space-y-2 bg-slate-50/95 py-2 md:bottom-0">
        {result && <Alert kind={result.ok ? "success" : "error"}>{result.text}</Alert>}
        <Button type="button" onClick={save} disabled={pending} className="w-full text-lg">
          {pending ? "Saving…" : attendanceTaken && !dirty ? "Save again" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}

function CheckBox({
  label,
  playerName,
  checked,
  onChange,
  tone,
}: {
  label: string;
  playerName: string;
  checked: boolean;
  onChange: () => void;
  tone: "green" | "blue";
}) {
  const on = tone === "green" ? "border-green-700 bg-green-700 text-white" : "border-blue-700 bg-blue-700 text-white";
  return (
    <label className={`flex min-h-12 min-w-[5.5rem] cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg border-2 px-2 font-semibold ${checked ? on : "border-slate-400 bg-white text-slate-900"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={`${label}: ${playerName}`}
        className="h-5 w-5 accent-current"
      />
      {label}
    </label>
  );
}
