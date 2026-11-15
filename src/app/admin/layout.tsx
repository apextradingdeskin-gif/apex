import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { robots: { index: false, follow: false } };

// Server-verified: the signed-in user must hold at least one non-member role. Every admin action
// is additionally enforced inside Postgres (require_permission), so this layout is not the only gate.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await db.from("user_roles").select("roles(key)").eq("user_id", user.id);
  if (!(data ?? []).some((r: any) => r.roles?.key !== "member")) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Admin" className="mb-8 flex flex-wrap gap-4 border-b border-line pb-3 text-sm text-mute">
        {[["Submissions","/admin/submissions"],["Partners","/admin/partners"],["Categories","/admin/categories"],["Rewards","/admin/rewards"]].map(([l,h]) => <Link key={h} href={h} className="hover:text-white">{l}</Link>)}
      </nav>
      {children}
    </div>);
}
