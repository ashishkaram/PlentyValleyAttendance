"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Icon, PlayerMark, type IconName } from "@/components/ui";
import { countStatuses } from "@/lib/domain/attendance";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/domain/types";
import { saveAttendance } from "../actions";

interface Player {
  id: string;
  name: string;
  player_number: string | null;
}

const STATUS_STYLE: Record<AttendanceStatus, { on: string; chip: string; icon: IconName }> = {
  present: { on: "bg-emerald-700 text-white ring-emerald-700", chip: "bg-emerald-50 text-emerald-900 ring-emerald-300", icon: "check" },
  absent: { on: "bg-red-700 text-white ring-red-700", chip: "bg-red-50 text-red-900 ring-red-300", icon: "x" },
  excused: { on: "bg-sky-700 text-white ring-sky-700", chip: "bg-sky-50 text-sky-900 ring-sky-300", icon: "minus" },
  injured: { on: "bg-amber-600 text-white ring-amber-600", chip: "bg-amber-50 text-amber-950 ring-amber-300", icon: "bandage" },
};

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
  const counts = countStatuses(Object.values(marks));

  function setStatus(playerId: string, status: AttendanceStatus) {
    setMarks((m) => ({ ...m, [playerId]: status }));
    setDirty(true);
    setResult(null);
  }

  function markAllPresent() {
    // Keep players already marked excused or injured.
    setMarks((m) =>
      Object.fromEntries(players.map((p) => [p.id, m[p.id] === "excused" || m[p.id] === "injured" ? m[p.id] : "present"])),
    );
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
        setResult({
          ok: true,
          text: `Attendance saved: ${counts.present} present, ${counts.absent} absent, ${counts.excused} excused, ${counts.injured} injured.`,
        });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Summary" aria-live="polite">
          {ATTENDANCE_STATUSES.map((s) => (
            <li key={s.value} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset tabular-nums ${STATUS_STYLE[s.value].chip}`}>
              {counts[s.value]} {s.label.toLowerCase()}
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={markAllPresent}>
          <Icon name="check" className="h-4 w-4" />
          Mark all present
        </Button>
      </div>

      <ul className="space-y-2">
        {players.map((p) => {
          const status = marks[p.id];
          const notRecorded = attendanceTaken && recorded[p.id] === undefined && !dirty;
          return (
            <li key={p.id} className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200/80 sm:flex sm:items-center sm:gap-4">
              <div className="mb-2.5 flex min-w-0 items-center gap-3 sm:mb-0 sm:flex-1">
                <PlayerMark name={p.name} number={p.player_number} />
                <div className="min-w-0">
                  <p className="text-[1.05rem] font-semibold leading-tight text-slate-900">
                    {p.player_number && <span className="sr-only">Number {p.player_number}, </span>}
                    {p.name}
                  </p>
                  {notRecorded && <p className="text-sm font-semibold text-amber-800">Not recorded</p>}
                </div>
              </div>
              <div role="radiogroup" aria-label={`Attendance for ${p.name}`} className="grid grid-cols-4 gap-1.5 sm:w-[23rem]">
                {ATTENDANCE_STATUSES.map((s) => {
                  const checked = status === s.value;
                  return (
                    <label
                      key={s.value}
                      className={`relative flex min-h-12 cursor-pointer select-none flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold ring-1 ring-inset transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                        checked ? STATUS_STYLE[s.value].on : "bg-slate-50 text-slate-800 ring-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`status-${p.id}`}
                        value={s.value}
                        checked={checked}
                        onChange={() => setStatus(p.id, s.value)}
                        aria-label={`${s.label}: ${p.name}`}
                        className="sr-only"
                      />
                      <Icon name={STATUS_STYLE[s.value].icon} className="h-4 w-4" />
                      {s.label}
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-slate-600">Excused and injured sessions do not lower a player&apos;s attendance %.</p>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 space-y-2 rounded-2xl bg-[#f4f6f8]/90 p-1 backdrop-blur md:bottom-3">
        {result && <Alert kind={result.ok ? "success" : "error"}>{result.text}</Alert>}
        <Button onClick={save} disabled={pending} className="w-full py-3 text-base shadow-float">
          {pending ? "Saving…" : attendanceTaken && !dirty ? "Save again" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}
