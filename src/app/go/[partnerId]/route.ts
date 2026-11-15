import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Affiliate redirect: log a click via the DB function, then send the visitor to the partner.
export async function GET(req: Request, { params }: { params: { partnerId: string } }) {
  const offer = new URL(req.url).searchParams.get("offer");
  const db = supabaseServer();
  const { data, error } = await db.rpc("record_affiliate_click", { p_partner: params.partnerId, p_offer: offer });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.url) return NextResponse.redirect(new URL("/marketplace?unavailable=1", req.url));
  return NextResponse.redirect(row.url, { status: 302, headers: { "Referrer-Policy": "no-referrer" } });
}
