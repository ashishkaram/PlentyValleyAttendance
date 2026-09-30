"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Alert, Badge, Button, Card, Field, inputClass } from "@/components/ui";
import { formatShortDate, isValidISODate } from "@/lib/domain/dates";
import {
  allowedActions,
  buildPreview,
  isDuplicate,
  planImport,
  type DuplicateAction,
  type ExistingPlayerForUpload,
  type RawUploadRow,
} from "@/lib/domain/upload";
import { importPlayers, type ImportSummary } from "../actions";
import { downloadCsvTemplate, downloadXlsxTemplate, parseUploadFile } from "./parseFile";

const ACTION_LABELS: Record<DuplicateAction, string> = {
  skip: "Skip",
  update_number: "Update player number",
  add: "Add anyway",
};

export function UploadFlow({
  existing,
  season,
  initialDefaultDate,
}: {
  existing: ExistingPlayerForUpload[];
  season: { start_date: string; end_date: string };
  initialDefaultDate: string;
}) {
  const [defaultDate, setDefaultDate] = useState(initialDefaultDate);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RawUploadRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Map<number, DuplicateAction>>(new Map());
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validDefault = isValidISODate(defaultDate) && defaultDate >= season.start_date && defaultDate <= season.end_date;
  const preview = useMemo(
    () => (rows && validDefault ? buildPreview({ rows, existing, defaultActiveFrom: defaultDate, season }) : null),
    [rows, existing, defaultDate, season, validDefault],
  );
  const plan = useMemo(() => (preview ? planImport(preview, choices) : null), [preview, choices]);

  async function onFile(file: File | undefined) {
    setSummary(null);
    setImportError(null);
    setChoices(new Map());
    setRows(null);
    setFileError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const result = await parseUploadFile(file);
      if ("error" in result) setFileError(result.error);
      else if (result.rows.length === 0) setFileError("The file has no player rows.");
      else setRows(result.rows);
    } catch {
      setFileError("Could not read that file. Check it is a valid CSV or .xlsx file.");
    }
  }

  function onImport() {
    if (!preview) return;
    startTransition(async () => {
      const result = await importPlayers(preview, [...choices.entries()]);
      if (result.ok) {
        setSummary(result.data!);
        setRows(null);
      } else setImportError(result.error);
    });
  }

  if (summary) {
    return (
      <Card className="max-w-lg space-y-3">
        <h2 className="text-base font-semibold">Import complete</h2>
        <dl className="grid grid-cols-2 gap-2 text-lg">
          <dt>Added</dt><dd className="font-bold">{summary.added}</dd>
          <dt>Updated</dt><dd className="font-bold">{summary.updated}</dd>
          <dt>Skipped</dt><dd className="font-bold">{summary.skipped}</dd>
          <dt>Errors</dt><dd className="font-bold">{summary.errors.length}</dd>
        </dl>
        {summary.errors.length > 0 && (
          <ul className="list-disc pl-5 text-sm">
            {summary.errors.map((e) => (
              <li key={e.rowNumber}>Row {e.rowNumber}: {e.messages.join("; ")}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/players" className="font-semibold text-brand-700 underline">View players</Link>
          <button type="button" className="font-semibold text-brand-700 underline" onClick={() => { setSummary(null); setFileName(null); }}>
            Upload another file
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h2 className="mb-1 text-base font-semibold">1. Get the template</h2>
          <p className="mb-2 text-slate-700">
            Columns: <strong>Name</strong>, <strong>Player number</strong> (optional), <strong>Active from</strong> (optional, DD/MM/YYYY).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={downloadCsvTemplate}>Download CSV template</Button>
            <Button type="button" variant="secondary" onClick={() => void downloadXlsxTemplate()}>Download Excel template</Button>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold">2. Choose the default date</h2>
          <Field
            label="Default active-from date for blank rows"
            htmlFor="default_date"
            hint={existing.length === 0 ? "Initial squad: defaults to the season start so earlier sessions can be back-entered." : undefined}
          >
            <input
              id="default_date"
              type="date"
              value={defaultDate}
              min={season.start_date}
              max={season.end_date}
              onChange={(e) => setDefaultDate(e.target.value)}
              className={`${inputClass} max-w-52`}
            />
          </Field>
          {!validDefault && <p className="mt-1 text-red-800">Choose a date within the season.</p>}
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold">3. Upload the file</h2>
          <label htmlFor="file" className="sr-only">Players file (CSV or Excel)</label>
          <input
            id="file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-700 file:px-4 file:font-semibold file:text-white"
          />
          {fileError && <div className="mt-2"><Alert kind="error">{fileError}</Alert></div>}
        </div>
      </Card>

      {preview && plan && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">4. Check and import {fileName && <span className="font-normal text-slate-700">({fileName})</span>}</h2>
          <p>
            <strong>{plan.operations.filter((o) => o.kind === "add").length}</strong> to add,{" "}
            <strong>{plan.operations.filter((o) => o.kind === "update_number").length}</strong> to update,{" "}
            <strong>{plan.skipped.length}</strong> to skip,{" "}
            <strong className={plan.errors.length ? "text-red-800" : ""}>{plan.errors.length}</strong> with errors (not imported).
          </p>
          <div tabIndex={0} role="region" aria-label="Preview table (scrolls sideways)" className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-sm text-slate-700">
                  <th scope="col" className="p-2">Row</th>
                  <th scope="col" className="p-2">Name</th>
                  <th scope="col" className="p-2">Number</th>
                  <th scope="col" className="p-2">Active from</th>
                  <th scope="col" className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const actions = allowedActions(row);
                  const choice = choices.get(row.rowNumber) ?? actions[0];
                  return (
                    <tr key={row.rowNumber} className={`border-b border-slate-200 align-top ${row.errors.length ? "bg-red-50" : isDuplicate(row) ? "bg-amber-50" : ""}`}>
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2 font-medium">{row.name || <em className="text-slate-600">blank</em>}</td>
                      <td className="p-2">{row.playerNumber ?? ""}</td>
                      <td className="p-2">
                        {row.activeFrom ? formatShortDate(row.activeFrom) : ""}
                        {row.usedDefaultDate && <span className="block text-sm text-slate-600">default</span>}
                      </td>
                      <td className="p-2">
                        {row.errors.length > 0 ? (
                          <ul className="text-red-900">
                            {row.errors.map((e) => <li key={e}>{e}</li>)}
                          </ul>
                        ) : isDuplicate(row) ? (
                          <div className="space-y-1">
                            <Badge tone="amber">Possible duplicate</Badge>
                            <p className="text-sm">
                              {row.existingMatches.length > 0
                                ? `Matches existing player${row.existingMatches.length > 1 ? "s" : ""}: ${row.existingMatches.map((m) => `${m.name}${m.player_number ? ` (#${m.player_number})` : ""}`).join(", ")}`
                                : `Same name as row ${row.duplicateOfRow}`}
                            </p>
                            <label className="sr-only" htmlFor={`action-${row.rowNumber}`}>Action for row {row.rowNumber}</label>
                            <select
                              id={`action-${row.rowNumber}`}
                              value={choice}
                              onChange={(e) => setChoices(new Map(choices).set(row.rowNumber, e.target.value as DuplicateAction))}
                              className={`${inputClass} max-w-60`}
                            >
                              {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                            </select>
                          </div>
                        ) : (
                          <Badge tone="green">New</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {importError && <Alert kind="error">{importError}</Alert>}
          <Button type="button" onClick={onImport} disabled={pending || plan.operations.length === 0}>
            {pending ? "Importing…" : `Import ${plan.operations.length} row${plan.operations.length === 1 ? "" : "s"}`}
          </Button>
        </Card>
      )}
    </div>
  );
}
