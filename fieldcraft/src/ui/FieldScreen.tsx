import { useEffect, useMemo, useState } from "react";
import { CONDITIONS, FORMAT_LABEL, PHASE_LABEL, RULES } from "../engine/config";
import { FORMAT, OTHER_FORMAT } from "../format";
import { describeBowler, generateField } from "../engine/generate";
import { resolveBowlingData, type BowlingSet, type DataSource } from "../engine/resolve";
import type { BallPlan, BatterType, Bowler, Family, Hand, PaceBand, Phase, ShortSide, SpinType, Swing } from "../engine/types";
import type { Player } from "../store";
import { Badge, Chip, Choice, Row } from "./bits";
import { FieldMap, MapLegend } from "./FieldMap";

interface Selection {
  grade: "1" | "2" | "3";
  phase: Phase;
  playerId: string | null;
  family: Family;
  arm: Hand;
  paceBand: PaceBand;
  swing: Swing;
  spinType: SpinType;
  around: boolean;
  keeperOverride: boolean | null;
  hand: Hand;
  batterType: BatterType | "none";
  newBatter: boolean;
  setBatter: boolean;
  needWickets: boolean;
  protectRuns: boolean;
  reverseSwing: boolean;
  shortSide: ShortSide;
  ballPlan: BallPlan;
}

const DEFAULT: Selection = {
  grade: "1",
  phase: "powerplay",
  playerId: null,
  family: "pace",
  arm: "R",
  paceBand: "fast-medium",
  swing: "none",
  spinType: "off",
  around: false,
  keeperOverride: null,
  hand: "R",
  batterType: "none",
  newBatter: false,
  setBatter: false,
  needWickets: false,
  protectRuns: false,
  reverseSwing: false,
  shortSide: "none",
  ballPlan: "none",
};

const SPIN_ARM: Record<SpinType, Hand> = { off: "R", leg: "R", lao: "L", law: "L" };

/** PRD §4.1: keeper stands up to spin and to medium pace by default. */
export function defaultKeeperUp(family: Family, band?: PaceBand): boolean {
  return family === "spin" || band === "medium";
}

function bowlerFromPlayer(p: Player): Bowler {
  const family = p.bowlFamily ?? "pace";
  return {
    family,
    arm: family === "spin" ? SPIN_ARM[p.spinType ?? "off"] : (p.bowlArm ?? "R"),
    paceBand: p.paceBand,
    swing: p.swing ?? "none",
    spinType: p.spinType,
    keeperUp: p.keeperUp ?? defaultKeeperUp(family, p.paceBand),
  };
}

const SOURCE_TEXT: Record<DataSource, string> = {
  phase: "this phase",
  overall: "overall figures",
  "other-format": `${FORMAT_LABEL[OTHER_FORMAT]} data`,
  none: "none",
};

