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

/** Playing conditions shown in the app (PRD §2.1). */
export const T20_CONDITIONS = {
  overs: 20,
  powerplayOvers: "1–4",
  surge: "2 overs called by the batters, from over 11; overs 19–20 if not called",
  maxBowlerOvers: 4,
  circleRadiusM: 23,
  maxBoundaryM: 62,
  nominalBoundaryM: 55,
  pitchLengthM: 20.12,
};

export const PHASE_LABEL: Record<string, string> = {
  powerplay: "Powerplay",
  middle: "Middle",
  surge: "Power Surge",
  death: "Death",
};
