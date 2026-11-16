import { useCallback, useEffect, useState } from "react";
import { FORMAT_LABEL } from "./engine/config";
import type { BowlingSet } from "./engine/resolve";
import { FORMAT } from "./format";
import { canEditPlayers, store, type Player, type Session } from "./store";
import { NewPassword, Onboarding, SignIn } from "./ui/AuthScreen";
import { ClubScreen } from "./ui/ClubScreen";
import { FieldScreen } from "./ui/FieldScreen";
import { PlayersScreen } from "./ui/PlayersScreen";
import { Reference } from "./ui/Reference";

type Tab = "field" | "players" | "club" | "reference";
const TABS: [Tab, string][] = [["field", "Field"], ["players", "Players"], ["club", "Club"], ["reference", "Reference"]];
const CACHE = "fieldcraft-cache-v1";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("field");
  const [players, setPlayers] = useState<Player[]>([]);
  const [bowling, setBowling] = useState<BowlingSet[]>([]);
  const [offline, setOffline] = useState(false);
  const [resetting, setResetting] = useState(() => new URLSearchParams(window.location.search).has("reset"));

  const refreshSession = useCallback(async () => {
    try {
      setSession(await store.getSession());
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    document.title = `FieldCraft ${FORMAT_LABEL[FORMAT]}`;
  }, []);

  useEffect(() => {
    void refreshSession();
    return store.onAuthChange(() => void refreshSession());
  }, [refreshSession]);

  const clubId = session?.membership?.clubId;
  const reload = useCallback(async () => {
    if (!clubId) return;
    try {
      const [p, b] = await Promise.all([store.listPlayers(), store.listBowlingData()]);
      setPlayers(p);
      setBowling(b);
      setOffline(false);
      try {
        localStorage.setItem(CACHE, JSON.stringify({ clubId, p, b }));
      } catch {
        /* cache is best-effort */
      }
    } catch {
      // No reception at the ground: fall back to the last copy this device saw.
      try {
        const c = JSON.parse(localStorage.getItem(CACHE) ?? "null") as { clubId: string; p: Player[]; b: BowlingSet[] } | null;
        if (c?.clubId === clubId) {
          setPlayers(c.p);
          setBowling(c.b);
        }
      } catch {
        /* nothing cached */
      }
      setOffline(true);
    }
  }, [clubId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (session === undefined) return <p className="p-8 text-center text-slate-500">Loading…</p>;
  if (resetting && session)
    return (
      <NewPassword
        done={() => {
          window.history.replaceState(null, "", window.location.pathname);
          setResetting(false);
        }}
      />
    );
  if (!session) return <SignIn />;
  if (!session.membership) return <Onboarding email={session.email} done={refreshSession} />;

  const m = session.membership;
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-900 px-3 py-2 text-white">
        <div className="min-w-0">
          <div className="truncate text-base leading-tight font-black">{m.clubName}</div>
          <div className="text-xs font-semibold text-emerald-300">FieldCraft {FORMAT_LABEL[FORMAT]} · Women's Premier</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {store.mode === "demo" && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-slate-900">DEMO</span>}
          {offline && <span className="rounded bg-red-500 px-1.5 py-0.5">OFFLINE</span>}
        </div>
      </header>
      <main className="flex-1 pb-16">
        {tab === "field" && <FieldScreen players={players} bowling={bowling} userId={session.userId} />}
        {tab === "players" && <PlayersScreen players={players} bowling={bowling} canEdit={canEditPlayers(m.role)} reload={reload} />}
        {tab === "club" && <ClubScreen session={session} refreshSession={refreshSession} />}
        {tab === "reference" && <Reference />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-slate-300 bg-white pb-[env(safe-area-inset-bottom)]">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-bold ${tab === t ? "border-t-4 border-slate-900 text-slate-900" : "border-t-4 border-transparent text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
