export type Zone = "close" | "ring" | "deep";
export type Side = "off" | "leg";
export type Phase = "powerplay" | "middle" | "surge" | "death";
export type Family = "pace" | "spin";
export type Hand = "R" | "L";
export type PaceBand = "fast" | "fast-medium" | "medium";
export type Swing = "out" | "in" | "none";
export type SpinType = "off" | "leg" | "lao" | "law";
export type BatterType = "aggressive" | "accumulator" | "technical" | "finisher" | "tail";
export type ShortSide = "none" | "off" | "leg";
export type BallPlan = "none" | "yorker" | "wideYorker" | "slower" | "bouncer";
export type Movement = "away" | "in";

export interface Position {
  name: string;
  zone: Zone;
  theta: number;
  r: number;
  /** radius when the keeper is standing up (slips, leg slip) */
  rUp?: number;
  /** ring position a deep fielder is brought in to */
  partner?: string;
}

export interface Bowler {
  arm: Hand;
  family: Family;
  paceBand?: PaceBand;
  /** as it behaves to a right-handed batter */
  swing?: Swing;
  spinType?: SpinType;
  keeperUp: boolean;
  aroundWicket?: boolean;
}

/** Five percentages totalling 100. */
export interface LineData {
  outsideOff: number;
  off: number;
  middle: number;
  leg: number;
  outsideLeg: number;
}

/** Three percentages totalling 100. */
export interface LengthData {
  short: number;
  good: number;
  full: number;
}

export interface Batter {
  hand: Hand;
  type?: BatterType;
}

export interface Modifiers {
  newBatter?: boolean;
  setBatter?: boolean;
  needWickets?: boolean;
  protectRuns?: boolean;
  /** One-Day only: old ball reversing (pace, middle and death overs) */
  reverseSwing?: boolean;
}

export interface Situation {
  phase: Phase;
  bowler: Bowler;
  batter: Batter;
  line?: LineData;
  length?: LengthData;
  modifiers?: Modifiers;
  shortSide?: ShortSide;
  ballPlan?: BallPlan;
}

export interface Template {
  close: string[];
  ring: string[];
  /** keep-priority order: the last listed is the first brought in */
  deep: string[];
}

export interface FormatRules {
  format: "t20" | "oneday";
  /** phases this format has, in order */
  phases: Phase[];
  maxDeep: Partial<Record<Phase, number>>;
  catcherCap: Partial<Record<Phase, number>>;
  maxLegSide: number;
  maxBehindSquareLeg: number;
  templates: Record<Family, Partial<Record<Phase, Template>>>;
}

export interface Thresholds {
  offChannel: number;
  legDrift: number;
  wideOff: number;
  wideLeg: number;
  straight: number;
  shortHeavy: number;
  fullHeavy: number;
  goodLength: number;
  smallSample: number;
}

export interface PlacedFielder {
  name: string;
  zone: Zone;
  /** batter-relative side */
  side: Side;
  /** screen angle, already mirrored for a left-hander */
  theta: number;
  r: number;
  helmet: boolean;
}

export interface FiredRule {
  step: string;
  text: string;
  skipped?: boolean;
  /** applied, but routine — left out of the rationale line */
  quiet?: boolean;
}

export type LineTag = "sprayed" | "off-channel" | "leg-drift" | "straight" | "balanced" | "none";
export type LengthTag = "short-heavy" | "full-heavy" | "good-length" | "mixed" | "none";

export interface FieldResult {
  fielders: PlacedFielder[];
  keeper: { theta: number; r: number; up: boolean };
  movement: Movement;
  template: Phase;
  lineTag: LineTag;
  lengthTag: LengthTag;
  fired: FiredRule[];
  rationale: string;
  counts: { close: number; ring: number; deep: number; legSide: number; behindSquareLeg: number };
}
