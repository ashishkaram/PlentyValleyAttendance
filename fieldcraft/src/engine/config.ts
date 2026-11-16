import type { FormatRules, Position, Thresholds } from "./types";

/**
 * Field positions for a right-handed batter (PRD §5.2).
 * theta: degrees clockwise from the striker→bowler direction. r: 0 at the striker, 1 at the boundary.
 */
export const POSITIONS: Position[] = [
  { name: "1st slip", zone: "close", theta: 162, r: 0.24, rUp: 0.16 },
  { name: "2nd slip", zone: "close", theta: 150, r: 0.24, rUp: 0.16 },
  { name: "3rd slip", zone: "close", theta: 138, r: 0.24, rUp: 0.16 },
  { name: "Gully", zone: "close", theta: 122, r: 0.26 },
  { name: "Leg slip", zone: "close", theta: 198, r: 0.24, rUp: 0.16 },
  { name: "Silly point", zone: "close", theta: 75, r: 0.1 },
  { name: "Short leg", zone: "close", theta: 285, r: 0.1 },
  { name: "Short cover", zone: "close", theta: 50, r: 0.16 },
  { name: "Short midwicket", zone: "close", theta: 310, r: 0.16 },
  { name: "Short third man", zone: "ring", theta: 150, r: 0.36 },
  { name: "Backward point", zone: "ring", theta: 110, r: 0.36 },
  { name: "Point", zone: "ring", theta: 90, r: 0.36 },
  { name: "Cover", zone: "ring", theta: 60, r: 0.36 },
  { name: "Extra cover", zone: "ring", theta: 40, r: 0.36 },
  { name: "Mid-off", zone: "ring", theta: 20, r: 0.38 },
  { name: "Mid-on", zone: "ring", theta: 340, r: 0.38 },
  { name: "Midwicket", zone: "ring", theta: 300, r: 0.36 },
  { name: "Square leg", zone: "ring", theta: 272, r: 0.36 },
  { name: "Short fine leg", zone: "ring", theta: 215, r: 0.36 },
  { name: "Third man", zone: "deep", theta: 150, r: 0.92, partner: "Short third man" },
  { name: "Deep backward point", zone: "deep", theta: 110, r: 0.92, partner: "Backward point" },
  { name: "Deep point", zone: "deep", theta: 90, r: 0.92, partner: "Point" },
  { name: "Deep cover", zone: "deep", theta: 60, r: 0.92, partner: "Cover" },
  { name: "Long-off", zone: "deep", theta: 15, r: 0.92, partner: "Mid-off" },
  { name: "Long-on", zone: "deep", theta: 345, r: 0.92, partner: "Mid-on" },
  { name: "Cow corner", zone: "deep", theta: 325, r: 0.92, partner: "Midwicket" },
  { name: "Deep midwicket", zone: "deep", theta: 300, r: 0.92, partner: "Midwicket" },
  { name: "Deep square leg", zone: "deep", theta: 272, r: 0.92, partner: "Square leg" },
  { name: "Fine leg", zone: "deep", theta: 215, r: 0.92, partner: "Short fine leg" },
  { name: "Deep fine leg", zone: "deep", theta: 200, r: 0.92, partner: "Short fine leg" },
];

export const POS: Record<string, Position> = Object.fromEntries(POSITIONS.map((p) => [p.name, p]));

/** Close-in radii are drawn larger than life so markers stay apart on a phone. */
export const KEEPER = { theta: 180, rBack: 0.2, rUp: 0.06 };

/** Rule 14.2: a helmet is required closer than 7 m in front of square. */
export const HELMET_POSITIONS = new Set(["Short leg", "Silly point"]);

/** PRD §5.3 — most expendable first. */
export const LEG_RING_DONORS = ["Short fine leg", "Square leg", "Midwicket", "Mid-on"];
export const OFF_RING_DONORS = ["Short third man", "Backward point", "Point", "Extra cover", "Cover", "Mid-off"];
export const CLOSE_DONORS = [
  "Leg slip",
  "Short leg",
  "Silly point",
  "Short midwicket",
  "Short cover",
  "Gully",
  "3rd slip",
  "2nd slip",
  "1st slip",
];

export const THRESHOLDS: Thresholds = {
  offChannel: 55,
  legDrift: 30,
  wideOff: 40,
  wideLeg: 15,
  straight: 65,
  shortHeavy: 35,
  fullHeavy: 40,
  goodLength: 55,
  smallSample: 30,
};

/**
 * VPC Women's T20 — Rules of Premier Cricket, Rule 19 (PRD §2.1, §6).
 * Same for Grades 1, 2 and 3.
 */
