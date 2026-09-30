import type { Metadata } from "next";
import { Field, inputClass } from "@/components/ui";
import { updatePassword } from "../actions";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Choose a new password</h1>
      <AuthForm action={updatePassword} submitLabel="Save password">
        <Field label="New password" htmlFor="password" hint="At least 10 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
        </Field>
      </AuthForm>
    </>
  );
}
