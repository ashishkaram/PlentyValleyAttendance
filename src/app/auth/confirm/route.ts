import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page for links in Supabase auth emails (password reset). Handles
 * both the PKCE `code` flow and the `token_hash` flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = ok ? safeNext : "/login";
  if (!ok) url.searchParams.set("error", "link");
  return NextResponse.redirect(url);
}
