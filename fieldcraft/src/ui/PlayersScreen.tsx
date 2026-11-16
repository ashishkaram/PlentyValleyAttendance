import { useState } from "react";
import { lengthTagFor, lineTagFor } from "../engine/generate";
import { scaleTo100, type BowlingSet, type PhaseScope } from "../engine/resolve";
import type { BatterType, Family, Hand, PaceBand, SpinType, Swing } from "../engine/types";
import { FORMAT_LABEL } from "../engine/config";
import { FORMAT } from "../format";
import { store, type Player } from "../store";
import { Badge, Button, Card, Chip, Choice, ErrorNote, Field, inputCls } from "./bits";
import { defaultKeeperUp } from "./FieldScreen";

const SCOPES: [PhaseScope, string][] = [["overall", "Overall"], ["powerplay", "Powerplay"], ["middle", "Middle"], ["death", "Death"]];
const LINE_FIELDS = [["outsideOff", "Outside off"], ["off", "Off stump"], ["middle", "Middle stump"], ["leg", "Leg stump"], ["outsideLeg", "Outside leg"]] as const;
const LENGTH_FIELDS = [["short", "Short"], ["good", "Good length"], ["full", "Full"]] as const;

function describe(p: Player): string {
  if (!p.bowls) return `${p.battingHand === "R" ? "Right" : "Left"}-hand bat`;
  if (p.bowlFamily === "spin")
    return { off: "Off-spin", leg: "Leg-spin", lao: "Left-arm orthodox", law: "Left-arm wrist-spin" }[p.spinType ?? "off"];
  const swing = p.swing === "out" ? ", outswing" : p.swing === "in" ? ", inswing" : "";
  return `${p.bowlArm === "L" ? "Left" : "Right"}-arm ${p.paceBand ?? "pace"}${swing}`;
}

function dataBadge(sets: BowlingSet[]) {
  const mine = sets.filter((s) => s.format === FORMAT);
  const line = mine.some((s) => s.line);
  const length = mine.some((s) => s.length);
  const phases = mine.filter((s) => s.scope !== "overall").length;
  const text = line && length ? "line + length" : line ? "line only" : length ? "length only" : "no data";
  return (
    <span className="flex gap-1">
      <Badge tone={line || length ? "ok" : "warn"}>{text}</Badge>
      {phases > 0 && <Badge>{phases} phase set{phases > 1 ? "s" : ""}</Badge>}
    </span>
  );
}

export function PlayersScreen(props: { players: Player[]; bowling: BowlingSet[]; canEdit: boolean; reload: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Player | "new" | null>(null);

  if (editing) {
    const current = editing === "new" ? null : (props.players.find((p) => p.id === editing.id) ?? editing);
    return (
      <PlayerEditor
        player={current}
        sets={current ? props.bowling.filter((b) => b.playerId === current.id) : []}
        canEdit={props.canEdit}
        reload={props.reload}
        onSaved={(p) => setEditing(p)}
        onClose={() => setEditing(null)}
      />
    );
  }

  const shown = props.players
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Search players" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search players" />
        {props.canEdit && <Button onClick={() => setEditing("new")}>Add</Button>}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-slate-500">{props.players.length ? "No players match." : "No players yet."}</p>}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {shown.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setEditing(p)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left active:bg-slate-100">
              <span>
                <span className={`block font-semibold ${p.active ? "" : "text-slate-400 line-through"}`}>{p.name}</span>
                <span className="block text-sm text-slate-600">{describe(p)}</span>
              </span>
              {p.bowls && dataBadge(props.bowling.filter((b) => b.playerId === p.id))}
            </button>
          </li>
        ))}
      </ul>
      {!props.canEdit && <p className="text-sm text-slate-500">Only an Admin or Coach can add or edit players.</p>}
    </div>
  );
}

