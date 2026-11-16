import {
  CLOSE_DONORS,
  HELMET_POSITIONS,
  KEEPER,
  LEG_RING_DONORS,
  OFF_RING_DONORS,
  PHASE_LABEL,
  POS,
  POSITIONS,
  THRESHOLDS,
} from "./config";
import type {
  Bowler,
  FieldResult,
  FiredRule,
  FormatRules,
  Hand,
  LengthTag,
  LineTag,
  Movement,
  Phase,
  Side,
  Situation,
  Thresholds,
} from "./types";

/** Batter-relative side of a position (off = theta 0–180, leg = 180–360). */
export function sideOf(name: string): Side {
  return POS[name].theta > 180 ? "leg" : "off";
}

function isBehindSquareLeg(name: string): boolean {
  const t = POS[name].theta;
  return t > 180 && t < 270;
}

function angDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** PRD §5.3 Step 2: does the ball move away from this batter or in to her? */
export function movementFor(bowler: Bowler, hand: Hand): Movement {
  if (bowler.family === "spin") {
    const inToRight = bowler.spinType === "off" || bowler.spinType === "law";
    return (hand === "R") === inToRight ? "in" : "away";
  }
  const swing = bowler.swing ?? "none";
  if (swing === "out") return hand === "R" ? "away" : "in";
  if (swing === "in") return hand === "R" ? "in" : "away";
  // No swing: the angle across the batter finds the outside edge, unless the bowler
  // comes around the wicket to the opposite-hand batter and angles it in.
  if (bowler.aroundWicket && bowler.arm !== hand) return "in";
  return "away";
}

export function lineTagFor(line: Situation["line"], t: Thresholds = THRESHOLDS): LineTag {
  if (!line) return "none";
  const off = line.outsideOff + line.off;
  const leg = line.leg + line.outsideLeg;
  const straight = line.off + line.middle + line.leg;
  if (off >= t.offChannel && leg >= t.legDrift) return "sprayed";
  if (off >= t.offChannel) return "off-channel";
  if (leg >= t.legDrift) return "leg-drift";
  if (straight >= t.straight) return "straight";
  return "balanced";
}

export function lengthTagFor(length: Situation["length"], t: Thresholds = THRESHOLDS): LengthTag {
  if (!length) return "none";
  if (length.short >= t.shortHeavy) return "short-heavy";
  if (length.full >= t.fullHeavy) return "full-heavy";
  if (length.good >= t.goodLength) return "good-length";
  return "mixed";
}

export function describeBowler(b: Bowler): string {
  if (b.family === "spin") {
    return { off: "Off-spin", leg: "Leg-spin", lao: "Left-arm orthodox", law: "Left-arm wrist-spin" }[
      b.spinType ?? "off"
    ];
  }
  const arm = b.arm === "R" ? "Right-arm" : "Left-arm";
  const band = { fast: "fast", "fast-medium": "fast-medium", medium: "medium" }[b.paceBand ?? "fast-medium"];
  const swing = b.swing === "out" ? ", outswing" : b.swing === "in" ? ", inswing" : "";
  return `${arm} ${band}${swing}${b.aroundWicket ? ", around the wicket" : ""}`;
}

type AttackOutcome = "ok" | "cap" | "none";

class Field {
  set: string[];
  /** deep keep-priority, highest first */
  keep: string[];
  locked: string[] = [];
  added: string[] = [];
  fired: FiredRule[] = [];

  constructor(
    private rules: FormatRules,
    private phase: Phase,
    private shortSide: Side | null,
    template: { close: string[]; ring: string[]; deep: string[] },
  ) {
    this.set = [...template.close, ...template.ring, ...template.deep];
    this.keep = [...template.deep];
  }

  has(n: string) {
    return this.set.includes(n);
  }
  count(zone: string) {
    return this.set.filter((n) => POS[n].zone === zone).length;
  }
  get maxDeep() {
    return this.rules.maxDeep[this.phase]!;
  }
  get cap() {
    return this.rules.catcherCap[this.phase]!;
  }
  legCount() {
    return this.set.filter((n) => sideOf(n) === "leg").length;
  }
  behindCount() {
    return this.set.filter(isBehindSquareLeg).length;
  }
  note(step: string, text: string, skipped = false, quiet = false) {
    this.fired.push({ step, text, skipped, quiet });
  }

