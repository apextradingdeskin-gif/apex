import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Coins } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { DashNav } from "@/components/DashNav";
import { SubmitButton } from "@/components/SubmitButton";
import { logout } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: p }, { data: w }, { count: unread }] = await Promise.all([
    db.from("profiles").select("full_name,username,suspended").eq("id", user.id).maybeSingle(),
    db.from("wallet_balance_cache").select("balance").eq("user_id", user.id).maybeSingle(),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);
  const name = p?.full_name ?? "Member";
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card flex items-center gap-3 p-4">
            <div aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-lime to-lime-dim font-display text-lg font-semibold text-ink">{name[0]?.toUpperCase()}</div>
            <div className="min-w-0"><p className="truncate font-medium">{name}</p><p className="truncate text-xs text-mute">@{p?.username}</p></div>
          </div>
          <DashNav unread={unread ?? 0} />
          <form action={logout}><SubmitButton className="btn-ghost w-full">Log out</SubmitButton></form>
        </aside>
        <div className="min-w-0">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-mute">Signed in as <span className="text-white">{user.email}</span></p>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/wallet" className="flex items-center gap-2 rounded-xl border border-lime/30 bg-lime/10 px-3 py-2 text-sm font-semibold text-lime"><Coins size={16} />{Number(w?.balance ?? 0).toLocaleString()} credits</Link>
              <Link href="/dashboard/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-xl border border-line hover:border-lime/50"><Bell size={18} />{!!unread && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-lime" />}</Link>
            </div>
          </header>
          {p?.suspended && <p role="alert" className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">Your account is suspended. Contact support to restore access.</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
