import { SubmitButton } from "@/components/SubmitButton";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { estimateCredits } from "@/lib/credits";

const schema = z.object({
  partner_id: z.string().uuid(), offer_id: z.string().uuid().optional().or(z.literal("")),
  order_id: z.string().trim().min(3).max(100), purchase_date: z.string().date(),
  amount: z.coerce.number().positive(), currency: z.string().length(3), discount_code: z.string().max(50).optional(), notes: z.string().max(1000).optional(),
});

async function submit(form: FormData) {
  "use server";
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(form));
  const proof = form.get("proof") as File | null;
  if (!parsed.success || !proof || proof.size === 0 || proof.size > 5 * 1024 * 1024)
    redirect(`/dashboard/submissions/new?error=${encodeURIComponent("Check the form and attach proof (max 5 MB).")}`);
  const d = parsed.data;

  // Credits are *requested* from the configured offer rule; the reviewer decides the final award.
  let requested = 0;
  if (d.offer_id) {
    const { data: o } = await db.from("partner_offers").select("price,discount_percent,credit_base,credit_rate,credit_cap,min_purchase").eq("id", d.offer_id).maybeSingle();
    if (o) requested = estimateCredits(o, d.amount).credits;
  }
  const { data: sub, error } = await db.from("submissions").insert({
    user_id: user.id, partner_id: d.partner_id, offer_id: d.offer_id || null, order_id: d.order_id, purchase_date: d.purchase_date,
    amount: d.amount, currency: d.currency, discount_code: d.discount_code, notes: d.notes, credits_requested: requested,
  }).select("id").single();
  if (error) redirect(`/dashboard/submissions/new?error=${encodeURIComponent(error.code === "23505" ? "This order has already been submitted." : "Could not save your submission.")}`);

  const path = `${user.id}/${sub!.id}/${crypto.randomUUID()}-${proof.name.replace(/[^\w.-]/g, "_")}`;
  const up = await db.storage.from("proofs").upload(path, proof, { contentType: proof.type });
  if (up.error) redirect(`/dashboard/submissions/new?error=${encodeURIComponent("Proof upload failed. Re-open this submission and attach it again.")}`);
  await db.from("submission_proofs").insert({ submission_id: sub!.id, storage_path: path, mime_type: proof.type });
  redirect("/dashboard/submissions?submitted=1");
}

export default async function NewSubmission({ searchParams }: { searchParams: { error?: string } }) {
  const db = supabaseServer();
  const { data: partners } = await db.from("partners").select("id,name").order("name");
  const { data: offers } = await db.from("partner_offers").select("id,name,partners(name)").order("name");
  return (
    <>
      <h1 className="font-display text-3xl">Submit a purchase</h1>
      {searchParams.error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-300">{searchParams.error}</p>}
      <form action={submit} className="mt-6 grid max-w-xl gap-4">
        <label className="text-sm">Partner<select name="partner_id" required className="input mt-1">{(partners ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="text-sm">Offer<select name="offer_id" className="input mt-1"><option value="">Not sure / other</option>{(offers ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.partners?.name} — {o.name}</option>)}</select></label>
        <label className="text-sm">Order ID<input name="order_id" required className="input mt-1" /></label>
        <label className="text-sm">Purchase date<input name="purchase_date" type="date" required className="input mt-1" /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Amount<input name="amount" type="number" step="0.01" min="0.01" required className="input mt-1" /></label>
          <label className="text-sm">Currency<input name="currency" defaultValue="USD" maxLength={3} required className="input mt-1 uppercase" /></label>
        </div>
        <label className="text-sm">Discount code used<input name="discount_code" className="input mt-1" /></label>
        <label className="text-sm">Proof of purchase (PDF or image)<input name="proof" type="file" accept="image/*,application/pdf" required className="input mt-1" /></label>
        <label className="text-sm">Notes<textarea name="notes" className="input mt-1" rows={3} /></label>
        <SubmitButton className="btn-lime">Submit for review</SubmitButton>
      </form>
    </>
  );
}
