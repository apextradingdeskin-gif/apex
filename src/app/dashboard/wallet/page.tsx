import { supabaseServer } from "@/lib/supabase/server";

const FILTERS: Record<string, string[] | null> = {
  all: null, earned: ["purchase_reward", "promo_bonus"], redeemed: ["redemption"], adjustments: ["admin_credit", "admin_deduction"], reversals: ["reversal"],
};

export default async function Wallet({ searchParams }: { searchParams: { f?: string; page?: string } }) {
  const f = searchParams.f && searchParams.f in FILTERS ? searchParams.f : "all";
  const page = Math.max(1, Number(searchParams.page ?? 1)); const size = 20;
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  let q = db.from("credit_ledger").select("id,type,amount,description,created_at,reference_type", { count: "exact" })
    .eq("user_id", user!.id).order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (FILTERS[f]) q = q.in("type", FILTERS[f]!);
  const { data, count } = await q;
  return (
    <>
      <h1 className="font-display text-3xl">My wallet</h1>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist">{Object.keys(FILTERS).map((k) =>
        <a key={k} href={`?f=${k}`} className={k === f ? "btn-lime" : "btn-ghost"}>{k[0].toUpperCase() + k.slice(1)}</a>)}</div>
      <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-mute"><tr><th className="py-2">Date</th><th>Type</th><th>Reference</th><th className="text-right">Credits</th></tr></thead>
        <tbody className="divide-y divide-line">{(data ?? []).map((t) => (
          <tr key={t.id}><td className="py-3">{new Date(t.created_at).toLocaleDateString()}</td><td>{t.type.replace("_", " ")}</td><td>{t.description}</td>
            <td className={`text-right ${t.amount > 0 ? "text-lime" : ""}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td></tr>))}</tbody>
      </table>{(data ?? []).length === 0 && <p className="py-6 text-mute">No transactions match this filter.</p>}</div>
      {(count ?? 0) > page * size && <a className="btn-ghost mt-4" href={`?f=${f}&page=${page + 1}`}>Next page</a>}
    </>
  );
}
