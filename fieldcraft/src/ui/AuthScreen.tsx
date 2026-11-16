import { useState, type FormEvent } from "react";
import { FORMAT_LABEL } from "../engine/config";
import { FORMAT } from "../format";
import { store } from "../store";
import { Button, Card, ErrorNote, Field, inputCls } from "./bits";

function Shell(props: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-4">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight">FieldCraft <span className="text-emerald-700">{FORMAT_LABEL[FORMAT]}</span></h1>
        <p className="text-sm text-slate-600">Field maps for Victorian Premier Cricket Women's</p>
      </div>
      {props.children}
    </div>
  );
}

export function inviteFromUrl(): string {
  return new URLSearchParams(window.location.search).get("invite")?.toUpperCase() ?? "";
}

export function SignIn() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">(inviteFromUrl() ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "in") await store.signIn(email.trim(), password);
      else if (mode === "up") {
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        if (await store.signUp(email.trim(), password)) setNotice("Check your email and open the confirmation link, then sign in here.");
      } else {
        await store.requestPasswordReset(email.trim());
        setNotice("If that address has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Card title={mode === "in" ? "Sign in" : mode === "up" ? "Create your account" : "Reset your password"}>
        {mode === "up" && inviteFromUrl() && <p className="mb-3 text-sm text-slate-600">You have an invite. Create an account and you will join your club in the next step.</p>}
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode !== "forgot" && (
            <Field label="Password">
              <input className={inputCls} type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          <ErrorNote error={error} />
          {notice && <p className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{notice}</p>}
          <Button type="submit" disabled={busy}>{mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-blue-700">
          {mode !== "in" && <button type="button" onClick={() => setMode("in")}>I have an account</button>}
          {mode !== "up" && <button type="button" onClick={() => setMode("up")}>Create an account</button>}
          {mode === "in" && <button type="button" onClick={() => setMode("forgot")}>Forgot password</button>}
        </div>
      </Card>
    </Shell>
  );
}

export function NewPassword(props: { done: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Shell>
      <Card title="Choose a new password">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
              await store.updatePassword(password);
              props.done();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <Field label="New password">
            <input className={inputCls} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit">Save password</Button>
        </form>
      </Card>
    </Shell>
  );
}

/** Signed in, but not yet in a club: create one or join with an invite. */
export function Onboarding(props: { email: string; done: () => Promise<void> }) {
  const [mode, setMode] = useState<"join" | "create">(inviteFromUrl() ? "join" : "create");
  const [name, setName] = useState("");
  const [clubName, setClubName] = useState("");
  const [code, setCode] = useState(inviteFromUrl());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") await store.createClub(clubName.trim(), name.trim());
      else await store.claimInvite(code.trim(), name.trim());
      window.history.replaceState(null, "", window.location.pathname);
      await props.done();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Card title={mode === "create" ? "Create your club" : "Join your club"}>
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Your name">
            <input className={inputCls} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {mode === "create" ? (
            <Field label="Club name">
              <input className={inputCls} required maxLength={80} value={clubName} onChange={(e) => setClubName(e.target.value)} />
            </Field>
          ) : (
            <Field label="Invite code">
              <input className={`${inputCls} font-mono tracking-widest uppercase`} required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </Field>
          )}
          <ErrorNote error={error} />
          <Button type="submit" disabled={busy}>{mode === "create" ? "Create club" : "Join club"}</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-x-4 text-sm font-semibold text-blue-700">
          <button type="button" onClick={() => setMode(mode === "create" ? "join" : "create")}>
            {mode === "create" ? "I have an invite code" : "Create a new club instead"}
          </button>
          <button type="button" onClick={() => void store.signOut()}>Sign out ({props.email})</button>
        </div>
        {mode === "create" && <p className="mt-3 text-xs text-slate-500">You become the club's first Admin and can invite everyone else.</p>}
      </Card>
    </Shell>
  );
}
