import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "dangerGhost";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none",
  secondary: "bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-500",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 active:bg-red-900 disabled:bg-slate-300 disabled:text-slate-600",
  ghost: "text-brand-800 hover:bg-brand-50 active:bg-brand-100",
  dangerGhost: "text-red-800 hover:bg-red-50 active:bg-red-100",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[0.95rem] font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function PageHeader({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-700 hover:text-brand-800">
          <Icon name="chevronLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80 ${padded ? "p-4 sm:p-5" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

const ALERT_STYLES = {
  info: { box: "bg-sky-50 text-sky-950 ring-sky-200", icon: "info" as const, iconClass: "text-sky-700" },
  success: { box: "bg-emerald-50 text-emerald-950 ring-emerald-200", icon: "check" as const, iconClass: "text-emerald-700" },
  error: { box: "bg-red-50 text-red-950 ring-red-200", icon: "alert" as const, iconClass: "text-red-700" },
  warning: { box: "bg-amber-50 text-amber-950 ring-amber-200", icon: "alert" as const, iconClass: "text-amber-700" },
};

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const s = ALERT_STYLES[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ${s.box}`}>
      <Icon name={s.icon} className={`mt-0.5 h-5 w-5 shrink-0 ${s.iconClass}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-xl border-0 bg-white px-3 py-2 text-base text-slate-900 shadow-sm ring-1 ring-inset ring-slate-400 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-brand-600";

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
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

export type Tone = "slate" | "green" | "amber" | "red" | "blue";

const BADGE_STYLES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-800 ring-slate-300",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  amber: "bg-amber-50 text-amber-900 ring-amber-300",
  red: "bg-red-50 text-red-800 ring-red-300",
  blue: "bg-sky-50 text-sky-800 ring-sky-300",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_STYLES[tone]}`}>
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "slate" | "green" | "red" | "amber";
}) {
  const valueColor = { slate: "text-slate-900", green: "text-emerald-800", red: "text-red-800", amber: "text-amber-800" }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${valueColor}`}>{value}</p>
      {detail && <p className="mt-0.5 text-sm text-slate-600">{detail}</p>}
    </div>
  );
}

/** Round badge with the player's number (or initials when she has none). */
export function PlayerMark({ name, number }: { name: string; number: string | null }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
        number ? "bg-brand-800 text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      {number ?? initials}
    </span>
  );
}

/** A row of toggle buttons (one selected). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-slate-200/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg px-3.5 text-sm font-semibold transition ${
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-700 hover:text-slate-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  clipboard: "M9 4h6m-6 0a2 2 0 0 0-2 2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2M9 4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 9 2 2 4-4",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6m13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  info: "M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  chevronLeft: "m15 18-6-6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  plus: "M12 5v14M5 12h14",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7-5-5-5 5m5-5v12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3",
  trash: "M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
  minus: "M5 12h14",
  cross: "M12 4v16m-8-8h16",
  bandage: "m10 10 4 4m-8.5 4.5-2-2a2.8 2.8 0 0 1 0-4l9-9a2.8 2.8 0 0 1 4 0l2 2a2.8 2.8 0 0 1 0 4l-9 9a2.8 2.8 0 0 1-4 0",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-sm font-black tracking-tight text-white shadow-sm ${className}`}>
      PV
    </span>
  );
}
