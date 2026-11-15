import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AdminHome() {
  const db = supabaseServer();
  const count = async (t: string, f?: (q: any) => any) => { let q: any = db.from(t).select("id", { count: "exact", head: true }); if (f) q = f(q); return (await q).count ?? 0; };
  const [pendingSubs, openRedemptions, partners, clicks] = await Promise.all([
    count("submissions", (q) => q.in("status", ["pending", "under_review", "more_info_required"])),
    count("redemptions", (q) => q.in("status", ["pending", "processing"])),
    count("partners", (q) => q.eq("active", true)),
    count("affiliate_clicks"),
  ]);
  const cards = [["Pending submissions", pendingSubs, "/admin/submissions"], ["Open redemptions", openRedemptions, "/admin/rewards"], ["Active partners", partners, "/admin/partners"], ["Tracked clicks", clicks, "/admin/partners"]];
  return (
    <>
      <h1 className="font-display text-3xl">Admin overview</h1>
      <p className="mt-1 text-sm text-mute">Live counts from the database. Numbers show 0 for areas your role cannot access.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([l, v, h]) => (
        <Link key={l as string} href={h as string} className="card transition-colors hover:border-lime/50"><p className="font-display text-4xl text-lime">{Number(v).toLocaleString()}</p><p className="mt-1 text-sm text-mute">{l}</p></Link>))}</div>
    </>
  );
}
