// Comparison-table fields shown in the firm listing. Ratings/review counts must be real; leave blank if unknown.
export function ListingFields({ p }: { p?: any }) {
  const F = ({ n, l, t = "text", v, h }: { n: string; l: string; t?: string; v?: any; h?: string }) => (
    <label className="text-sm">{l}<input name={n} type={t} step="any" defaultValue={Array.isArray(v) ? v.join(", ") : v ?? ""} placeholder={h} className="input mt-1" /></label>);
  return (
    <fieldset className="grid gap-3 rounded-xl border border-line p-4">
      <legend className="px-2 text-sm text-mute">Listing details (comparison table)</legend>
      <F n="tagline" l="Tagline" v={p?.tagline} />
      <div className="grid grid-cols-2 gap-3">
        <F n="country" l="Country" v={p?.country} /><F n="years_operating" l="Years operating" t="number" v={p?.years_operating} />
        <F n="assets" l="Assets (comma separated)" v={p?.assets} h="FX, Metals, Indices" /><F n="platforms" l="Platforms (comma separated)" v={p?.platforms} h="MT5, cTrader" />
        <F n="max_allocation" l="Max allocation (USD)" t="number" v={p?.max_allocation} /><F n="rank" l="Rank (1 = first)" t="number" v={p?.rank} />
        <F n="rating" l="Rating (0–5, real data only)" t="number" v={p?.rating} /><F n="review_count" l="Review count" t="number" v={p?.review_count ?? 0} />
      </div>
      <div className="flex gap-6 text-sm">
        <label className="flex gap-2"><input type="checkbox" name="recommended" defaultChecked={p?.recommended} />Recommended badge</label>
        <label className="flex gap-2"><input type="checkbox" name="payout_guarantee" defaultChecked={p?.payout_guarantee} />Payout guarantee badge</label>
      </div>
    </fieldset>);
}
