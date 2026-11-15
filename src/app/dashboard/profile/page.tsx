import { supabaseServer } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { updateProfile, requestDeletion, logoutEverywhere } from "../actions";

export default async function Profile({ searchParams }: { searchParams: { saved?: string; error?: string; deletion?: string } }) {
  const db = supabaseServer(); const { data: { user } } = await db.auth.getUser();
  const { data: p } = await db.from("profiles").select("*").eq("id", user!.id).single();
  return (
    <>
      <h1 className="font-display text-3xl">Profile settings</h1>
      {searchParams.saved && <p role="status" className="mt-4 rounded-xl border border-lime/40 bg-lime/10 p-3 text-sm text-lime">Saved.</p>}
      {searchParams.error && <p role="alert" className="mt-4 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{searchParams.error}</p>}
      {searchParams.deletion && <p role="status" className="mt-4 rounded-xl border border-line p-3 text-sm text-mute">Deletion request recorded. Our team will confirm by email.</p>}
      <form action={updateProfile} className="card mt-6 grid max-w-xl gap-4">
        <label className="text-sm">Full name<input name="full_name" defaultValue={p?.full_name} required className="input mt-1" /></label>
        <label className="text-sm">Username<input name="username" defaultValue={p?.username} required className="input mt-1" /></label>
        <label className="text-sm">Country<input name="country" defaultValue={p?.country ?? ""} className="input mt-1" /></label>
        <label className="text-sm">Discord username<input name="discord_username" defaultValue={p?.discord_username ?? ""} className="input mt-1" /></label>
        <label className="text-sm">Preferred market<select name="preferred_market" defaultValue={p?.preferred_market ?? ""} className="input mt-1"><option value="">—</option>{["forex", "futures", "crypto", "perps"].map((m) => <option key={m}>{m}</option>)}</select></label>
        <SubmitButton>Save changes</SubmitButton>
      </form>
      <div className="card mt-6 max-w-xl"><h2 className="font-display text-lg">Security and privacy</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={logoutEverywhere}><SubmitButton className="btn-ghost">Sign out of all devices</SubmitButton></form>
          <form action={requestDeletion}><SubmitButton className="btn-ghost">Request account deletion</SubmitButton></form>
        </div></div>
    </>
  );
}
