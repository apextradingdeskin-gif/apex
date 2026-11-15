import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";

async function update(f: FormData) {
  "use server";
  const pw = String(f.get("password") ?? "");
  if (pw.length < 10) redirect("/reset-password?error=" + encodeURIComponent("Use at least 10 characters."));
  const { error } = await supabaseServer().auth.updateUser({ password: pw });
  if (error) redirect("/reset-password?error=" + encodeURIComponent("Could not update the password. Request a new link."));
  redirect("/dashboard");
}

export default async function Reset({ searchParams }: { searchParams: { error?: string } }) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) redirect("/forgot-password");
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="font-display text-3xl">Choose a new password</h1>
      {searchParams.error && <p role="alert" className="mt-4 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{searchParams.error}</p>}
      <form action={update} className="mt-6 space-y-4">
        <label className="block text-sm">New password<input name="password" type="password" minLength={10} required autoComplete="new-password" className="input mt-1" /></label>
        <SubmitButton className="btn-lime w-full">Update password</SubmitButton>
      </form>
    </main>
  );
}