  move(from: string, to: string) {
    this.set[this.set.indexOf(from)] = to;
    this.keep = this.keep.filter((n) => n !== from);
    this.locked = this.locked.filter((n) => n !== from);
    this.added = this.added.filter((n) => n !== from);
  }

  firstFree(list: string[]) {
    return list.find((n) => !this.has(n));
  }
  firstPresent(list: string[]) {
    return list.find((n) => this.has(n));
  }
  ringDonor(side: Side, exclude: string[] = []) {
    const list = side === "leg" ? LEG_RING_DONORS : OFF_RING_DONORS;
    return list.find((n) => this.has(n) && !exclude.includes(n));
  }
  ringCount(side: Side) {
    return this.set.filter((n) => POS[n].zone === "ring" && sideOf(n) === side).length;
  }
  /** A ring donor that does not leave its side of the ring empty. */
  spareRingDonor(side: Side) {
    return this.ringCount(side) > 1 ? this.ringDonor(side) : undefined;
  }
  nearestFreeRing(theta: number) {
    return POSITIONS.filter((p) => p.zone === "ring" && !this.has(p.name)).sort(
      (a, b) => angDiff(a.theta, theta) - angDiff(b.theta, theta),
    )[0]?.name;
  }

  /** Deep fielders ordered from first-to-go to last-to-go. */
  private deepByExpendability(): string[] {
    const deep = this.set.filter((n) => POS[n].zone === "deep");
    const rank = (n: string) => {
      const k = this.keep.indexOf(n);
      return k < 0 ? this.keep.length : k;
    };
    const unlocked = deep.filter((n) => !this.locked.includes(n));
    const normal = unlocked.filter((n) => sideOf(n) !== this.shortSide).sort((a, b) => rank(b) - rank(a));
    const short = unlocked.filter((n) => sideOf(n) === this.shortSide).sort((a, b) => rank(b) - rank(a));
    const locked = [...this.locked].reverse().filter((n) => deep.includes(n));
    return [...normal, ...short, ...locked];
  }

  /** Bring deep fielders in until the phase limit is met. */
  fitDeep(step: string) {
    while (this.count("deep") > this.maxDeep) {
      const victim = this.deepByExpendability()[0];
      const partner = POS[victim].partner!;
      const to = this.has(partner) ? this.nearestFreeRing(POS[victim].theta)! : partner;
      this.move(victim, to);
      this.note(step, `${victim} brought in to ${to.toLowerCase()} (max ${this.maxDeep} outside)`, false, step === "1");
    }
  }

  /** Add a close catcher, funded by a ring fielder from the opposite side. */
  attack(list: string[], step: string, why: string): AttackOutcome {
    if (this.count("close") >= this.cap) {
      this.note(step, `${why}: no catcher added (close-catcher cap of ${this.cap} reached)`, true);
      return "cap";
    }
    const target = this.firstFree(list);
    if (!target) {
      this.note(step, `${why}: no free catching position`, true);
      return "none";
    }
    const other: Side = sideOf(target) === "off" ? "leg" : "off";
    const donor =
      this.spareRingDonor(other) ?? this.spareRingDonor(sideOf(target)) ?? this.ringDonor(other) ?? this.ringDonor(sideOf(target));
    if (!donor) {
      this.note(step, `${why}: no ring fielder available to bring in`, true);
      return "none";
    }
    this.move(donor, target);
    this.added.push(target);
    this.note(step, `${why} → ${target.toLowerCase()} added (from ${donor.toLowerCase()})`);
    return "ok";
  }

  /** Make sure a deep position is manned. */
  protect(list: string[], step: string, why: string, lock = false): boolean {
    const target = this.firstFree(list);
    if (!target) {
      if (lock) for (const n of list) if (!this.locked.includes(n)) this.locked.push(n);
      this.note(step, `${why}: ${list.join(" / ").toLowerCase()} already manned`, true);
      return false;
    }
    let donor: string | undefined;
    if (this.count("deep") < this.maxDeep) {
      const other: Side = sideOf(target) === "off" ? "leg" : "off";
      donor = this.firstPresent(CLOSE_DONORS) ?? this.spareRingDonor(other) ?? this.spareRingDonor(sideOf(target));
    } else {
      donor = this.deepByExpendability().find(
        (n) => !list.includes(n) && !this.locked.includes(n) && sideOf(n) !== this.shortSide,
      );
    }
    if (!donor) {
      this.note(step, `${why}: no fielder available to move to ${target.toLowerCase()}`, true);
      return false;
    }
    this.move(donor, target);
    this.keep = [target, ...this.keep.filter((n) => n !== target)];
    if (lock) this.locked.push(target);
    this.note(step, `${why} → ${target.toLowerCase()} manned (from ${donor.toLowerCase()})`);
    return true;
  }

