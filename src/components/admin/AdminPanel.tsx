import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, Archive, ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ChevronRight, CircleDollarSign, Coins, Download, Eye, EyeOff, FileClock, Gift, LayoutDashboard, LockKeyhole, LogOut, Menu, MessageSquareText, Plus, ReceiptText, Search, Settings, ShieldCheck, Star, Trash2, Upload, UserRound, Users, WalletCards, X, type LucideIcon } from "lucide-react";
import { useAccount, type PlatformSettings, type PurchaseStatus, type RedemptionStatus } from "../../context/AccountContext";
import { getCashbackRate, type Firm } from "../../data/firms";
import { api } from "../../lib/api";
import Logo, { LogoMark } from "../Logo";
import FirmLogo from "../FirmLogo";
import Modal from "../Modal";
import FirmEditor from "./FirmEditor";
import ImagePicker from "./ImagePicker";
import SocialSettings from "./SocialSettings";
import PayoutOperations from "./PayoutOperations";
import LaunchReadiness from "./LaunchReadiness";
import AttributionPanel from "./AttributionPanel";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
type Tab = "overview" | "orders" | "attribution" | "payouts" | "members" | "firms" | "reviews" | "rewards" | "settings" | "launch" | "audit";
const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "orders", label: "Purchases", icon: ReceiptText },
  { id: "attribution", label: "Attribution", icon: Activity }, { id: "payouts", label: "Payout requests", icon: WalletCards },
  { id: "members", label: "Members", icon: Users }, { id: "firms", label: "Prop firms", icon: Building2 },
  { id: "reviews", label: "Reviews", icon: MessageSquareText }, { id: "rewards", label: "Redemptions", icon: Gift },
  { id: "settings", label: "Settings & data", icon: Settings }, { id: "launch", label: "Launch checklist", icon: ShieldCheck }, { id: "audit", label: "Audit log", icon: FileClock },
];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv(name: string, rows: Record<string, string | number | boolean | undefined>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const raw = String(value ?? "");
    const safe = typeof value === "string" && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  download(name, [keys.map(escape).join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n"), "text/csv;charset=utf-8");
}
function Status({ value }: { value: string }) { return <span className={`admin-status status-${value}`}>{value}</span>; }

function AdminGate() {
  const { user, loading: checking, logInAdmin, logOut, connection, refresh } = useAccount();
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    setLoading(true);
    try { const result = await logInAdmin(email, passcode); if (!result.ok) setError(result.message); }
    finally { setLoading(false); setPasscode(""); }
  };
  if (checking) return <main className="admin-access-message"><ShieldCheck size={30} /><h1>Checking access</h1><p>Verifying your server session...</p></main>;
  if (user && user.role !== "admin") return <main className="admin-access-message"><LockKeyhole size={30} /><h1>This page is restricted</h1><p>Your member account cannot access administration. No management data has been loaded.</p><a className="button button-lime" href="#dashboard">Return to my dashboard <ArrowRight size={16} /></a><button className="text-button" onClick={async () => { const result = await logOut(); if (!result.ok) setError(result.message); }}>Sign out</button>{error && <p role="alert">{error}</p>}</main>;
  return <main className="admin-gate"><div className="admin-gate-visual"><a href="#home"><Logo /></a><div><span className="admin-gate-mark"><LogoMark /></span><p>APEX OPERATIONS</p><h1>One console for<br />every trading reward.</h1><p>Verify purchases, moderate the community, manage firms and fulfil member rewards.</p></div><small>Server-authenticated access · Persistent database</small></div>
    <div className="admin-gate-form-wrap"><form onSubmit={submit} className="admin-gate-form"><span className="admin-lock"><LockKeyhole size={23} /></span><p className="eyebrow">AUTHORISED STAFF ONLY</p><h2>Administrator sign in</h2><p>Use an administrator account provisioned by the website owner. Member registrations do not grant access.</p>
      <label><span>Administrator email</span><div><UserRound size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></div></label>
      <label><span>Password</span><div><LockKeyhole size={16} /><input type={show ? "text" : "password"} value={passcode} onChange={(e) => setPasscode(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShow((value) => !value)} aria-label="Toggle password visibility">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
      {connection === "offline" && <div className="form-error">The server is unavailable. <button type="button" onClick={() => void refresh()}>Retry connection</button></div>}
      {error && <div className="form-error" role="alert">{error}</div>}<button className="button button-lime" disabled={loading || connection !== "connected"}>{loading ? "Verifying..." : "Sign in securely"}<ArrowRight size={16} /></button>
      <div className="admin-local-note"><ShieldCheck size={15} /><p>Permissions are verified by the server on every management request. There is no browser-based admin setup.</p></div><a href="#home" className="admin-back-link"><ArrowLeft size={14} /> Return to website</a>
    </form></div></main>;
}

export default function AdminPanel() {
  const account = useAccount();
  const { members, firms, allPurchases, reviews, allRedemptions, auditLog, platformSettings, allPayouts, conversions } = account;
  const profile = account.user?.role === "admin" ? account.user : null;
  const [tab, setTab] = useState<Tab>(() => { const value = window.location.hash.split("/")[1] as Tab; return tabs.some((item) => item.id === value) ? value : "overview"; });
  const [sidebarOpen, setSidebarOpen] = useState(false); const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState("");
  const [reviewStatus, setReviewStatus] = useState<PurchaseStatus>("pending"); const [adminNote, setAdminNote] = useState("");
  const [editingFirm, setEditingFirm] = useState<Firm | null | undefined>(undefined);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(platformSettings); const [notice, setNotice] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const previousReceiptCount = useRef<number | null>(null);
  useEffect(() => {
    if (!profile) { previousReceiptCount.current = null; return; }
    if (previousReceiptCount.current !== null && conversions.length > previousReceiptCount.current) setNotice("New partner activity received. Open Attribution to review the receipt.");
    previousReceiptCount.current = conversions.length;
  }, [conversions.length, profile?.id]);
  const changeSettings = (patch: Partial<PlatformSettings>) => { setSettingsDirty(true); setSettingsDraft((current) => ({ ...current, ...patch })); };
  useEffect(() => { if (!settingsDirty) setSettingsDraft(platformSettings); }, [platformSettings, settingsDirty]);

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3000); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { setQuery(""); window.history.replaceState(null, "", `#admin/${tab}`); setSidebarOpen(false); }, [tab]);
  useEffect(() => {
    if (!purchaseId) return;
    const purchase = allPurchases.find((item) => item.id === purchaseId);
    if (purchase) { setReviewStatus(purchase.status); setAdminNote(purchase.adminNote ?? ""); setVerifiedAmount(purchase.amount.toFixed(2)); }
  }, [purchaseId, allPurchases]);

  const actor = profile?.email ?? "admin";
  const memberById = (id: string) => members.find((member) => member.id === id);
  const firmById = (id: string) => firms.find((firm) => firm.id === id);
  const normalized = query.toLowerCase().trim();
  const filteredPurchases = allPurchases.filter((purchase) => (statusFilter === "all" || purchase.status === statusFilter) && (!normalized || [purchase.orderId, memberById(purchase.userId)?.name, memberById(purchase.userId)?.email, firmById(purchase.firmId)?.name].join(" ").toLowerCase().includes(normalized)));
  const filteredMembers = members.filter((member) => (statusFilter === "all" || (statusFilter === "suspended" ? member.suspended : !member.suspended)) && (!normalized || [member.id, member.name, member.email, member.referralCode].join(" ").toLowerCase().includes(normalized)));
  const filteredFirms = firms.filter((firm) => (statusFilter === "all" || (firm.status ?? "active") === statusFilter) && (!normalized || [firm.name, firm.country, firm.market].join(" ").toLowerCase().includes(normalized)));
  const filteredReviews = reviews.filter((review) => (statusFilter === "all" || (review.status ?? "published") === statusFilter) && (!normalized || [review.title, review.userName, firmById(review.firmId)?.name].join(" ").toLowerCase().includes(normalized)));
  const filteredRedemptions = allRedemptions.filter((item) => (statusFilter === "all" || item.status === statusFilter) && (!normalized || [item.itemName, memberById(item.userId)?.name, memberById(item.userId)?.email].join(" ").toLowerCase().includes(normalized)));

  const metrics = useMemo(() => {
    const volume = allPurchases.filter((item) => item.status !== "rejected").reduce((sum, item) => sum + item.amount, 0);
    const pending = allPurchases.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.cashbackAmount, 0);
    const approvedTotal = allPurchases.filter((item) => item.status === "approved" && item.verification !== "refunded" && !item.amountMismatch).reduce((sum, item) => sum + item.cashbackAmount, 0);
    const committed = allPayouts.filter((item) => ["requested", "processing", "paid"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    const approved = Math.max(0, approvedTotal - committed);
    const credits = allPurchases.filter((item) => item.status === "approved" || item.status === "paid").reduce((sum, item) => sum + (item.creditsEarned ?? Math.floor(item.amount * platformSettings.creditRate)), 0);
    return { volume, pending, approved, credits };
  }, [allPurchases, allPayouts, platformSettings.creditRate]);
  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const value = allPurchases.filter((item) => { const created = new Date(item.createdAt); return created.getMonth() === month.getMonth() && created.getFullYear() === month.getFullYear(); }).reduce((sum, item) => sum + item.amount, 0);
      return { label: month.toLocaleDateString("en-US", { month: "short" }), value };
    });
  }, [allPurchases]);
  const maxMonth = Math.max(...monthly.map((item) => item.value), 1);

  if (!profile || account.loading) return <AdminGate />;
  const openTab = (next: Tab) => { setStatusFilter("all"); setTab(next); };
  const openQueue = (next: Tab, filter: string) => { setStatusFilter(filter); setTab(next); };
  const savePurchase = async () => { if (!purchaseId) return; const result = await account.adminUpdatePurchase(purchaseId, reviewStatus, adminNote, actor, Number(verifiedAmount)); setNotice(result.message); if (result.ok) setPurchaseId(null); };
  const saveSettings = async (event: FormEvent) => { event.preventDefault(); setSavingSettings(true); const result = await account.updatePlatformSettings({ ...settingsDraft, contact: platformSettings.contact }, actor); setSavingSettings(false); setNotice(result.message); if (result.ok) { setSettingsDirty(false); localStorage.removeItem("apex_logo_draft_site"); } };
  const backup = async () => {
    try { const payload = await api<unknown>("/admin/export"); download(`apex-report-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json"); setNotice("Database report downloaded. Authentication secrets are excluded."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Export failed."); }
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      const result = await api<{ message: string }>("/admin/firms/import", "POST", { firms: data.firms });
      await account.refresh(); setNotice(result.message);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Choose a valid firm catalog JSON file."); }
  };
  const selectedPurchase = allPurchases.find((item) => item.id === purchaseId);
  const title = tabs.find((item) => item.id === tab)?.label ?? "Overview";

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="admin-sidebar-brand"><LogoMark /><div><strong>APEX OPS</strong><span>ADMIN CONSOLE</span></div><button onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <div className="admin-env"><span /> SERVER CONNECTED</div>
      <nav>{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => openTab(id)}><Icon size={17} /><span>{label}</span>{id === "orders" && allPurchases.filter((item) => item.status === "pending").length > 0 && <small>{allPurchases.filter((item) => item.status === "pending").length}</small>}{id === "rewards" && allRedemptions.filter((item) => item.status === "requested").length > 0 && <small>{allRedemptions.filter((item) => item.status === "requested").length}</small>}{id === "payouts" && allPayouts.some((item) => item.status === "requested") && <small>{allPayouts.filter((item) => item.status === "requested").length}</small>}{id === "attribution" && conversions.some((item) => item.match === "unmatched") && <small>{conversions.filter((item) => item.match === "unmatched").length}</small>}<ChevronRight size={13} /></button>)}</nav>
      <div className="admin-sidebar-bottom"><a href="#home"><ArrowLeft size={15} /> View website</a><button onClick={async () => { const result = await account.logOut(); if (!result.ok) setNotice(result.message); }}><LogOut size={15} /> Sign out securely</button><div><span>{profile.name.slice(0, 2).toUpperCase()}</span><p><strong>{profile.name}</strong><small>{profile.email}</small></p></div></div>
    </aside>
    {sidebarOpen && <button className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

    <main className="admin-main">
      <header className="admin-topbar"><button className="admin-menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div><p>APEX OPERATIONS / {title.toUpperCase()}</p><h1>{title}</h1></div><div className="admin-top-actions"><label className="admin-global-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} /></label><a className="button button-outline button-small" href="#home">Website <ArrowRight size={14} /></a></div></header>
      <div className="admin-content">
        <div className="admin-preview-banner"><ShieldCheck size={16} /><p><strong>Server-protected operations.</strong> Permissions, balances and saved changes are verified by the APEX backend. Member accounts cannot access management data.</p><span>{account.storage?.database === "supabase-postgres" ? "SUPABASE POSTGRES" : "LOCAL DATABASE"}</span></div>

        {tab === "overview" && <>
          <div className="ops-overview-actions"><button onClick={() => openQueue("attribution", "all")}><Activity size={18} /><span><strong>{conversions.filter((item) => item.match === "unmatched").length} unmatched sale receipts</strong><small>Review partner-reported purchases and referral evidence</small></span><ArrowRight size={15} /></button><button onClick={() => openQueue("payouts", "all")}><WalletCards size={18} /><span><strong>{allPayouts.filter((item) => item.status === "requested").length} payout requests awaiting review</strong><small>Verify member requests before recording a transfer</small></span><ArrowRight size={15} /></button></div>
          <div className="admin-kpis">{[
            ["Submitted order volume", money(metrics.volume), `${allPurchases.length} submitted orders`, CircleDollarSign],
            ["Pending verification", money(metrics.pending), `${allPurchases.filter((item) => item.status === "pending").length} orders need review`, ReceiptText],
            ["Approved cashback", money(metrics.approved), "Ready in member balances", WalletCards],
            ["Credits issued", metrics.credits.toLocaleString(), `${allRedemptions.length} redemption requests`, Coins],
          ].map(([label, value, note, Icon]) => { const KpiIcon = Icon as LucideIcon; return <article key={label as string}><span><KpiIcon size={19} /></span><p>{label as string}</p><strong>{value as string}</strong><small>{note as string}</small></article>; })}</div>
          <div className="admin-overview-grid"><section className="admin-card admin-volume-chart"><div className="admin-card-head"><div><span>PERFORMANCE</span><h2>Purchase volume</h2></div><strong>{money(metrics.volume)} <small>total</small></strong></div><div className="admin-bars">{monthly.map((month) => <div key={month.label}><span>{month.value ? money(month.value) : ""}</span><div><i style={{ height: `${Math.max(month.value ? 8 : 2, month.value / maxMonth * 100)}%` }} /></div><small>{month.label}</small></div>)}</div></section>
            <section className="admin-card admin-queue"><div className="admin-card-head"><div><span>WORK QUEUE</span><h2>Needs attention</h2></div></div><button onClick={() => openQueue("orders", "pending")}><span className="queue-icon amber"><ReceiptText size={17} /></span><div><strong>{allPurchases.filter((item) => item.status === "pending").length} purchase verifications</strong><small>Review orders and cashback</small></div><ArrowRight size={15} /></button><button onClick={() => openQueue("reviews", "pending")}><span className="queue-icon violet"><MessageSquareText size={17} /></span><div><strong>{reviews.filter((item) => item.status === "pending").length} reviews awaiting moderation</strong><small>Approve or hide community content</small></div><ArrowRight size={15} /></button><button onClick={() => openQueue("rewards", "requested")}><span className="queue-icon cyan"><Gift size={17} /></span><div><strong>{allRedemptions.filter((item) => item.status === "requested").length} rewards to fulfil</strong><small>Process marketplace requests</small></div><ArrowRight size={15} /></button></section></div>
          <section className="admin-card"><div className="admin-card-head"><div><span>RECENT ACTIVITY</span><h2>Latest purchases</h2></div><button onClick={() => openTab("orders")}>View all <ArrowRight size={14} /></button></div><PurchaseTable purchases={allPurchases.slice(0, 5)} memberById={memberById} firmById={firmById} onOpen={setPurchaseId} /></section>
          <section className="admin-card admin-audit-preview"><div className="admin-card-head"><div><span>SECURITY</span><h2>Recent admin activity</h2></div><button onClick={() => openTab("audit")}>Full audit log <ArrowRight size={14} /></button></div>{auditLog.length ? auditLog.slice(0, 4).map((entry) => <div className="admin-activity" key={entry.id}><Activity size={14} /><div><strong>{entry.action}</strong><p>{entry.target} · {entry.detail}</p></div><small>{date(entry.createdAt)}</small></div>) : <p className="admin-muted">Admin actions will appear here as you work.</p>}</section>
        </>}

        {tab === "orders" && <section className="admin-card"><AdminFilters value={statusFilter} onChange={setStatusFilter} options={["all", "pending", "approved", "paid", "rejected"]} onExport={() => exportCsv("apex-purchases.csv", filteredPurchases.map((item) => ({ order: item.orderId, member: memberById(item.userId)?.email, firm: firmById(item.firmId)?.name, amount: item.amount, cashback: item.cashbackAmount, status: item.status, date: item.purchaseDate })))} /><PurchaseTable purchases={filteredPurchases} memberById={memberById} firmById={firmById} onOpen={setPurchaseId} /></section>}

        {tab === "attribution" && <AttributionPanel query={query} onNotice={setNotice} onReviewPurchase={setPurchaseId} />}
        {tab === "payouts" && <PayoutOperations query={query} onNotice={setNotice} />}

        {tab === "launch" && <LaunchReadiness />}

        {tab === "members" && <section className="admin-card"><div className="admin-section-title"><div><h2>Member directory</h2><p>{members.length} registered accounts · {members.filter((member) => member.suspended).length} suspended</p></div><button className="button button-outline button-small" onClick={() => exportCsv("apex-members.csv", filteredMembers.map((member) => ({ name: member.name, email: member.email, role: member.role, suspended: member.suspended, referral: member.referralCode, joined: member.createdAt })))}><Download size={14} /> Export CSV</button></div><AdminFilters value={statusFilter} onChange={setStatusFilter} options={["all", "active", "suspended"]} /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Joined</th><th>Orders</th><th>Volume</th><th>Role</th><th>Account status</th><th>Access</th></tr></thead><tbody>{filteredMembers.map((member) => { const orders = allPurchases.filter((item) => item.userId === member.id); return <tr key={member.id}><td><div className="admin-member"><span>{member.name.slice(0, 2).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.email}</small><small title={member.id}>ID: {member.id.slice(0, 8)} · {member.referralCode}</small></div></div></td><td>{date(member.createdAt)}</td><td>{orders.length}</td><td>{money(orders.reduce((sum, item) => sum + item.amount, 0))}</td><td><select aria-label={`Role for ${member.name}`} disabled={member.id === profile.id} value={member.role ?? "member"} onChange={async (e) => { const result = await account.adminUpdateUser(member.id, { role: e.target.value as "member" | "admin", suspended: Boolean(member.suspended) }, actor); setNotice(result.message); }}><option value="member">Member</option><option value="admin">Admin</option></select></td><td><Status value={member.suspended ? "suspended" : "active"} /></td><td><button disabled={member.id === profile.id} className={`admin-access ${member.suspended ? "suspended" : ""}`} onClick={async () => { const result = await account.adminUpdateUser(member.id, { role: member.role ?? "member", suspended: !member.suspended }, actor); setNotice(result.message); }}>{member.suspended ? "Unsuspend" : "Suspend"}</button></td></tr>; })}</tbody></table>{!filteredMembers.length && <Empty text="No members match this search." />}</div></section>}

        {tab === "firms" && <section className="admin-card"><AdminFilters value={statusFilter} onChange={setStatusFilter} options={["all", "active", "archived"]} onExport={() => exportCsv("apex-firms.csv", filteredFirms.map((firm) => ({ name: firm.name, market: firm.market, country: firm.country, cashback: getCashbackRate(firm.id), code: firm.code, status: firm.status ?? "active" })))} action={<button className="button button-lime button-small" onClick={() => setEditingFirm(null)}><Plus size={14} /> Add firm</button>} /><div className="admin-firm-grid">{filteredFirms.map((firm) => <article key={firm.id} className={firm.status === "archived" ? "archived" : ""}><div className="admin-firm-top"><FirmLogo firm={firm} large /><div><strong>{firm.name}</strong><small>{firm.market} · {firm.country}</small></div><Status value={firm.status ?? "active"} /></div><div className="admin-firm-metrics"><span><small>Cashback</small><strong>{getCashbackRate(firm.id)}%</strong></span><span><small>Allocation</small><strong>{firm.allocationLabel}</strong></span><span><small>Rating</small><strong>{firm.rating}/5</strong></span></div><div className="admin-firm-code"><span>{firm.code ? `Code ${firm.code}` : "Tracked link only"}</span><strong>{firm.promo}</strong></div><div className="admin-firm-actions"><button onClick={() => setEditingFirm(firm)}><Settings size={14} /> Edit</button><a href={firm.website} target="_blank" rel="noreferrer">Official site <ArrowRight size={13} /></a><button onClick={async () => { const result = await account.archiveFirm(firm.id, firm.status !== "archived", actor); setNotice(result.message); }}>{firm.status === "archived" ? <><BadgeCheck size={14} /> Restore</> : <><Archive size={14} /> Archive</>}</button></div></article>)}</div></section>}

        {tab === "reviews" && <section className="admin-card"><AdminFilters value={statusFilter} onChange={setStatusFilter} options={["all", "published", "pending", "hidden"]} /><div className="admin-review-list">{filteredReviews.map((review) => <article key={review.id}><div className="admin-review-head"><div><strong>{review.userName}</strong><span>{firmById(review.firmId)?.name} · {date(review.createdAt)}</span></div><div className="admin-review-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? "currentColor" : "none"} />)}</div><Status value={review.status ?? "published"} /></div><h3>{review.title}</h3><p>{review.body}</p><div className="admin-review-actions"><button onClick={async () => { const result = await account.adminModerateReview(review.id, "published", actor); setNotice(result.message); }}><Check size={14} /> Approve</button><button onClick={async () => { const result = await account.adminModerateReview(review.id, "hidden", actor); setNotice(result.message); }}><EyeOff size={14} /> Hide</button><button className="danger" onClick={async () => { if (window.confirm("Permanently delete this review?")) { const result = await account.adminDeleteReview(review.id, actor); setNotice(result.message); } }}><Trash2 size={14} /> Delete</button></div></article>)}{!filteredReviews.length && <Empty text="No reviews in this view." />}</div></section>}

        {tab === "rewards" && <section className="admin-card"><AdminFilters value={statusFilter} onChange={setStatusFilter} options={["all", "requested", "fulfilled", "cancelled"]} onExport={() => exportCsv("apex-redemptions.csv", filteredRedemptions.map((item) => ({ reward: item.itemName, member: memberById(item.userId)?.email, credits: item.cost, status: item.status, requested: item.createdAt })))} /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reward</th><th>Member</th><th>Requested</th><th>Credits</th><th>Status</th><th>Fulfilment</th></tr></thead><tbody>{filteredRedemptions.map((item) => <tr key={item.id}><td><strong>{item.itemName}</strong><small className="admin-sub">{item.id}</small></td><td>{memberById(item.userId)?.name ?? "Unknown"}<small className="admin-sub">{memberById(item.userId)?.email}</small></td><td>{date(item.createdAt)}</td><td><strong className="admin-credit">{item.cost.toLocaleString()}</strong></td><td><Status value={item.status} /></td><td><select value={item.status} onChange={async (e) => { const result = await account.adminUpdateRedemption(item.id, e.target.value as RedemptionStatus, actor); setNotice(result.message); }}><option value="requested">Requested</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table>{!filteredRedemptions.length && <Empty text="No reward redemptions in this view." />}</div></section>}

        {tab === "settings" && <div className="admin-settings-grid"><form className="admin-card admin-branding-card" onSubmit={saveSettings}><div className="admin-section-title"><div><h2>Website branding</h2><p>Your logo appears in the website header, footer and account sign-in pages.</p></div></div><ImagePicker label="APEX website logo" value={settingsDraft.siteLogo} onChange={(image) => changeSettings({ siteLogo: image })} draftKey="apex_logo_draft_site" /><div className="admin-form-actions"><button className="button button-lime" type="submit" disabled={savingSettings}><Check size={15} />{savingSettings ? "Uploading..." : "Save website logo"}</button></div></form><form className="admin-card admin-settings-form" onSubmit={saveSettings}><div className="admin-section-title"><div><h2>Rewards & moderation</h2><p>These values immediately affect calculations and member workflows.</p></div></div><label><span>Credits earned per $1 net spend</span><input type="number" min="0" step="0.1" value={settingsDraft.creditRate} onChange={(e) => changeSettings({ creditRate: Number(e.target.value) })} /></label><label><span>Minimum cashback payout (USD)</span><input type="number" min="1" value={settingsDraft.minPayout} onChange={(e) => changeSettings({ minPayout: Number(e.target.value) })} /></label><label><span>Website announcement</span><input value={settingsDraft.announcement} onChange={(e) => changeSettings({ announcement: e.target.value })} /></label><label className="admin-setting-toggle"><input type="checkbox" checked={settingsDraft.cashbackEnabled} onChange={(e) => changeSettings({ cashbackEnabled: e.target.checked })} /><span><strong>Accept cashback submissions</strong><small>Turn off to pause new purchase reports.</small></span></label><label className="admin-setting-toggle"><input type="checkbox" checked={settingsDraft.reviewModeration} onChange={(e) => changeSettings({ reviewModeration: e.target.checked })} /><span><strong>Require review moderation</strong><small>New and edited reviews enter the approval queue.</small></span></label><button className="button button-lime" type="submit" disabled={savingSettings}><Check size={15} /> {savingSettings ? "Saving..." : "Apply settings"}</button></form>
          <SocialSettings onNotice={setNotice} />
          <section className="admin-card admin-data-card"><div className="admin-section-title"><div><h2>Data & portability</h2><p>Export operational data or import validated firm listings.</p></div></div><button onClick={backup}><span><Download size={18} /></span><div><strong>Download database report</strong><small>Members, orders, firms, reviews, settings and audit history</small></div><ArrowRight size={15} /></button><label className="admin-upload"><span><Upload size={18} /></span><div><strong>Import firm catalog</strong><small>Updates firm listings only. Accounts and permissions are never imported.</small></div><input type="file" accept="application/json" onChange={(e) => { if (window.confirm("Import the firm listings from this JSON file?")) restore(e.target.files?.[0]); }} /></label><div className="admin-data-warning"><ShieldCheck size={16} /><p>Reports exclude passwords and session secrets. Keep exports private. Firm imports are validated and cannot change member roles.</p></div></section></div>}

        {tab === "audit" && <section className="admin-card"><div className="admin-section-title"><div><h2>Admin audit trail</h2><p>Last 300 server-recorded administrator actions.</p></div><button className="button button-outline button-small" onClick={() => exportCsv("apex-audit-log.csv", auditLog.map((entry) => ({ actor: entry.actor, action: entry.action, target: entry.target, detail: entry.detail, date: entry.createdAt })))}><Download size={14} /> Export log</button></div><div className="admin-audit-list">{auditLog.map((entry) => <article key={entry.id}><span><Activity size={15} /></span><div><strong>{entry.action}</strong><p>{entry.detail}</p><small>{entry.actor} · {entry.target}</small></div><time>{new Date(entry.createdAt).toLocaleString()}</time></article>)}{!auditLog.length && <Empty text="No admin activity recorded yet." />}</div></section>}
      </div>
    </main>

    <Modal open={Boolean(selectedPurchase)} onClose={() => setPurchaseId(null)} title="Review purchase" eyebrow="CASHBACK VERIFICATION">
      {selectedPurchase && <div className="admin-purchase-detail"><div className="admin-detail-firm"><FirmLogo firm={firmById(selectedPurchase.firmId) ?? firms[0]} large /><div><h3>{firmById(selectedPurchase.firmId)?.name ?? "Unknown firm"}</h3><p>Order #{selectedPurchase.orderId}</p></div><Status value={selectedPurchase.status} /></div><dl><div><dt>Member</dt><dd>{memberById(selectedPurchase.userId)?.name}<small>{memberById(selectedPurchase.userId)?.email}</small></dd></div><div><dt>Net spend</dt><dd>{money(selectedPurchase.amount)}</dd></div><div><dt>Cashback</dt><dd>{money(selectedPurchase.cashbackAmount)} at {selectedPurchase.cashbackRate}%</dd></div><div><dt>Purchase date</dt><dd>{date(selectedPurchase.purchaseDate)}</dd></div><div><dt>Code used</dt><dd>{selectedPurchase.codeUsed || "None listed"}</dd></div><div><dt>Member notes</dt><dd>{selectedPurchase.notes || "No notes"}</dd></div></dl><div className="purchase-evidence-note"><ShieldCheck size={16} /><p><strong>{selectedPurchase.verification === "partner_confirmed" ? "Signed partner receipt received" : selectedPurchase.verification === "report_matched" ? "Matched to a manual partner report" : selectedPurchase.verification === "refunded" ? "Partner reported a refund" : "Member-submitted order: no partner receipt yet"}</strong>{selectedPurchase.amountMismatch ? ` Partner amount ${money(selectedPurchase.partnerAmount ?? 0)} differs from the recorded amount. Correct it before approval.` : " Verify the order in the actual affiliate report before approving cashback."}</p></div><label className="admin-note-field"><span>Verified net purchase amount (USD)</span><input type="number" min="0.01" step="0.01" value={verifiedAmount} onChange={(event) => setVerifiedAmount(event.target.value)} /></label><label className="admin-note-field"><span>Verification status</span><select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as PurchaseStatus)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></label><label className="admin-note-field"><span>Internal review note</span><textarea rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Attribution evidence, invoice checks, or rejection reason…" /></label><div className="admin-form-actions"><button className="button button-outline" onClick={() => setPurchaseId(null)}>Cancel</button><button className="button button-lime" onClick={savePurchase}><Check size={15} /> Save verification</button></div></div>}
    </Modal>
    <FirmEditor firm={editingFirm} onClose={() => setEditingFirm(undefined)} onSave={async (firm) => { const result = await account.saveFirm(firm, actor); setNotice(result.message); if (result.ok) { localStorage.removeItem(`apex_logo_draft_firm_${editingFirm?.id ?? "new"}`); setEditingFirm(undefined); } }} />
    <div className={`admin-toast ${notice ? "show" : ""}`}><Check size={15} />{notice}</div>
  </div>;
}

function AdminFilters({ value, onChange, options, onExport, action }: { value: string; onChange: (value: string) => void; options: string[]; onExport?: () => void; action?: React.ReactNode }) {
  return <div className="admin-filters"><div>{options.map((option) => <button className={value === option ? "active" : ""} key={option} onClick={() => onChange(option)}>{option}</button>)}</div><span>{onExport && <button onClick={onExport}><Download size={14} /> Export CSV</button>}{action}</span></div>;
}
function Empty({ text }: { text: string }) { return <div className="admin-empty"><Search size={23} /><p>{text}</p></div>; }
function PurchaseTable({ purchases, memberById, firmById, onOpen }: { purchases: ReturnType<typeof useAccount>["allPurchases"]; memberById: (id: string) => ReturnType<typeof useAccount>["members"][number] | undefined; firmById: (id: string) => Firm | undefined; onOpen: (id: string) => void }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order / firm</th><th>Member</th><th>Submitted</th><th>Net spend</th><th>Cashback</th><th>Status</th><th /></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td><strong>#{purchase.orderId}</strong><small className="admin-sub">{firmById(purchase.firmId)?.name ?? purchase.firmId}</small></td><td>{memberById(purchase.userId)?.name ?? "Unknown"}<small className="admin-sub">{memberById(purchase.userId)?.email}</small></td><td>{date(purchase.createdAt)}</td><td>{money(purchase.amount)}</td><td><strong className="admin-credit">{money(purchase.cashbackAmount)}</strong></td><td><Status value={purchase.status} /></td><td><button className="admin-review-btn" onClick={() => onOpen(purchase.id)}>Review <ChevronRight size={13} /></button></td></tr>)}</tbody></table>{!purchases.length && <Empty text="No purchases in this view." />}</div>;
}
