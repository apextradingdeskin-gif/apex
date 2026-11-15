import Link from "next/link";
import Image from "next/image";

const COLS: [string, [string, string][]][] = [
  ["Explore", [["Prop firms", "/prop-firms"], ["Brokers", "/marketplace/brokers"], ["Trading tools", "/marketplace/tools"], ["Flight deals", "/marketplace/flight-deals"], ["Hotel deals", "/marketplace/hotel-deals"]]],
  ["Members", [["Credits calculator", "/credits-calculator"], ["Rewards", "/marketplace/gift-cards"], ["Dashboard", "/dashboard"], ["Log in", "/login"], ["Sign up", "/register"]]],
  ["Legal", [["Terms & conditions", "/terms-and-conditions"], ["Privacy policy", "/privacy-policy"], ["Affiliate disclosure", "/affiliate-disclosure"]]],
];

export function Footer() {
  return (
    <footer className="mt-28 border-t border-line bg-panel/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5 font-display text-lg"><Image src="/brand/apex-mark.jpg" alt="" width={32} height={32} className="rounded-lg" />Apex Trading Community</div>
          <p className="mt-4 max-w-xs text-sm text-mute">Compare trading partners, use exclusive codes, and earn credits on verified purchases.</p>
          <div className="mt-5 flex gap-4 text-sm">
            <a href="https://discord.gg/fgkSY352aT" rel="noopener" className="hover:text-lime">Discord</a>
            <a href="https://x.com/apexXtrades" rel="noopener" className="hover:text-lime">X</a>
            <a href="https://www.instagram.com/apexxdesk/" rel="noopener" className="hover:text-lime">Instagram</a>
          </div>
        </div>
        {COLS.map(([h, links]) => (
          <div key={h}><h3 className="font-display text-sm uppercase tracking-wider text-white/60">{h}</h3>
            <ul className="mt-4 space-y-2 text-sm">{links.map(([l, href]) => <li key={href}><Link href={href} className="text-white/80 hover:text-lime">{l}</Link></li>)}</ul></div>))}
      </div>
      <div className="border-t border-line py-5 text-xs text-mute"><p className="mx-auto max-w-6xl px-4">
        Apex Trading Community is not a broker, financial adviser or investment service. Trading carries risk of loss. Some links are affiliate links and Apex may earn a commission. © {new Date().getFullYear()} Apex Trading Community.</p></div>
    </footer>
  );
}