  /** Shift one ring fielder from one side to a named spot on the other. */
  shiftRing(from: Side, targets: string[], step: string, why: string): boolean {
    // never strip a side of its last ring fielder
    const donor = this.spareRingDonor(from);
    const target = this.firstFree(targets);
    if (!donor || !target) {
      this.note(step, `${why}: no ring fielder to shift`, true);
      return false;
    }
    this.move(donor, target);
    this.note(step, `${why} → ${donor.toLowerCase()} moved to ${target.toLowerCase()}`);
    return true;
  }

  ensureStraight(step: string, why: string) {
    let changed = false;
    for (const need of ["Mid-off", "Mid-on"]) {
      if (this.has(need)) continue;
      // A long-off / long-on already guards that straight boundary; don't stand a fielder in front of her.
      if (this.has(need === "Mid-off" ? "Long-off" : "Long-on")) continue;
      const ring = (s: Side) => this.set.filter((n) => POS[n].zone === "ring" && sideOf(n) === s).length;
      const side: Side = ring("leg") > ring("off") ? "leg" : "off";
      const ex = ["Mid-off", "Mid-on"];
      // mid-off and mid-on sit either side of the bowler, so this never empties a side
      const donor = this.ringDonor(side, ex) ?? this.ringDonor(side === "leg" ? "off" : "leg", ex);
      if (!donor) continue;
      this.move(donor, need);
      this.note(step, `${why} → ${donor.toLowerCase()} moved to ${need.toLowerCase()}`);
      changed = true;
    }
    if (!changed) this.note(step, `${why}: straight field already in place`, true);
  }

  /** Send the most recently added catcher (or the most expendable one) back to the ring. */
  dropCatcher(step: string, why: string): boolean {
    const present = this.added.filter((n) => this.has(n));
    const victim = present[present.length - 1] ?? this.firstPresent(CLOSE_DONORS);
    if (!victim) {
      this.note(step, `${why}: no close catcher to move back`, true);
      return false;
    }
    const to = this.nearestFreeRing(POS[victim].theta)!;
    this.move(victim, to);
    this.note(step, `${why} → ${victim.toLowerCase()} moved back to ${to.toLowerCase()}`);
    return true;
  }
}

const AWAY_CATCHERS = {
  pace: ["1st slip", "2nd slip", "Gully", "3rd slip"],
  spin: ["1st slip", "Silly point", "Short cover"],
};
const IN_CATCHERS = {
  pace: ["Short midwicket", "Leg slip"],
  spin: ["Short leg", "Leg slip", "Short midwicket"],
};
const OFF_RING_TARGETS = ["Backward point", "Extra cover", "Short third man"];
const LEG_RING_TARGETS = ["Square leg", "Short fine leg", "Midwicket"];