export const T20_RULES: FormatRules = {
  format: "t20",
  phases: ["powerplay", "middle", "surge", "death"],
  maxDeep: { powerplay: 2, middle: 4, surge: 2, death: 4 }, // 19.8(b)
  catcherCap: { powerplay: 2, middle: 1, surge: 1, death: 1 },
  maxLegSide: 5, // 19.8(a)
  maxBehindSquareLeg: 2, // Laws of Cricket 28.4.1
  templates: {
    pace: {
      powerplay: {
        close: ["1st slip"],
        ring: ["Point", "Cover", "Mid-off", "Mid-on", "Midwicket", "Square leg"],
        deep: ["Third man", "Fine leg"],
      },
      middle: {
        close: [],
        ring: ["Point", "Cover", "Mid-off", "Midwicket"],
        deep: ["Deep square leg", "Long-on", "Deep cover", "Third man", "Deep midwicket"],
      },
      surge: {
        close: [],
        ring: ["Short third man", "Backward point", "Cover", "Mid-off", "Mid-on", "Midwicket", "Short fine leg"],
        deep: ["Deep midwicket", "Deep cover"],
      },
      death: {
        close: [],
        ring: ["Short third man", "Backward point", "Extra cover", "Short fine leg"],
        deep: ["Long-on", "Long-off", "Deep square leg", "Deep midwicket", "Deep cover"],
      },
    },
    spin: {
      powerplay: {
        close: ["1st slip"],
        ring: ["Point", "Cover", "Mid-off", "Mid-on", "Midwicket", "Short fine leg"],
        deep: ["Deep midwicket", "Deep cover"],
      },
      middle: {
        close: [],
        ring: ["Point", "Cover", "Midwicket", "Short fine leg"],
        deep: ["Long-on", "Deep midwicket", "Long-off", "Deep square leg", "Deep cover"],
      },
      surge: {
        close: [],
        ring: ["Backward point", "Cover", "Mid-off", "Mid-on", "Midwicket", "Square leg", "Short fine leg"],
        deep: ["Deep midwicket", "Long-off"],
      },
      death: {
        close: [],
        ring: ["Point", "Extra cover", "Midwicket", "Short fine leg"],
        deep: ["Long-on", "Cow corner", "Long-off", "Deep square leg", "Deep cover"],
      },
    },
  },
};

/**
 * VPC Women's One-Day — Rules of Premier Cricket, Rule 17 (One-Day PRD §2.1, §6).
 * One powerplay at the start; four fielders out for every other over.
 */
export const ONEDAY_RULES: FormatRules = {
  format: "oneday",
  phases: ["powerplay", "middle", "death"],
  maxDeep: { powerplay: 2, middle: 4, death: 4 }, // 17.9.4
  catcherCap: { powerplay: 4, middle: 3, death: 1 },
  maxLegSide: 5, // 17.9.1
  maxBehindSquareLeg: 2, // Laws of Cricket 28.4.1
  templates: {
    pace: {
      powerplay: {
        close: ["1st slip", "2nd slip", "Gully"],
        ring: ["Cover", "Mid-off", "Mid-on", "Square leg"],
        deep: ["Third man", "Fine leg"],
      },
      middle: {
        close: ["1st slip"],
        ring: ["Point", "Cover", "Mid-off", "Mid-on"],
        deep: ["Third man", "Fine leg", "Deep square leg", "Deep cover"],
      },
      death: T20_RULES.templates.pace.death,
    },
    spin: {
      powerplay: T20_RULES.templates.spin.powerplay,
      middle: {
        close: ["1st slip"],
        ring: ["Point", "Cover", "Midwicket", "Short fine leg"],
        deep: ["Long-on", "Deep midwicket", "Long-off", "Deep square leg"],
      },
      death: T20_RULES.templates.spin.death,
    },
  },
};

/** Ground dimensions, the same in both formats (Rules 14.7.1, 17.8.1). */
export const GROUND = { circleRadiusM: 23, maxBoundaryM: 62, nominalBoundaryM: 55, pitchLengthM: 20.12 };

export type Grade = "1" | "2" | "3";

export interface Conditions {
  overs: number;
  /** last over of the powerplay */
  powerplayEnd: number;
  /** first over of the death phase (an app convention in One-Day: the last fifth) */
  deathStart: number;
  maxBowlerOvers: number;
}

/** Playing conditions per grade (PRD §2.1). T20 is the same for every grade. */
export const CONDITIONS: Record<"t20" | "oneday", Record<Grade, Conditions>> = {
  t20: {
    "1": { overs: 20, powerplayEnd: 4, deathStart: 17, maxBowlerOvers: 4 }, // 19.2, 19.8, 19.5
    "2": { overs: 20, powerplayEnd: 4, deathStart: 17, maxBowlerOvers: 4 },
    "3": { overs: 20, powerplayEnd: 4, deathStart: 17, maxBowlerOvers: 4 },
  },
  oneday: {
    "1": { overs: 50, powerplayEnd: 10, deathStart: 41, maxBowlerOvers: 10 }, // 17.3.1, 17.9.4, 17.7.1
    "2": { overs: 45, powerplayEnd: 9, deathStart: 37, maxBowlerOvers: 9 },
    "3": { overs: 40, powerplayEnd: 8, deathStart: 33, maxBowlerOvers: 8 },
  },
};

export const RULES = { t20: T20_RULES, oneday: ONEDAY_RULES };
export const FORMAT_LABEL = { t20: "T20", oneday: "One-Day" };

export const PHASE_LABEL: Record<string, string> = {
  powerplay: "Powerplay",
  middle: "Middle",
  surge: "Power Surge",
  death: "Death",
};
