"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerm, slugify, numOrNull, strOrNull, uploadPublic } from "@/lib/auth";

const must = (error: any) => { if (error) throw new Error(error.message); };
const done = (id?: string) => { revalidatePath("/admin/partners"); revalidatePath("/marketplace", "layout"); if (id) revalidatePath(`/admin/partners/${id}`); };

const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function partnerFields(f: FormData) {
  const name = String(f.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  return {
    category_id: Number(f.get("category_id")), name, slug: strOrNull(f.get("slug")) ? slugify(String(f.get("slug"))) : slugify(name),
    market: strOrNull(f.get("market")), website_url: strOrNull(f.get("website_url")), description: strOrNull(f.get("description")),
    terms: strOrNull(f.get("terms")), featured: f.get("featured") === "on", active: f.get("active") !== "off",
    tagline: strOrNull(f.get("tagline")), country: strOrNull(f.get("country")), years_operating: numOrNull(f.get("years_operating")),
    assets: list(f.get("assets")), platforms: list(f.get("platforms")), max_allocation: numOrNull(f.get("max_allocation")),
    rank: numOrNull(f.get("rank")), rating: numOrNull(f.get("rating")), review_count: numOrNull(f.get("review_count")) ?? 0,
    recommended: f.get("recommended") === "on", payout_guarantee: f.get("payout_guarantee") === "on",
  };
}

export async function createPartner(f: FormData) {
  const { db } = await requirePerm("partners.manage");
  const logo = await uploadPublic(db, "partner-logos", f.get("logo") as File | null);
  const { data, error } = await db.from("partners").insert({ ...partnerFields(f), logo_url: logo }).select("id").single();
  must(error); done(); redirect(`/admin/partners/${data!.id}`);
}
export async function updatePartner(f: FormData) {
  const { db } = await requirePerm("partners.manage");
  const id = String(f.get("id")); const logo = await uploadPublic(db, "partner-logos", f.get("logo") as File | null);
  const { error } = await db.from("partners").update({ ...partnerFields(f), ...(logo && { logo_url: logo }) }).eq("id", id);
  must(error); done(id);
}
// "Delete" is an archive: partners with submissions/clicks must keep their history.
export async function setPartnerActive(f: FormData) {
  const { db } = await requirePerm("partners.manage"); const id = String(f.get("id"));
  must((await db.from("partners").update({ active: f.get("active") === "true" }).eq("id", id)).error); done(id);
}
export async function setFeatured(f: FormData) {
  const { db } = await requirePerm("partners.manage"); const id = String(f.get("id"));
  must((await db.from("partners").update({ featured: f.get("featured") === "true" }).eq("id", id)).error); done(id);
}

export async function saveOffer(f: FormData) {
  const { db } = await requirePerm("partners.manage");
  const id = strOrNull(f.get("id")); const partner_id = String(f.get("partner_id"));
  const row = {
    partner_id, name: String(f.get("name") ?? "").trim(), challenge_type: strOrNull(f.get("challenge_type")), account_size: numOrNull(f.get("account_size")),
    price: numOrNull(f.get("price")), currency: String(f.get("currency") || "USD").toUpperCase(), discount_percent: numOrNull(f.get("discount_percent")),
    credit_base: numOrNull(f.get("credit_base")) ?? 0, credit_rate: numOrNull(f.get("credit_rate")) ?? 0, credit_cap: numOrNull(f.get("credit_cap")),
    min_purchase: numOrNull(f.get("min_purchase")) ?? 0, credit_conditions: strOrNull(f.get("credit_conditions")), active: f.get("active") === "on",
  };
  if (!row.name) throw new Error("Offer name is required");
  must((id ? await db.from("partner_offers").update(row).eq("id", id) : await db.from("partner_offers").insert(row)).error); done(partner_id);
}
export async function addCode(f: FormData) {
  const { db } = await requirePerm("partners.manage"); const partner_id = String(f.get("partner_id"));
  must((await db.from("discount_codes").insert({ partner_id, code: String(f.get("code")).trim() })).error); done(partner_id);
}
export async function setCodeActive(f: FormData) {
  const { db } = await requirePerm("partners.manage");
  must((await db.from("discount_codes").update({ active: f.get("active") === "true" }).eq("id", String(f.get("id")))).error); done(String(f.get("partner_id")));
}
export async function addLink(f: FormData) {
  const { db } = await requirePerm("partners.manage"); const partner_id = String(f.get("partner_id"));
  const url = String(f.get("url")).trim(); if (!url.startsWith("https://")) throw new Error("Referral links must start with https://");
  must((await db.from("affiliate_links").insert({ partner_id, url, offer_id: strOrNull(f.get("offer_id")) })).error); done(partner_id);
}
export async function setLinkActive(f: FormData) {
  const { db } = await requirePerm("partners.manage");
  must((await db.from("affiliate_links").update({ active: f.get("active") === "true" }).eq("id", String(f.get("id")))).error); done(String(f.get("partner_id")));
}
export async function saveCategory(f: FormData) {
  const { db } = await requirePerm("partners.manage"); const id = numOrNull(f.get("id")); const name = String(f.get("name")).trim();
  const row = { name, slug: slugify(String(f.get("slug") || name)), sort: numOrNull(f.get("sort")) ?? 0 };
  must((id ? await db.from("partner_categories").update(row).eq("id", id) : await db.from("partner_categories").insert(row)).error);
  revalidatePath("/admin/categories"); revalidatePath("/marketplace", "layout");
}
