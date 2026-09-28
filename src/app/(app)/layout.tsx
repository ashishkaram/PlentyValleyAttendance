import { logout } from "@/app/(auth)/actions";
import { BottomTabs, SideNav } from "@/components/Nav";
import { requireManager } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireManager();
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-10 border-b border-brand-800 bg-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <span className="text-lg font-bold">PV Attendance</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:inline">{profile?.display_name || user.email}</span>
            <form action={logout}>
              <button type="submit" className="min-h-11 rounded-lg border border-white/70 px-3 font-semibold hover:bg-brand-800">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 pt-4 pb-24 md:pb-8">
        <aside className="no-print hidden w-48 shrink-0 md:block">
          <SideNav />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
