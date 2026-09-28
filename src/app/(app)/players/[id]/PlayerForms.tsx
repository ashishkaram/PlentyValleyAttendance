"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/actionResult";
import { formatDisplayDate } from "@/lib/domain/dates";
import type { ActivePeriod, PlayerRecord } from "@/lib/domain/types";
import { deactivatePlayer, reactivatePlayer, updatePlayer } from "../actions";

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? <Alert kind="success">{state.message}</Alert> : <Alert kind="error">{state.error}</Alert>;
}

export function EditPlayerForm({
  player,
  firstPeriod,
  seasonStart,
}: {
  player: PlayerRecord;
  firstPeriod: ActivePeriod | null;
  seasonStart: string;
}) {
  const [state, action, pending] = useActionState(updatePlayer, null);
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <input type="hidden" name="id" value={player.id} />
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" required maxLength={100} defaultValue={player.name} className={inputClass} />
      </Field>
      <Field label="Player number (optional)" htmlFor="player_number">
        <input id="player_number" name="player_number" maxLength={10} defaultValue={player.player_number ?? ""} className={`${inputClass} max-w-32`} />
      </Field>
      {firstPeriod && (
        <Field
          label="Joined the squad on"
          htmlFor="first_start_date"
          hint="Fix a wrong joining date. Cannot be before the season start."
        >
          <input
            id="first_start_date"
            name="first_start_date"
            type="date"
            required
            defaultValue={firstPeriod.start_date}
            min={seasonStart}
            className={`${inputClass} max-w-52`}
          />
        </Field>
      )}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

export function StatusControls({
  playerId,
  name,
  isActive,
  today,
  minReactivate,
  maxReactivate,
  defaultReactivate,
}: {
  playerId: string;
  name: string;
  isActive: boolean;
  today: string;
  minReactivate: string;
  maxReactivate: string;
  defaultReactivate: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [reactivateState, reactivateAction, reactivating] = useActionState(reactivatePlayer, null);

  if (isActive) {
    return (
      <div className="space-y-3">
        <Result state={result} />
        <p>
          Deactivating removes {name} from attendance forms from today ({formatDisplayDate(today)}). Her history stays in reports.
        </p>
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setResult(await deactivatePlayer(playerId));
                  setConfirming(false);
                })
              }
            >
              {pending ? "Deactivating…" : `Yes, deactivate ${name}`}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>Deactivate</Button>
        )}
      </div>
    );
  }

  return (
    <form action={reactivateAction} className="space-y-3">
      <Result state={reactivateState ?? result} />
      <input type="hidden" name="id" value={playerId} />
      <Field
        label="Back in the squad from"
        htmlFor="start_date"
        hint="Sessions between her periods are not counted against her."
      >
        <input
          id="start_date"
          name="start_date"
          type="date"
          required
          defaultValue={defaultReactivate}
          min={minReactivate}
          max={maxReactivate}
          className={`${inputClass} max-w-52`}
        />
      </Field>
      <Button type="submit" disabled={reactivating}>{reactivating ? "Saving…" : "Reactivate"}</Button>
    </form>
  );
}
