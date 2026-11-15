import Link from "next/link";
import { TiltCard } from "@/components/TiltCard";
import { supabaseServer } from "@/lib/supabase/server";
export const metadata = { title: "Marketplace" };
export const revalidate = 60;

export default async function Marketplace({ searchParams }: { searchParams: { unavailable?: string } }) {
  const { data: cats } = await supabaseServer().from("partner_categories").select("id,slug,name").order("sort");
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl">Marketplace</h1>
      {searchParams.unavailable && <p role="alert" className="mt-4 rounded-lg border border-line p-3 text-sm text-mute">That offer link isn’t available right now.</p>}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(cats ?? []).map((c) => (
        <li key={c.id}><TiltCard><Link href={`/marketplace/${c.slug}`} className="card block bg-gradient-to-br from-raised to-panel py-8 hover:border-lime/60"><h2 className="font-display text-xl">{c.name}</h2><p className="mt-1 text-sm text-mute">Browse {c.name.toLowerCase()} →</p></Link></TiltCard></li>))}</ul>
    </main>
  );
}
