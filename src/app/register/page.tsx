import { SubmitButton } from "@/components/SubmitButton";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/, "3–30 letters, numbers or underscores"),
  password: z.string().min(10, "Use at least 10 characters"),
  country: z.string().min(2),
  terms: z.literal("on", { errorMap: () => ({ message: "Accept the terms and privacy policy" }) }),
});

async function register(form: FormData) {
  "use server";
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/register?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const d = parsed.data;
  const db = supabaseServer();
  const taken = await db.from("profiles").select("id").eq("username", d.username).maybeSingle();
  if (taken.data) redirect(`/register?error=${encodeURIComponent("That username is taken")}`);
  const { error } = await db.auth.signUp({
    email: d.email, password: d.password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard`, data: { full_name: d.full_name, username: d.username, country: d.country } },
  });
  if (error) redirect(`/register?error=${encodeURIComponent(error.message)}`);
  redirect("/register?sent=1");   // email verification is required before login
}

export default function Register({ searchParams }: { searchParams: { error?: string; sent?: string } }) {
  if (searchParams.sent) return <main className="mx-auto max-w-sm px-4 py-20"><h1 className="font-display text-3xl">Check your email</h1><p className="mt-3 text-mute">Open the verification link we sent, then log in.</p></main>;
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="font-display text-3xl">Create your account</h1>
      {searchParams.error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-300">{searchParams.error}</p>}
      <form action={register} className="mt-6 space-y-4">
        {[["full_name","Full name","text"],["email","Email","email"],["username","Username","text"],["password","Password","password"],["country","Country","text"]].map(([n,l,t]) =>
          <label key={n} className="block text-sm">{l}<input name={n} type={t} required className="input mt-1" /></label>)}
        <label className="flex gap-2 text-sm text-mute"><input type="checkbox" name="terms" required />I accept the Terms and the Privacy Policy.</label>
        <SubmitButton className="btn-lime w-full">Create account</SubmitButton>
      </form>
    </main>
  );
}
