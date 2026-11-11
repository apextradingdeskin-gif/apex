import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Mail,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import Header from "./components/Header";
import Logo, { LogoMark } from "./components/Logo";
import FirmDirectory from "./components/FirmDirectory";
import { getCashbackRate, type Firm } from "./data/firms";
import { useAccount } from "./context/AccountContext";
import AuthModal from "./components/AuthModal";
import PurchaseModal from "./components/PurchaseModal";
import ReviewModal from "./components/ReviewModal";
import CashbackCenter from "./components/CashbackCenter";
import ReviewCenter from "./components/ReviewCenter";
import Dashboard from "./components/Dashboard";
import Marketplace from "./components/Marketplace";
import TraderToolkit from "./components/TraderToolkit";
import SocialLinks from "./components/SocialLinks";
import SupportAgent from "./components/SupportAgent";
import { contact, mailto } from "./data/contact";
import ConnectionNotice from "./components/ConnectionNotice";

const ApexScene = lazy(() => import("./components/ApexScene"));
const AdminPanel = lazy(() => import("./components/admin/AdminPanel"));
function websiteRoute() {
  const hash = window.location.hash;
  if (hash.startsWith("#admin") || (!hash && window.location.pathname.replace(/\/$/, "") === "/admin")) return "admin";
  if (hash === "#dashboard") return "dashboard";
  if (hash === "#marketplace") return "marketplace";
  if (hash === "#tools") return "tools";
  return "home";
}

