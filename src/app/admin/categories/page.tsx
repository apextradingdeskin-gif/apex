import { SubmitButton } from "@/components/SubmitButton";
import { requirePerm } from "@/lib/auth";
import { saveCategory } from "../partners/actions";

export default async function Categories() {
  const { db } = await requirePerm("partners.manage");
  const { data } = await db.from("partner_categories").select("*").order("sort");
  return (
    <>
      <h1 className="font-display text-3xl">Marketplace categories</h1>
      <ul className="mt-6 space-y-3">{(data ?? []).map((c: any) => (
        <li key={c.id}><form action={saveCategory} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={c.id} />
          <input name="name" defaultValue={c.name} className="input max-w-xs" aria-label="Name" /><input name="slug" defaultValue={c.slug} className="input max-w-xs" aria-label="Slug" />
          <input name="sort" type="number" defaultValue={c.sort} className="input w-24" aria-label="Order" /><SubmitButton className="btn-ghost">Save</SubmitButton></form></li>))}</ul>
      <form action={saveCategory} className="mt-6 flex flex-wrap gap-2"><input name="name" required placeholder="New category" className="input max-w-xs" /><input name="slug" placeholder="slug (optional)" className="input max-w-xs" /><SubmitButton className="btn-lime">Add category</SubmitButton></form>
    </>
  );
}
