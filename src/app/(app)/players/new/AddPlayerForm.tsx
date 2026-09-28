"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Alert, Button, Field, LinkButton, inputClass } from "@/components/ui";
import { addPlayer } from "../actions";

export function AddPlayerForm({ defaultDate, minDate, maxDate }: { defaultDate: string; minDate: string; maxDate: string }) {
  const [state, action, pending] = useActionState(addPlayer, null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state && !state.ok && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && (
        <Alert kind="success">
          {state.message} Add another, or <Link href="/players" className="font-semibold underline">go back to the list</Link>.
        </Alert>
      )}
      <Field label="Name" htmlFor="name">
        <input ref={nameRef} id="name" name="name" required maxLength={100} autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Player number (optional)" htmlFor="player_number">
        <input id="player_number" name="player_number" maxLength={10} inputMode="numeric" autoComplete="off" className={`${inputClass} max-w-32`} />
      </Field>
      <Field label="Active from" htmlFor="active_from" hint="First day she is in the squad. Can be backdated to the season start.">
        <input id="active_from" name="active_from" type="date" required defaultValue={defaultDate} min={minDate} max={maxDate} className={`${inputClass} max-w-52`} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add player"}</Button>
        <LinkButton href="/players" variant="secondary">Cancel</LinkButton>
      </div>
    </form>
  );
}
