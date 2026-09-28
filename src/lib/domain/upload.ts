import { validateActiveFrom } from "./activePeriods";
import { addDays, isValidISODate, makeISODate, type ISODate } from "./dates";
import { nameKey, normaliseName, normaliseNumber, validateName, validateNumber } from "./players";

export const TEMPLATE_HEADERS = ["Name", "Player number", "Active from"] as const;

export const TEMPLATE_CSV =
  "Name,Player number,Active from\r\nJane Citizen,7,29/09/2026\r\nAva Example,,\r\n";

/** A row as read from the file (cell values are untyped). */
export interface RawUploadRow {
  /** 1-based line in the file, header = 1, so the first data row is 2. */
  rowNumber: number;
  name: unknown;
  playerNumber: unknown;
  activeFrom: unknown;
}

/**
 * Map a header row to column indexes, matching TEMPLATE_HEADERS
 * case-insensitively. Returns an error message when Name is missing.
 */
export function mapHeaders(
  headers: unknown[],
): { ok: true; name: number; playerNumber: number; activeFrom: number } | { ok: false; error: string } {
  const norm = headers.map((h) => String(h ?? "").trim().toLowerCase().replace(/\s+/g, " "));
  const name = norm.indexOf("name");
  if (name === -1) return { ok: false, error: 'The file must have a "Name" column. Download the template to see the format.' };
  return {
    ok: true,
    name,
    playerNumber: norm.findIndex((h) => h === "player number" || h === "number" || h === "player no"),
    activeFrom: norm.findIndex((h) => h === "active from"),
  };
}

/** Convert table rows (first row = headers) into RawUploadRows, skipping blank lines. */
export function rowsFromTable(table: unknown[][]): { rows: RawUploadRow[] } | { error: string } {
  if (table.length === 0) return { error: "The file is empty." };
  const map = mapHeaders(table[0]);
  if (!map.ok) return { error: map.error };
  const rows: RawUploadRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const get = (idx: number) => (idx >= 0 ? cells[idx] : undefined);
    const blank = [map.name, map.playerNumber, map.activeFrom].every((idx) => isBlank(get(idx)));
    if (blank) return;
    rows.push({
      rowNumber: i + 2,
      name: get(map.name),
      playerNumber: get(map.playerNumber),
      activeFrom: get(map.activeFrom),
    });
  });
  return { rows };
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === "";
}

/** Excel serial day number -> ISO date (1900 date system, incl. the 1900 leap-year quirk). */
export function excelSerialToISODate(serial: number): ISODate | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const whole = Math.floor(serial);
  // Excel treats 1900 as a leap year, so from serial 61 (1 Mar 1900) the epoch is 30 Dec 1899.
  if (whole < 61) return addDays("1899-12-31", whole);
  return addDays("1899-12-30", whole);
}

/**
 * Parse an "Active from" cell: DD/MM/YYYY, YYYY-MM-DD, an Excel serial
 * number, or a Date. Blank -> "blank"; unparseable -> null.
 */
export function parseActiveFrom(value: unknown): ISODate | "blank" | null {
  if (isBlank(value)) return "blank";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return makeISODate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") return excelSerialToISODate(value);
  const s = String(value).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isValidISODate(iso) ? iso : null;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return isValidISODate(iso) ? iso : null;
  }
  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToISODate(Number(s));
  return null;
}

export type DuplicateAction = "skip" | "update_number" | "add";

export interface ExistingPlayerForUpload {
  id: string;
  name: string;
  player_number: string | null;
}

export interface PreviewRow {
  rowNumber: number;
  name: string;
  playerNumber: string | null;
  activeFrom: ISODate | null;
  /** True if Active from was blank and the default was used. */
  usedDefaultDate: boolean;
  errors: string[];
  /** Existing players with the same name (case-insensitive, trimmed). */
  existingMatches: ExistingPlayerForUpload[];
  /** Earlier row in the same file with the same name. */
  duplicateOfRow: number | null;
}

export function isDuplicate(row: PreviewRow): boolean {
  return row.existingMatches.length > 0 || row.duplicateOfRow !== null;
}

