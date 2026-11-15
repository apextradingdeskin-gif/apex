"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function logout() { await supabaseServer().auth.signOut(); redirect("/"); }
export async function logoutEverywhere() { await supabaseServer().auth.signOut({ scope: "global" }); redirect("/login"); }

export async function markRead(f: FormData) {
  await supabaseServer().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", String(f.get("id")));
  revalidatePath("/dashboard", "layout");
}
export async function markAllRead() {
  await supabaseServer().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/dashboard", "layout");
}

export async function updateProfile(f: FormData) {
  const db = supabaseServer(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login");
  const username = String(f.get("username") ?? "").trim();
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) redirect("/dashboard/profile?error=" + encodeURIComponent("Username must be 3–30 letters, numbers or underscores."));
  const { error } = await db.from("profiles").update({
    full_name: String(f.get("full_name") ?? "").trim() || "Member", username, country: String(f.get("country") ?? "").trim() || null,
    discord_username: String(f.get("discord_username") ?? "").trim() || null, preferred_market: String(f.get("preferred_market") ?? "") || null,
  }).eq("id", user.id);
  if (error) redirect("/dashboard/profile?error=" + encodeURIComponent(error.code === "23505" ? "That username is taken." : "Could not save changes."));
  revalidatePath("/dashboard", "layout"); redirect("/dashboard/profile?saved=1");
}
export async function requestDeletion() {
  const db = supabaseServer(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login");
  await db.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", user.id);
  redirect("/dashboard/profile?deletion=1");
}
