import { SubmitButton } from "@/components/SubmitButton";
import { requirePerm } from "@/lib/auth";
import { saveReward, processRedemption } from "./actions";

const RewardFields = ({ r }: { r?: any }) => (
  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
    <label className="text-xs text-mute">Name<input name="name" defaultValue={r?.name} required className="input mt-1" /></label>
    <label className="text-xs text-mute">Currency<select name="currency" defaultValue={r?.currency ?? "INR"} className="input mt-1"><option>INR</option><option>USD</option></select></label>
    <label className="text-xs text-mute">Credit cost<input name="credits_cost" type="number" min="1" defaultValue={r?.credits_cost} required className="input mt-1" /></label>
    <label className="text-xs text-mute">Stock (blank = unlimited)<input name="stock" type="number" min="0" defaultValue={r?.reward_inventory?.stock ?? ""} className="input mt-1" /></label>
    <label className="text-xs text-mute">Region (e.g. IN, US)<input name="region" defaultValue={r?.region ?? ""} className="input mt-1" /></label>
    <label className="text-xs text-mute">Fulfilment<input name="fulfillment_method" defaultValue={r?.fulfillment_method ?? "manual"} className="input mt-1" /></label>
    <label className="text-xs text-mute">Image<input name="image" type="file" accept="image/*" className="input mt-1" /></label>
    <div className="flex items-end gap-4 text-sm"><label className="flex gap-2"><input type="checkbox" name="active" defaultChecked={r ? r.active : true} />Active</label><label className="flex gap-2"><input type="checkbox" name="featured" defaultChecked={r?.featured} />Featured</label></div>
  </div>
);

export default async function AdminRewards() {
  const { db } = await requirePerm("rewards.manage");
  const [{ data: rewards }, { data: queue }] = await Promise.all([
    db.from("rewards").select("*,reward_inventory(stock)").order("created_at", { ascending: false }),
    db.from("redemptions").select("id,status,credits_spent,created_at,rewards(name),profiles:user_id(username)").in("status", ["pending", "processing"]).order("created_at"),
  ]);
  return (
    <>
      <h1 className="font-display text-3xl">Rewards</h1>
      <h2 className="mt-8 font-display text-xl">Redemption requests</h2>
      {(queue ?? []).length === 0 ? <p className="mt-3 text-mute">No open requests.</p> : (
        <ul className="mt-3 space-y-3">{queue!.map((d: any) => (
          <li key={d.id} className="card text-sm"><p><strong>{d.rewards?.name}</strong> · {d.profiles?.username} · {d.credits_spent} credits · <span className="capitalize">{d.status}</span></p>
            <form action={processRedemption} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="id" value={d.id} />
              <input name="code" placeholder="Gift card code / reference" className="input max-w-xs" /><input name="notes" placeholder="Notes" className="input max-w-xs" />
              <SubmitButton name="status" value="fulfilled" className="btn-lime">Fulfil</SubmitButton><SubmitButton name="status" value="processing" className="btn-ghost">Mark processing</SubmitButton>
              <SubmitButton name="status" value="rejected" className="btn-ghost">Reject &amp; refund</SubmitButton></form></li>))}</ul>)}
      <h2 className="mt-12 font-display text-xl">Catalogue</h2>
      {(rewards ?? []).map((r: any) => <form key={r.id} action={saveReward} className="card mt-3"><input type="hidden" name="id" value={r.id} /><RewardFields r={r} /><SubmitButton className="btn-ghost mt-3">Save</SubmitButton></form>)}
      <form action={saveReward} className="card mt-4 border-dashed"><h3 className="mb-3 font-display">New reward</h3><RewardFields /><SubmitButton className="btn-lime mt-3">Create reward</SubmitButton></form>
    </>
  );
}
