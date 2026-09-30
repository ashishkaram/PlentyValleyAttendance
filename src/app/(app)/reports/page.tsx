import type { Metadata } from "next";
import { Alert, Badge, Icon, PageHeader, PlayerMark, StatTile, buttonClass } from "@/components/ui";
import { requireManager } from "@/lib/data";
import { attendancePercent, formatPercent, type PlayerStats } from "@/lib/domain/attendance";
import { formatDisplayDate } from "@/lib/domain/dates";
import { loadReport, parseReportParams } from "@/lib/reportData";
import { ReportControls } from "./ReportControls";

export const metadata: Metadata = { title: "Reports" };

function rangeText(start: string, end: string) {
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

const COLS = ["Held", "Present", "Absent", "Excused", "Injured", "%"];

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const params = await searchParams;
  const { supabase } = await requireManager();
  const request = parseReportParams(params);
  const result = await loadReport(supabase, request);

  if (result.status === "no-season") return <Alert kind="warning">Set up the season in Settings first.</Alert>;

  const controls = (
    <ReportControls
      weeks={result.weeks}
      today={"today" in result ? result.today : undefined}
      selectedWeek={result.status === "ok" && result.isWeek ? result.report.range.start : result.status === "break" ? result.range.start : undefined}
      customRange={request.kind === "range" ? { start: request.start, end: request.end } : undefined}
      seasonStart={result.season.start_date}
      seasonEnd={result.season.end_date}
    />
  );

  if (result.status !== "ok") {
    return (
      <>
        <PageHeader title="Reports" />
        <div className="space-y-4">
          {controls}
          {result.status === "error" && <Alert kind="error">{result.message}</Alert>}
          {result.status === "break" && (
            <Alert kind="info">No weekly report: {rangeText(result.range.start, result.range.end)} is entirely within a season break.</Alert>
          )}
          {result.status === "not-yet" && <Alert kind="info">The first weekly report will be ready once the first report week of the season has finished.</Alert>}
        </div>
      </>
    );
  }

  const { report, season, isWeek } = result;
  const label = isWeek ? "Week" : "Range";
  const qs = new URLSearchParams({ start: report.range.start, end: report.range.end }).toString();
  const lowCount = report.rows.filter((r) => r.low).length;
  const sum = (k: "present" | "counted" | "injured") => report.rows.reduce((n, r) => n + r.range[k], 0);
  const squadPct = attendancePercent(sum("present"), sum("counted"));

  return (
    <>
      <PageHeader
        title={isWeek ? "Weekly report" : "Custom report"}
        subtitle={rangeText(report.range.start, report.range.end)}
      >
        <a href={`/reports/export?format=csv&${qs}`} className={buttonClass("secondary")} download>
          <Icon name="download" className="h-4 w-4" />
          Export CSV
        </a>
        <a href={`/reports/export?format=pdf&${qs}`} className={buttonClass("secondary")} download>
          <Icon name="download" className="h-4 w-4" />
          Export PDF
        </a>
      </PageHeader>
      <div className="space-y-4">
        {controls}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label={`Sessions this ${label.toLowerCase()}`}
            value={report.sessionsInRange.length}
            detail={report.sessionsInRange.map((s) => formatDisplayDate(s.date).split(" ").slice(0, 3).join(" ")).join(", ") || "None recorded"}
          />
          <StatTile label={`Squad attendance (${label.toLowerCase()})`} value={formatPercent(squadPct)} tone={squadPct !== null && squadPct < season.low_attendance_threshold ? "red" : "green"} />
          <StatTile label={`Below ${season.low_attendance_threshold}% for season`} value={lowCount} detail={lowCount === 1 ? "player" : "players"} tone={lowCount > 0 ? "red" : "slate"} />
          <StatTile label={`Injured (${label.toLowerCase()})`} value={sum("injured")} detail="session marks" tone={sum("injured") > 0 ? "amber" : "slate"} />
        </div>

        {report.rows.length === 0 ? (
          <Alert kind="info">No players were in the squad on any session date in this range.</Alert>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Report table (scrolls sideways)"
            className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80"
          >
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm tabular-nums">
              <caption className="sr-only">
                Attendance per player for {rangeText(report.range.start, report.range.end)} and season to date
              </caption>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-600">
                  <th scope="col" rowSpan={2} className="sticky left-0 z-[1] bg-slate-50 px-4 py-2 align-bottom">Player</th>
                  <th scope="colgroup" colSpan={6} className="border-l border-slate-200 bg-slate-50 px-3 pt-3 text-center">{label}</th>
                  <th scope="colgroup" colSpan={6} className="border-l border-slate-200 bg-slate-50 px-3 pt-3 text-center">Season to date</th>
                </tr>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  {[...COLS, ...COLS].map((h, i) => (
                    <th key={i} scope="col" className={`bg-slate-50 px-3 py-2 text-right ${i % 6 === 0 ? "border-l border-slate-200" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((r) => (
                  <tr key={r.player.id} className={r.low ? "bg-red-50/70" : "hover:bg-slate-50"}>
                    <th scope="row" className={`sticky left-0 z-[1] px-4 py-2.5 font-medium ${r.low ? "bg-red-50" : "bg-white"}`}>
                      <span className="flex items-center gap-3">
                        <PlayerMark name={r.player.name} number={r.player.player_number} />
                        <span className="whitespace-nowrap">
                          <span className="block font-semibold text-slate-900">{r.player.name}</span>
                          <span className="flex gap-1">
                            {!r.player.is_active && <Badge>Inactive</Badge>}
                            {r.low && <Badge tone="red">Below {season.low_attendance_threshold}%</Badge>}
                          </span>
                        </span>
                      </span>
                    </th>
                    <StatCells stats={r.range} />
                    <StatCells stats={r.season} highlight={r.low} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-slate-600">
          % = present ÷ (present + absent), rounded. Excused and injured sessions, cancelled sessions, sessions before a player joined or while she was out of the squad, and sessions where she was not recorded are not counted. “n/a” means nothing to count yet.
        </p>
      </div>
    </>
  );
}

function StatCells({ stats, highlight = false }: { stats: PlayerStats; highlight?: boolean }) {
  return (
    <>
      <td className="border-l border-slate-100 px-3 py-2.5 text-right text-slate-700">{stats.held}</td>
      <td className="px-3 py-2.5 text-right">{stats.present}</td>
      <td className="px-3 py-2.5 text-right">{stats.absent}</td>
      <td className="px-3 py-2.5 text-right">{stats.excused}</td>
      <td className="px-3 py-2.5 text-right">{stats.injured}</td>
      <td className={`px-3 py-2.5 text-right text-base font-bold ${highlight ? "text-red-800" : "text-slate-900"}`}>{formatPercent(stats.pct)}</td>
    </>
  );
}
