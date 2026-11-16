import { THRESHOLDS } from "./config";
import type { LengthData, LineData, Phase } from "./types";

export type Format = "t20" | "oneday";
export type PhaseScope = "overall" | "powerplay" | "middle" | "death";
export type DataSource = "phase" | "overall" | "other-format" | "none";

export interface BowlingSet {
  playerId: string;
  format: Format;
  scope: PhaseScope;
  line?: LineData;
  length?: LengthData;
  ballsSampled?: number;
  sourceNote?: string;
}

export interface ResolvedData {
  line?: LineData;
  lineSource: DataSource;
  length?: LengthData;
  lengthSource: DataSource;
  smallSample: boolean;
}

/** The Power Surge has no tab of its own: it uses the Death figures. */
export function scopeForPhase(phase: Phase): PhaseScope {
  return phase === "surge" ? "death" : phase;
}

/**
 * PRD §4.3 — checked separately for line and for length:
 * this format's phase set → this format's Overall → other format's Overall → none (generic field).
 */
export function resolveBowlingData(sets: BowlingSet[], format: Format, phase: Phase): ResolvedData {
  const scope = scopeForPhase(phase);
  const chain: [BowlingSet | undefined, DataSource][] = [
    [sets.find((s) => s.format === format && s.scope === scope), "phase"],
    [sets.find((s) => s.format === format && s.scope === "overall"), "overall"],
    [sets.find((s) => s.format !== format && s.scope === "overall"), "other-format"],
  ];
  const out: ResolvedData = { lineSource: "none", lengthSource: "none", smallSample: false };
  for (const [set, source] of chain) {
    if (!set) continue;
    const small = set.ballsSampled !== undefined && set.ballsSampled < THRESHOLDS.smallSample;
    if (!out.line && set.line) {
      out.line = set.line;
      out.lineSource = source;
      out.smallSample ||= small;
    }
    if (!out.length && set.length) {
      out.length = set.length;
      out.lengthSource = source;
      out.smallSample ||= small;
    }
  }
  return out;
}

export function lineTotal(l: Partial<LineData>): number {
  return (l.outsideOff ?? 0) + (l.off ?? 0) + (l.middle ?? 0) + (l.leg ?? 0) + (l.outsideLeg ?? 0);
}
export function lengthTotal(l: Partial<LengthData>): number {
  return (l.short ?? 0) + (l.good ?? 0) + (l.full ?? 0);
}

/** "Scale to 100": proportional, whole numbers, remainder to the largest bucket. */
export function scaleTo100(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values;
  const scaled = values.map((v) => Math.round((v * 100) / total));
  const diff = 100 - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.indexOf(Math.max(...scaled))] += diff;
  return scaled;
}
