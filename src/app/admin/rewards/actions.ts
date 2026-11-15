"use server";
import { revalidatePath } from "next/cache";
import { requirePerm, numOrNull, strOrNull, uploadPublic } from "@/lib/auth";

export async function saveReward(f: FormData) {
  const { db } = await requirePerm("rewards.manage");
  const id = strOrNull(f.get("id")); const image = await uploadPublic(db, "reward-images", f.get("image") as File | null);
  const currency = String(f.get("currency"));
  if (!["INR", "USD"].includes(currency)) throw new Error("Currency must be INR or USD");
  const cost = numOrNull(f.get("credits_cost")); if (!cost || cost <= 0) throw new Error("Credit cost must be positive");
  const row = { name: String(f.get("name")).trim(), region: strOrNull(f.get("region")), currency, credits_cost: cost,
    fulfillment_method: String(f.get("fulfillment_method") || "manual"), featured: f.get("featured") === "on", active: f.get("active") === "on", ...(image && { image_url: image }) };
  let rid = id;
  if (id) { const { error } = await db.from("rewards").update(row).eq("id", id); if (error) throw new Error(error.message); }
  else { const { data, error } = await db.from("rewards").insert(row).select("id").single(); if (error) throw new Error(error.message); rid = data!.id; }
  const stock = numOrNull(f.get("stock"));   // blank = unlimited
  const { error } = await db.from("reward_inventory").upsert({ reward_id: rid, stock }); if (error) throw new Error(error.message);
  revalidatePath("/admin/rewards"); revalidatePath("/dashboard/rewards"); revalidatePath("/marketplace", "layout");
}

// Uses the existing atomic function; it also refunds credits and restocks on reject/cancel.
export async function processRedemption(f: FormData) {
  const { db } = await requirePerm("redemptions.process");
  const { error } = await db.rpc("fulfill_redemption", { p_id: String(f.get("id")), p_status: String(f.get("status")), p_code: strOrNull(f.get("code")), p_notes: strOrNull(f.get("notes")) });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/rewards"); revalidatePath("/dashboard", "layout");
}
