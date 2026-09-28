import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui";

export default function NoAccessPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold">No access yet</h1>
      <p className="mb-6 text-slate-700">
        Your account does not have a role in this app. Ask the team manager to give you access.
      </p>
      <form action={logout}>
        <Button type="submit" variant="secondary">
          Log out
        </Button>
      </form>
    </main>
  );
}
