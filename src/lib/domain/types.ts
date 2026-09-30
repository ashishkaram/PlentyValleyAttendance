import type { ISODate } from "./dates";

export type SessionSource = "generated" | "manual";
export type SessionStatus = "scheduled" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "excused" | "injured";

/** Display order and labels for the attendance form and reports. */
export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: "present", label: "Present", short: "P" },
  { value: "absent", label: "Absent", short: "A" },
  { value: "excused", label: "Excused", short: "E" },
  { value: "injured", label: "Injured", short: "I" },
];

export interface SeasonSettings {
  start_date: ISODate;
  end_date: ISODate;
  /** ISO weekdays, Monday = 1 ... Sunday = 7 */
  training_weekdays: number[];
  report_weekday: number;
  low_attendance_threshold: number;
}

export interface SeasonBreak {
  name: string;
  start_date: ISODate;
  /** inclusive */
  end_date: ISODate;
}

export interface ActivePeriod {
  id?: string;
  start_date: ISODate;
  /** exclusive: first day no longer in the squad; null = still active */
  end_date: ISODate | null;
}

export interface SessionRecord {
  id: string;
  date: ISODate;
  source: SessionSource;
  status: SessionStatus;
  attendance_taken: boolean;
  needs_review: boolean;
}

export interface PlayerRecord {
  id: string;
  name: string;
  player_number: string | null;
  is_active: boolean;
}
