import Link from "next/link";
import { Coins, TrendingUp, Clock, Gift, ArrowUpRight } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { TiltCard } from "@/components/TiltCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CreditsChart, type Point } from "@/components/CreditsChart";

export default async function Overview() {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
  const [{ data: w }, { data: pending }, { data: recent }, { data: ledger }, { data: subs }, { count: redemptions }, { data: featured }, { data: news }, { data: profile }] = await Promise.all([
    db.from("wallet_balance_cache").select("balance,total_earned,total_spent").eq("user_id", user!.id).maybeSingle(),
    db.from("submissions").select("credits_requested").eq("user_id", user!.id).in("status", ["pending", "under_review", "more_info_required"]),
    db.from("credit_ledger").select("id,type,amount,description,created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
    db.from("credit_ledger").select("amount,created_at").eq("user_id", user!.id).gte("created_at", since.toISOString()).limit(1000),
    db.from("submissions").select("id,order_id,status,credits_requested,partners(name)").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(4),
    db.from("redemptions").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    db.from("partners").select("id,name,slug,market,partner_categories!inner(slug)").eq("featured", true).eq("active", true).eq("partner_categories.slug", "prop-firms").limit(3),
    db.from("announcements").select("id,title,body").eq("published", true).order("created_at", { ascending: false }).limit(2),
    db.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
  ]);

  const months: Point[] = Array.from({ length: 6 }, (_, i) => { const d = new Date(since); d.setMonth(since.getMonth() + i); return { label: d.toLocaleString("en", { month: "short" }), earned: 0, redeemed: 0, key: `${d.getFullYear()}-${d.getMonth()}` } as Point & { key: string }; });
  (ledger ?? []).forEach((r: any) => { const d = new Date(r.created_at); const m: any = months.find((x: any) => x.key === `${d.getFullYear()}-${d.getMonth()}`); if (m) r.amount > 0 ? (m.earned += r.amount) : (m.redeemed += -r.amount); });
  const pendingCredits = (pending ?? []).reduce((a: number, r: any) => a + r.credits_requested, 0);
  const tiles = [
    { label: "Available credits", value: w?.balance ?? 0, Icon: Coins, hero: true },
    { label: "Total earned", value: w?.total_earned ?? 0, Icon: TrendingUp },
    { label: "Pending credits", value: pendingCredits, Icon: Clock },
    { label: "Redemptions", value: redemptions ?? 0, Icon: Gift },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Welcome back, {profile?.full_name?.split(" ")[0] ?? "trader"}</h1>
        <p className="mt-1 text-mute">Here is where your credits stand.</p>
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map(({ label, value, Icon, hero }) => (
          <TiltCard key={label} className={`relative overflow-hidden rounded-2xl border p-5 ${hero ? "border-lime/40 bg-gradient-to-br from-lime/15 via-panel to-panel shadow-[0_0_40px_rgba(198,244,50,.12)]" : "border-line bg-panel/80"}`}>
            <Icon size={20} className={hero ? "text-lime" : "text-mute"} />
            <p className="mt-4 font-display text-3xl font-semibold">{Number(value).toLocaleString()}</p>
            <p className="text-sm text-mute">{label}</p>
          </TiltCard>))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[["Submit a purchase", "/dashboard/submissions/new", "Send your order ID and proof"], ["Redeem rewards", "/dashboard/rewards", "Spend your credits"], ["Compare firms", "/prop-firms", "Find your next challenge"]].map(([t, h, d]) => (
          <Link key={h} href={h} className="group card flex items-center justify-between transition-colors hover:border-lime/50"><div><p className="font-medium">{t}</p><p className="text-sm text-mute">{d}</p></div><ArrowUpRight className="text-mute transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime" /></Link>))}
      </section>

      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg">Credits activity</h2><span className="text-xs text-mute">Last 6 months</span></div>
        {(ledger ?? []).length === 0 ? <p className="py-10 text-center text-mute">Your activity chart appears after your first credits.</p> : <CreditsChart data={months} />}</section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg">Recent transactions</h2><Link href="/dashboard/wallet" className="text-sm text-lime">View all</Link></div>
          {(recent ?? []).length === 0 ? <p className="text-mute">No credits yet. Buy through a partner link, then submit your order.</p> :
            <ul className="divide-y divide-line">{recent!.map((t: any) => <li key={t.id} className="flex justify-between gap-3 py-3 text-sm"><span className="truncate">{t.description}</span><span className={t.amount > 0 ? "font-semibold text-lime" : "text-mute"}>{t.amount > 0 ? "+" : ""}{t.amount}</span></li>)}</ul>}</section>
        <section className="card"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg">Latest submissions</h2><Link href="/dashboard/submissions" className="text-sm text-lime">View all</Link></div>
          {(subs ?? []).length === 0 ? <p className="text-mute">Nothing submitted yet.</p> :
            <ul className="divide-y divide-line">{subs!.map((s: any) => <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate">{s.partners?.name} · {s.order_id}</span><StatusBadge status={s.status} /></li>)}</ul>}</section>
      </div>

      {(featured ?? []).length > 0 && (
        <section><h2 className="mb-3 font-display text-lg">Featured partners</h2>
          <div className="grid gap-4 sm:grid-cols-3">{featured!.map((f: any) => (
            <TiltCard key={f.id} className="card"><p className="font-display">{f.name}</p><p className="text-sm capitalize text-mute">{f.market}</p><Link href={`/marketplace/prop-firms/${f.slug}`} className="btn-ghost mt-4">View offer</Link></TiltCard>))}</div></section>)}

      {(news ?? []).length > 0 && <section className="card border-lime/20"><h2 className="font-display text-lg">Announcements</h2>{news!.map((n: any) => <div key={n.id} className="mt-3"><p className="font-medium">{n.title}</p><p className="text-sm text-mute">{n.body}</p></div>)}</section>}
    </div>
  );
}
