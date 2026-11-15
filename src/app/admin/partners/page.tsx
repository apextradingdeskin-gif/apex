import { SubmitButton } from "@/components/SubmitButton";
import { ListingFields } from "./ListingFields";
import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { createPartner } from "./actions";

export default async function Partners() {
  const { db } = await requirePerm("partners.manage");
  const [{ data: partners }, { data: cats }] = await Promise.all([
    db.from("partners").select("id,name,market,featured,active,partner_categories(name)").order("name"),
    db.from("partner_categories").select("id,name").order("sort"),
  ]);
  return (
    <>
      <h1 className="font-display text-3xl">Partners</h1>
      <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-mute"><tr><th className="py-2">Name</th><th>Category</th><th>Market</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-line">{(partners ?? []).map((p: any) => (
          <tr key={p.id}><td className="py-3"><Link href={`/admin/partners/${p.id}`} className="text-lime underline">{p.name}</Link>{p.featured && " ★"}</td>
            <td>{p.partner_categories?.name}</td><td className="capitalize">{p.market ?? "—"}</td><td>{p.active ? "Active" : "Archived"}</td></tr>))}</tbody></table></div>
      <h2 className="mt-10 font-display text-xl">Add partner</h2>
      <form action={createPartner} className="mt-4 grid max-w-xl gap-3">
        <label className="text-sm">Name<input name="name" required className="input mt-1" /></label>
        <label className="text-sm">Category<select name="category_id" required className="input mt-1">{(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm">Market<select name="market" className="input mt-1"><option value="">—</option>{["forex","crypto","futures","perps","multi"].map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm">Website<input name="website_url" type="url" className="input mt-1" /></label>
        <label className="text-sm">Logo<input name="logo" type="file" accept="image/*" className="input mt-1" /></label>
        <label className="text-sm">Description<textarea name="description" rows={3} className="input mt-1" /></label>
        <ListingFields />
        <label className="text-sm">Terms<textarea name="terms" rows={3} className="input mt-1" /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="featured" />Featured</label>
        <SubmitButton className="btn-lime">Create partner</SubmitButton>
      </form>
    </>
  );
}
