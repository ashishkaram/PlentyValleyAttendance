"use client";

import { useActionState, type ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import type { FormState } from "./actions";

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.message && <Alert kind="success">{state.message}</Alert>}
      {children}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
