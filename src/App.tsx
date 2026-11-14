import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  GitCompareArrows,
  Mail,
  MousePointer2,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Header from "./components/Header";
import Logo, { LogoMark } from "./components/Logo";
import FirmLogo from "./components/FirmLogo";
import FirmDirectory from "./components/FirmDirectory";
import { type Firm } from "./data/firms";
import { useAccount } from "./context/AccountContext";
import AuthModal from "./components/AuthModal";
import PurchaseModal from "./components/PurchaseModal";
import ReviewModal from "./components/ReviewModal";
import CashbackCenter from "./components/CashbackCenter";
import ReviewCenter from "./components/ReviewCenter";
import Dashboard from "./components/Dashboard";
import Marketplace from "./components/Marketplace";
import TraderToolkit from "./components/TraderToolkit";
import SocialLinks, { DiscordIcon } from "./components/SocialLinks";
import SupportAgent from "./components/SupportAgent";
import AdminPanel from "./components/admin/AdminPanel";

const ApexScene = lazy(() => import("./components/ApexScene"));

const traderImages = [
  { src: "https://www.theforexclue.in/community/trader-1.webp", alt: "Trader in a red turban and grey suit" },
  { src: "https://www.theforexclue.in/community/trader-2.webp", alt: "Trader seated beside a mountain shrine" },
  { src: "https://www.theforexclue.in/community/trader-3.webp", alt: "Trader seated on a car outdoors" },
  { src: "https://www.theforexclue.in/community/trader-4.webp", alt: "Trader in a pink shirt beside a pool" },
];

const faqs = [
  {
    question: "Which prop firm is the best?",
    answer: "There is no single best prop firm for everyone. The right choice depends on your strategy, risk management, preferred platform and payout expectations. PropApex helps you compare rule pressure and account value before a headline discount influences your decision.",
  },
  {
    question: "What is the best prop firm for beginners?",
    answer: "Beginners usually benefit from simple rules, transparent drawdown calculations, manageable profit targets and flexible trading conditions. Use the directory to shortlist a firm, then read its current evaluation and consistency rules on the official website before purchasing.",
  },
  {
    question: "Which prop firms offer instant funding?",
    answer: "Several firms in the directory list instant or direct-funding models. These accounts can have different fees, trailing drawdown rules, consistency requirements and profit splits. Open a firm’s detail view to see its listed account models and validate the exact terms at source.",
  },
  {
    question: "Which prop firm has the fastest payout?",
    answer: "Payout speed varies by account model, review process and payment rail. Some firms advertise on-demand or short-cycle payouts, while others use fixed intervals. Treat advertised timing as one decision factor and confirm eligibility conditions, minimum withdrawal rules and recent trader feedback.",
  },
  {
    question: "How do prop firm discount codes work?",
    answer: "A listed code can be copied from a firm row or detail view and applied on the firm’s eligible checkout page. Campaigns may be limited by account model, region or date. A discount reduces entry cost; it does not make unsuitable trading rules suitable.",
  },
  {
    question: "How does PropApex cashback work?",
    answer: "Create a free account, activate a firm’s cashback offer and complete your purchase through the tracked link or eligible listed code. Submit the order ID, purchase date and net amount in your dashboard. We calculate the estimated reward and keep it pending while the purchase and referral are verified.",
  },
  {
    question: "When can I withdraw my cashback?",
    answer: "Only approved cashback counts toward your available balance. The dashboard separates pending, reserved and paid amounts. Your current minimum payout threshold is shown next to your balance. Refunded, duplicate, charged-back or unattributed orders can be ineligible, so a submitted estimate is not a guaranteed balance.",
  },
  {
    question: "How do I submit and follow a payout request?",
    answer: "Open Dashboard → Cashback, choose Request payout after reaching the displayed minimum, and provide a receiving email or wallet reference for one of the available methods. The request appears in Payout history. You can cancel it while it is still marked Requested; Processing, Paid and Rejected updates come from the PropApex team.",
  },
  {
    question: "How will I know someone purchased through my PropApex link or code?",
    answer: "PropApex records each activated click with a unique click ID. If the firm or its affiliate network sends PropApex a signed purchase postback containing that ID (or an PropApex promo code and order ID), the conversion appears in the admin Affiliate conversions panel. A click or a member-entered order by itself is not proof that a purchase happened. Each partner must support and enable the postback.",
  },
  {
    question: "How do I request a cashback payout?",
    answer: "Open Dashboard → Cashback and select Request payout once your available balance reaches the displayed minimum. Choose an available payment method and enter only the receiving email or wallet reference that method requires. The request and amount appear in your payout history while the PropApex team reviews it.",
  },
  {
    question: "Which payout methods can I use?",
    answer: "Available payout methods are shown in the request form and can change. PropApex administrators manage the methods offered for new requests. Existing requests keep the method you selected when you submitted them.",
  },
  {
    question: "Why is my payout request pending?",
    answer: "A request stays pending while PropApex reviews the available balance, destination details and payment. The amount is reserved while the request is pending or processing. If it is rejected, the amount returns to your available balance; if it is paid, the payment appears in your history.",
  },
  {
    question: "How can PropApex confirm that a purchase came through my link?",
    answer: "An PropApex link attaches a unique click ID. When a partner supports server-to-server affiliate postbacks, it sends the click ID and order event back to PropApex and the conversion appears in your order status. A code or order you submit manually remains pending until PropApex can verify it with the firm. Not every firm supports automatic postbacks.",
  },
  {
    question: "What are PropApex Credits and how do I use them?",
    answer: "You earn 1 PropApex Credit for every $1 of eligible net spend on a purchase you submit. Credits stay pending until the purchase is verified, then become spendable in the Marketplace on challenge credits, trader tools, gift cards and experiences. Credits have no cash value and can’t be transferred.",
  },
  {
    question: "Are the trader calculators and market rates accurate?",
    answer: "The calculators use standard formulas and run entirely in your browser, but they’re planning aids, not trading advice. Always confirm contract size, pip value and drawdown rules on your own platform and with your prop firm. The rates strip shows daily European Central Bank reference rates, not live tradable prices.",
  },
  {
    question: "Does PropApex TRADING provide financial advice?",
    answer: "No. PropApex TRADING is an independent comparison and research interface. It does not place trades, manage capital or provide personalized financial advice. Proprietary trading and leveraged products involve substantial risk, so always conduct your own due diligence.",
  },
];