/** PRD §5.3 — the whole algorithm. Pure: no I/O, safe to run offline. */
export function generateField(rules: FormatRules, s: Situation, thresholds: Thresholds = THRESHOLDS): FieldResult {
  const { bowler, batter, phase } = s;
  const mods = s.modifiers ?? {};
  const family = bowler.family;
  const shortSide: Side | null = s.shortSide && s.shortSide !== "none" ? s.shortSide : null;

  // Step 1 — base template
  const templatePhase: Phase = batter.type === "finisher" && phase !== "surge" ? "death" : phase;
  const template = rules.templates[family][templatePhase];
  if (!template || !rules.phases.includes(phase)) throw new Error(`No ${family} template for ${templatePhase} in ${rules.format}`);
  const f = new Field(rules, phase, shortSide, template);
  if (templatePhase !== phase) f.note("1", "Finisher at the crease → death-overs field");
  f.fitDeep("1");

  // Step 2 — movement bias
  // One-Day: an old ball reversing swings the opposite way to the bowler's usual shape.
  const reversing = !!mods.reverseSwing && family === "pace" && (phase === "middle" || phase === "death");
  const natural = movementFor(bowler, batter.hand);
  const movement: Movement = reversing ? (natural === "away" ? "in" : "away") : natural;
  const moveWord = reversing ? "reversing" : family === "spin" ? "turning" : bowler.swing && bowler.swing !== "none" ? "swinging" : "angled";
  const attackMovement = (step: string, why: string, allowSlipMove: boolean) => {
    if (movement === "away") return f.attack(AWAY_CATCHERS[family], step, why);
    const out = f.attack(IN_CATCHERS[family], step, why);
    if (out === "cap" && allowSlipMove) {
      const slip = f.firstPresent(["3rd slip", "2nd slip", "1st slip"]);
      const target = f.firstFree(IN_CATCHERS[family]);
      if (slip && target) {
        f.fired.pop();
        f.move(slip, target);
        f.added.push(target);
        f.note(step, `${why} → ${slip.toLowerCase()} moved to ${target.toLowerCase()}`);
        return "ok" as const;
      }
    }
    return out;
  };
  attackMovement("2", `${moveWord[0].toUpperCase()}${moveWord.slice(1)} ${movement}`, true);
  if (reversing) f.protect([movement === "away" ? "Third man" : "Fine leg"], "2", "Old ball reversing");

  // Ball plan (T20 §2.5) is only live when a death or surge template is in use.
  const plan = s.ballPlan && s.ballPlan !== "none" && (templatePhase === "death" || templatePhase === "surge") ? s.ballPlan : null;

  // Step 3 — line
  const line = plan === "wideYorker" ? undefined : s.line;
  const lineTag = lineTagFor(line, thresholds);
  let offShiftDone = false;
  if (line) {
    const off = line.outsideOff + line.off;
    const leg = line.leg + line.outsideLeg;
    if (lineTag === "sprayed") {
      f.note("3", `Line sprayed (${off}% off side, ${leg}% leg side) — no side favoured`, true);
    } else if (lineTag === "off-channel") {
      offShiftDone = f.shiftRing("leg", OFF_RING_TARGETS, "3", `Line ${off}% off side`);
      if (line.outsideOff >= thresholds.wideOff)
        f.protect(["Third man", "Deep point"], "3", `${line.outsideOff}% wide of off`);
    } else if (lineTag === "leg-drift") {
      f.shiftRing("off", LEG_RING_TARGETS, "3", `Line ${leg}% leg side`);
      f.protect(["Fine leg", "Deep square leg"], "3", "Leg-side drift");
      if (line.outsideLeg >= thresholds.wideLeg && f.has("Fine leg"))
        f.keep = ["Fine leg", ...f.keep.filter((n) => n !== "Fine leg")];
    } else if (lineTag === "straight") {
      f.ensureStraight("3", "Line stump to stump");
    }
  }

  // Step 4 — length (replaced by a ball plan)
  const length = plan ? undefined : s.length;
  const lengthTag = lengthTagFor(length, thresholds);
  if (length) {
    if (lengthTag === "short-heavy") {
      f.protect(
        family === "pace" ? ["Deep square leg", "Third man"] : ["Deep midwicket", "Deep point"],
        "4",
        `${length.short}% short`,
      );
    } else if (lengthTag === "full-heavy") {
      if (phase === "powerplay") f.ensureStraight("4", `${length.full}% full`);
      else f.protect(["Long-on", "Long-off"], "4", `${length.full}% full`);
    }
  }

  // Step 4b — T20 match inputs
  if (shortSide && (phase === "middle" || phase === "death")) {
    f.protect(
      shortSide === "off" ? ["Deep point", "Deep cover"] : ["Deep square leg", "Deep midwicket"],
      "4b",
      `Short ${shortSide}-side boundary`,
    );
  }
  if (plan) {
    const P = (n: string, why: string) => f.protect([n], "4b", why, true);
    if (plan === "yorker") {
      P("Long-on", "Yorker plan");
      P("Long-off", "Yorker plan");
      P("Deep square leg", "Yorker plan");
    } else if (plan === "wideYorker") {
      P("Deep point", "Wide-yorker plan");
      P("Deep cover", "Wide-yorker plan");
      P("Long-off", "Wide-yorker plan");
      offShiftDone = f.shiftRing("leg", OFF_RING_TARGETS, "4b", "Wide-yorker plan") || offShiftDone;
    } else if (plan === "slower") {
      P("Deep midwicket", "Slower-ball plan");
      P("Long-on", "Slower-ball plan");
      P("Long-off", "Slower-ball plan");
    } else if (plan === "bouncer") {
      P("Deep square leg", "Bouncer plan");
      P("Fine leg", "Bouncer plan");
      P("Third man", "Bouncer plan");
    }
  }

  // Step 5 — batter type
  let attackedForNewBatter = false;
  if (batter.type === "aggressive") {
    f.protect(
      movement === "in" ? ["Cow corner", "Deep midwicket", "Long-on"] : ["Deep cover", "Long-off", "Deep point"],
      "5",
      "Aggressive batter",
    );
  } else if (batter.type === "technical") {
    if (!offShiftDone) f.shiftRing("leg", OFF_RING_TARGETS, "5", "Technical batter");
  } else if (batter.type === "tail") {
    attackMovement("5", "Tail-ender", false);
    attackedForNewBatter = true;
    if (family === "pace") f.attack(["Short leg"], "5", "Tail-ender, short-ball trap");
  }

  // Step 6 — modifiers
  if (mods.newBatter && !attackedForNewBatter) attackMovement("6", "New batter", false);
  if (mods.setBatter) {
    f.protect(movement === "in" ? ["Deep midwicket", "Long-on"] : ["Deep cover", "Long-off"], "6", "Set batter");
  }
  if (mods.needWickets) attackMovement("6", "Need wickets", false);
  if (mods.protectRuns) f.dropCatcher("6", "Protect runs");

  // Step 7 — enforce the laws
  let guard = 0;
  while (f.count("close") > f.cap && guard++ < 9) f.dropCatcher("7", "Close-catcher cap");
  f.fitDeep("7");
  guard = 0;
  while (f.legCount() > rules.maxLegSide && guard++ < 9) {
    const donor =
      f.spareRingDonor("leg") ??
      f.firstPresent(["Leg slip", "Short leg", "Short midwicket"]) ??
      f.ringDonor("leg") ??
      f.set.filter((n) => sideOf(n) === "leg")[0];
    const to = f.firstFree(["Cover", "Point", "Mid-off", "Extra cover", "Backward point", "Short third man"])!;
    f.move(donor, to);
    f.note("7", `${donor} moved to ${to.toLowerCase()} (max ${rules.maxLegSide} on the leg side)`);
  }
  guard = 0;
  while (f.behindCount() > rules.maxBehindSquareLeg && guard++ < 9) {
    const donor = f.firstPresent(["Short fine leg", "Leg slip", "Deep fine leg", "Fine leg"])!;
    const to = f.firstFree(["Square leg", "Midwicket", "Mid-on"])!;
    f.move(donor, to);
    f.note("7", `${donor} moved to ${to.toLowerCase()} (max ${rules.maxBehindSquareLeg} behind square leg)`);
  }
  if (f.set.length !== 9 || new Set(f.set).size !== 9) throw new Error("Field must be 9 distinct positions");

  // Steps 8–9 — keeper, radii, mirror
  const mirror = (theta: number) => (batter.hand === "L" ? (360 - theta) % 360 : theta);
  const fielders = f.set.map((name) => {
    const p = POS[name];
    return {
      name,
      zone: p.zone,
      side: sideOf(name),
      theta: mirror(p.theta),
      r: bowler.keeperUp && p.rUp !== undefined ? p.rUp : p.r,
      helmet: HELMET_POSITIONS.has(name),
    };
  });

  // Step 10 — rationale, built only from what fired
  const lead = `${describeBowler(bowler)} to a ${batter.hand === "R" ? "right" : "left"}-hander, ${PHASE_LABEL[phase]}`;
  const parts = f.fired.filter((x) => !x.skipped && !x.quiet).map((x) => x.text);
  const rationale = `${lead}: ${parts.length ? parts.join(". ") : "base field"}.`;

  return {
    fielders,
    keeper: { theta: KEEPER.theta, r: bowler.keeperUp ? KEEPER.rUp : KEEPER.rBack, up: bowler.keeperUp },
    movement,
    template: templatePhase,
    lineTag,
    lengthTag,
    fired: f.fired,
    rationale,
    counts: {
      close: f.count("close"),
      ring: f.count("ring"),
      deep: f.count("deep"),
      legSide: f.legCount(),
      behindSquareLeg: f.behindCount(),
    },
  };
}
