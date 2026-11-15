import { SubmitButton } from "@/components/SubmitButton";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function redeem(form: FormData) {
  "use server";
  const { error } = await supabaseServer().rpc("redeem_reward", { p_reward: String(form.get("reward")), p_idempotency_key: String(form.get("key")) });
  revalidatePath("/dashboard", "layout");
  if (error) throw new Error(error.message.includes("insufficient") ? "Not enough credits." : error.message.includes("out of stock") ? "Out of stock." : "Redemption failed.");
}

export default async function Rewards() {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  const [{ data: rewards }, { data: w }, { data: history }] = await Promise.all([
    db.from("rewards").select("id,name,region,currency,credits_cost,reward_inventory(stock)").order("credits_cost"),
    db.from("wallet_balance_cache").select("balance").eq("user_id", user!.id).maybeSingle(),
    db.from("redemptions").select("id,status,credits_spent,created_at,rewards(name)").order("created_at", { ascending: false }).limit(10),
  ]);
  const balance = w?.balance ?? 0;
  return (
    <>
      <h1 className="font-display text-3xl">Redeem rewards</h1><p className="mt-1 text-mute">You have {balance.toLocaleString()} credits.</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">{(rewards ?? []).map((r: any) => {
        const stock = r.reward_inventory?.stock; const out = stock !== null && stock !== undefined && stock <= 0; const short = balance < r.credits_cost;
        return (<li key={r.id} className="card"><h2 className="font-display text-lg">{r.name}</h2><p className="text-sm text-mute">{r.region} · {r.currency}</p>
          <p className="mt-2 text-lime">{r.credits_cost.toLocaleString()} credits</p>
          <form action={redeem} className="mt-4"><input type="hidden" name="reward" value={r.id} /><input type="hidden" name="key" value={crypto.randomUUID()} />
            <SubmitButton className="btn-lime disabled:opacity-40" disabled={out || short}>{out ? "Out of stock" : short ? "Not enough credits" : "Redeem"}</SubmitButton></form></li>);})}</ul>
      <h2 className="mt-10 font-display text-xl">Redemption history</h2>
      {(history ?? []).length === 0 ? <p className="mt-3 text-mute">No redemptions yet.</p> :
        <ul className="mt-3 divide-y divide-line text-sm">{history!.map((h: any) => <li key={h.id} className="flex justify-between py-3"><span>{h.rewards?.name}</span><span className="capitalize text-mute">{h.status}</span></li>)}</ul>}
    </>
  );
}
