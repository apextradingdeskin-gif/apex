import { supabase, supabaseConfigured } from "./supabase";

const LOGO_BUCKET = "apex-firm-logos";
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "firm";
}

async function compressLogo(file: File) {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Use a PNG, JPG, WebP or GIF image.");
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error("Choose an image smaller than 8 MB.");
  if (!("createImageBitmap" in window)) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
  if (!blob) return file;
  return new File([blob], `${safeSlug(file.name.replace(/\.[^.]+$/, ""))}.webp`, { type: "image/webp" });
}

export async function storeFirmLogo(file: File, firmId: string): Promise<string> {
  const optimized = await compressLogo(file);
  if (supabaseConfigured && supabase) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Sign in with an administrator account before uploading a shared logo.");
    const extension = optimized.type === "image/jpeg" ? "jpg" : optimized.type.split("/")[1] || "webp";
    const path = `${safeSlug(firmId)}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, optimized, {
      cacheControl: "31536000",
      contentType: optimized.type || "image/webp",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be saved."));
    reader.readAsDataURL(optimized);
  });
}
