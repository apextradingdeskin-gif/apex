import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";

async function send(f: FormData) {
  "use server";
  const email = String(f.get("email") ?? "").trim();
  if (email) await supabaseServer().auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password` });
  redirect("/forgot-password?sent=1");   // same response whether or not the email exists
}

export default function Forgot({ searchParams }: { searchParams: { sent?: string } }) {
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="font-display text-3xl">Reset your password</h1>
      {searchParams.sent ? <p role="status" className="mt-6 rounded-xl border border-lime/40 bg-lime/10 p-4 text-sm text-lime">If that email has an account, a reset link is on its way.</p> : (
        <form action={send} className="mt-6 space-y-4">
          <label className="block text-sm">Email<input name="email" type="email" required autoComplete="email" className="input mt-1" /></label>
          <SubmitButton className="btn-lime w-full">Send reset link</SubmitButton>
        </form>)}
      <p className="mt-4 text-sm text-mute"><a href="/login" className="hover:text-lime">Back to log in</a></p>
    </main>
  );
}
