import type { SeasonBreak, SeasonSettings } from "../types";

export const SEASON_2026: SeasonSettings = {
  start_date: "2026-09-29",
  end_date: "2027-03-30",
  training_weekdays: [2, 4],
  report_weekday: 3,
  low_attendance_threshold: 75,
};

export const CHRISTMAS: SeasonBreak = {
  name: "Christmas break",
  start_date: "2026-12-16",
  end_date: "2027-01-15",
};
