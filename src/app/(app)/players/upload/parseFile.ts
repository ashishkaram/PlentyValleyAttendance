import { rowsFromTable, TEMPLATE_CSV, TEMPLATE_HEADERS, type RawUploadRow } from "@/lib/domain/upload";

/** Read a CSV or .xlsx file into raw rows (first sheet for Excel). */
export async function parseUploadFile(file: File): Promise<{ rows: RawUploadRow[] } | { error: string }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    return rowsFromTable(result.data);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "The workbook has no sheets." };
    // Formatted text keeps player numbers like "07"; raw values give Excel date serials.
    const text = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    const parsed = rowsFromTable(text);
    if ("error" in parsed) return parsed;
    const header = (text[0] ?? []).map((h) => String(h).trim().toLowerCase());
    const dateCol = header.indexOf("active from");
    if (dateCol >= 0) {
      for (const row of parsed.rows) {
        const rawValue = raw[row.rowNumber - 1]?.[dateCol];
        // Prefer the raw serial for real date cells; keep typed text as text.
        if (typeof rawValue === "number") row.activeFrom = rawValue;
      }
    }
    return parsed;
  }
  return { error: "Choose a .csv or .xlsx file." };
}

export function downloadCsvTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, "players-template.csv");
}

export async function downloadXlsxTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], ["Jane Citizen", "7", "29/09/2026"], ["Ava Example", "", ""]]);
  // Keep player numbers as text so "07" stays "07".
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }];
  for (let r = 1; r <= 2; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cell) cell.t = "s";
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Players");
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "players-template.xlsx",
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