export function FieldScreen(props: { players: Player[]; bowling: BowlingSet[]; userId: string }) {
  const storageKey = `fieldcraft-selection-${FORMAT}-${props.userId}`;
  const [sel, setSel] = useState<Selection>(() => {
    try {
      const saved = { ...DEFAULT, ...(JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<Selection>) };
      return RULES[FORMAT].phases.includes(saved.phase) ? saved : { ...saved, phase: "powerplay" };
    } catch {
      return DEFAULT;
    }
  });
  const [showWhy, setShowWhy] = useState(false);
  const set = (patch: Partial<Selection>) => setSel((s) => ({ ...s, ...patch }));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sel));
    } catch {
      /* not essential */
    }
  }, [sel, storageKey]);

  const bowlers = useMemo(() => props.players.filter((p) => p.active && p.bowls), [props.players]);
  const player = bowlers.find((p) => p.id === sel.playerId) ?? null;

  const base: Bowler = player
    ? bowlerFromPlayer(player)
    : sel.family === "spin"
      ? { family: "spin", arm: SPIN_ARM[sel.spinType], spinType: sel.spinType, keeperUp: true }
      : { family: "pace", arm: sel.arm, paceBand: sel.paceBand, swing: sel.swing, keeperUp: defaultKeeperUp("pace", sel.paceBand) };
  const bowler: Bowler = { ...base, aroundWicket: sel.around, keeperUp: sel.keeperOverride ?? base.keeperUp };

  const data = useMemo(
    () => resolveBowlingData(player ? props.bowling.filter((b) => b.playerId === player.id) : [], FORMAT, sel.phase),
    [player, props.bowling, sel.phase],
  );

  const rules = RULES[FORMAT];
  const cond = CONDITIONS[FORMAT][sel.grade];
  const isT20 = FORMAT === "t20";
  const planAvailable = isT20 && (sel.phase === "death" || sel.phase === "surge" || sel.batterType === "finisher");
  const reverseAvailable = !isT20 && bowler.family === "pace" && (sel.phase === "middle" || sel.phase === "death");
  const field = useMemo(
    () =>
      generateField(rules, {
        phase: sel.phase,
        bowler,
        batter: { hand: sel.hand, type: sel.batterType === "none" ? undefined : sel.batterType },
        line: data.line,
        length: data.length,
        modifiers: { newBatter: sel.newBatter, setBatter: sel.setBatter, needWickets: sel.needWickets, protectRuns: sel.protectRuns, reverseSwing: reverseAvailable && sel.reverseSwing },
        shortSide: isT20 ? sel.shortSide : "none",
        ballPlan: planAvailable ? sel.ballPlan : "none",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(bowler), data, sel, planAvailable, reverseAvailable],
  );

  const swap = (s: ShortSide): ShortSide => (s === "off" ? "leg" : s === "leg" ? "off" : "none");
  const generic = !data.line && !data.length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        <FieldMap field={field} hand={sel.hand} shortSide={isT20 ? sel.shortSide : "none"} />
        <button
          type="button"
          onClick={() => set({ hand: sel.hand === "R" ? "L" : "R", shortSide: swap(sel.shortSide) })}
          className="absolute right-2 bottom-2 rounded-full border-2 border-white bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg active:bg-slate-700"
        >
          ⇄ Flip hand
        </button>
        <div className="absolute bottom-2 left-2 rounded-lg bg-slate-900/85 px-2 py-1 text-xs font-semibold text-white">
          {field.counts.deep} out · {field.counts.legSide} leg side · max {rules.maxDeep[sel.phase]} out
        </div>
      </div>

      <div className="space-y-2 bg-white px-3 py-2">
        <p className="text-sm leading-snug font-medium text-slate-900">{field.rationale}</p>
        <div className="flex flex-wrap gap-1.5">
          {player ? (
            generic ? (
              <Badge tone="warn">Generic {describeBowler(base).toLowerCase()} field — no line/length data</Badge>
            ) : (
              <>
                <Badge tone={data.lineSource === "phase" ? "ok" : data.lineSource === "none" ? "warn" : "info"}>
                  Line: {data.line ? `${field.lineTag === "none" ? "ball plan overrides" : field.lineTag} (${SOURCE_TEXT[data.lineSource]})` : "no data"}
                </Badge>
                <Badge tone={data.lengthSource === "phase" ? "ok" : data.lengthSource === "none" ? "warn" : "info"}>
                  Length: {data.length ? `${field.lengthTag === "none" ? "ball plan overrides" : field.lengthTag} (${SOURCE_TEXT[data.lengthSource]})` : "no data"}
                </Badge>
                {data.smallSample && <Badge tone="warn">Small sample</Badge>}
              </>
            )
          ) : (
            <Badge>Generic bowler</Badge>
          )}
          {field.template !== sel.phase && <Badge>{PHASE_LABEL[field.template]} template</Badge>}
        </div>
      </div>
      <div className="border-y border-slate-200 bg-white px-3 pt-1 pb-1">
        <Row
          label="Grade"
          hint={`${cond.overs} overs · powerplay overs 1–${cond.powerplayEnd} · max ${cond.maxBowlerOvers} overs a bowler · ${sel.grade === "1" ? "11 players" : "12 may be nominated"}`}
        >
          <Choice value={sel.grade} onChange={(grade) => set({ grade })} options={[["1", "Grade 1"], ["2", "Grade 2"], ["3", "Grade 3"]]} />
        </Row>
        <Row
          label="Phase"
          hint={
            !isT20
              ? sel.phase === "powerplay"
                ? "Only 2 fielders out."
                : `4 fielders out for every over after the powerplay. Death here means overs ${cond.deathStart}–${cond.overs}.`
              : sel.phase === "surge"
                ? "Two overs the batters call from over 11. Only 2 fielders out."
                : sel.phase === "death"
                  ? "Overs 19–20 are Surge overs unless the Surge was taken earlier."
                  : undefined
          }
        >
          <Choice
            value={sel.phase}
            onChange={(phase) => set({ phase })}
            options={rules.phases.map((p) => [p, p === "powerplay" ? `Powerplay 1–${cond.powerplayEnd}` : p === "middle" && !isT20 ? `Middle ${cond.powerplayEnd + 1}–${cond.deathStart - 1}` : p === "death" && !isT20 ? `Death ${cond.deathStart}–${cond.overs}` : PHASE_LABEL[p]] as const)}
          />
        </Row>
        <Row label="Bowler">
          {bowlers.map((p) => (
            <Chip key={p.id} on={sel.playerId === p.id} onClick={() => set({ playerId: p.id, keeperOverride: null, around: false })}>
              {p.name}
            </Chip>
          ))}
          <Chip on={!player} onClick={() => set({ playerId: null, keeperOverride: null, around: false })}>
            Generic
          </Chip>
        </Row>
        {!player && (
          <>
            <Row label="Type">
              <Choice value={sel.family} onChange={(family) => set({ family, keeperOverride: null })} options={[["pace", "Pace"], ["spin", "Spin"]]} />
              <span className="mx-1 w-px shrink-0 bg-slate-300" />
              {sel.family === "pace" ? (
                <>
                  <Choice value={sel.arm} onChange={(arm) => set({ arm })} options={[["R", "Right-arm"], ["L", "Left-arm"]]} />
                  <span className="mx-1 w-px shrink-0 bg-slate-300" />
                  <Choice
                    value={sel.paceBand}
                    onChange={(paceBand) => set({ paceBand, keeperOverride: null })}
                    options={[["fast", "Fast"], ["fast-medium", "Fast-medium"], ["medium", "Medium"]]}
                  />
                </>
              ) : (
                <Choice
                  value={sel.spinType}
                  onChange={(spinType) => set({ spinType })}
                  options={[["off", "Off-spin"], ["leg", "Leg-spin"], ["lao", "Left-arm orthodox"], ["law", "Left-arm wrist-spin"]]}
                />
              )}
            </Row>
            {sel.family === "pace" && (
              <Row label="Swing" hint="As it behaves to a right-hander.">
                <Choice value={sel.swing} onChange={(swing) => set({ swing })} options={[["none", "None"], ["out", "Outswing"], ["in", "Inswing"]]} />
              </Row>
            )}
          </>
        )}
        <Row label="Delivery">
          <Chip on={!sel.around} onClick={() => set({ around: false })}>Over the wicket</Chip>
          <Chip on={sel.around} onClick={() => set({ around: true })}>Around</Chip>
          <span className="mx-1 w-px shrink-0 bg-slate-300" />
          <Chip on={bowler.keeperUp} onClick={() => set({ keeperOverride: true })}>Keeper up</Chip>
          <Chip on={!bowler.keeperUp} onClick={() => set({ keeperOverride: false })}>Keeper back</Chip>
        </Row>
        <Row label="Batter">
          <Choice value={sel.hand} onChange={(hand) => set({ hand })} options={[["R", "Right-hand"], ["L", "Left-hand"]]} />
          <span className="mx-1 w-px shrink-0 bg-slate-300" />
          <Choice
            value={sel.batterType}
            onChange={(batterType) => set({ batterType })}
            options={[["none", "Any"], ["aggressive", "Aggressive"], ["accumulator", "Accumulator"], ["technical", "Technical"], ["finisher", "Finisher"], ["tail", "Tail-ender"]]}
          />
        </Row>
        <Row label="Match">
          <Chip on={sel.newBatter} onClick={() => set({ newBatter: !sel.newBatter, setBatter: false })}>New batter in</Chip>
          <Chip on={sel.setBatter} onClick={() => set({ setBatter: !sel.setBatter, newBatter: false })}>Set batter</Chip>
          <Chip on={sel.needWickets} onClick={() => set({ needWickets: !sel.needWickets, protectRuns: false })}>Need wickets</Chip>
          <Chip on={sel.protectRuns} onClick={() => set({ protectRuns: !sel.protectRuns, needWickets: false })}>Protect runs</Chip>
          {reverseAvailable && (
            <Chip on={sel.reverseSwing} onClick={() => set({ reverseSwing: !sel.reverseSwing })}>Old ball reversing</Chip>
          )}
        </Row>
        {isT20 && <Row label="Short side" hint={sel.shortSide !== "none" ? "For the batter shown. Flips with the batter's hand." : undefined}>
          <Choice value={sel.shortSide} onChange={(shortSide) => set({ shortSide })} options={[["none", "None"], ["off", "Off side"], ["leg", "Leg side"]]} />
          {sel.shortSide !== "none" && (
            <Chip on={false} onClick={() => set({ shortSide: swap(sel.shortSide) })}>⇄ Switch ends</Chip>
          )}
        </Row>}
        {planAvailable && (
          <Row label="Ball plan" hint={sel.ballPlan === "bouncer" ? "One short-pitched ball per over (Rule 19.11)." : undefined}>
            <Choice
              value={sel.ballPlan}
              onChange={(ballPlan) => set({ ballPlan })}
              options={[["none", "None"], ["yorker", "Yorker"], ["wideYorker", "Wide yorker"], ["slower", "Slower ball"], ["bouncer", "Bouncer"]]}
            />
          </Row>
        )}
      </div>

      <div className="space-y-2 bg-white px-3 py-3">
        <MapLegend />
        <button type="button" className="text-sm font-semibold text-blue-700 underline" onClick={() => setShowWhy(!showWhy)}>
          {showWhy ? "Hide the steps" : "Show every step"}
        </button>
        {showWhy && (
          <ol className="space-y-1 text-sm">
            {field.fired.map((r, i) => (
              <li key={i} className={r.skipped ? "text-slate-500" : "text-slate-900"}>
                <span className="mr-1 inline-block w-14 text-xs font-bold text-slate-500">Step {r.step}</span>
                {r.text}
                {r.skipped && " — not applied"}
              </li>
            ))}
            {field.fired.length === 0 && <li className="text-slate-500">Base template, nothing else applied.</li>}
          </ol>
        )}
        <p className="text-xs text-slate-500">
          Free hit: the field may change only if a different batter is on strike (Rule 17.10.1).
        </p>
      </div>
    </div>
  );
}
