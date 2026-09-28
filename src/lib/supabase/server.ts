import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookieOptions, supabaseEnv, withSessionMaxAge } from "./config";

/** Supabase client for server components, server actions and route handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, withSessionMaxAge(options)));
        } catch {
          // Called from a server component: cookies are read-only there.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
