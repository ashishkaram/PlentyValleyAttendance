import { describe, expect, it } from "vitest";
import { POS, T20_RULES } from "./config";
import { generateField, lineTagFor } from "./generate";
import { resolveBowlingData, scaleTo100, type BowlingSet } from "./resolve";
import type { BatterType, Bowler, FieldResult, FormatRules, Hand, LineData, Phase, Situation } from "./types";

const R = T20_RULES;
const pace = (o: Partial<Bowler> = {}): Bowler => ({ arm: "R", family: "pace", paceBand: "fast-medium", swing: "none", keeperUp: false, ...o });
const spin = (spinType: Bowler["spinType"]): Bowler => ({ arm: spinType === "off" || spinType === "leg" ? "R" : "L", family: "spin", spinType, keeperUp: true });
const gen = (s: Partial<Situation> & { bowler: Bowler }, hand: Hand = "R") =>
  generateField(R, { phase: "middle", batter: { hand }, ...s });
const names = (f: FieldResult) => f.fielders.map((x) => x.name);
const fielder = (f: FieldResult, n: string) => f.fielders.find((x) => x.name === n)!;
/** +1 = screen right, -1 = screen left */
const screenSide = (f: FieldResult, n: string) => Math.sign(Math.sin((fielder(f, n).theta * Math.PI) / 180));
const count = (f: FieldResult, pred: (n: string) => boolean) => names(f).filter(pred).length;
const offRing = (n: string) => POS[n].zone === "ring" && POS[n].theta < 180;
const legRing = (n: string) => POS[n].zone === "ring" && POS[n].theta > 180;
const line = (a: number, b: number, c: number, d: number, e: number): LineData => ({ outsideOff: a, off: b, middle: c, leg: d, outsideLeg: e });

describe("movement and mirroring (PRD §9 rows 1–9)", () => {
  it("1: right-arm outswing to RHB in the powerplay adds a slip on screen right", () => {
    const f = gen({ bowler: pace({ swing: "out" }), phase: "powerplay" });
    expect(f.movement).toBe("away");
    expect(names(f)).toContain("2nd slip");
    expect(screenSide(f, "2nd slip")).toBe(1);
  });
  it("2: same bowler to LHB moves in — short midwicket, drawn on screen right", () => {
    const f = gen({ bowler: pace({ swing: "out" }), phase: "powerplay" }, "L");
    expect(f.movement).toBe("in");
    expect(names(f)).toContain("Short midwicket");
    expect(fielder(f, "Short midwicket").side).toBe("leg");
    expect(screenSide(f, "Short midwicket")).toBe(1);
  });
  it("3: right-arm inswing to LHB moves away — slip on screen left", () => {
    const f = gen({ bowler: pace({ swing: "in" }), phase: "powerplay" }, "L");
    expect(f.movement).toBe("away");
    expect(screenSide(f, "2nd slip")).toBe(-1);
  });
  it("4: off-spin to RHB turns in — short leg on screen left", () => {
    const f = gen({ bowler: spin("off") });
    expect(names(f)).toContain("Short leg");
    expect(screenSide(f, "Short leg")).toBe(-1);
  });
  it("5: off-spin to LHB turns away — slip on screen left", () => {
    const f = gen({ bowler: spin("off") }, "L");
    expect(names(f)).toContain("1st slip");
    expect(screenSide(f, "1st slip")).toBe(-1);
  });
  it("6: leg-spin to RHB turns away — slip on screen right", () => {
    const f = gen({ bowler: spin("leg") });
    expect(names(f)).toContain("1st slip");
    expect(screenSide(f, "1st slip")).toBe(1);
  });
  it("7: leg-spin to LHB turns in — short leg on screen right", () => {
    const f = gen({ bowler: spin("leg") }, "L");
    expect(names(f)).toContain("Short leg");
    expect(screenSide(f, "Short leg")).toBe(1);
  });
  it("8: left-arm orthodox to RHB matches leg-spin", () => {
    expect(names(gen({ bowler: spin("lao") }))).toEqual(names(gen({ bowler: spin("leg") })));
  });
  it("9: left-arm wrist-spin to RHB matches off-spin", () => {
    expect(names(gen({ bowler: spin("law") }))).toEqual(names(gen({ bowler: spin("off") })));
  });
});

