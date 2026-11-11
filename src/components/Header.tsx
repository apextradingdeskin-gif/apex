import { useEffect, useState } from "react";
import { ArrowUpRight, LayoutDashboard, Menu, X } from "lucide-react";
import Logo from "./Logo";
import MarketTicker from "./MarketTicker";
import SocialLinks from "./SocialLinks";
import { useAccount } from "../context/AccountContext";

const navigation = [
  { label: "Prop Firms", href: "#top-prop-firms-section" },
  { label: "Cashback", href: "#cashback" },
  { label: "Rewards", href: "#marketplace" },
  { label: "Tools", href: "#tools" },
  { label: "Reviews", href: "#community-reviews" },
  { label: "FAQs", href: "#faq-section" },
];

type HeaderProps = { onLogin: () => void; onSignup: () => void };

export default function Header({ onLogin, onSignup }: HeaderProps) {
  const { user, platformSettings } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const closeOnWideScreen = () => {
      if (window.innerWidth > 900) setMenuOpen(false);
    };
    window.addEventListener("resize", closeOnWideScreen);
    return () => window.removeEventListener("resize", closeOnWideScreen);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="announcement">
        <div className="container announcement-inner">
          <span className="announcement-label">THE APEX STANDARD</span>
          <span className="announcement-copy">{platformSettings.announcement}</span>
          <a href="#top-prop-firms-section">Explore firms <ArrowUpRight size={13} /></a>
          <SocialLinks compact className="announcement-social" />
        </div>
      </div>
      <div className="nav-shell">
        <div className="container navbar">
          <a href="#home" className="logo-link" aria-label="APEX Trading home" onClick={() => setMenuOpen(false)}>
            <Logo />
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navigation.map((item) => (
              <a key={item.label} href={item.href}>{item.label}</a>
            ))}
          </nav>
          <div className="nav-actions">
            {user?.role === "admin" && <a className="admin-header-link desktop-cta" href="/admin">Admin</a>}
            {user ? <a className="account-nav-link desktop-cta" href="#dashboard"><span>{user.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><div><small>My account</small><strong>Dashboard</strong></div><LayoutDashboard size={16} /></a> : <><button className="login-nav-button desktop-cta" onClick={onLogin}>Log in</button><button className="button button-small button-lime desktop-cta" onClick={onSignup}>Join APEX <ArrowUpRight size={15} /></button></>}
            <button
              className="menu-toggle"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <MarketTicker />
        <div className={`mobile-menu ${menuOpen ? "is-open" : ""}`}>
          <nav className="container" aria-label="Mobile navigation">
            {navigation.map((item, index) => (
              <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
                <span>0{index + 1}</span>{item.label}<ArrowUpRight size={17} />
              </a>
            ))}
            {user?.role === "admin" && <a className="mobile-admin-link" href="#admin" onClick={() => setMenuOpen(false)}>Open admin console <ArrowUpRight size={15} /></a>}
            <div className="mobile-menu-social"><span>Follow APEX</span><SocialLinks compact /></div>
            {user ? <a className="button button-lime" href="#dashboard" onClick={() => setMenuOpen(false)}><LayoutDashboard size={17} /> Open my dashboard <ArrowUpRight size={17} /></a> : <div className="mobile-auth-actions"><button className="button button-outline" onClick={() => { setMenuOpen(false); onLogin(); }}>Log in</button><button className="button button-lime" onClick={() => { setMenuOpen(false); onSignup(); }}>Create free account <ArrowUpRight size={17} /></button></div>}
          </nav>
        </div>
      </div>
    </header>
  );
}
