import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, BadgePercent, Bell, Check, ChevronRight, CircleDollarSign, Clock3, Coins, Copy, ExternalLink, Gift, LayoutDashboard, LogOut, MessageSquareText, PenLine, Plus, ReceiptText, Settings, ShieldCheck, Star, Trash2, UserRound, WalletCards } from "lucide-react";
import { getCashbackRate, type Firm } from "../data/firms";
import CashbackPanel from "./CashbackPanel";
import { useAccount, type PurchaseStatus } from "../context/AccountContext";
import FirmLogo from "./FirmLogo";
import { copyText } from "../utils/copyText";
import { LogoMark } from "./Logo";

type Tab = "overview" | "purchases" | "cashback" | "credits" | "reviews" | "settings";
type Props = {
  onAddPurchase: (firm: Firm | null) => void;
  onWriteReview: (firm: Firm | null) => void;
  onRequireAuth: () => void;
  onNotice: (message: string) => void;
};

const statusCopy: Record<PurchaseStatus, string> = { pending: "Verification pending", approved: "Approved", paid: "Paid", rejected: "Not eligible" };
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export default function Dashboard({ onAddPurchase, onWriteReview, onRequireAuth, onNotice }: Props) {
  const { user, firms, purchases, reviews, logOut, updateProfile, deleteReview, credits, redemptions, cancelRedemption, platformSettings, cashback } = useAccount();
  const [tab, setTab] = useState<Tab>("overview");
  const [name, setName] = useState(user?.name ?? "");
  const [profileMessage, setProfileMessage] = useState("");
  const userReviews = reviews.filter((review) => review.userId === user?.id);
  const pending = cashback.pending;
  const available = cashback.available;
  const maxCashback = Math.max(0, ...firms.filter((firm) => firm.status !== "archived").map((firm) => getCashbackRate(firm.id)));
  const total = cashback.total;

  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const value = purchases.filter((purchase) => {
        const created = new Date(purchase.createdAt);
        return created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear();
      }).reduce((sum, purchase) => sum + purchase.cashbackAmount, 0);
      return { label: date.toLocaleDateString("en-US", { month: "short" }), value };
    });
  }, [purchases]);
  const maxMonthly = Math.max(...monthlyData.map((month) => month.value), 1);

  if (!user) {
    return <section className="dashboard-locked"><div className="dashboard-locked-card"><span><ShieldCheck size={32} /></span><p className="eyebrow">YOUR APEX WORKSPACE</p><h1>Log in to open your dashboard.</h1><p>Add purchases, pending cashback, referral activity and your trader reviews in one private workspace.</p><button className="button button-lime button-large" onClick={onRequireAuth}>Log in or create an account <ArrowRight size={17} /></button><a href="#home">Return to the directory</a></div></section>;
  }

  const initials = user.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  const referralLink = `${window.location.origin}${window.location.pathname}#join-${user.referralCode}`;
  const copyReferral = async () => onNotice(await copyText(referralLink) ? "Your referral link has been copied." : "Could not copy the referral link.");
  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "purchases", label: "Purchases", icon: ReceiptText, count: purchases.length },
    { id: "cashback", label: "Cashback", icon: WalletCards },
    { id: "credits", label: "APEX Credits", icon: Coins, count: redemptions.length },
    { id: "reviews", label: "My reviews", icon: MessageSquareText, count: userReviews.length },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    const result = await updateProfile(name);
    setProfileMessage(result.message);
    if (result.ok) onNotice(result.message);
  };

  const purchaseTable = (items = purchases) => items.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Firm / Order</th><th>Purchase date</th><th>Net spend</th><th>Cashback</th><th>Status</th></tr></thead><tbody>{items.map((purchase) => {
    const firm = firms.find((item) => item.id === purchase.firmId);
    if (!firm) return null;
    const refunded = purchase.verification === "refunded";
    const statusLabel = refunded ? "Refund reported" : purchase.amountMismatch ? "Amount needs review" : statusCopy[purchase.status];
    return <tr key={purchase.id}><td><div className="dashboard-firm"><FirmLogo firm={firm} /><span><strong>{firm.name}</strong><small>#{purchase.orderId}</small></span></div></td><td>{new Date(purchase.purchaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td>{money(purchase.amount)}</td><td><strong className="dashboard-reward">+{money(purchase.cashbackAmount)}</strong><small>{purchase.cashbackRate}%</small></td><td><span className={`purchase-status status-${refunded ? "rejected" : purchase.status}`}>{purchase.status === "pending" ? <Clock3 size={12} /> : <Check size={12} />}{statusLabel}</span></td></tr>;
  })}</tbody></table></div> : <div className="dashboard-empty"><span><ReceiptText size={26} /></span><h3>No purchases yet</h3><p>Activate a cashback offer and submit your first order to see it here.</p><button className="button button-lime" onClick={() => onAddPurchase(null)}><Plus size={16} /> Add a purchase</button></div>;

  return (
    <section className="dashboard-page">
      <div className="container dashboard-layout">
        <aside className="dashboard-sidebar">
          <div className="dashboard-user"><span>{initials}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
          <nav aria-label="Dashboard navigation">{tabs.map(({ id, label, icon: Icon, count }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span>{count !== undefined && <small>{count}</small>}<ChevronRight size={14} /></button>)}</nav>
          <div className="sidebar-reward-card"><LogoMark /><strong>Rewards, without the guesswork.</strong><p>Pending rewards move only after purchase verification.</p><button onClick={() => setTab("cashback")}>How cashback works <ArrowUpRight size={13} /></button></div>
          <button className="dashboard-logout" onClick={async () => { const result = await logOut(); onNotice(result.message); }}><LogOut size={16} /> Log out</button>
        </aside>

        <div className="dashboard-main">
          <div className="dashboard-topbar"><div><p className="eyebrow">APEX MEMBER DASHBOARD</p><h1>{tab === "overview" ? `Good to see you, ${user.name.split(" ")[0]}.` : tabs.find((item) => item.id === tab)?.label}</h1><p>{tab === "overview" ? "Here’s the latest state of your purchases and rewards." : "Manage your APEX activity from this workspace."}</p></div><div className="dashboard-top-actions"><button className="dashboard-notification" onClick={() => onNotice(purchases.some((purchase) => purchase.status === "pending") ? `${purchases.filter((purchase) => purchase.status === "pending").length} purchase(s) awaiting verification.` : "You’re all caught up.")} aria-label="View notifications"><Bell size={18} />{purchases.some((purchase) => purchase.status === "pending") && <span />}</button><button className="button button-lime" onClick={() => onAddPurchase(null)}><Plus size={16} /> Add purchase</button></div></div>

          {tab === "overview" && <>
            <div className="dashboard-stat-grid">
              <article className="stat-featured"><span className="stat-icon"><CircleDollarSign size={20} /></span><p>Cashback earned</p><strong>{money(total)}</strong><small>Across {purchases.length} submitted purchase{purchases.length === 1 ? "" : "s"}</small><div className="stat-decoration" /></article>
              <article><span className="stat-icon"><Clock3 size={20} /></span><p>Pending verification</p><strong>{money(pending)}</strong><small>{purchases.filter((purchase) => purchase.status === "pending").length} orders in queue</small></article>
              <article><span className="stat-icon"><WalletCards size={20} /></span><p>Available cashback</p><strong>{money(available)}</strong><small>${platformSettings.minPayout} minimum payout threshold</small></article>
              <article><span className="stat-icon"><Coins size={20} /></span><p>APEX Credits</p><strong>{credits.available.toLocaleString()}</strong><small>{credits.pending.toLocaleString()} pending approval</small></article>
            </div>
            <div className="dashboard-overview-grid">
              <div className="dashboard-chart-card"><div className="dashboard-panel-heading"><div><span>Reward activity</span><h2>Last 6 months</h2></div><strong>{money(total)} <small>tracked</small></strong></div><div className="reward-chart">{monthlyData.map((month) => <div key={month.label}><span className="chart-value">{month.value ? money(month.value) : ""}</span><div className="chart-bar-track"><span style={{ height: `${month.value ? Math.max(8, month.value / maxMonthly * 100) : 2}%` }} className={month.value ? "has-value" : ""} /></div><small>{month.label}</small></div>)}</div>{total === 0 && <p className="chart-empty-note">Your reward chart will grow when you submit eligible purchases.</p>}</div>
              <div className="dashboard-quick-card"><div className="dashboard-panel-heading"><div><span>Quick actions</span><h2>Keep moving</h2></div></div><button onClick={() => onAddPurchase(null)}><span><Plus size={18} /></span><div><strong>Add a purchase</strong><small>Submit an order for verification</small></div><ArrowRight size={15} /></button><button onClick={() => onWriteReview(null)}><span><PenLine size={18} /></span><div><strong>Write a firm review</strong><small>Help another trader decide</small></div><ArrowRight size={15} /></button><button onClick={copyReferral}><span><Copy size={18} /></span><div><strong>Copy referral link</strong><small>{user.referralCode}</small></div><ArrowRight size={15} /></button><a href="#cashback"><span><BadgePercent size={18} /></span><div><strong>Explore cashback rates</strong><small>Earn up to {maxCashback}% on eligible purchases</small></div><ArrowRight size={15} /></a></div>
            </div>
            <div className="dashboard-recent"><div className="dashboard-panel-heading"><div><span>Recent activity</span><h2>Latest purchases</h2></div>{purchases.length > 0 && <button onClick={() => setTab("purchases")}>View all <ArrowRight size={14} /></button>}</div>{purchaseTable(purchases.slice(0, 3))}</div>
          </>}

          {tab === "purchases" && <div className="dashboard-tab-panel"><div className="tab-panel-intro"><div><h2>Purchase verification</h2><p>Every submitted order, its calculated reward and current status.</p></div><button className="button button-outline" onClick={() => onAddPurchase(null)}><Plus size={15} /> Add order</button></div>{purchaseTable()}<div className="dashboard-info-note"><ShieldCheck size={17} /><p>Order details can be checked against the firm’s attribution and invoice data. Never submit card numbers, passwords or full payment documents.</p></div></div>}

          {tab === "cashback" && <div className="dashboard-tab-panel"><CashbackPanel onNotice={onNotice} /></div>}

          {tab === "credits" && <div className="dashboard-tab-panel">
            <div className="credits-hero"><div><p>Spendable APEX Credits</p><strong>{credits.available.toLocaleString()}</strong><span>{credits.pending.toLocaleString()} pending verification · {credits.spent.toLocaleString()} redeemed · {credits.lifetime.toLocaleString()} earned in total</span></div><span className="balance-wallet"><Coins size={30} /></span><a className="button button-lime" href="#marketplace" onClick={() => { window.location.hash = "#marketplace"; }}><Gift size={16} /> Browse the marketplace</a></div>
            <div className="tab-panel-intro" style={{ marginTop: 24 }}><div><h2>Redemption history</h2><p>Requested rewards reserve your credits. Cancel a request to release them.</p></div></div>
            {redemptions.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Reward</th><th>Requested</th><th>Cost</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{redemptions.map((item) => <tr key={item.id}><td><strong style={{ color: "#dce8f7" }}>{item.itemName}</strong></td><td>{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><strong className="dashboard-reward">{item.cost.toLocaleString()}</strong><small>credits</small></td><td><span className={`purchase-status ${item.status === "requested" ? "status-pending" : item.status === "fulfilled" ? "status-paid" : "status-rejected"}`}>{item.status === "requested" ? <Clock3 size={12} /> : <Check size={12} />}{item.status === "requested" ? "Requested" : item.status === "fulfilled" ? "Fulfilled" : "Cancelled"}</span></td><td>{item.status === "requested" && <button className="text-button" onClick={async () => { const result = await cancelRedemption(item.id); onNotice(result.message); }}>Cancel</button>}</td></tr>)}</tbody></table></div> : <div className="dashboard-empty"><span><Gift size={26} /></span><h3>No redemptions yet</h3><p>Earn credits from verified purchases, then redeem them in the marketplace.</p><a className="button button-lime" href="#marketplace">Explore rewards <ArrowRight size={16} /></a></div>}
          </div>}

          {tab === "reviews" && <div className="dashboard-tab-panel"><div className="tab-panel-intro"><div><h2>Your published experiences</h2><p>Edit your perspective as your experience with a firm evolves.</p></div><button className="button button-lime" onClick={() => onWriteReview(null)}><PenLine size={15} /> Write review</button></div>{userReviews.length ? <div className="dashboard-review-list">{userReviews.map((review) => { const firm = firms.find((item) => item.id === review.firmId); if (!firm) return null; return <article key={review.id}><FirmLogo firm={firm} large /><div className="dashboard-review-copy"><div><strong>{firm.name}</strong><span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={12} fill={index < review.rating ? "currentColor" : "none"} />)}</span></div><h3>{review.title}</h3><p>{review.body}</p><small>Published {new Date(review.createdAt).toLocaleDateString()}{review.updatedAt ? " · Updated" : ""}</small></div><div className="dashboard-review-actions"><button onClick={() => onWriteReview(firm)}><PenLine size={14} /> Edit</button><button onClick={async () => { if (window.confirm("Delete this review permanently?")) { const result = await deleteReview(review.id); onNotice(result.message); } }}><Trash2 size={14} /> Delete</button></div></article>; })}</div> : <div className="dashboard-empty"><span><MessageSquareText size={26} /></span><h3>No reviews published yet</h3><p>Share specific details about an account you’ve used.</p><button className="button button-lime" onClick={() => onWriteReview(null)}><PenLine size={16} /> Write your first review</button></div>}</div>}

          {tab === "settings" && <div className="dashboard-tab-panel settings-panel"><form onSubmit={submitProfile} className="profile-settings"><div className="settings-heading"><span><UserRound size={20} /></span><div><h2>Profile details</h2><p>This name appears alongside your published reviews.</p></div></div><label className="form-field"><span>Full name</span><div><input value={name} onChange={(event) => setName(event.target.value)} required /></div></label><label className="form-field"><span>Email address</span><div><input value={user.email} disabled /><small className="field-lock">Login email</small></div></label><div className="member-id"><span>Member ID</span><strong>{user.id}</strong></div>{profileMessage && <p className="profile-message"><Check size={14} />{profileMessage}</p>}<button className="button button-lime" type="submit">Save profile <ArrowRight size={15} /></button></form><div className="referral-settings"><div className="settings-heading"><span><ExternalLink size={20} /></span><div><h2>Your APEX referral identity</h2><p>Included in tracked cashback links you activate.</p></div></div><label><span>Referral code</span><strong>{user.referralCode}</strong></label><div className="referral-link-box"><span>{referralLink}</span><button onClick={copyReferral}><Copy size={16} /> Copy</button></div><p><ShieldCheck size={14} /> Referral parameters help identify eligible clicks; final attribution is verified with the firm.</p></div><div className="account-session"><div><h3>Account session</h3><p>End this server session. Your purchases and reviews are saved to your account.</p></div><button className="button button-outline" onClick={async () => { const result = await logOut(); onNotice(result.message); }}><LogOut size={15} /> Log out</button></div></div>}
        </div>
      </div>
    </section>
  );
}


