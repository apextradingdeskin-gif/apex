import Link from "next/link";
import Image from "next/image";
import { supabaseServer } from "@/lib/supabase/server";

const LINKS = [["Prop Firms", "/prop-firms"], ["Brokers", "/marketplace/brokers"], ["Tools", "/marketplace/tools"], ["Rewards", "/marketplace/gift-cards"], ["Credits Calculator", "/credits-calculator"]];

export async function Navbar() {
  let signedIn = false;
  try { signedIn = !!(await supabaseServer().auth.getUser()).data.user; } catch { /* env not set */ }
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
          <Image src="/brand/apex-mark.jpg" alt="" width={34} height={34} className="rounded-lg" priority />
          <span>Apex<span className="text-lime"> Trading</span></span>
        </Link>
        <div className="ml-8 hidden items-center gap-1 lg:flex">
          {LINKS.map(([l, h]) => <Link key={h} href={h} className="rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-raised hover:text-white">{l}</Link>)}
        </div>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {signedIn ? <Link href="/dashboard" className="btn-lime">Dashboard</Link> : <><Link href="/login" className="btn-ghost">Log in</Link><Link href="/register" className="btn-lime">Sign up</Link></>}
        </div>
        <details className="relative ml-auto lg:hidden sm:ml-2">
          <summary className="btn-ghost cursor-pointer list-none" aria-label="Open menu">Menu</summary>
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-panel p-2 shadow-2xl">
            {LINKS.map(([l, h]) => <Link key={h} href={h} className="block rounded-lg px-3 py-2 text-sm hover:bg-raised">{l}</Link>)}
            <div className="mt-2 grid gap-2 border-t border-line pt-2">
              {signedIn ? <Link href="/dashboard" className="btn-lime">Dashboard</Link> : <><Link href="/login" className="btn-ghost">Log in</Link><Link href="/register" className="btn-lime">Sign up</Link></>}
            </div>
          </div>
        </details>
      </nav>
    </header>
  );
}
