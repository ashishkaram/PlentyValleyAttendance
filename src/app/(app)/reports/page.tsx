import type { Metadata } from "next";
import { Alert, Badge, PageHeader, buttonClass } from "@/components/ui";
import { requireManager } from "@/lib/data";
import { formatPercent } from "@/lib/domain/attendance";
import { formatDisplayDate } from "@/lib/domain/dates";
import type { PlayerStats } from "@/lib/domain/attendance";
import { loadReport, parseReportParams } from "@/lib/reportData";
import { ReportControls } from "./ReportControls";

export const metadata: Metadata = { title: "Reports" };

function rangeText(start: string, end: string) {
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

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

  return (
    <>
      <PageHeader title={isWeek ? "Weekly report" : "Custom report"}>
        <a href={`/reports/export?format=csv&${qs}`} className={buttonClass("secondary")} download>
          Export CSV
        </a>
        <a href={`/reports/export?format=pdf&${qs}`} className={buttonClass("secondary")} download>
          Export PDF
        </a>
      </PageHeader>
      <div className="space-y-4">
        {controls}
        <div>
          <p className="text-lg font-semibold">{rangeText(report.range.start, report.range.end)}</p>
          <p className="text-slate-700">
            {report.sessionsInRange.length} session{report.sessionsInRange.length === 1 ? "" : "s"} with attendance in this {label.toLowerCase()}
            {report.sessionsInRange.length > 0 && <>: {report.sessionsInRange.map((s) => formatDisplayDate(s.date)).join(", ")}</>}.
            Season to date: {rangeText(report.seasonRange.start, report.seasonRange.end)}.
          </p>
          {lowCount > 0 && (
            <p className="mt-1 font-semibold text-red-800">
              {lowCount} player{lowCount === 1 ? " is" : "s are"} below {season.low_attendance_threshold}% for the season.
            </p>
          )}
        </div>

        {report.rows.length === 0 ? (
          <Alert kind="info">No players were in the squad on any session date in this range.</Alert>
        ) : (
          <div tabIndex={0} role="region" aria-label="Report table (scrolls sideways)" className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
            <table className="w-full min-w-[46rem] border-collapse text-left tabular-nums">
              <caption className="sr-only">
                Attendance per player for {rangeText(report.range.start, report.range.end)} and season to date
              </caption>
              <thead>
                <tr className="bg-slate-100">
                  <th scope="col" rowSpan={2} className="sticky left-0 bg-slate-100 p-2">#</th>
                  <th scope="col" rowSpan={2} className="p-2">Name</th>
                  <th scope="colgroup" colSpan={5} className="border-l border-slate-300 p-2 text-center">{label}</th>
                  <th scope="colgroup" colSpan={5} className="border-l border-slate-300 p-2 text-center">Season to date</th>
                </tr>
                <tr className="bg-slate-100 text-sm">
                  {["Held", "Present", "Excused", "Absent", "%", "Held", "Present", "Excused", "Absent", "%"].map((h, i) => (
                    <th key={i} scope="col" className={`p-2 text-right ${i % 5 === 0 ? "border-l border-slate-300" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.player.id} className={`border-t border-slate-200 ${r.low ? "bg-red-50" : ""}`}>
                    <td className={`sticky left-0 p-2 font-mono font-semibold ${r.low ? "bg-red-50" : "bg-white"}`}>{r.player.player_number ?? ""}</td>
                    <th scope="row" className="whitespace-nowrap p-2 font-medium">
                      {r.player.name}
                      {!r.player.is_active && <span className="ml-2"><Badge>Inactive</Badge></span>}
                      {r.low && <span className="ml-2"><Badge tone="red">Below {season.low_attendance_threshold}%</Badge></span>}
                    </th>
                    <StatCells stats={r.range} />
                    <StatCells stats={r.season} highlight={r.low} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-slate-700">
          % = present ÷ (present + absent), rounded. Excused sessions, cancelled sessions, sessions before a player joined or while she was out of the squad, and sessions where she was not recorded are not counted. “n/a” means nothing to count yet.
        </p>
      </div>
    </>
  );
}

function StatCells({ stats, highlight = false }: { stats: PlayerStats; highlight?: boolean }) {
  return (
    <>
      <td className="border-l border-slate-200 p-2 text-right">{stats.held}</td>
      <td className="p-2 text-right">{stats.present}</td>
      <td className="p-2 text-right">{stats.excused}</td>
      <td className="p-2 text-right">{stats.absent}</td>
      <td className={`p-2 text-right font-bold ${highlight ? "text-red-800" : ""}`}>{formatPercent(stats.pct)}</td>
    </>
  );
}
