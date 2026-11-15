import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// Server-side gate for admin pages/actions. Postgres RLS / require_permission() still enforce the same rule.
export async function requirePerm(perm: string) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.rpc("has_permission", { p: perm });
  if (data !== true) notFound();
  return { db, user };
}
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const numOrNull = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : Number(v));
export const strOrNull = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

export async function uploadPublic(db: any, bucket: string, file: File | null) {
  if (!file || file.size === 0) return null;
  if (file.size > 2 * 1024 * 1024) throw new Error("Image must be under 2 MB");
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await db.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl as string;
}
