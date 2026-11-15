"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, FileText, Gift, Bell, User, Store } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/prop-firms", label: "Marketplace", Icon: Store },
  { href: "/dashboard/wallet", label: "My wallet", Icon: Wallet },
  { href: "/dashboard/submissions", label: "Submissions", Icon: FileText },
  { href: "/dashboard/rewards", label: "Rewards", Icon: Gift },
  { href: "/dashboard/notifications", label: "Notifications", Icon: Bell },
  { href: "/dashboard/profile", label: "Profile", Icon: User },
];

export function DashNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-lime/10 text-lime shadow-[inset_0_0_0_1px_rgba(198,244,50,.25)]" : "text-white/70 hover:bg-raised hover:text-white"}`}>
            <Icon size={18} className={active ? "text-lime" : "text-mute group-hover:text-white"} />{label}
            {label === "Notifications" && unread > 0 && <span className="ml-auto rounded-full bg-lime px-1.5 text-xs font-semibold text-ink">{unread}</span>}
          </Link>);
      })}
    </nav>
  );
}
