import type { ReactNode } from "react";

export function Chip(props: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      aria-pressed={props.on}
      onClick={props.onClick}
      className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
        props.on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 active:bg-slate-200"
      }`}
    >
      {props.children}
    </button>
  );
}

export function Row(props: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <div className="w-16 shrink-0 text-xs font-bold tracking-wide text-slate-500 uppercase">{props.label}</div>
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">{props.children}</div>
      </div>
      {props.hint && <div className="mt-1 pl-18 text-xs text-slate-500">{props.hint}</div>}
    </div>
  );
}

export function Choice<T extends string>(props: {
  value: T | undefined;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <>
      {props.options.map(([v, label]) => (
        <Chip key={v} on={props.value === v} onClick={() => props.onChange(v)}>
          {label}
        </Chip>
      ))}
    </>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  kind?: "primary" | "plain" | "danger";
  disabled?: boolean;
}) {
  const kind = props.kind ?? "primary";
  const cls =
    kind === "primary"
      ? "bg-slate-900 text-white active:bg-slate-700"
      : kind === "danger"
        ? "border-2 border-red-600 text-red-700 bg-white active:bg-red-50"
        : "border-2 border-slate-300 bg-white text-slate-800 active:bg-slate-100";
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${cls}`}
    >
      {props.children}
    </button>
  );
}

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{props.label}</span>
      {props.children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-900";

export function Badge(props: { children: ReactNode; tone?: "info" | "warn" | "ok" }) {
  const tone =
    props.tone === "warn"
      ? "bg-amber-100 text-amber-900 border-amber-300"
      : props.tone === "ok"
        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
        : "bg-slate-200 text-slate-800 border-slate-300";
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold ${tone}`}>{props.children}</span>;
}

export function ErrorNote(props: { error: string | null }) {
  if (!props.error) return null;
  return (
    <p role="alert" className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
      {props.error}
    </p>
  );
}

export function Card(props: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {props.title && <h2 className="mb-3 text-base font-bold">{props.title}</h2>}
      {props.children}
    </section>
  );
}
