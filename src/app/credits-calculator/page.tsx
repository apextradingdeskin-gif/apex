import { supabaseServer } from "@/lib/supabase/server";
import { estimateCredits } from "@/lib/credits";

export const metadata = { title: "Credits calculator" };

export default async function Calculator({ searchParams }: { searchParams: { partner?: string; size?: string; type?: string; amount?: string } }) {
  const db = supabaseServer();
  const { data: partners } = await db.from("partners").select("id,name,terms,partner_offers(*)").order("name");
  const list = (partners ?? []).filter((p: any) => (p.partner_offers ?? []).some((o: any) => o.active));
  const partner: any = list.find((p: any) => p.id === searchParams.partner);
  const offers = (partner?.partner_offers ?? []).filter((o: any) => o.active);
  const sizes = [...new Set(offers.map((o: any) => o.account_size).filter((s: any) => s != null))] as number[];
  const types = [...new Set(offers.map((o: any) => o.challenge_type).filter(Boolean))] as string[];
  const offer = partner && offers.find((o: any) => (!searchParams.size || String(o.account_size) === searchParams.size) && (!searchParams.type || o.challenge_type === searchParams.type));
  const amount = searchParams.amount ? Number(searchParams.amount) : null;
  const est = offer ? estimateCredits(offer, amount != null && amount > 0 ? amount : null) : null;
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-4xl">Credits calculator</h1>
      <form className="mt-8 grid gap-4">
        <label className="text-sm">Partner<select name="partner" defaultValue={partner?.id ?? ""} className="input mt-1">
          <option value="">Choose a partner</option>{list.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {partner && <>
          {sizes.length > 0 && <label className="text-sm">Account size<select name="size" defaultValue={searchParams.size ?? ""} className="input mt-1"><option value="">Any</option>{sizes.map((s) => <option key={s} value={s}>{s.toLocaleString()}</option>)}</select></label>}
          {types.length > 0 && <label className="text-sm">Challenge type<select name="type" defaultValue={searchParams.type ?? ""} className="input mt-1"><option value="">Any</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>}
          <label className="text-sm">Purchase amount (optional)<input name="amount" type="number" step="0.01" min="0" defaultValue={searchParams.amount} className="input mt-1" /></label>
        </>}
        <button className="btn-lime">{partner ? "Calculate" : "Continue"}</button>
      </form>
      {partner && !offer && <p className="mt-6 text-mute">No offer matches that size and type.</p>}
      {est && offer && (
        <section className="card mt-8" aria-live="polite">
          <p className="text-sm text-mute">Estimated credits</p>
          <p className="font-display text-5xl text-lime">{est.eligible ? est.credits.toLocaleString() : "0"}</p>
          {offer.discount_percent > 0 && <p className="mt-2 text-sm">Partner discount: {offer.discount_percent}%</p>}
          <h2 className="mt-4 font-display text-lg">How this was calculated</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-mute">{est.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {(offer.credit_conditions || partner.terms) && <><h2 className="mt-4 font-display text-lg">Conditions</h2><p className="mt-2 whitespace-pre-line text-sm text-mute">{offer.credit_conditions ?? partner.terms}</p></>}
        </section>)}
      <p className="mt-6 text-xs text-mute">Credits displayed are estimates. Final credit awards are subject to purchase verification and the applicable partner terms. This calculator never awards credits.</p>
    </main>
  );
}
