import type { Metadata } from "next";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui";
import { requestPasswordReset } from "../actions";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-bold">Reset your password</h1>
      <p className="mb-4 text-slate-700">We will email you a link to choose a new password.</p>
      <AuthForm action={requestPasswordReset} submitLabel="Send reset link">
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
      </AuthForm>
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="font-medium text-brand-700 underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
