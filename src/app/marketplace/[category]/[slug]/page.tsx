import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { estimateCredits } from "@/lib/credits";

export const revalidate = 60;

export default async function PartnerPage({ params }: { params: { category: string; slug: string } }) {
  const db = supabaseServer();
  const { data: p } = await db.from("partners").select("*,partner_categories!inner(slug,name),discount_codes(code,active),partner_offers(*)").eq("slug", params.slug).eq("partner_categories.slug", params.category).maybeSingle();
  if (!p) notFound();
  const { data: hasLink } = await db.rpc("partner_has_link", { p: p.id });
  const offers = (p.partner_offers ?? []).filter((o: any) => o.active).sort((a: any, b: any) => (a.account_size ?? 0) - (b.account_size ?? 0));
  const codes = (p.discount_codes ?? []).filter((c: any) => c.active);
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Link href={`/marketplace/${params.category}`} className="text-sm text-mute hover:text-white">← {p.partner_categories.name}</Link>
      <div className="mt-4 flex items-center gap-4">
        {p.logo_url && <Image src={p.logo_url} alt={`${p.name} logo`} width={64} height={64} unoptimized className="h-16 w-16 rounded-xl object-cover" />}
        <div><h1 className="font-display text-4xl">{p.name}</h1><p className="capitalize text-mute">{p.market}</p></div>
      </div>
      {p.description && <p className="mt-6 max-w-2xl text-mute">{p.description}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {codes.map((c: any) => <span key={c.code} className="rounded-lg bg-raised px-3 py-2 text-sm">Code <strong className="text-lime">{c.code}</strong></span>)}
        {hasLink ? <a href={`/go/${p.id}`} rel="nofollow sponsored" className="btn-lime">Get this offer</a> : <span className="text-sm text-mute">Offer link coming soon</span>}
      </div>
      <p className="mt-2 text-xs text-mute">Apex may earn a commission from partner links. Credits are estimates until your purchase is verified.</p>

      <h2 className="mt-10 font-display text-2xl">Offers</h2>
      {offers.length === 0 ? <p className="mt-3 text-mute">No active offers.</p> : (
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-mute"><tr><th className="py-2">Offer</th><th>Size</th><th>Price</th><th>Discount</th><th className="text-right">Est. credits</th></tr></thead>
          <tbody className="divide-y divide-line">{offers.map((o: any) => { const e = estimateCredits(o); return (
            <tr key={o.id}><td className="py-3">{o.name}{o.challenge_type ? ` · ${o.challenge_type}` : ""}</td><td>{o.account_size?.toLocaleString() ?? "—"}</td>
              <td>{o.price != null ? `${o.price} ${o.currency}` : "—"}</td><td>{o.discount_percent ? `${o.discount_percent}%` : "—"}</td>
              <td className="text-right text-lime">{e.eligible ? e.credits : "—"}</td></tr>); })}</tbody></table></div>)}
      <p className="mt-4 text-sm"><Link href={`/credits-calculator?partner=${p.id}`} className="text-lime underline">Estimate credits for your purchase</Link></p>

      {p.terms && <><h2 className="mt-10 font-display text-2xl">Terms</h2><p className="mt-3 whitespace-pre-line text-sm text-mute">{p.terms}</p></>}
    </main>
  );
}
