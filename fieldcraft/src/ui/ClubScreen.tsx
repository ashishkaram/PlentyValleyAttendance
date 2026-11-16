import { useEffect, useState } from "react";
import { store, type Invite, type Member, type Role, type Session } from "../store";
import { Badge, Button, Card, ErrorNote, Field, inputCls } from "./bits";

const ROLES: [Role, string][] = [["admin", "Admin"], ["coach", "Coach"], ["captain", "Captain"], ["player", "Player"]];
const ROLE_HELP: Record<Role, string> = {
  admin: "Manages members and the club; can do everything a Coach can.",
  coach: "Adds and edits players and their bowling figures.",
  captain: "Uses the field maps and views players.",
  player: "Uses the field maps and views players.",
};

export function ClubScreen(props: { session: Session; refreshSession: () => Promise<void> }) {
  const m = props.session.membership!;
  const isAdmin = m.role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [clubName, setClubName] = useState(m.clubName);
  const [inviteRole, setInviteRole] = useState<Role>("player");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    try {
      setMembers(await store.listMembers());
      if (isAdmin) setInvites(await store.listInvites());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const link = (code: string) => `${window.location.origin}${window.location.pathname}?invite=${code}`;
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(link(code));
      setCopied(code);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      {store.mode === "demo" && (
        <p className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Demo mode: no login, and everything you enter stays in this browser. Connect a Supabase project to get club
          accounts, invites and shared data.
        </p>
      )}
      <ErrorNote error={error} />
      <Card title="Your account">
        <p className="text-sm">
          <b>{m.displayName}</b> · {props.session.email} · <Badge>{ROLES.find(([r]) => r === m.role)![1]}</Badge>
        </p>
        {store.mode === "supabase" && (
          <div className="mt-3">
            <Button kind="plain" onClick={() => void store.signOut()}>Sign out</Button>
          </div>
        )}
      </Card>

      <Card title="Club">
        {isAdmin ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await store.renameClub(clubName.trim());
                await props.refreshSession();
              });
            }}
          >
            <div className="flex-1">
              <Field label="Club name">
                <input className={inputCls} value={clubName} maxLength={80} onChange={(e) => setClubName(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={!clubName.trim() || clubName.trim() === m.clubName}>Rename</Button>
          </form>
        ) : (
          <p className="text-sm">{m.clubName}</p>
        )}
      </Card>

      <Card title="Members">
        <ul className="divide-y divide-slate-200">
          {members.map((x) => (
            <li key={x.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-semibold">
                {x.displayName} {x.userId === props.session.userId && <span className="font-normal text-slate-500">(you)</span>}
              </span>
              {isAdmin && store.mode === "supabase" ? (
                <span className="flex items-center gap-2">
                  <select
                    className="rounded-lg border-2 border-slate-300 bg-white px-2 py-1.5 text-sm"
                    value={x.role}
                    aria-label={`Role for ${x.displayName}`}
                    onChange={(e) => void run(async () => {
                      await store.setMemberRole(x.userId, e.target.value as Role);
                      if (x.userId === props.session.userId) await props.refreshSession();
                    })}
                  >
                    {ROLES.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
                  </select>
                  {x.userId !== props.session.userId && (
                    <Button kind="danger" onClick={() => { if (window.confirm(`Remove ${x.displayName} from the club?`)) void run(() => store.removeMember(x.userId)); }}>
                      Remove
                    </Button>
                  )}
                </span>
              ) : (
                <Badge>{ROLES.find(([r]) => r === x.role)![1]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isAdmin && store.mode === "supabase" && (
        <Card title="Invites">
          <p className="mb-3 text-sm text-slate-600">Each invite works once and expires after 14 days. The role is fixed when you create it.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Role for the new member">
                <select className={inputCls} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                  {ROLES.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
                </select>
              </Field>
            </div>
            <Button onClick={() => void run(() => store.createInvite(inviteRole))}>Create invite</Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">{ROLE_HELP[inviteRole]}</p>
          <ul className="mt-3 divide-y divide-slate-200">
            {invites.map((i) => {
              const expired = new Date(i.expiresAt) < new Date();
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <code className="text-base font-bold tracking-wider">{i.code}</code>{" "}
                    <Badge>{ROLES.find(([r]) => r === i.role)![1]}</Badge>{" "}
                    {i.used ? <Badge tone="ok">used</Badge> : expired ? <Badge tone="warn">expired</Badge> : <span className="text-xs text-slate-500">expires {new Date(i.expiresAt).toLocaleDateString()}</span>}
                  </span>
                  {!i.used && (
                    <span className="flex gap-2">
                      {!expired && <Button kind="plain" onClick={() => void copy(i.code)}>{copied === i.code ? "Copied" : "Copy link"}</Button>}
                      <Button kind="danger" onClick={() => void run(() => store.revokeInvite(i.id))}>Delete</Button>
                    </span>
                  )}
                </li>
              );
            })}
            {invites.length === 0 && <li className="py-2 text-sm text-slate-500">No invites yet.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
