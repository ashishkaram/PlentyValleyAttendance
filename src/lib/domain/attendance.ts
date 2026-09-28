import { isActiveOn } from "./activePeriods";
import { isWithin, type ISODate } from "./dates";
import type { ActivePeriod, AttendanceStatus, SessionRecord } from "./types";

/**
 * Attendance % rounded half up to a whole number, using integer maths
 * (section 7.2). Returns null when nothing is counted ("n/a").
 */
export function attendancePercent(attended: number, counted: number): number | null {
  if (!Number.isInteger(attended) || !Number.isInteger(counted))
    throw new Error("attended and counted must be integers");
  if (counted <= 0) return null;
  return Math.floor((attended * 200 + counted) / (counted * 2));
}

export function formatPercent(pct: number | null): string {
  return pct === null ? "n/a" : `${pct}%`;
}

export function isLowAttendance(pct: number | null, threshold: number): boolean {
  return pct !== null && pct < threshold;
}

export interface PlayerStats {
  /** Recorded sessions she was active for: present + excused + absent. */
  held: number;
  present: number;
  excused: number;
  absent: number;
  /** Denominator of the %: present + absent. */
  counted: number;
  pct: number | null;
}

export type SessionForStats = Pick<SessionRecord, "id" | "date" | "status" | "attendance_taken">;

/**
 * Stats for one player over an inclusive date range (section 7.2).
 * `attendance` maps session id -> this player's recorded status; a missing
 * entry means "not recorded" and that session is not counted.
 */
export function computePlayerStats(
  sessions: SessionForStats[],
  periods: ActivePeriod[],
  attendance: ReadonlyMap<string, AttendanceStatus>,
  range: { start: ISODate; end: ISODate },
): PlayerStats {
  let present = 0;
  let excused = 0;
  let absent = 0;
  for (const s of sessions) {
    if (!isWithin(s.date, range.start, range.end)) continue;
    if (s.status !== "scheduled" || !s.attendance_taken) continue;
    if (!isActiveOn(periods, s.date)) continue;
    const status = attendance.get(s.id);
    if (status === undefined) continue;
    if (status === "present") present++;
    else if (status === "excused") excused++;
    else absent++;
  }
  const counted = present + absent;
  return {
    held: present + excused + absent,
    present,
    excused,
    absent,
    counted,
    pct: attendancePercent(present, counted),
  };
}

/** Enforce the Present/Excused mutual exclusivity of the form (FR-08). */
export function toggleStatus(
  current: AttendanceStatus,
  box: "present" | "excused",
): AttendanceStatus {
  return current === box ? "absent" : box;
}
