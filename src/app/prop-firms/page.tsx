import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { FirmTable } from "@/components/FirmTable";
import { FIRM_SELECT, shapeFirm } from "@/lib/firms";

export const metadata = { title: "Compare prop firms", description: "Compare prop firms by market, country, platform and allocation, with exclusive codes." };
const MARKETS = [["", "All"], ["forex", "Forex"], ["futures", "Futures"], ["perps", "Perps"], ["crypto", "Crypto"]];
const SORTS: Record<string, string> = { recommended: "Recommended", rating: "Top rated", years: "Most years", allocation: "Largest allocation", name: "Name A–Z" };
const PAGE = 10;
type SP = { market?: string; asset?: string; country?: string; years?: string; platform?: string; q?: string; sort?: string; page?: string };

export default async function PropFirms({ searchParams }: { searchParams: SP }) {
  const db = supabaseServer();
  const sort = searchParams.sort && searchParams.sort in SORTS ? searchParams.sort : "recommended";
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const term = (searchParams.q ?? "").replace(/[%,()]/g, " ").trim().slice(0, 60);

  // filter option lists come from the data itself
  const { data: all } = await db.from("partners").select("country,assets,platforms,partner_categories!inner(slug)").eq("partner_categories.slug", "prop-firms").eq("active", true);
  const uniq = (xs: any[]) => [...new Set(xs.filter(Boolean))].sort() as string[];
  const countries = uniq((all ?? []).map((r: any) => r.country));
  const assets = uniq((all ?? []).flatMap((r: any) => r.assets ?? []));
  const platforms = uniq((all ?? []).flatMap((r: any) => r.platforms ?? []));

  let q = db.from("partners").select(FIRM_SELECT, { count: "exact" }).eq("partner_categories.slug", "prop-firms").eq("active", true);
  if (searchParams.market) q = q.eq("market", searchParams.market);
  if (searchParams.country) q = q.eq("country", searchParams.country);
  if (searchParams.asset) q = q.contains("assets", [searchParams.asset]);
  if (searchParams.platform) q = q.contains("platforms", [searchParams.platform]);
  if (searchParams.years && Number(searchParams.years) > 0) q = q.gte("years_operating", Number(searchParams.years));
  if (term) q = q.ilike("name", `%${term}%`);
  q = sort === "rating" ? q.order("rating", { ascending: false, nullsFirst: false })
    : sort === "years" ? q.order("years_operating", { ascending: false, nullsFirst: false })
    : sort === "allocation" ? q.order("max_allocation", { ascending: false, nullsFirst: false })
    : sort === "name" ? q.order("name")
    : q.order("featured", { ascending: false }).order("rank", { ascending: true, nullsFirst: false });
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  const qs = (patch: Record<string, string>) => `?${new URLSearchParams(Object.entries({ ...searchParams, ...patch }).filter(([, v]) => v) as [string, string][])}`;
  const Select = ({ name, label, options, value }: { name: string; label: string; options: string[]; value?: string }) => (
    <label className="text-xs text-mute">{label}<select name={name} defaultValue={value ?? ""} className="input mt-1"><option value="">All</option>{options.map((o) => <option key={o}>{o}</option>)}</select></label>);

  return (
    <main className="mx-auto max-w-6xl px-4 py-14">
      <p className="eyebrow">Compare</p>
      <h1 className="section-title">Prop firms</h1>
      <p className="mt-3 max-w-2xl text-white/70">Filter by market, country, platform and track record. Details, rules and codes are managed by the Apex team.</p>

      <nav aria-label="Market" className="mt-8 flex flex-wrap gap-2">
        {MARKETS.map(([v, l]) => <Link key={l} href={qs({ market: v, page: "" })} className={(searchParams.market ?? "") === v ? "btn-lime" : "btn-ghost"}>{l}</Link>)}
      </nav>

      <form className="mt-5 grid gap-3 rounded-2xl border border-line bg-panel/80 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        {searchParams.market && <input type="hidden" name="market" value={searchParams.market} />}
        <label className="text-xs text-mute lg:col-span-2">Search<input type="search" name="q" defaultValue={term} placeholder="Firm name" className="input mt-1" /></label>
        <Select name="asset" label="Assets" options={assets} value={searchParams.asset} />
        <Select name="country" label="Country" options={countries} value={searchParams.country} />
        <Select name="platform" label="Platform" options={platforms} value={searchParams.platform} />
        <label className="text-xs text-mute">Years operating<select name="years" defaultValue={searchParams.years ?? ""} className="input mt-1"><option value="">Any</option>{[1, 2, 3, 5, 8].map((y) => <option key={y} value={y}>{y}+ years</option>)}</select></label>
        <label className="text-xs text-mute lg:col-span-2">Sort<select name="sort" defaultValue={sort} className="input mt-1">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div className="flex items-end gap-2 lg:col-span-4"><button className="btn-lime">Apply filters</button><Link href="/prop-firms" className="btn-ghost">Clear</Link></div>
      </form>

      <p className="mt-6 text-sm text-mute" aria-live="polite">{count ?? 0} {count === 1 ? "firm" : "firms"}</p>
      <div className="mt-3"><FirmTable firms={(data ?? []).map(shapeFirm)} /></div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="btn-ghost">← Previous</Link> : <span />}
          <span className="text-mute">Page {page} of {pages}</span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })} className="btn-ghost">Next →</Link> : <span />}
        </nav>)}
      <p className="mt-8 text-xs text-mute">Listings are information, not financial advice. Apex may earn a commission from partner links. Always read each firm’s own terms.</p>
    </main>
  );
}
