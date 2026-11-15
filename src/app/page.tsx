import Link from "next/link";
import Image from "next/image";
import { TiltCard } from "@/components/TiltCard";
import { supabaseServer } from "@/lib/supabase/server";
import { FirmTable } from "@/components/FirmTable";
import { FIRM_SELECT, shapeFirm } from "@/lib/firms";

export const revalidate = 120;

const STEPS = [
  ["Pick a partner", "Compare firms by market, platform and allocation, then choose the one that fits how you trade."],
  ["Buy with your code", "Use the exclusive Apex code and tracked link so your purchase can be matched to you."],
  ["Submit your order", "Send your order ID and proof from your dashboard. A real person reviews it."],
  ["Earn and redeem", "Approved purchases add credits to your wallet. Spend them on rewards from the catalogue."],
];
const COMPARE: [string, string, string][] = [
  ["Compare firms", "One table: rules, platforms, allocation, promo codes", "Open a dozen tabs and copy numbers by hand"],
  ["Exclusive codes", "Partner codes listed next to every firm", "Hunt for codes, often miss them"],
  ["Rewards", "Credits on verified purchases, redeemable for gift cards", "Nothing back after you buy"],
  ["Transparency", "Credits and approvals are logged in an audit trail", "No record of what you were promised"],
];

export default async function Home() {
  const db = supabaseServer();
  const [{ data: stats }, { data: firms }, { data: faqs }] = await Promise.all([
    db.from("site_statistics").select("key,label,value").order("sort"),
    db.from("partners").select(FIRM_SELECT).eq("partner_categories.slug", "prop-firms").eq("active", true)
      .order("featured", { ascending: false }).order("rank", { ascending: true, nullsFirst: false }).limit(6),
    db.from("faq_entries").select("id,question,answer").eq("published", true).order("sort").limit(6),
  ]);
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow">Apex Trading Community</p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Compare prop firms. <span className="text-lime">Get rewarded</span> for the one you pick.</h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">Side-by-side firm comparison, exclusive partner codes, and credits you can redeem on every verified purchase.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/prop-firms" className="btn-lime px-6 py-3 text-base">Compare prop firms</Link>
              <a href="https://discord.gg/fgkSY352aT" rel="noopener" className="btn-ghost px-6 py-3 text-base">Join the community</a>
            </div>
          </div>
          <div className="scene relative mx-auto w-full max-w-md py-6">
            <div aria-hidden className="absolute -right-4 -top-2 z-10 float">
              <div className="tile3d overflow-hidden rounded-3xl"><Image src="/brand/apex-mark.jpg" alt="" width={120} height={120} priority className="h-28 w-28" /></div>
            </div>
            <span aria-hidden className="glass float-slow absolute -left-6 top-24 z-10 rounded-xl px-3 py-1.5 text-xs text-lime">✓ Verified purchase</span>
            <span aria-hidden className="glass float absolute -bottom-2 right-6 z-10 rounded-xl px-3 py-1.5 text-xs text-white/80">Credits → Rewards</span>
            <TiltCard className="card glass glow-lime relative mt-14 border-lime/20 p-6" max={6}>
              <p className="eyebrow">How credits work</p>
              <ol className="mt-5 space-y-4">{["Buy through an Apex link with your code", "Submit your order ID and proof", "We verify it and add credits to your wallet", "Redeem credits for rewards"].map((t, i) => (
                <li key={t} className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime/15 text-sm font-semibold text-lime">{i + 1}</span><span className="pt-0.5 text-sm text-white/80">{t}</span></li>))}</ol>
              <p className="mt-5 border-t border-line pt-4 text-xs text-mute">Credits are awarded after purchase verification and depend on each partner’s terms.</p>
            </TiltCard>
          </div>
        </div>
      </section>

      {(stats ?? []).some((s) => s.value > 0) && (
        <section aria-label="Platform statistics" className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
            {stats!.map((s) => <div key={s.key} className="bg-panel px-6 py-6"><p className="font-display text-3xl text-lime">{Number(s.value).toLocaleString()}{s.value >= 1000 ? "+" : ""}</p><p className="mt-1 text-sm text-mute">{s.label}</p></div>)}
          </div>
        </section>)}

      <section className="mx-auto mt-24 max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Compare</p><h2 className="section-title">Top prop firms</h2></div>
          <Link href="/prop-firms" className="btn-ghost">View all firms</Link>
        </div>
        <div className="mt-8"><FirmTable firms={(firms ?? []).map(shapeFirm)} /></div>
      </section>

      <section className="mx-auto mt-28 max-w-6xl px-4">
        <p className="eyebrow">Why Apex</p><h2 className="section-title">Apex vs doing it yourself</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-[1fr_1.4fr_1.4fr]">
          {[["", "With Apex", "On your own"], ...COMPARE].map(([a, b, c], i) => (
            <div key={i} className="contents">
              <div className={`bg-panel px-5 py-4 text-sm ${i === 0 ? "" : "font-medium"}`}>{a}</div>
              <div className={`bg-panel px-5 py-4 text-sm ${i === 0 ? "font-display text-lime" : "text-white/85"}`}>{i === 0 ? b : <>✓ {b}</>}</div>
              <div className={`bg-panel px-5 py-4 text-sm ${i === 0 ? "font-display text-mute" : "text-mute"}`}>{i === 0 ? c : <>✕ {c}</>}</div>
            </div>))}
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-6xl px-4">
        <p className="eyebrow">How it works</p><h2 className="section-title">From first click to reward</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">{STEPS.map(([t, d], i) => (
          <li key={t} className="card"><span className="font-display text-4xl text-lime/40">0{i + 1}</span><h3 className="mt-3 font-display text-lg">{t}</h3><p className="mt-2 text-sm text-mute">{d}</p></li>))}</ol>
      </section>

      {(faqs ?? []).length > 0 && (
        <section className="mx-auto mt-28 max-w-3xl px-4">
          <p className="eyebrow">Support</p><h2 className="section-title">Frequently asked questions</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-panel/80">{faqs!.map((f) => (
            <details key={f.id} className="group px-5 py-4"><summary className="flex cursor-pointer items-center justify-between font-medium">{f.question}<span className="text-lime transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 text-sm text-white/70">{f.answer}</p></details>))}</div>
        </section>)}

      <section className="mx-auto mt-28 max-w-6xl px-4">
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-raised via-panel to-ink p-10 text-center md:p-16">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Join the Apex community</h2>
          <p className="mx-auto mt-3 max-w-lg text-white/70">Ask questions, share results and hear about new partner offers first.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><a href="https://discord.gg/fgkSY352aT" rel="noopener" className="btn-lime px-6 py-3">Join on Discord</a><Link href="/register" className="btn-ghost px-6 py-3">Create a free account</Link></div>
        </div>
      </section>
    </main>
  );
}