function PlayerEditor(props: {
  player: Player | null;
  sets: BowlingSet[];
  canEdit: boolean;
  reload: () => Promise<void>;
  onSaved: (p: Player) => void;
  onClose: () => void;
}) {
  const p = props.player;
  const [name, setName] = useState(p?.name ?? "");
  const [battingHand, setBattingHand] = useState<Hand>(p?.battingHand ?? "R");
  const [battingType, setBattingType] = useState<BatterType | "none">(p?.battingType ?? "none");
  const [bowls, setBowls] = useState(p?.bowls ?? true);
  const [family, setFamily] = useState<Family>(p?.bowlFamily ?? "pace");
  const [arm, setArm] = useState<Hand>(p?.bowlArm ?? "R");
  const [paceBand, setPaceBand] = useState<PaceBand>(p?.paceBand ?? "fast-medium");
  const [swing, setSwing] = useState<Swing>(p?.swing ?? "none");
  const [spinType, setSpinType] = useState<SpinType>(p?.spinType ?? "off");
  const [keeperUp, setKeeperUp] = useState<boolean | undefined>(p?.keeperUp);
  const [active, setActive] = useState(p?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ro = !props.canEdit;
  const keeper = keeperUp ?? defaultKeeperUp(family, paceBand);

  async function save() {
    if (!name.trim()) return setError("Enter a name.");
    setBusy(true);
    setError(null);
    try {
      const out = await store.savePlayer({
        id: p?.id,
        name: name.trim(),
        battingHand,
        battingType: battingType === "none" ? undefined : battingType,
        bowls,
        bowlFamily: bowls ? family : undefined,
        bowlArm: bowls ? (family === "spin" ? (spinType === "off" || spinType === "leg" ? "R" : "L") : arm) : undefined,
        paceBand: bowls && family === "pace" ? paceBand : undefined,
        swing: bowls && family === "pace" ? swing : undefined,
        spinType: bowls && family === "spin" ? spinType : undefined,
        keeperUp: bowls ? keeper : undefined,
        active,
      });
      await props.reload();
      props.onSaved(out);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const group = "flex flex-wrap gap-1.5";
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      <button type="button" className="text-sm font-semibold text-blue-700" onClick={props.onClose}>
        ← All players
      </button>
      <Card title={p ? p.name : "New player"}>
        <fieldset disabled={ro} className="space-y-3">
          <Field label="Name">
            <input className={inputCls} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
          </Field>
          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700">Batting hand</div>
            <div className={group}><Choice value={battingHand} onChange={setBattingHand} options={[["R", "Right"], ["L", "Left"]]} /></div>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700">Batting type (optional)</div>
            <div className={group}>
              <Choice value={battingType} onChange={setBattingType} options={[["none", "Not set"], ["aggressive", "Aggressive"], ["accumulator", "Accumulator"], ["technical", "Technical"], ["finisher", "Finisher"], ["tail", "Tail-ender"]]} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700">Bowls</div>
            <div className={group}>
              <Chip on={bowls} onClick={() => setBowls(true)}>Yes</Chip>
              <Chip on={!bowls} onClick={() => setBowls(false)}>No</Chip>
            </div>
          </div>
          {bowls && (
            <>
              <div>
                <div className="mb-1 text-sm font-semibold text-slate-700">Type of bowler</div>
                <div className={group}><Choice value={family} onChange={(f) => { setFamily(f); setKeeperUp(undefined); }} options={[["pace", "Pace"], ["spin", "Spin"]]} /></div>
              </div>
              {family === "pace" ? (
                <>
                  <div>
                    <div className="mb-1 text-sm font-semibold text-slate-700">Bowling arm</div>
                    <div className={group}><Choice value={arm} onChange={setArm} options={[["R", "Right-arm"], ["L", "Left-arm"]]} /></div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-semibold text-slate-700">Pace</div>
                    <div className={group}><Choice value={paceBand} onChange={(b) => { setPaceBand(b); setKeeperUp(undefined); }} options={[["fast", "Fast"], ["fast-medium", "Fast-medium"], ["medium", "Medium"]]} /></div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-semibold text-slate-700">Swing (as it behaves to a right-hander)</div>
                    <div className={group}><Choice value={swing} onChange={setSwing} options={[["none", "None"], ["out", "Outswing"], ["in", "Inswing"]]} /></div>
                  </div>
                </>
              ) : (
                <div>
                  <div className="mb-1 text-sm font-semibold text-slate-700">Spin type</div>
                  <div className={group}><Choice value={spinType} onChange={setSpinType} options={[["off", "Off-spin"], ["leg", "Leg-spin"], ["lao", "Left-arm orthodox"], ["law", "Left-arm wrist-spin"]]} /></div>
                </div>
              )}
              <div>
                <div className="mb-1 text-sm font-semibold text-slate-700">Keeper stands</div>
                <div className={group}>
                  <Chip on={keeper} onClick={() => setKeeperUp(true)}>Up to the stumps</Chip>
                  <Chip on={!keeper} onClick={() => setKeeperUp(false)}>Back</Chip>
                </div>
              </div>
            </>
          )}
          {p && (
            <div>
              <div className="mb-1 text-sm font-semibold text-slate-700">Status</div>
              <div className={group}>
                <Chip on={active} onClick={() => setActive(true)}>Active</Chip>
                <Chip on={!active} onClick={() => setActive(false)}>Inactive</Chip>
              </div>
            </div>
          )}
        </fieldset>
        {!ro && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={save} disabled={busy}>{p ? "Save player" : "Add player"}</Button>
            {saved && <span className="text-sm font-semibold text-emerald-700">Saved</span>}
          </div>
        )}
        <div className="mt-3"><ErrorNote error={error} /></div>
      </Card>

      {p && p.bowls && <BowlingData player={p} sets={props.sets} canEdit={props.canEdit} reload={props.reload} />}
      {!p && bowls && <p className="text-sm text-slate-500">Add the player first, then enter her line and length figures.</p>}
    </div>
  );
}

type Draft = Record<string, string>;
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function draftFrom(set: BowlingSet | undefined): Draft {
  const d: Draft = {};
  for (const [k] of LINE_FIELDS) d[k] = set?.line ? String(set.line[k]) : "";
  for (const [k] of LENGTH_FIELDS) d[k] = set?.length ? String(set.length[k]) : "";
  d.balls = set?.ballsSampled !== undefined ? String(set.ballsSampled) : "";
  d.note = set?.sourceNote ?? "";
  return d;
}

function BowlingData(props: { player: Player; sets: BowlingSet[]; canEdit: boolean; reload: () => Promise<void> }) {
  const [scope, setScope] = useState<PhaseScope>("overall");
  const existing = props.sets.find((s) => s.format === FORMAT && s.scope === scope);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(existing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ro = !props.canEdit;

  function pick(next: PhaseScope) {
    setScope(next);
    setDraft(draftFrom(props.sets.find((s) => s.format === FORMAT && s.scope === next)));
    setError(null);
    setSaved(false);
  }
  const edit = (k: string, v: string) => {
    setDraft((d) => ({ ...d, [k]: k === "note" ? v : v.replace(/[^0-9]/g, "").slice(0, 3) }));
    setSaved(false);
    setError(null);
  };

  const lineVals = LINE_FIELDS.map(([k]) => num(draft[k]));
  const lenVals = LENGTH_FIELDS.map(([k]) => num(draft[k]));
  const state = (vals: (number | undefined)[]) => {
    const filled = vals.filter((v) => v !== undefined).length;
    const total = vals.reduce<number>((a, v) => a + (v ?? 0), 0);
    return { empty: filled === 0, complete: filled === vals.length, total, ok: filled === 0 || (filled === vals.length && total === 100) };
  };
  const ls = state(lineVals);
  const ns = state(lenVals);
  const scale = (fields: readonly (readonly [string, string])[], vals: (number | undefined)[]) => {
    const out = scaleTo100(vals.map((v) => v ?? 0));
    setError(null);
    setDraft((d) => ({ ...d, ...Object.fromEntries(fields.map(([k], i) => [k, String(out[i])])) }));
  };

  const line = ls.complete && ls.total === 100
    ? { outsideOff: lineVals[0]!, off: lineVals[1]!, middle: lineVals[2]!, leg: lineVals[3]!, outsideLeg: lineVals[4]! }
    : undefined;
  const length = ns.complete && ns.total === 100 ? { short: lenVals[0]!, good: lenVals[1]!, full: lenVals[2]! } : undefined;

  async function save() {
    if (!ls.ok) return setError("Line: fill all five boxes so they total 100, or leave all five empty.");
    if (!ns.ok) return setError("Length: fill all three boxes so they total 100, or leave all three empty.");
    setBusy(true);
    setError(null);
    try {
      if (!line && !length) await store.deleteBowlingSet(props.player.id, FORMAT, scope);
      else
        await store.saveBowlingSet({
          playerId: props.player.id,
          format: FORMAT,
          scope,
          line,
          length,
          ballsSampled: num(draft.balls),
          sourceNote: draft.note.trim() || undefined,
        });
      await props.reload();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalBadge = (s: ReturnType<typeof state>) =>
    s.empty ? <Badge>empty</Badge> : <Badge tone={s.ok ? "ok" : "warn"}>total {s.total}{s.ok ? "" : " — must be 100"}</Badge>;
  const box = (k: string, label: string) => (
    <label key={k} className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="relative">
        <input className={`${inputCls} pr-7 text-right`} inputMode="numeric" value={draft[k]} onChange={(e) => edit(k, e.target.value)} aria-label={`${label} percent`} />
        <span className="pointer-events-none absolute top-2.5 right-2.5 text-slate-400">%</span>
      </div>
    </label>
  );

  return (
    <Card title={`${FORMAT_LABEL[FORMAT]} line and length`}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SCOPES.map(([s, label]) => {
          const has = props.sets.some((x) => x.format === FORMAT && x.scope === s);
          return <Chip key={s} on={scope === s} onClick={() => pick(s)}>{label}{has ? " ●" : ""}</Chip>;
        })}
      </div>
      <p className="mb-3 text-sm text-slate-600">
        {scope === "overall"
          ? "Used for any phase that has no figures of its own."
          : `Used only in the ${scope === "death" ? (FORMAT === "t20" ? "death overs and the Power Surge" : "death overs") : scope}. Leave empty to use the Overall figures.`}
      </p>
      <fieldset disabled={ro} className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">Line — where it passes the batter</span>
            <span className="flex items-center gap-2">
              {!ro && ls.complete && ls.total !== 100 && ls.total >= 95 && ls.total <= 105 && (
                <button type="button" className="text-xs font-semibold text-blue-700 underline" onClick={() => scale(LINE_FIELDS, lineVals)}>Scale to 100</button>
              )}
              {totalBadge(ls)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{LINE_FIELDS.map(([k, l]) => box(k, l))}</div>
          {line && <p className="mt-1 text-xs text-slate-600">Reads as: <b>{lineTagFor(line)}</b></p>}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">Length</span>
            <span className="flex items-center gap-2">
              {!ro && ns.complete && ns.total !== 100 && ns.total >= 95 && ns.total <= 105 && (
                <button type="button" className="text-xs font-semibold text-blue-700 underline" onClick={() => scale(LENGTH_FIELDS, lenVals)}>Scale to 100</button>
              )}
              {totalBadge(ns)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">{LENGTH_FIELDS.map(([k, l]) => box(k, l))}</div>
          {length && <p className="mt-1 text-xs text-slate-600">Reads as: <b>{lengthTagFor(length)}</b></p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Balls sampled</span>
            <input className={inputCls} inputMode="numeric" value={draft.balls} onChange={(e) => edit("balls", e.target.value)} />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Source note</span>
            <input className={inputCls} maxLength={200} value={draft.note} onChange={(e) => edit("note", e.target.value)} placeholder="e.g. last 4 games" />
          </label>
        </div>
      </fieldset>
      {!ro && (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={busy}>Save {SCOPES.find(([s]) => s === scope)![1].toLowerCase()} figures</Button>
          {saved && <span className="text-sm font-semibold text-emerald-700">Saved</span>}
        </div>
      )}
      <div className="mt-3"><ErrorNote error={error} /></div>
    </Card>
  );
}
