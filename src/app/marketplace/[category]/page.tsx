import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { estimateCredits } from "@/lib/credits";

export const revalidate = 60;
const MARKETS = ["forex", "crypto", "futures", "perps"];
const SORTS: Record<string, string> = { featured: "Featured", name: "Name A–Z", discount: "Biggest discount", credits: "Most credits" };

export default async function Category({ params, searchParams }: { params: { category: string }; searchParams: { q?: string; market?: string; sort?: string } }) {
  const db = supabaseServer();
  const { data: cat } = await db.from("partner_categories").select("id,name,slug").eq("slug", params.category).maybeSingle();
  if (!cat) notFound();
  const sort = searchParams.sort && searchParams.sort in SORTS ? searchParams.sort : "featured";
  const term = (searchParams.q ?? "").replace(/[%,()]/g, " ").trim().slice(0, 60);

  // Gift cards are the reward catalogue (redeemed with credits), not affiliate partners.
  if (cat.slug === "gift-cards") {
    const { data: rewards } = await db.from("rewards").select("id,name,image_url,region,currency,credits_cost,reward_inventory(stock)").order("credits_cost");
    const list = (rewards ?? []).filter((r: any) => !term || r.name.toLowerCase().includes(term.toLowerCase()));
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-display text-4xl">{cat.name}</h1>
        <p className="mt-2 text-mute">Redeem credits for gift cards. Log in to redeem.</p>
        {list.length === 0 ? <p className="mt-8 text-mute">No gift cards available yet.</p> : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((r: any) => (
            <li key={r.id} className="card">
              {r.image_url && <Image src={r.image_url} alt={r.name} width={320} height={180} unoptimized className="mb-3 h-36 w-full rounded-lg object-cover" />}
              <h2 className="font-display text-lg">{r.name}</h2><p className="text-sm text-mute">{r.region} · {r.currency}</p>
              <p className="mt-2 text-lime">{r.credits_cost.toLocaleString()} credits</p>
              {r.reward_inventory?.stock != null && r.reward_inventory.stock <= 0 && <p className="text-sm text-mute">Out of stock</p>}
            </li>))}</ul>)}
        <Link href="/dashboard/rewards" className="btn-lime mt-8">Redeem in your dashboard</Link>
      </main>
    );
  }

  let q = db.from("partners").select("id,name,slug,market,logo_url,featured,description,discount_codes(code,active),partner_offers(price,discount_percent,credit_base,credit_rate,credit_cap,min_purchase,active)").eq("category_id", cat.id);
  if (cat.slug === "prop-firms" && searchParams.market && MARKETS.includes(searchParams.market)) q = q.eq("market", searchParams.market);
  if (term) q = q.ilike("name", `%${term}%`);
  const { data } = await q;
  const items = (data ?? []).map((p: any) => {
    const offers = (p.partner_offers ?? []).filter((o: any) => o.active);
    return { ...p, bestDiscount: Math.max(0, ...offers.map((o: any) => Number(o.discount_percent ?? 0))),
      maxCredits: Math.max(0, ...offers.map((o: any) => estimateCredits(o).credits)), code: (p.discount_codes ?? []).find((c: any) => c.active)?.code };
  });
  items.sort((a: any, b: any) => sort === "name" ? a.name.localeCompare(b.name) : sort === "discount" ? b.bestDiscount - a.bestDiscount
    : sort === "credits" ? b.maxCredits - a.maxCredits : Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));

  const href = (patch: Record<string, string>) => `?${new URLSearchParams({ ...(term && { q: term }), ...(searchParams.market && { market: searchParams.market }), sort, ...patch } as any)}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl">{cat.name}</h1>
      <form className="mt-6 flex flex-wrap items-end gap-3" role="search">
        <input type="search" name="q" defaultValue={term} placeholder={`Search ${cat.name.toLowerCase()}`} aria-label="Search" className="input max-w-xs" />
        {searchParams.market && <input type="hidden" name="market" value={searchParams.market} />}
        <label className="text-sm text-mute">Sort<select name="sort" defaultValue={sort} className="input ml-2 w-auto">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="btn-ghost">Apply</button>
      </form>
      {cat.slug === "prop-firms" && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Market filter">
          <Link href={href({ market: "" })} className={!searchParams.market ? "btn-lime" : "btn-ghost"}>All</Link>
          {MARKETS.map((m) => <Link key={m} href={href({ market: m })} className={searchParams.market === m ? "btn-lime" : "btn-ghost"}>{m[0].toUpperCase() + m.slice(1)}</Link>)}
        </div>)}
      {items.length === 0 ? <p className="mt-10 text-mute">Nothing matches. Clear the filters or search again.</p> : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((p: any) => (
          <li key={p.id} className="card flex flex-col">
            <div className="flex items-center gap-3">
              {p.logo_url ? <Image src={p.logo_url} alt={`${p.name} logo`} width={44} height={44} unoptimized className="h-11 w-11 rounded-lg object-cover" /> : <div className="h-11 w-11 rounded-lg bg-raised" aria-hidden />}
              <div><h2 className="font-display text-lg">{p.name}</h2><p className="text-sm capitalize text-mute">{p.market ?? ""}{p.featured ? " · Featured" : ""}</p></div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-mute">Discount</dt><dd>{p.bestDiscount ? `Up to ${p.bestDiscount}%` : "—"}</dd></div>
              <div><dt className="text-mute">Est. credits</dt><dd className="text-lime">{p.maxCredits ? `Up to ${p.maxCredits}` : "—"}</dd></div>
            </dl>
            {p.code && <p className="mt-3 text-sm">Code <span className="rounded bg-raised px-2 py-0.5 font-semibold text-lime">{p.code}</span></p>}
            <Link href={`/marketplace/${cat.slug}/${p.slug}`} className="btn-ghost mt-auto pt-2">View details</Link>
          </li>))}</ul>)}
    </main>
  );
}