const BOWLERS: Bowler[] = [
  pace(), pace({ swing: "out" }), pace({ swing: "in" }), pace({ arm: "L" }), pace({ arm: "L", swing: "in" }),
  pace({ aroundWicket: true }), pace({ paceBand: "medium", keeperUp: true }),
  spin("off"), spin("leg"), spin("lao"), spin("law"),
];
const PHASES: Phase[] = ["powerplay", "middle", "surge", "death"];
const TYPES: (BatterType | undefined)[] = [undefined, "aggressive", "accumulator", "technical", "finisher", "tail"];
const LINES = [undefined, line(40, 20, 20, 10, 10), line(10, 20, 30, 20, 20), line(35, 25, 5, 15, 20), line(10, 30, 40, 15, 5), line(5, 10, 20, 25, 40)];
const LENGTHS = [undefined, { short: 45, good: 40, full: 15 }, { short: 10, good: 40, full: 50 }, { short: 20, good: 60, full: 20 }];
const MODS = [{}, { newBatter: true, needWickets: true }, { setBatter: true, protectRuns: true }, { needWickets: true }, { protectRuns: true }];

function checkLaws(f: FieldResult, phase: Phase, rules: FormatRules = R) {
  expect(f.fielders).toHaveLength(9);
  expect(new Set(names(f)).size).toBe(9);
  expect(f.counts.deep).toBeLessThanOrEqual(rules.maxDeep[phase]);
  expect(f.counts.close).toBeLessThanOrEqual(rules.catcherCap[phase]);
  expect(f.counts.legSide).toBeLessThanOrEqual(5);
  expect(f.counts.behindSquareLeg).toBeLessThanOrEqual(2);
}

describe("laws hold for every combination (rows 11–13, 25, 32)", () => {
  it("full sweep", () => {
    let n = 0;
    for (const bowler of BOWLERS) for (const hand of ["R", "L"] as Hand[]) for (const phase of PHASES)
      for (const type of TYPES) for (const ln of LINES) for (const len of LENGTHS) for (const modifiers of MODS)
        for (const shortSide of ["none", "off", "leg"] as const) for (const ballPlan of ["none", "yorker", "wideYorker", "slower", "bouncer"] as const) {
          const f = generateField(R, { phase, bowler, batter: { hand, type }, line: ln, length: len, modifiers, shortSide, ballPlan });
          checkLaws(f, phase);
          n++;
        }
    expect(n).toBeGreaterThan(100000);
  }, 60000);
});

describe("templates and config", () => {
  it("10: a Finisher in the powerplay gets the death template cut to the powerplay limit", () => {
    const f = gen({ bowler: pace(), phase: "powerplay", batter: { hand: "R", type: "finisher" } });
    expect(f.template).toBe("death");
    expect(f.counts.deep).toBe(2);
  });
  it("a Finisher never replaces the Surge template", () => {
    expect(gen({ bowler: pace(), phase: "surge", batter: { hand: "R", type: "finisher" } }).template).toBe("surge");
  });
  it("14: raising max_deep_middle to 5 keeps the fifth deep fielder out with no code change", () => {
    const five = { ...R, maxDeep: { ...R.maxDeep, middle: 5 } };
    expect(gen({ bowler: pace() }).counts.deep).toBe(4);
    expect(generateField(five, { phase: "middle", bowler: pace(), batter: { hand: "R" } }).counts.deep).toBe(5);
  });
  it("25: at most 4 deep in middle and death; 34: powerplay and surge allow 2", () => {
    expect(R.maxDeep).toEqual({ powerplay: 2, middle: 4, surge: 2, death: 4 });
  });
  it("26: powerplay, tail-ender, need wickets — close count stays at the cap of 2", () => {
    const f = gen({ bowler: pace(), phase: "powerplay", batter: { hand: "R", type: "tail" }, modifiers: { needWickets: true } });
    expect(f.counts.close).toBe(2);
  });
});

