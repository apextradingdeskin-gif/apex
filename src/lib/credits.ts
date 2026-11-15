// Single source of truth for estimating credits. Used by the calculator AND the submission form.
// Rates come from partner_offers (editable in /admin); this module holds no rates of its own.
export type OfferRule = {
  price: number | null; discount_percent: number | null;
  credit_base: number; credit_rate: number; credit_cap: number | null; min_purchase: number | null;
};
export type Estimate = { eligible: boolean; credits: number; basis: number | null; discountedPrice: number | null; steps: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimateCredits(o: OfferRule, amountOverride?: number | null): Estimate {
  const steps: string[] = [];
  const price = o.price == null ? null : Number(o.price);
  const pct = Number(o.discount_percent ?? 0);
  const discountedPrice = price == null ? null : round2(price * (1 - pct / 100));
  if (price != null) steps.push(pct > 0 ? `List price ${price} − ${pct}% discount = ${discountedPrice}` : `List price ${price}`);

  const basis = amountOverride != null && !Number.isNaN(amountOverride) ? round2(amountOverride) : discountedPrice;
  if (amountOverride != null) steps.push(`Using your purchase amount: ${basis}`);
  const base = Number(o.credit_base), rate = Number(o.credit_rate);

  if (basis == null && rate > 0) return { eligible: false, credits: 0, basis: null, discountedPrice, steps: [...steps, "Enter a purchase amount to estimate credits for this offer."] };
  const min = Number(o.min_purchase ?? 0);
  if (basis != null && basis < min) return { eligible: false, credits: 0, basis, discountedPrice, steps: [...steps, `Purchase is below the minimum of ${min}, so no credits apply.`] };

  let raw = base + (basis != null ? basis * rate : 0);
  steps.push(`${base} base + ${basis ?? 0} × ${rate} rate = ${round2(raw)}`);
  if (o.credit_cap != null && raw > o.credit_cap) { raw = o.credit_cap; steps.push(`Capped at ${o.credit_cap} credits`); }
  const credits = Math.max(0, Math.floor(raw));
  steps.push(`Rounded down to ${credits} credits`);
  return { eligible: true, credits, basis, discountedPrice, steps };
}
