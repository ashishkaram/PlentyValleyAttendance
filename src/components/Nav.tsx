"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./ui";

const MOBILE_TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/attendance", label: "Attendance", icon: "clipboard" },
  { href: "/players", label: "Players", icon: "users" },
  { href: "/reports", label: "Reports", icon: "chart" },
];

const DESKTOP_LINKS: { href: string; label: string; icon: IconName }[] = [
  ...MOBILE_TABS,
  { href: "/sessions", label: "Sessions", icon: "calendar" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-brand-800" : "text-slate-600"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-brand-100" : ""}`}>
                  <Icon name={tab.icon} className="h-5 w-5" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {DESKTOP_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold transition ${
                  active ? "bg-brand-50 text-brand-900 ring-1 ring-inset ring-brand-200" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon name={link.icon} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