describe("line and length (rows 15–19)", () => {
  const base = gen({ bowler: pace() });
  it("15: off-channel adds an off-side ring fielder and mans third man or deep point", () => {
    const f = gen({ bowler: pace(), line: line(40, 20, 20, 10, 10) });
    expect(f.lineTag).toBe("off-channel");
    expect(count(f, offRing)).toBe(count(base, offRing) + 1);
    expect(names(f).some((n) => n === "Third man" || n === "Deep point")).toBe(true);
  });
  it("16: leg-drift adds a leg-side ring fielder and mans fine leg", () => {
    const f = gen({ bowler: pace(), line: line(10, 20, 30, 20, 20) });
    expect(f.lineTag).toBe("leg-drift");
    expect(count(f, legRing)).toBe(count(base, legRing) + 1);
    expect(names(f)).toContain("Fine leg");
    checkLaws(f, "middle");
  });
  it("17: sprayed line changes nothing", () => {
    const l = line(35, 25, 5, 15, 20);
    expect(lineTagFor(l)).toBe("sprayed");
    expect(names(gen({ bowler: pace(), line: l }))).toEqual(names(base));
  });
  it("18: short-heavy pace mans deep square leg", () => {
    const f = gen({ bowler: pace(), phase: "powerplay", length: { short: 45, good: 40, full: 15 } });
    expect(f.lengthTag).toBe("short-heavy");
    expect(names(f)).toContain("Deep square leg");
  });
  it("19: full-heavy in the middle overs mans long-on", () => {
    const f = gen({ bowler: spin("leg"), phase: "surge", length: { short: 10, good: 40, full: 50 } });
    expect(names(f)).toContain("Long-on");
    expect(names(gen({ bowler: pace(), length: { short: 10, good: 40, full: 50 } }))).toContain("Long-off");
  });
  it("good-length and no data give the same field", () => {
    expect(names(gen({ bowler: pace(), length: { short: 20, good: 60, full: 20 } }))).toEqual(names(base));
  });
});

