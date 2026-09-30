import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Field, inputClass } from "@/components/ui";
import { login } from "../actions";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Log in</h1>
      {error === "link" && (
        <div className="mb-4">
          <Alert kind="error">That link has expired or was already used. Request a new one.</Alert>
        </div>
      )}
      <AuthForm action={login} submitLabel="Log in">
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
      </AuthForm>
      <p className="mt-5 text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-brand-700 underline">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
