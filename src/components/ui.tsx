import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-400",
  secondary: "bg-white text-slate-900 border border-slate-400 hover:bg-slate-100 disabled:text-slate-400",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-400",
  ghost: "text-brand-700 hover:bg-brand-50 underline-offset-2 hover:underline",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-300 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const styles = {
    info: "border-blue-300 bg-blue-50 text-blue-950",
    success: "border-green-400 bg-green-50 text-green-950",
    error: "border-red-400 bg-red-50 text-red-950",
    warning: "border-amber-400 bg-amber-50 text-amber-950",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 ${styles}`}>
      {children}
    </div>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block font-medium text-slate-900">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "green" | "amber" | "red" | "blue";
  children: ReactNode;
}) {
  const styles = {
    slate: "bg-slate-200 text-slate-900",
    green: "bg-green-100 text-green-900",
    amber: "bg-amber-100 text-amber-950",
    red: "bg-red-100 text-red-900",
    blue: "bg-blue-100 text-blue-900",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${styles}`}>{children}</span>;
}
