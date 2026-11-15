import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Email links (verify, reset) land here: exchange the code for a session, then continue.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const { error } = await supabaseServer().auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That link is invalid or has expired."), url.origin));
  }
  return NextResponse.redirect(new URL(safe, url.origin));
}
