import { supabaseServer } from "@/lib/supabase/server";
export const metadata = { title: "Terms and Conditions" };
export const revalidate = 300;

export default async function Page() {
  const { data } = await supabaseServer().from("site_settings").select("value").eq("key", "legal_terms").maybeSingle();
  const body: string | undefined = data?.value?.body;
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="section-title">Terms and Conditions</h1>
      {body ? <div className="mt-8 whitespace-pre-line text-white/75">{body}</div> : (
        <p className="mt-8 rounded-xl border border-line p-4 text-mute">This page has not been written yet. Add its text in site settings (key <code>legal_terms</code>) after legal review.</p>)}
    </main>
  );
}
