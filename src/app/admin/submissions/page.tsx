import { SubmitButton } from "@/components/SubmitButton";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function decide(form: FormData) {
  "use server";
  const db = supabaseServer();
  const id = String(form.get("id")); const notes = String(form.get("notes") ?? ""); const action = String(form.get("action"));
  const { error } = action === "approve"
    ? await db.rpc("award_submission", { p_submission: id, p_credits: Number(form.get("credits")), p_notes: notes || null })
    : await db.rpc("decide_submission", { p_submission: id, p_status: action === "reject" ? "rejected" : "more_info_required", p_notes: notes });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/submissions");
}

export default async function Queue() {
  const db = supabaseServer();
  const { data } = await db.from("submissions").select("id,order_id,amount,currency,credits_requested,discount_code,created_at,status,partners(name),profiles:user_id(username),submission_proofs(storage_path)")
    .in("status", ["pending", "under_review", "more_info_required"]).order("created_at");
  const rows = await Promise.all((data ?? []).map(async (s: any) => ({
    ...s, proofUrls: await Promise.all((s.submission_proofs ?? []).map(async (p: any) => (await db.storage.from("proofs").createSignedUrl(p.storage_path, 300)).data?.signedUrl)),
  })));
  return (
    <>
      <h1 className="font-display text-3xl">Submission review queue</h1>
      {rows.length === 0 && <p className="mt-6 text-mute">The queue is empty.</p>}
      <ul className="mt-6 space-y-4">{rows.map((s: any) => (
        <li key={s.id} className="card text-sm">
          <p><strong>{s.partners?.name}</strong> · order {s.order_id} · {s.amount} {s.currency} · code {s.discount_code ?? "—"}</p>
          <p className="text-mute">Member {s.profiles?.username} · requested {s.credits_requested}</p>
          {s.proofUrls.filter(Boolean).map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="mr-3 text-lime underline">Proof {i + 1}</a>)}
          <form action={decide} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={s.id} />
            <input name="credits" type="number" min="1" defaultValue={s.credits_requested || undefined} placeholder="Credits" className="input w-28" aria-label="Credits to award" />
            <input name="notes" placeholder="Note (required to reject)" className="input flex-1" />
            <SubmitButton name="action" value="approve" className="btn-lime">Approve</SubmitButton>
            <SubmitButton name="action" value="more_info" className="btn-ghost">Request info</SubmitButton>
            <SubmitButton name="action" value="reject" className="btn-ghost">Reject</SubmitButton>
          </form>
        </li>))}</ul>
    </>
  );
}