/** Actions the manager may choose for a duplicate row (FR-03). */
export function allowedActions(row: PreviewRow): DuplicateAction[] {
  if (!isDuplicate(row)) return ["add"];
  const actions: DuplicateAction[] = ["skip"];
  if (row.existingMatches.length === 1 && row.playerNumber !== null) actions.push("update_number");
  actions.push("add");
  return actions;
}

export function buildPreview(args: {
  rows: RawUploadRow[];
  existing: ExistingPlayerForUpload[];
  defaultActiveFrom: ISODate;
  season: { start_date: ISODate; end_date: ISODate };
}): PreviewRow[] {
  const { rows, existing, defaultActiveFrom, season } = args;
  const byKey = new Map<string, ExistingPlayerForUpload[]>();
  for (const p of existing) {
    const k = nameKey(p.name);
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  const seenInFile = new Map<string, number>();

  return rows.map((raw) => {
    const errors: string[] = [];
    const name = normaliseName(String(raw.name ?? ""));
    const nameError = validateName(name);
    if (nameError) errors.push(nameError);

    const playerNumber = normaliseNumber(raw.playerNumber == null ? null : String(raw.playerNumber));
    const numberError = validateNumber(playerNumber);
    if (numberError) errors.push(numberError);

    const parsed = parseActiveFrom(raw.activeFrom);
    let activeFrom: ISODate | null = null;
    const usedDefaultDate = parsed === "blank";
    if (parsed === null) {
      errors.push(`Invalid "Active from" date "${String(raw.activeFrom)}" (use DD/MM/YYYY)`);
    } else {
      activeFrom = parsed === "blank" ? defaultActiveFrom : parsed;
      const dateError = validateActiveFrom(activeFrom, season);
      if (dateError) errors.push(`"Active from": ${dateError.toLowerCase()}`);
    }

    let existingMatches: ExistingPlayerForUpload[] = [];
    let duplicateOfRow: number | null = null;
    if (!nameError) {
      const k = nameKey(name);
      existingMatches = byKey.get(k) ?? [];
      duplicateOfRow = seenInFile.get(k) ?? null;
      if (duplicateOfRow === null) seenInFile.set(k, raw.rowNumber);
    }

    return { rowNumber: raw.rowNumber, name, playerNumber, activeFrom, usedDefaultDate, errors, existingMatches, duplicateOfRow };
  });
}

export type ImportOperation =
  | { kind: "add"; rowNumber: number; name: string; playerNumber: string | null; activeFrom: ISODate }
  | { kind: "update_number"; rowNumber: number; playerId: string; playerNumber: string | null };

export interface ImportPlan {
  operations: ImportOperation[];
  skipped: number[];
  errors: { rowNumber: number; messages: string[] }[];
}

/**
 * Turn the preview plus the manager's choices into operations. Rows with
 * errors are not imported. Duplicates default to Skip.
 */
export function planImport(
  preview: PreviewRow[],
  choices: ReadonlyMap<number, DuplicateAction>,
): ImportPlan {
  const plan: ImportPlan = { operations: [], skipped: [], errors: [] };
  for (const row of preview) {
    if (row.errors.length > 0) {
      plan.errors.push({ rowNumber: row.rowNumber, messages: row.errors });
      continue;
    }
    const allowed = allowedActions(row);
    const choice = choices.get(row.rowNumber);
    const action: DuplicateAction = choice && allowed.includes(choice) ? choice : allowed[0];
    if (action === "skip") plan.skipped.push(row.rowNumber);
    else if (action === "update_number")
      plan.operations.push({
        kind: "update_number",
        rowNumber: row.rowNumber,
        playerId: row.existingMatches[0].id,
        playerNumber: row.playerNumber,
      });
    else
      plan.operations.push({
        kind: "add",
        rowNumber: row.rowNumber,
        name: row.name,
        playerNumber: row.playerNumber,
        activeFrom: row.activeFrom!,
      });
  }
  return plan;
}

/** Default active-from date for blank rows (FR-03). */
export function defaultUploadActiveFrom(
  playerCount: number,
  seasonStart: ISODate,
  today: ISODate,
): ISODate {
  return playerCount === 0 ? seasonStart : today < seasonStart ? seasonStart : today;
}
