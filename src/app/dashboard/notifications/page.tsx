import { supabaseServer } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { markRead, markAllRead } from "../actions";

export default async function Notifications() {
  const { data } = await supabaseServer().from("notifications").select("id,title,body,read_at,created_at").order("created_at", { ascending: false }).limit(50);
  const unread = (data ?? []).filter((n: any) => !n.read_at).length;
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl">Notifications</h1>
        {unread > 0 && <form action={markAllRead}><SubmitButton className="btn-ghost">Mark all as read</SubmitButton></form>}</div>
      {(data ?? []).length === 0 ? <p className="mt-8 text-mute">You are all caught up.</p> : (
        <ul className="mt-6 space-y-3">{data!.map((n: any) => (
          <li key={n.id} className={`card flex items-start justify-between gap-4 ${n.read_at ? "opacity-70" : "border-lime/30"}`}>
            <div><p className="font-medium">{!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-lime" />}{n.title}</p>{n.body && <p className="mt-1 text-sm text-mute">{n.body}</p>}<p className="mt-1 text-xs text-mute">{new Date(n.created_at).toLocaleString()}</p></div>
            {!n.read_at && <form action={markRead}><input type="hidden" name="id" value={n.id} /><SubmitButton className="btn-ghost">Mark read</SubmitButton></form>}
          </li>))}</ul>)}
    </>
  );
}
