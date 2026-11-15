import { SubmitButton } from "@/components/SubmitButton";
import { ListingFields } from "../ListingFields";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { updatePartner, setPartnerActive, setFeatured, saveOffer, addCode, setCodeActive, addLink, setLinkActive } from "../actions";

const OfferFields = ({ o }: { o?: any }) => (
  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
    {[["name","Name","text",o?.name],["challenge_type","Challenge type","text",o?.challenge_type],["account_size","Account size","number",o?.account_size],["price","List price","number",o?.price],
      ["currency","Currency","text",o?.currency ?? "USD"],["discount_percent","Discount %","number",o?.discount_percent],["credit_base","Base credits","number",o?.credit_base ?? 0],
      ["credit_rate","Credits per currency unit","number",o?.credit_rate ?? 0],["credit_cap","Credit cap","number",o?.credit_cap],["min_purchase","Min purchase","number",o?.min_purchase ?? 0]
    ].map(([n, l, t, v]) => <label key={n as string} className="text-xs text-mute">{l}<input name={n as string} type={t as string} step="any" defaultValue={v ?? ""} required={n === "name"} className="input mt-1" /></label>)}
    <label className="col-span-2 text-xs text-mute md:col-span-4">Credit conditions shown to members<textarea name="credit_conditions" defaultValue={o?.credit_conditions ?? ""} rows={2} className="input mt-1" /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={o ? o.active : true} />Active</label>
  </div>
);

export default async function EditPartner({ params }: { params: { id: string } }) {
  const { db } = await requirePerm("partners.manage");
  const [{ data: p }, { data: cats }] = await Promise.all([
    db.from("partners").select("*,partner_offers(*),discount_codes(*),affiliate_links(*)").eq("id", params.id).maybeSingle(),
    db.from("partner_categories").select("id,name").order("sort"),
  ]);
  if (!p) notFound();
  const offers = (p.partner_offers ?? []).sort((a: any, b: any) => (a.account_size ?? 0) - (b.account_size ?? 0));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{p.name} {!p.active && <span className="text-mute">(archived)</span>}</h1>
        <div className="flex gap-2">
          <form action={setFeatured}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="featured" value={String(!p.featured)} /><SubmitButton className="btn-ghost">{p.featured ? "Unfeature" : "Feature"}</SubmitButton></form>
          <form action={setPartnerActive}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} /><SubmitButton className="btn-ghost">{p.active ? "Archive" : "Restore"}</SubmitButton></form>
        </div>
      </div>

      <form action={updatePartner} className="mt-6 grid max-w-xl gap-3">
        <input type="hidden" name="id" value={p.id} />{!p.active && <input type="hidden" name="active" value="off" />}
        <label className="text-sm">Name<input name="name" defaultValue={p.name} required className="input mt-1" /></label>
        <label className="text-sm">URL slug<input name="slug" defaultValue={p.slug} className="input mt-1" /></label>
        <label className="text-sm">Category<select name="category_id" defaultValue={p.category_id} className="input mt-1">{(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm">Market<select name="market" defaultValue={p.market ?? ""} className="input mt-1"><option value="">—</option>{["forex","crypto","futures","perps","multi"].map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm">Website<input name="website_url" defaultValue={p.website_url ?? ""} className="input mt-1" /></label>
        <label className="text-sm">Replace logo<input name="logo" type="file" accept="image/*" className="input mt-1" /></label>
        <label className="text-sm">Description<textarea name="description" defaultValue={p.description ?? ""} rows={3} className="input mt-1" /></label>
        <ListingFields p={p} />
        <label className="text-sm">Terms<textarea name="terms" defaultValue={p.terms ?? ""} rows={3} className="input mt-1" /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={p.featured} />Featured</label>
        <SubmitButton className="btn-lime">Save partner</SubmitButton>
      </form>

      <h2 className="mt-12 font-display text-2xl">Offers and earning rules</h2>
      <p className="text-sm text-mute">Credits = base + (purchase amount × rate), capped, rounded down. Changes apply to the calculator and new submissions immediately.</p>
      {offers.map((o: any) => (
        <form key={o.id} action={saveOffer} className="card mt-4"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="partner_id" value={p.id} /><OfferFields o={o} /><SubmitButton className="btn-ghost mt-3">Save offer</SubmitButton></form>))}
      <form action={saveOffer} className="card mt-4 border-dashed"><input type="hidden" name="partner_id" value={p.id} /><h3 className="mb-3 font-display">New offer</h3><OfferFields /><SubmitButton className="btn-lime mt-3">Add offer</SubmitButton></form>

      <h2 className="mt-12 font-display text-2xl">Discount codes</h2>
      <ul className="mt-3 space-y-2 text-sm">{(p.discount_codes ?? []).map((c: any) => (
        <li key={c.id} className="flex items-center gap-3"><code className="rounded bg-raised px-2 py-1">{c.code}</code><span className="text-mute">{c.active ? "Active" : "Off"}</span>
          <form action={setCodeActive}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="partner_id" value={p.id} /><input type="hidden" name="active" value={String(!c.active)} /><SubmitButton className="btn-ghost">{c.active ? "Disable" : "Enable"}</SubmitButton></form></li>))}</ul>
      <form action={addCode} className="mt-3 flex gap-2"><input type="hidden" name="partner_id" value={p.id} /><input name="code" required placeholder="New code" className="input max-w-xs" /><SubmitButton className="btn-lime">Add code</SubmitButton></form>

      <h2 className="mt-12 font-display text-2xl">Referral links</h2>
      <p className="text-sm text-mute">Members never see these URLs. They are reached through the tracked redirect.</p>
      <ul className="mt-3 space-y-2 text-sm">{(p.affiliate_links ?? []).map((l: any) => (
        <li key={l.id} className="flex flex-wrap items-center gap-3"><span className="break-all">{l.url}</span><span className="text-mute">{l.active ? "Active" : "Off"}</span>
          <form action={setLinkActive}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="partner_id" value={p.id} /><input type="hidden" name="active" value={String(!l.active)} /><SubmitButton className="btn-ghost">{l.active ? "Disable" : "Enable"}</SubmitButton></form></li>))}</ul>
      <form action={addLink} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="partner_id" value={p.id} />
        <input name="url" type="url" required placeholder="https://…" className="input max-w-md" />
        <select name="offer_id" className="input w-auto"><option value="">All offers</option>{offers.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <SubmitButton className="btn-lime">Add link</SubmitButton></form>
    </>
  );
}
