import { formatPercent } from "./attendance";
import { formatShortDate } from "./dates";
import type { Report } from "./reports";

/** Flat rows for CSV/PDF export (FR-12). */
export function reportTable(report: Report, rangeLabel: string, threshold: number): (string | number)[][] {
  const header = [
    "Player number",
    "Name",
    "Status",
    `${rangeLabel}: sessions`,
    `${rangeLabel}: present`,
    `${rangeLabel}: absent`,
    `${rangeLabel}: excused`,
    `${rangeLabel}: injured`,
    `${rangeLabel}: attendance %`,
    "Season: sessions",
    "Season: present",
    "Season: absent",
    "Season: excused",
    "Season: injured",
    "Season: attendance %",
    `Below ${threshold}%`,
  ];
  return [
    header,
    ...report.rows.map((r) => [
      r.player.player_number ?? "",
      r.player.name,
      r.player.is_active ? "Active" : "Inactive",
      r.range.held,
      r.range.present,
      r.range.absent,
      r.range.excused,
      r.range.injured,
      formatPercent(r.range.pct),
      r.season.held,
      r.season.present,
      r.season.absent,
      r.season.excused,
      r.season.injured,
      formatPercent(r.season.pct),
      r.low ? "Yes" : "",
    ]),
  ];
}

export function reportFileName(report: Report, ext: string): string {
  const d = (s: string) => formatShortDate(s).split("/").reverse().join("");
  return `attendance-${d(report.range.start)}-${d(report.range.end)}.${ext}`;
}
