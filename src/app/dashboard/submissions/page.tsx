import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";

export default async function Submissions() {
  const db = supabaseServer();
  const { data } = await db.from("submissions").select("id,order_id,status,amount,currency,credits_requested,credits_approved,review_notes,created_at,partners(name)").order("created_at", { ascending: false });
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl">Purchase submissions</h1><Link href="/dashboard/submissions/new" className="btn-lime">New submission</Link></div>
      {(data ?? []).length === 0 ? <p className="mt-6 text-mute">Nothing submitted yet.</p> : (
        <ul className="mt-6 space-y-3">{data!.map((s: any) => (
          <li key={s.id} className="card text-sm"><div className="flex justify-between"><strong>{s.partners?.name} · {s.order_id}</strong><StatusBadge status={s.status} /></div>
            <p className="text-mute">{s.amount} {s.currency} · requested {s.credits_requested} · approved {s.credits_approved ?? "—"}</p>
            {s.review_notes && <p className="mt-2">Reviewer note: {s.review_notes}</p>}</li>))}</ul>)}
    </>
  );
}
