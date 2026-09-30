import { logout } from "@/app/(auth)/actions";
import { BottomTabs, SideNav } from "@/components/Nav";
import { BrandMark, Icon } from "@/components/ui";
import { requireManager } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireManager();
  const name = profile?.display_name || user.email;
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-bold text-slate-900">Plenty Valley</p>
            <p className="text-sm text-slate-600">Training attendance</p>
          </div>
        </div>
        <SideNav />
        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="truncate px-2 text-sm font-medium text-slate-800">{name}</p>
          <p className="mb-2 px-2 text-xs text-slate-600">Team manager</p>
          <form action={logout}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-semibold text-slate-700 hover:bg-slate-100">
              <Icon name="logout" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-8 w-8" />
              <span className="font-bold text-slate-900">PV Attendance</span>
            </div>
            <form action={logout}>
              <button type="submit" className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Icon name="logout" className="h-4 w-4" />
                Log out
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