const faqs = [
  { question: "What is APEX Trading?", answer: "APEX is an independent prop-firm comparison and rewards platform. Compare account rules, explore partner offers and manage eligible cashback in your account. We are not a broker and do not provide personalised financial advice." },
  { question: "How do I earn cashback?", answer: "Buy an eligible account through an APEX partner link or code, then add your order details. We review the order with the partner before making cashback available. Refunded, duplicate or ineligible orders do not earn cashback." },
  { question: "What do I need to add a purchase?", answer: "Choose the firm and provide the order or invoice ID, purchase date and amount paid. You can also include the code you used and any helpful notes. There is no need to choose a tracking category." },
  { question: "How can I request a payout?", answer: "Once approved cashback reaches the minimum shown in your dashboard, choose Request payout. Select an available method and complete its questions. Your request status and payment reference appear in your payout history." },
  { question: "Can I cancel a payout request?", answer: "You can cancel while a request is awaiting review. Once processing starts, contact support before changing any payment details. Cancelled or rejected requests release the reserved cashback back to your available balance." },
  { question: "How do APEX Credits work?", answer: "Eligible purchases earn credits at the published rate. Credits become available after approval and can be used for rewards in the Rewards page. Credits have no cash value and are not transferable." },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section className="faq-section" id="faq-section">
      <div className="container faq-grid">
        <div className="faq-intro">
          <p className="eyebrow"><span /> SUPPORT & ANSWERS</p>
          <h2>Frequently asked<br /><em>questions</em></h2>
          <p>Clear answers for your next prop-firm decision. No jargon, no coupon-only recommendations.</p>
          <div className="support-card">
            <span className="support-icon"><Mail size={20} /></span>
            <div><strong>Still have a question?</strong><p>Need help with firm selection, comparison or an offer? Reach out and our team will guide you.</p></div>
            <a href={mailto("APEX Trading support")}>Contact support <ArrowUpRight size={15} /></a>
          </div>
        </div>
        <div className="faq-list">
          {faqs.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div className={`faq-item ${open ? "is-open" : ""}`} key={faq.question}>
                <button onClick={() => setOpenIndex(open ? -1 : index)} aria-expanded={open} aria-controls={`faq-answer-${index}`}>
                  <span className="faq-number">0{index + 1}</span>
                  <span>{faq.question}</span>
                  <span className="faq-toggle"><ChevronDown size={18} /></span>
                </button>
                <div className="faq-answer" id={`faq-answer-${index}`}><div><p>{faq.answer}</p></div></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { user, firms: allFirms } = useAccount();
  const firms = allFirms.filter((firm) => firm.status !== "archived");
  const maximumCashback = Math.max(0, ...firms.map((firm) => getCashbackRate(firm.id)));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [route, setRoute] = useState<ReturnType<typeof websiteRoute>>(websiteRoute);
  const isDashboard = route === "dashboard";
  const isAdmin = route === "admin";
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseFirm, setPurchaseFirm] = useState<Firm | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFirm, setReviewFirm] = useState<Firm | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: "purchase" | "review"; firm: Firm | null } | null>(null);
  const [globalNotice, setGlobalNotice] = useState("");

  useEffect(() => {
    const onRouteChange = () => setRoute(websiteRoute());
    window.addEventListener("hashchange", onRouteChange);
    return () => window.removeEventListener("hashchange", onRouteChange);
  }, []);

  useEffect(() => {
    if (route !== "home") {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const hash = window.location.hash;
    if (!hash || hash.startsWith("#firm-") || hash.startsWith("#join-")) return;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(timer);
  }, [route]);

  useEffect(() => {
    if (window.location.hash.startsWith("#join-")) {
      const referrer = window.location.hash.replace("#join-", "").trim();
      if (/^APX-[A-Z0-9]{6}$/.test(referrer)) {
        localStorage.setItem("apex_referred_by", referrer);
        window.history.replaceState(null, "", "#home");
        setAuthMode("signup");
        setAuthOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!globalNotice) return;
    const timer = window.setTimeout(() => setGlobalNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [globalNotice]);

  useEffect(() => {
    if (!user || !pendingAction) return;
    if (pendingAction.type === "purchase") {
      setPurchaseFirm(pendingAction.firm);
      setPurchaseOpen(true);
    } else {
      setReviewFirm(pendingAction.firm);
      setReviewOpen(true);
    }
    setPendingAction(null);
    setAuthOpen(false);
  }, [user, pendingAction]);

  const openAuth = (mode: "login" | "signup") => {
    setPendingAction(null);
    setAuthMode(mode);
    setAuthOpen(true);
  };
  const openPurchase = (firm: Firm | null) => {
    if (!user) {
      setPendingAction({ type: "purchase", firm });
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    setPurchaseFirm(firm);
    setPurchaseOpen(true);
  };
  const openReview = (firm: Firm | null) => {
    if (!user) {
      setPendingAction({ type: "review", firm });
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    setReviewFirm(firm);
    setReviewOpen(true);
  };
  const authSuccess = (message: string) => {
    setGlobalNotice(message);
    setAuthOpen(false);
    if (!pendingAction) window.location.hash = "#dashboard";
  };

  return (
    <div className="app-shell">
      {!isAdmin && <Header onLogin={() => openAuth("login")} onSignup={() => openAuth("signup")} />}
      {!isAdmin && <ConnectionNotice />}
      {isAdmin ? <Suspense fallback={<main className="admin-access-message">Checking administrator access...</main>}><AdminPanel /></Suspense> : isDashboard ? <Dashboard key={user?.id ?? "guest"} onAddPurchase={openPurchase} onWriteReview={openReview} onRequireAuth={() => openAuth("login")} onNotice={setGlobalNotice} /> : route === "marketplace" || route === "tools" ? <main className="resource-page"><div className="container resource-back"><a href="#home"><ArrowRight size={14} /> Back to APEX Trading</a></div>{route === "marketplace" ? <Marketplace onRequireAuth={() => openAuth("signup")} onNotice={setGlobalNotice} /> : <TraderToolkit />}</main> : <main>
        <section className="hero" id="home">
          <div className="hero-grid-overlay" />
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="container hero-layout">
            <div className="hero-copy">
              <div className="hero-eyebrow"><span className="status-dot" /> Independent prop-firm comparison & cashback rewards</div>
              <h1><span className="hero-brand-name">APEX TRADING</span><span className="hero-promise">Clarity before<br />your next trade.</span></h1>
              <p className="hero-description">Compare prop firms on their rules, not the noise. Earn up to {maximumCashback}% cashback on eligible purchases and follow every reward from verification to payout.</p>
              <div className="hero-actions">
                <a className="button button-lime button-large" href="#top-prop-firms-section">Explore prop firms <ArrowRight size={18} /></a>
                <a className="button button-ghost button-large" href="#cashback"><MousePointer2 size={17} /> How rewards work</a>
              </div>
            </div>
            <div className="hero-visual">
              <Suspense fallback={<div className="scene-loading"><LogoMark /><span>Building your perspective…</span></div>}>
                <ApexScene />
              </Suspense>
            </div>
          </div>
          <div className="container hero-bottom"><a href="#top-prop-firms-section" className="scroll-cue"><span><ArrowDown size={15} /></span> Discover your next firm</a><a href="#top-prop-firms-section" className="hero-directory-signal" aria-live="polite"><strong data-testid="hero-firm-count">{firms.length} {firms.length === 1 ? "firm" : "firms"}. One clear view.</strong><ArrowUpRight size={17} /></a></div>
        </section>

        <FirmDirectory onActivateCashback={openPurchase} onWriteReview={openReview} />

        <CashbackCenter onActivate={openPurchase} />

        <section className="about-summary" id="about"><div className="container"><p className="eyebrow">THE APEX APPROACH</p><h2>Better decisions.<br /><em>Clearer rewards.</em></h2><p>Start with the account rules, not the discount. Keep your research, purchase records and rewards in one place.</p><ol id="methodology"><li><span>01</span><div><strong>Compare the rules</strong><p>Check platforms, drawdown and payout terms for your trading style.</p></div></li><li><span>02</span><div><strong>Buy through APEX</strong><p>Use an eligible partner offer and keep your order confirmation.</p></div></li><li><span>03</span><div><strong>Manage your rewards</strong><p>Add the purchase, follow its review and request approved cashback.</p></div></li></ol></div></section>

        <ReviewCenter onWriteReview={openReview} />

        <FAQSection />
      </main>}

      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => { setAuthOpen(false); setPendingAction(null); }} onSuccess={authSuccess} />
      <PurchaseModal open={purchaseOpen} initialFirm={purchaseFirm} onClose={() => setPurchaseOpen(false)} onNotice={setGlobalNotice} />
      <ReviewModal open={reviewOpen} initialFirm={reviewFirm} onClose={() => setReviewOpen(false)} onNotice={setGlobalNotice} />
      <div className={`global-toast ${globalNotice ? "is-visible" : ""}`} role="status"><Check size={16} />{globalNotice}</div>
      {!isAdmin && <SupportAgent onOpenAuth={() => openAuth("signup")} onTrackPurchase={() => openPurchase(null)} onWriteReview={() => openReview(null)} />}

      {!isAdmin && <footer className="site-footer">
        <div className="container footer-top">
          <div className="footer-brand"><a href="#home"><Logo /></a><p>Independent prop-firm discovery for traders who prefer clear rules, structured comparisons and informed decisions.</p><a className="footer-email" href={`mailto:${contact.email}`}><Mail size={15} /> {contact.email}</a><SocialLinks className="footer-social" /></div>
          <div className="footer-links"><div><h3>Discover</h3><a href="#top-prop-firms-section">Prop firms</a><a href="#cashback">Cashback rewards</a><a href="#marketplace">Marketplace</a><a href="#tools">Trader toolkit</a><a href="#community-reviews">Trader reviews</a><a href="#dashboard">My dashboard</a></div><div><h3>Learn</h3><a href="#about">Why APEX</a><a href="#methodology">Our methodology</a><a href="#faq-section">All FAQs</a><a href={mailto("APEX Trading support")}>Contact support</a><button className="footer-link-button" onClick={() => window.dispatchEvent(new CustomEvent("apex:open-support"))}>Ask APEX Assist</button></div><div><h3>Markets</h3><a href="#top-prop-firms-section" onClick={() => { localStorage.setItem("apex_preferred_market", "Forex"); window.dispatchEvent(new CustomEvent("apex:filter-market", { detail: "Forex" })); }}>Forex firms</a><a href="#top-prop-firms-section" onClick={() => { localStorage.setItem("apex_preferred_market", "Futures"); window.dispatchEvent(new CustomEvent("apex:filter-market", { detail: "Futures" })); }}>Futures firms</a><a href="#offers">Account offers</a><a href="#methodology">Risk checklist</a></div></div>
        </div>
        <div className="container risk-disclosure"><ShieldCheck size={18} /><p><strong>Risk disclosure:</strong> APEX TRADING is a comparison platform, not a broker or financial adviser. Trading leveraged products and participating in prop-firm evaluations involves risk. Metrics and promotions can change; always verify current terms with the provider.</p></div>
        <div className="container footer-bottom"><p>© {new Date().getFullYear()} APEX TRADING. All rights reserved.</p><p>Built for clarity. Designed for better decisions.</p><span className="footer-bottom-links">{user?.role === "admin" && <a href="/admin">Admin console</a>}<a href="#home">Back to top <ArrowUpRight size={14} /></a></span></div>
      </footer>}
    </div>
  );
}
