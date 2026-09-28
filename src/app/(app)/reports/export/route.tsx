import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/data";
import { toCsv } from "@/lib/domain/csv";
import { reportFileName, reportTable } from "@/lib/domain/reportTable";
import { loadReport } from "@/lib/reportData";
import { ReportPdf } from "./ReportPdf";

/** CSV and PDF export of any report (FR-12). */
export async function GET(request: NextRequest) {
  const { supabase } = await requireManager();
  const sp = request.nextUrl.searchParams;
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  const format = sp.get("format") === "pdf" ? "pdf" : "csv";

  const result = await loadReport(supabase, { kind: "range", start, end });
  if (result.status !== "ok") {
    return NextResponse.json({ error: "message" in result ? result.message : "No report for that range." }, { status: 400 });
  }
  const { report, season } = result;
  const isWeek = result.weeks.some((w) => w.start === start && w.end === end);
  const label = isWeek ? "Week" : "Range";
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${reportFileName(report, format)}"`,
  };

  if (format === "csv") {
    // BOM so Excel opens UTF-8 names correctly.
    const body = "﻿" + toCsv(reportTable(report, label, season.low_attendance_threshold));
    return new NextResponse(body, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }

  const pdf = await renderToBuffer(
    <ReportPdf report={report} label={label} threshold={season.low_attendance_threshold} seasonName={season.name} />,
  );
  return new NextResponse(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
