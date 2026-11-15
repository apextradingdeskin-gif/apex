export const FIRM_SELECT =
  "id,name,slug,market,logo_url,featured,recommended,payout_guarantee,tagline,country,years_operating,assets,platforms,max_allocation,rank,rating,review_count," +
  "partner_categories!inner(slug),discount_codes(code,active),partner_offers(discount_percent,active)";

export function shapeFirm(p: any) {
  const offers = (p.partner_offers ?? []).filter((o: any) => o.active);
  return { ...p, bestDiscount: Math.max(0, ...offers.map((o: any) => Number(o.discount_percent ?? 0))),
    code: (p.discount_codes ?? []).find((c: any) => c.active)?.code ?? null };
}
