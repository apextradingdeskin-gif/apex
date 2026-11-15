import Link from "next/link";
import Image from "next/image";

const COLS = "md:grid md:grid-cols-[2.2fr_1fr_1.1fr_1.1fr_1.2fr_1fr_1.2fr_1.4fr] md:items-center md:gap-4";
const Chip = ({ children }: { children: React.ReactNode }) => <span className="rounded-md border border-line bg-raised px-2 py-0.5 text-xs text-white/80">{children}</span>;
const Label = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-[11px] uppercase tracking-wide text-mute md:hidden">{children}</span>;

export function FirmTable({ firms }: { firms: any[] }) {
  if (!firms.length) return <p className="card text-mute">No firms match these filters. Try clearing one.</p>;
  return (
    <div role="table" aria-label="Prop firm comparison" className="overflow-hidden rounded-2xl border border-line bg-panel/80">
      <div role="row" className={`hidden border-b border-line bg-raised/60 px-5 py-3 text-xs uppercase tracking-wide text-mute ${COLS}`}>
        <span>Firm</span><span>Rating</span><span>Country · Years</span><span>Assets</span><span>Platforms</span><span>Max allocation</span><span>Promo</span><span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-line">
        {firms.map((f) => (
          <li key={f.id} role="row" className={`flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-raised/40 ${COLS}`}>
            <div className="flex items-center gap-3" role="cell">
              {f.logo_url ? <Image src={f.logo_url} alt={`${f.name} logo`} width={44} height={44} unoptimized className="h-11 w-11 rounded-xl border border-line object-cover" />
                : <div aria-hidden className="grid h-11 w-11 place-items-center rounded-xl border border-lime/30 bg-lime/10 font-display text-lg text-lime">{f.name[0]}</div>}
              <div>
                <Link href={`/marketplace/prop-firms/${f.slug}`} className="font-display text-base hover:text-lime">{f.name}</Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {f.recommended && <span className="rounded-md bg-lime px-2 py-0.5 text-[11px] font-semibold text-ink">Recommended</span>}
                  {f.payout_guarantee && <span className="rounded-md border border-lime/40 px-2 py-0.5 text-[11px] text-lime">Payout guarantee</span>}
                </div>
              </div>
            </div>
            <div role="cell"><Label>Rating</Label>{f.rating != null ? <><span className="text-lime">★</span> {Number(f.rating).toFixed(1)}<span className="block text-xs text-mute">{f.review_count > 0 ? `${f.review_count} reviews` : "No reviews yet"}</span></> : <span className="text-mute">—</span>}</div>
            <div role="cell"><Label>Country · Years</Label>{f.country ?? "—"}<span className="block text-xs text-mute">{f.years_operating != null ? `${f.years_operating} yrs` : ""}</span></div>
            <div role="cell"><Label>Assets</Label><div className="flex flex-wrap gap-1">{(f.assets ?? []).length ? f.assets.map((a: string) => <Chip key={a}>{a}</Chip>) : "—"}</div></div>
            <div role="cell"><Label>Platforms</Label><div className="flex flex-wrap gap-1">{(f.platforms ?? []).length ? f.platforms.slice(0, 3).map((a: string) => <Chip key={a}>{a}</Chip>) : "—"}</div></div>
            <div role="cell"><Label>Max allocation</Label>{f.max_allocation ? `$${Number(f.max_allocation).toLocaleString()}` : "—"}</div>
            <div role="cell"><Label>Promo</Label>{f.code ? <><span className="rounded-md bg-lime/10 px-2 py-1 text-sm font-semibold text-lime">{f.code}</span>{f.bestDiscount > 0 && <span className="block pt-1 text-xs text-mute">Up to {f.bestDiscount}% off</span>}</> : <span className="text-mute">—</span>}</div>
            <div className="flex gap-2 md:justify-end" role="cell">
              <Link href={`/marketplace/prop-firms/${f.slug}`} className="btn-ghost">Details</Link>
              <a href={`/go/${f.id}`} rel="nofollow sponsored" className="btn-lime">Get offer</a>
            </div>
          </li>))}
      </ul>
    </div>
  );
}