describe("data fallback (rows 20, 20a, 35)", () => {
  const set = (o: Partial<BowlingSet>): BowlingSet => ({ playerId: "p", format: "t20", scope: "overall", ...o });
  const L = line(40, 20, 20, 10, 10);
  it("20: borrows the other format's overall set, else generic", () => {
    const r = resolveBowlingData([set({ format: "oneday", line: L })], "t20", "middle");
    expect(r.lineSource).toBe("other-format");
    expect(r.lengthSource).toBe("none");
    expect(resolveBowlingData([], "t20", "middle")).toMatchObject({ lineSource: "none", lengthSource: "none" });
  });
  it("20a: phase set first, then overall", () => {
    const sets = [set({ line: L }), set({ scope: "death", line: line(10, 20, 30, 20, 20) })];
    expect(resolveBowlingData(sets, "t20", "death").lineSource).toBe("phase");
    expect(resolveBowlingData(sets, "t20", "middle").lineSource).toBe("overall");
  });
  it("35: the Surge uses the Death set", () => {
    const sets = [set({ line: L }), set({ scope: "death", line: line(10, 20, 30, 20, 20) })];
    const r = resolveBowlingData(sets, "t20", "surge");
    expect(r.lineSource).toBe("phase");
    expect(r.line!.outsideLeg).toBe(20);
  });
  it("line and length fall back independently; small sample flagged", () => {
    const sets = [set({ scope: "middle", line: L, ballsSampled: 12 }), set({ length: { short: 20, good: 60, full: 20 } })];
    const r = resolveBowlingData(sets, "t20", "middle");
    expect(r).toMatchObject({ lineSource: "phase", lengthSource: "overall", smallSample: true });
  });
  it("scale to 100", () => {
    expect(scaleTo100([30, 30, 20, 10, 12]).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("around the wicket and keeper (rows 20b–20d)", () => {
  it("20b: right-arm, no swing, LHB — over is away, around is in", () => {
    expect(names(gen({ bowler: pace(), phase: "powerplay" }, "L"))).toContain("2nd slip");
    const f = gen({ bowler: pace({ aroundWicket: true }), phase: "powerplay" }, "L");
    expect(f.movement).toBe("in");
    expect(names(f)).toContain("Short midwicket");
  });
  it("20c: around the wicket does not change a swing bowler's field", () => {
    for (const hand of ["R", "L"] as Hand[])
      expect(names(gen({ bowler: pace({ swing: "out", aroundWicket: true }) }, hand))).toEqual(names(gen({ bowler: pace({ swing: "out" }) }, hand)));
  });
  it("20d: keeper up brings the slip up with her", () => {
    const up = gen({ bowler: pace({ paceBand: "medium", keeperUp: true }), phase: "powerplay" });
    const back = gen({ bowler: pace(), phase: "powerplay" });
    expect(up.keeper.up).toBe(true);
    expect(fielder(up, "1st slip").r).toBeLessThan(fielder(back, "1st slip").r);
  });
});

describe("T20 match inputs (rows 27–33)", () => {
  it("27: wide yorker overrides leg-drift line data", () => {
    const f = gen({ bowler: pace(), phase: "death", ballPlan: "wideYorker", line: line(10, 20, 30, 20, 20) });
    expect(f.lineTag).toBe("none");
    for (const n of ["Deep point", "Deep cover", "Long-off"]) expect(names(f)).toContain(n);
    const plain = gen({ bowler: pace(), phase: "death" });
    expect(count(f, offRing)).toBeGreaterThanOrEqual(count(plain, offRing));
    expect(count(f, (n) => POS[n].theta < 180)).toBeGreaterThan(count(plain, (n) => POS[n].theta < 180));
    checkLaws(f, "death");
  });
  it("28: bouncer plan mans deep square leg and fine leg within the behind-square limit", () => {
    const f = gen({ bowler: pace(), phase: "death", ballPlan: "bouncer" });
    expect(names(f)).toContain("Deep square leg");
    expect(names(f)).toContain("Fine leg");
    expect(f.counts.behindSquareLeg).toBeLessThanOrEqual(2);
  });
  it("29: yorker plan keeps long-on, long-off and deep square leg out", () => {
    const f = gen({ bowler: pace(), phase: "death", ballPlan: "yorker", batter: { hand: "R", type: "aggressive" }, modifiers: { setBatter: true } });
    for (const n of ["Long-on", "Long-off", "Deep square leg"]) expect(names(f)).toContain(n);
  });
  it("30: short leg-side boundary mans and keeps deep square leg; flips to off for the other hand", () => {
    const f = gen({ bowler: spin("leg"), shortSide: "leg" });
    expect(names(f)).toContain("Deep square leg");
    expect(names(f)).toContain("Deep midwicket");
    const g = gen({ bowler: spin("leg"), shortSide: "off" }, "L");
    expect(names(g).some((n) => n === "Deep point" || n === "Deep cover")).toBe(true);
  });
  it("31: ball plan is ignored outside death and surge", () => {
    expect(names(gen({ bowler: pace(), ballPlan: "yorker" }))).toEqual(names(gen({ bowler: pace() })));
  });
  it("33: surge + yorker — long-on and long-off are the two deep fielders", () => {
    const f = gen({ bowler: pace(), phase: "surge", ballPlan: "yorker" });
    expect(names(f).filter((n) => POS[n].zone === "deep").sort()).toEqual(["Long-off", "Long-on"]);
  });
});

describe("rationale", () => {
  it("names the bowler, hand, phase and what fired", () => {
    const f = gen({ bowler: spin("off"), line: line(40, 22, 20, 10, 8) }, "L");
    expect(f.rationale).toMatch(/^Off-spin to a left-hander, Middle: Turning away → 1st slip added/);
    expect(f.rationale).toContain("62% off side");
  });
});