function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(1100px) rotateX(${-y * 4.5}deg) rotateY(${x * 5.5}deg) translateY(-3px)`;
    card.style.setProperty("--glow-x", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--glow-y", `${(y + 0.5) * 100}%`);
  };
  const onLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0)";
  };
  return <div ref={cardRef} onMouseMove={onMove} onMouseLeave={onLeave} className={`tilt-card ${className}`}>{children}</div>;
}

function FAQSection() {
  const { platformSettings } = useAccount();
  const [openIndex, setOpenIndex] = useState(0);
  const faqItems = faqs.map((item) => {
    if (item.question === "When can I withdraw my cashback?") {
      return { ...item, answer: `Only approved cashback counts toward your available balance. The dashboard separates pending, reserved and paid amounts, with a $${platformSettings.minPayout.toFixed(2)} minimum payout threshold. Refunded, duplicate, charged-back or unattributed orders can be ineligible, so a submitted estimate is not a guaranteed balance.` };
    }
    if (item.question === "Which payout methods can I use?") {
      return { ...item, answer: `The current payout form offers: ${platformSettings.payoutMethods.join(", ") || "No methods are available right now"}. PropApex administrators can add or remove methods in Settings. Existing requests keep the method selected at submission.` };
    }
    if (item.question === "How do I submit and follow a payout request?") {
      return { ...item, answer: `Open Dashboard → Cashback and select Request payout once your available balance reaches $${platformSettings.minPayout.toFixed(2)}. Provide a receiving email or wallet reference for one of these methods: ${platformSettings.payoutMethods.join(", ") || "No methods are available right now"}. Requests appear in Payout history. You can cancel one while its status is Requested.` };
    }
    return item;
  });
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
            <a href={`mailto:${platformSettings.supportEmail}?subject=PropApex%20Trading%20support`}>Contact support <ArrowUpRight size={15} /></a>
          </div>
          <div className="community-card">
            <div><strong>Join the PropApex community</strong><p>Faster answers, offer alerts and trader discussion.</p></div>
            <a className="button button-small button-lime" href={platformSettings.socialDiscord} target="_blank" rel="noreferrer"><DiscordIcon size={15} /> Join Discord</a>
            <SocialLinks compact />
          </div>
        </div>
        <div className="faq-list">
          {faqItems.map((faq, index) => {
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
  const { user, firms, platformSettings, backendConfigured, backendStatus, backendError } = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [route, setRoute] = useState<"home" | "dashboard" | "admin">(() => window.location.hash.startsWith("#admin") ? "admin" : window.location.hash === "#dashboard" ? "dashboard" : "home");
  const isDashboard = route === "dashboard";
  const isAdmin = route === "admin";
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseFirm, setPurchaseFirm] = useState<Firm | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFirm, setReviewFirm] = useState<Firm | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: "purchase" | "review"; firm: Firm | null } | null>(null);
  const [globalNotice, setGlobalNotice] = useState("");

  useEffect(() => {
    const onRouteChange = () => setRoute(window.location.hash.startsWith("#admin") ? "admin" : window.location.hash === "#dashboard" ? "dashboard" : "home");
    window.addEventListener("hashchange", onRouteChange);
    return () => window.removeEventListener("hashchange", onRouteChange);
  }, []);

  useEffect(() => {
    if (isDashboard || isAdmin) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const hash = window.location.hash;
    if (!hash || hash.startsWith("#firm-") || hash.startsWith("#join-")) return;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(timer);
  }, [isDashboard, isAdmin]);

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
    if (!pendingAction && route !== "admin") window.location.hash = "#dashboard";
  };

  return (
    <div className="app-shell">
      {!isAdmin && backendConfigured && backendStatus === "error" && <div className="backend-reconnect-banner"><ShieldCheck size={17} /><p><strong>Browsing is available; account services need the server.</strong><span>{backendError || "Reconnect to continue with accounts, purchases and payouts."}</span></p><button onClick={() => window.location.reload()}><RefreshCw size={14} /> Reconnect</button></div>}
      {!isAdmin && <Header onLogin={() => openAuth("login")} onSignup={() => openAuth("signup")} />}
      {isAdmin ? <AdminPanel onLogin={() => openAuth("login")} /> : isDashboard ? <Dashboard key={user?.id ?? "guest"} onAddPurchase={openPurchase} onWriteReview={openReview} onRequireAuth={() => openAuth("login")} onNotice={setGlobalNotice} /> : <main>
        <section className="hero" id="home">
          <div className="hero-grid-overlay" />
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="container hero-layout">
            <div className="hero-copy">
              <div className="hero-eyebrow"><span className="status-dot" /> Independent prop-firm comparison & cashback rewards</div>
              <h1>Your Guide For<br />Choosing The <span>Top Prop Firms</span></h1>
              <p className="hero-description">Compare rules, payouts and platforms—then earn cashback and PropApex Credits on every eligible purchase through our tracked links or codes. Plan trades with free calculators. No noise. Just a clearer, more rewarding decision.</p>
              <div className="hero-actions">
                <a className="button button-lime button-large" href="#cashback">Explore firms & earn <ArrowRight size={18} /></a>
                <a className="button button-ghost button-large" href="#about"><MousePointer2 size={17} /> How PropApex works</a>
              </div>
              <div className="hero-proof">
                <div className="avatar-stack">
                  {traderImages.map((trader) => <img key={trader.src} src={trader.src} alt={trader.alt} loading="eager" />)}
                  <span><TrendingUp size={17} /></span>
                </div>
                <div><div className="proof-stars"><BadgeCheck size={13} /><span>RULE-AWARE RESEARCH</span></div><p>Use <strong>PropApex TRADING</strong> to compare your options and track eligible rewards.</p></div>
              </div>
            </div>
            <div className="hero-visual">
              <Suspense fallback={<div className="scene-loading"><LogoMark /><span>Building your perspective…</span></div>}>
                <ApexScene />
              </Suspense>
              <div className="floating-panel floating-panel-top">
                <span className="floating-icon"><GitCompareArrows size={17} /></span>
                <div><strong>{firms.length} firms. One clear view.</strong><small>Compare what actually matters</small></div>
              </div>
              <div className="floating-panel floating-panel-bottom">
                <span className="floating-icon"><ShieldCheck size={17} /></span>
                <div><strong>Rules before rewards</strong><small>Official-source links included</small></div>
                <BadgeCheck size={17} className="floating-check" />
              </div>
            </div>
          </div>
          <div className="container hero-bottom">
            <a href="#reviews" className="scroll-cue"><span><ArrowDown size={15} /></span> Scroll to discover</a>
            <div className="hero-micro-stats">
              <div><strong>{firms.length}</strong><span>Firms to explore</span></div>
              <div><strong>8%</strong><span>Maximum cashback rate</span></div>
              <div><strong>02</strong><span>Market categories</span></div>
            </div>
          </div>
        </section>

        <section className="trust-section" id="reviews">
          <div className="container trust-heading">
            <p className="eyebrow"><span /> TOP TRUSTED</p>
            <h2>Built for Real Decisions. <em>Clarified by PropApex.</em></h2>
            <p>Explore recognizable funding brands through one consistent comparison framework.</p>
          </div>
          <div className="logo-marquee" aria-label="Featured prop firms">
            <div className="logo-marquee-track">
              {[...firms.slice(0, 10), ...firms.slice(0, 10)].map((firm, index) => (
                <a href={`#firm-${firm.id}`} className="marquee-firm" key={`${firm.id}-${index}`} aria-hidden={index >= 10} tabIndex={index >= 10 ? -1 : 0}>
                  <FirmLogo firm={firm} /><span>{firm.name}</span>{firm.verified && <BadgeCheck size={14} />}
                </a>
              ))}
            </div>
          </div>
          <div className="container trust-principles">
            <div><SearchCheck size={20} /><span><strong>Real rule comparisons</strong><small>Drawdown, leverage and account models</small></span></div>
            <div><CircleDollarSign size={20} /><span><strong>Payout context</strong><small>Look beyond the headline profit split</small></span></div>
            <div><BadgePercent size={20} /><span><strong>Offers in perspective</strong><small>Discounts never replace due diligence</small></span></div>
          </div>
        </section>

        <FirmDirectory onActivateCashback={openPurchase} onWriteReview={openReview} />

        <CashbackCenter onActivate={openPurchase} />

        <Marketplace onRequireAuth={() => openAuth("signup")} onNotice={setGlobalNotice} />

        <TraderToolkit />

        <section className="why-section" id="about">
          <div className="why-glow" />
          <div className="container">
            <div className="section-heading why-heading">
              <div><p className="eyebrow"><span /> WHY TRADERS CHOOSE US</p><h2><em>PropApex TRADING</em> vs<br />Doing It Yourself</h2></div>
              <p>Stop wasting hours searching for the right prop firm. Find, compare and validate your next challenge from one focused workspace.</p>
            </div>
            <div className="comparison-cards">
              <div className="manual-card">
                <div className="comparison-card-head"><span className="comparison-symbol"><Clock3 size={23} /></span><div><h3>Manual Research</h3><p>The old way</p></div><span className="outdated-badge">OUTDATED</span></div>
                <div className="manual-list">
                  {[
                    ["Firm Comparison", "Visit multiple sites manually", "No comparison tools"],
                    ["Discounts", "Miss offer context and eligibility", "Coupon-only decisions"],
                    ["Reviews", "Conflicting or biased information", "Unstructured data"],
                    ["Rule Checking", "Drawdown details buried in documents", "Easy to overlook"],
                    ["Time Waste", "Repeat the same research for every firm", "Hours fragmented"],
                  ].map(([title, description, tag]) => <div key={title}><span className="x-icon"><X size={15} /></span><span><strong>{title}</strong><small>{description}</small></span><em>{tag}</em></div>)}
                </div>
                <div className="manual-footer"><span><X size={13} /> Scattered research</span><span><X size={13} /> Hard to compare</span><span><X size={13} /> No clear next step</span></div>
              </div>

              <TiltCard className="apex-way-card">
                <div className="card-spotlight" />
                <div className="apex-card-watermark"><LogoMark /></div>
                <div className="comparison-card-head"><span className="comparison-symbol"><Zap size={23} /></span><div><h3>PropApex TRADING</h3><p>The smart way</p></div><span className="recommended-badge"><Sparkles size={12} /> RECOMMENDED</span></div>
                <div className="apex-benefit-list">
                  {[
                    [GitCompareArrows, "Smart Firm Comparison", "Compare account rules and value in one view", `${firms.length} firms covered`],
                    [BadgePercent, "Offer Context", "See codes alongside eligibility reminders", "Rule fit first"],
                    [SearchCheck, "Structured Research", "Consistent metrics across every listing", "Official links"],
                    [ShieldCheck, "Risk-Aware Discovery", "Drawdown and payout context stay visible", "Informed choice"],
                    [Zap, "Faster Shortlisting", "Filter by market, platform and country", "Compare up to 3"],
                  ].map(([Icon, title, description, tag]) => {
                    const BenefitIcon = Icon as typeof Zap;
                    return <div key={title as string}><span className="check-icon"><Check size={15} /></span><span className="benefit-icon"><BenefitIcon size={18} /></span><span><strong>{title as string}</strong><small>{description as string}</small></span><em>{tag as string}</em></div>;
                  })}
                </div>
                <div className="apex-card-footer"><div><Check size={14} /> Instant comparison</div><div><Check size={14} /> Actionable detail views</div><div><Check size={14} /> No dead-end research</div></div>
              </TiltCard>
            </div>

            <div className="methodology" id="methodology">
              <div className="methodology-title"><BookOpenCheck size={23} /><span><strong>A clearer decision, in three passes</strong><small>A practical workflow for every challenge you consider.</small></span></div>
              <div className="methodology-steps">
                <div><span>01</span><p><strong>Shortlist</strong><small>Filter for your market and platform.</small></p></div>
                <ArrowRight size={17} />
                <div><span>02</span><p><strong>Validate</strong><small>Compare drawdown, payout and rules.</small></p></div>
                <ArrowRight size={17} />
                <div><span>03</span><p><strong>Decide</strong><small>Reconfirm terms at the official source.</small></p></div>
              </div>
            </div>
          </div>
        </section>

        <ReviewCenter onWriteReview={openReview} />

        <section className="decision-cta">
          <div className="container decision-cta-inner">
            <div className="cta-emblem"><LogoMark /><span /></div>
            <div><p className="eyebrow">YOUR NEXT MOVE</p><h2>Want to make sure you’re choosing<br />the right prop firm?</h2><p>Build a shortlist, compare the details, then verify at source.</p></div>
            <div className="cta-actions"><a href="#top-prop-firms-section" className="button button-lime button-large">Compare prop firms <GitCompareArrows size={18} /></a><a href="#reviews" className="button button-ghost button-large">Explore top names <ArrowUpRight size={17} /></a></div>
          </div>
        </section>

        <FAQSection />
      </main>}

      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => { setAuthOpen(false); setPendingAction(null); }} onSuccess={authSuccess} />
      <PurchaseModal open={purchaseOpen} initialFirm={purchaseFirm} onClose={() => setPurchaseOpen(false)} onNotice={setGlobalNotice} />
      <ReviewModal open={reviewOpen} initialFirm={reviewFirm} onClose={() => setReviewOpen(false)} onNotice={setGlobalNotice} />
      <div className={`global-toast ${globalNotice ? "is-visible" : ""}`} role="status"><Check size={16} />{globalNotice}</div>
      {!isAdmin && <SupportAgent onOpenAuth={() => openAuth("signup")} onTrackPurchase={() => openPurchase(null)} onWriteReview={() => openReview(null)} />}

      {!isAdmin && <footer className="site-footer">
        <div className="container footer-top">
          <div className="footer-brand"><a href="#home"><Logo /></a><p>Independent prop-firm discovery for traders who prefer clear rules, structured comparisons and informed decisions.</p><a className="footer-email" href={`mailto:${platformSettings.supportEmail}`}><Mail size={15} /> {platformSettings.supportEmail}</a><SocialLinks className="footer-social" /></div>
          <div className="footer-links"><div><h3>Discover</h3><a href="#top-prop-firms-section">Prop firms</a><a href="#cashback">Cashback rewards</a><a href="#marketplace">Marketplace</a><a href="#tools">Trader toolkit</a><a href="#community-reviews">Trader reviews</a><a href="#dashboard">My dashboard</a></div><div><h3>Learn</h3><a href="#about">Why PropApex</a><a href="#methodology">Our methodology</a><a href="#faq-section">All FAQs</a><a href={`mailto:${platformSettings.supportEmail}?subject=PropApex%20Trading%20support`}>Contact support</a><button className="footer-link-button" onClick={() => window.dispatchEvent(new CustomEvent("apex:open-support"))}>Ask PropApex Assist</button></div><div><h3>Markets</h3><a href="#top-prop-firms-section" onClick={() => { localStorage.setItem("apex_preferred_market", "Forex"); window.dispatchEvent(new CustomEvent("apex:filter-market", { detail: "Forex" })); }}>Forex firms</a><a href="#top-prop-firms-section" onClick={() => { localStorage.setItem("apex_preferred_market", "Futures"); window.dispatchEvent(new CustomEvent("apex:filter-market", { detail: "Futures" })); }}>Futures firms</a><a href="#offers">Account offers</a><a href="#methodology">Risk checklist</a></div></div>
        </div>
        <div className="container risk-disclosure"><ShieldCheck size={18} /><p><strong>Risk disclosure:</strong> PropApex TRADING is a comparison platform, not a broker or financial adviser. Trading leveraged products and participating in prop-firm evaluations involves risk. Metrics and promotions can change; always verify current terms with the provider.</p></div>
        <div className="container footer-bottom"><p>© {new Date().getFullYear()} PropApex TRADING. All rights reserved.</p><p>Built for clarity. Designed for better decisions.</p><span className="footer-bottom-links">{user?.role === "admin" && <a href="#admin">Admin console</a>}<a href="#home">Back to top <ArrowUpRight size={14} /></a></span></div>
      </footer>}
    </div>
  );
}
