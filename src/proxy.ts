import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase/config";

/** Pages reachable without signing in. */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm"];

/**
 * Refreshes the Supabase session cookie on every request (keeping the
 * manager signed in for a rolling 30 days) and sends signed-out visitors to
 * the login page. Authorisation itself is enforced by RLS in the database.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  let signedIn = false;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });
    try {
      const { data } = await supabase.auth.getClaims();
      signedIn = !!data?.claims?.sub;
    } catch {
      signedIn = false;
    }
  }

  if (!signedIn && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)"],
};
