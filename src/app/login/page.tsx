import { SubmitButton } from "@/components/SubmitButton";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function login(form: FormData) {
  "use server";
  const next = String(form.get("next") ?? "/dashboard");
  const { error } = await supabaseServer().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
  if (error) redirect(`/login?error=${encodeURIComponent("Email or password is incorrect, or the email is not verified yet.")}`);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export default function Login({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="font-display text-3xl">Log in</h1>
      {searchParams.error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-300">{searchParams.error}</p>}
      <form action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
        <label className="block text-sm">Email<input name="email" type="email" required autoComplete="email" className="input mt-1" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required autoComplete="current-password" className="input mt-1" /></label>
        <SubmitButton className="btn-lime w-full">Log in</SubmitButton>
      </form>
      <p className="mt-4 text-sm text-mute"><a href="/forgot-password">Forgot password?</a> · <a href="/register">Create an account</a></p>
    </main>
  );
}
