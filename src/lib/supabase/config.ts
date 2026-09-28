/** Rolling login on the manager's device (section 6.1): 30 days. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const cookieOptions = {
  maxAge: SESSION_MAX_AGE_SECONDS,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * @supabase/ssr always writes auth cookies with a 400-day maxAge, so cap it
 * here. Each token refresh re-writes the cookie, which makes this a rolling
 * 30-day login; deletions (maxAge 0) pass through unchanged.
 */
export function withSessionMaxAge<T extends { maxAge?: number }>(options: T): T {
  return options.maxAge && options.maxAge > SESSION_MAX_AGE_SECONDS
    ? { ...options, maxAge: SESSION_MAX_AGE_SECONDS }
    : options;
}

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }
  return { url, key };
}
