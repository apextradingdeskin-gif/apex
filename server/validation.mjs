import { z } from 'zod';

const text = (max = 200) => z.string().trim().max(max);
export const httpUrl = z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value), 'Use an http or https URL.');
export const imageReference = z.union([z.literal(''), httpUrl, z.string().regex(/^\/api\/media\/[a-f0-9]{64}$/)]);
export const credentials = z.object({ email: text(254).email().toLowerCase(), password: z.string().min(8).max(128) });
export const registration = credentials.extend({ name: text(100).min(2), referredBy: text(30).optional() });
export const firmSchema = z.object({
  id: text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: text(100).min(2), monogram: text(5),
  logo: imageReference.optional(), country: text(100), countryCode: text(3),
  founded: z.number().int().min(1990).max(new Date().getFullYear()), rating: z.number().min(0).max(5), reviews: z.number().int().min(0),
  assets: z.array(text(60)).max(30), market: z.enum(['Forex', 'Futures']), platforms: z.array(text(60)).max(30),
  allocation: z.number().min(0).max(1e10), allocationLabel: text(60), profitSplit: text(100), leverage: text(120),
  drawdown: text(180), payout: text(180), promo: text(180), code: text(60).optional(), offerDetails: text(3000),
  website: httpUrl, color: z.string().regex(/^#[a-f0-9]{6}$/i), verified: z.boolean(), models: z.array(text(100)).max(30),
  summary: text(3000), cashbackRate: z.number().min(0).max(100), status: z.enum(['active', 'archived']).default('active'),
  affiliateUrl: z.union([z.literal(''), httpUrl]).optional(),
  trackingParameter: text(40).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).refine((value) => !['ref', 'code', 'coupon', 'afmc', 'affiliate', 'utm_source', 'utm_medium'].includes(value.toLowerCase()), 'Use a click/sub-ID parameter, not the affiliate or coupon parameter.').default('apex_click'),
});
const socialUrl = (hosts) => z.union([z.literal(''), z.string().trim().url().max(2048).refine((value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.includes(url.hostname.replace(/^www\./, '')); }
  catch { return false; }
}, 'Enter a valid HTTPS profile URL for this platform.')]);
export const contactSchema = z.object({
  email: text(254).email(), x: socialUrl(['x.com', 'twitter.com']),
  discord: socialUrl(['discord.gg', 'discord.com']), instagram: socialUrl(['instagram.com']),
});
export const settingsSchema = z.object({
  creditRate: z.number().min(0).max(100), minPayout: z.number().min(1).max(100000),
  reviewModeration: z.boolean(), cashbackEnabled: z.boolean(), announcement: text(240),
  siteLogo: imageReference.default(''),
  contact: contactSchema.optional(),
});
export const purchaseSchema = z.object({
  firmId: text(80).min(1), orderId: text(100).min(1), amount: z.number().positive().max(1000000),
  codeUsed: text(60).default(''), purchaseDate: z.string().datetime(), notes: text(1000).default(''),
});
export const reviewSchema = z.object({
  firmId: text(80).min(1), rating: z.number().int().min(1).max(5), accountModel: text(100).default(''),
  title: text(80).min(4), body: text(1200).min(40), recommend: z.boolean(),
});
export const purchaseUpdate = z.object({ status: z.enum(['pending', 'approved', 'paid', 'rejected']), adminNote: text(2000).default(''), verifiedAmount: z.number().positive().max(1000000).optional() });
export const redemptionUpdate = z.object({ status: z.enum(['requested', 'fulfilled', 'cancelled']) });
export const reviewUpdate = z.object({ status: z.enum(['published', 'pending', 'hidden']) });
export const userUpdate = z.object({ role: z.enum(['member', 'admin']), suspended: z.boolean() });
export const mediaInput = z.object({ dataUrl: z.string().max(6_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/) });
const dollars = z.number().positive().max(100000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use no more than two decimal places.');
export const payoutRequest = z.object({
  amount: dollars, methodId: text(70).optional(), methodVersion: z.number().int().positive().optional(),
  answers: z.record(z.string().max(40), z.string().max(500)).optional(),
  method: text(70).optional(), payeeName: text(100).optional(), destination: text(240).optional(), requestKey: z.string().uuid(),
});
export const payoutUpdate = z.object({
  status: z.enum(['processing', 'paid', 'rejected']), paymentReference: text(160).default(''), note: text(1000).default(''),
}).superRefine((value, ctx) => {
  if (value.status === 'paid' && value.paymentReference.length < 3) ctx.addIssue({ code: 'custom', message: 'A payment reference is required to mark a payout paid.' });
  if (value.status === 'rejected' && value.note.length < 4) ctx.addIssue({ code: 'custom', message: 'Give the member a reason for rejecting this request.' });
});
export const conversionEvent = z.object({
  eventId: text(100).min(1), orderId: text(100).min(1), amount: dollars, currency: z.literal('USD'),
  purchasedAt: z.string().datetime(), status: z.enum(['completed', 'refunded']),
  clickId: text(100).optional(), memberCode: text(30).optional(), buyerEmail: text(254).email().toLowerCase().optional(), couponCode: text(60).default(''),
});