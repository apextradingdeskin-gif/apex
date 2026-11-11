import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, Check, Copy, KeyRound, Link2, MousePointerClick, Plus, Radio, ReceiptText, RefreshCw, ShieldCheck, Webhook } from "lucide-react";
import { useAccount, type PartnerSaleInput } from "../../context/AccountContext";
import { api } from "../../lib/api";
import { copyText } from "../../utils/copyText";
import { formatMoney } from "../CashbackPanel";
import Modal from "../Modal";

type Integration = { firmId: string; name: string; affiliateUrl: string; trackingParameter: string; webhookConfigured: boolean; endpoint: string; lastReceivedAt: string | null };
type Props = { query: string; onNotice: (message: string) => void; onReviewPurchase: (id: string) => void };

export default function AttributionPanel({ query, onNotice, onReviewPurchase }: Props) {
  const { firms, members, conversions, allClicks, allPurchases, recordPartnerSale, matchPartnerSale } = useAccount();
  const [view, setView] = useState<"sales" | "clicks" | "setup">("sales");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationFirm, setIntegrationFirm] = useState(firms.find((firm) => firm.status !== "archived")?.id ?? firms[0]?.id ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [report, setReport] = useState({ firmId: integrationFirm, orderId: "", amount: "", buyerEmail: "", couponCode: "", clickId: "", purchasedAt: new Date().toISOString().slice(0, 10) });
  const [reportEventId, setReportEventId] = useState("");
  const [matching, setMatching] = useState<string | null>(null);
  const [memberId, setMemberId] = useState("");
  const loadIntegrations = async () => { try { setIntegrations(await api<Integration[]>("/admin/integrations")); setSetupError(""); } catch (error) { setSetupError(error instanceof Error ? error.message : "Could not load integrations."); } };
  useEffect(() => { void loadIntegrations(); }, [firms]);
  useEffect(() => { setSecret(""); }, [integrationFirm]);
  const current = integrations.find((item) => item.firmId === integrationFirm);
  const matchingReceipt = conversions.find((item) => item.id === matching);
  const filtered = conversions.filter((item) => [item.orderId, item.buyerEmail, item.couponCode, firms.find((firm) => firm.id === item.firmId)?.name, members.find((member) => member.id === item.userId)?.email].join(" ").toLowerCase().includes(query.toLowerCase()));
  const latestOrders = useMemo(() => {
    const orders = new Map<string, (typeof conversions)[number]>();
    for (const item of conversions) { const key = `${item.firmId}:${item.orderId.toLowerCase()}`; if (!orders.has(key) || item.status === "refunded") orders.set(key, item); }
    return [...orders.values()];
  }, [conversions]);
  const completed = latestOrders.filter((item) => item.status === "completed");
  const unmatched = completed.filter((item) => item.match === "unmatched");
  const openReport = () => { setReport({ firmId: integrationFirm, orderId: "", amount: "", buyerEmail: "", couponCode: "", clickId: "", purchasedAt: new Date().toISOString().slice(0, 10) }); setRecordError(""); setReportEventId(`manual-${crypto.randomUUID()}`); setRecording(true); };
  const submitReport = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setRecordError("");
    const input: PartnerSaleInput = { ...report, eventId: reportEventId, amount: Number(report.amount), currency: "USD", status: "completed", purchasedAt: new Date(`${report.purchasedAt}T12:00:00Z`).toISOString(), buyerEmail: report.buyerEmail.trim() || undefined, clickId: report.clickId.trim() || undefined };
    const result = await recordPartnerSale(input); setBusy(false);
    if (!result.ok) { setRecordError(result.message); return; } setRecording(false); onNotice(result.message);
  };
  const matchSale = async (event: FormEvent) => {
    event.preventDefault(); if (!matching || busy) return;
    setBusy(true); const result = await matchPartnerSale(matching, memberId); setBusy(false);
    if (result.ok) setMatching(null); onNotice(result.message);
  };
  const rotateKey = async () => {
    if (!current || busy) return;
    if (current.webhookConfigured && !window.confirm("Replace this signing key? Any partner still using the old key will need the new one.")) return;
    setBusy(true);
    try { const result = await api<{ secret: string; message: string }>(`/admin/integrations/${current.firmId}/rotate`, "POST"); setSecret(result.secret); onNotice(result.message); await loadIntegrations(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Could not create signing key."); }
    finally { setBusy(false); }
  };
  const copy = async (text: string) => onNotice(await copyText(text) ? "Copied to clipboard." : "Could not copy. Select the text and copy it manually.");

  return <>
    <div className="ops-stat-row attribution-stat-row">
      <div><MousePointerClick size={18} /><span>Activated links</span><strong>{allClicks.length}</strong><small>Clicks recorded, not purchases</small></div>
      <div><ReceiptText size={18} /><span>Partner-reported orders</span><strong>{completed.length}</strong><small>{formatMoney(completed.reduce((sum, item) => sum + item.amount, 0))} reported net spend</small></div>
      <div><Link2 size={18} /><span>Need member matching</span><strong>{unmatched.length}</strong><small>Shared coupons do not identify a buyer</small></div>
    </div>
    <section className="admin-card attribution-panel">
      <div className="admin-section-title"><div><h2>Purchase attribution</h2><p>Know the difference between a referral click, a member's claim and evidence received from a partner.</p></div><button className="button button-lime button-small" onClick={openReport}><Plus size={14} /> Record partner sale</button></div>
      <div className="ops-tabs">{[["sales", "Sale receipts"], ["clicks", "Link activations"], ["setup", "Partner setup"]].map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id as typeof view)}>{label}</button>)}</div>

      {view === "sales" && <>
        <div className="attribution-explainer"><ShieldCheck size={18} /><p><strong>A code or click is not purchase proof.</strong> Signed webhooks or your partner's order report provide sale evidence. Matching creates a pending cashback order; the APEX team still reviews eligibility before approval.</p></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order / firm</th><th>Partner amount</th><th>Evidence</th><th>Member</th><th>Matching</th><th /></tr></thead><tbody>{filtered.map((item) => {
          const member = members.find((candidate) => candidate.id === item.userId);
          const mismatch = allPurchases.find((purchase) => purchase.id === item.purchaseId)?.amountMismatch ?? item.amountMismatch;
          return <tr key={item.id}><td><strong>#{item.orderId}</strong><small className="admin-sub">{firms.find((firm) => firm.id === item.firmId)?.name} · {new Date(item.receivedAt).toLocaleDateString()}</small>{item.couponCode && <small className="admin-sub">Code: {item.couponCode}</small>}</td><td><strong className="admin-credit">{formatMoney(item.amount)}</strong><small className="admin-sub">{item.status}</small></td><td><span className={`evidence-badge ${item.source === "webhook" ? "confirmed" : ""}`}>{item.source === "webhook" ? <BadgeCheck size={12} /> : <ReceiptText size={12} />}{item.source === "webhook" ? "Signed webhook" : "Manual partner report"}</span></td><td>{member?.name ?? "Not matched"}<small className="admin-sub">{member?.email ?? item.buyerEmail ?? "No unique member identifier"}</small></td><td><span className={`admin-status ${item.match === "matched" ? "status-approved" : "status-pending"}`}>{item.match}</span>{mismatch && <small className="payout-note">Amount discrepancy</small>}</td><td>{item.purchaseId ? <button className="admin-review-btn" onClick={() => onReviewPurchase(item.purchaseId!)}>Review order <ArrowRight size={13} /></button> : <button className="admin-review-btn" onClick={() => { setMatching(item.id); setMemberId(""); }}>Match member <ArrowRight size={13} /></button>}</td></tr>;
        })}</tbody></table>{!filtered.length && <div className="admin-empty"><Radio size={25} /><p>No partner sale receipts yet.</p><button className="text-button" onClick={() => setView("setup")}>Connect a partner report <ArrowRight size={13} /></button></div>}</div>
      </>}
      {view === "clicks" && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Click reference</th><th>Firm</th><th>Member</th><th>Activated</th><th>Outcome</th></tr></thead><tbody>{allClicks.filter((item) => [item.id, firms.find((firm) => firm.id === item.firmId)?.name, members.find((member) => member.id === item.userId)?.email].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0, 150).map((item) => {
        const sale = conversions.find((receipt) => receipt.clickId === item.id && receipt.status === "completed" && receipt.match === "matched");
        const refunded = sale && (allPurchases.find((purchase) => purchase.id === sale.purchaseId)?.verification === "refunded" || latestOrders.find((order) => order.firmId === sale.firmId && order.orderId.toLowerCase() === sale.orderId.toLowerCase())?.status === "refunded");
        return <tr key={item.id}><td><code className="click-reference">{item.id}</code></td><td>{firms.find((firm) => firm.id === item.firmId)?.name}</td><td>{members.find((member) => member.id === item.userId)?.name}</td><td>{new Date(item.createdAt).toLocaleString()}</td><td><span className={`evidence-badge ${sale && !refunded ? "confirmed" : ""}`}>{sale && !refunded ? <BadgeCheck size={12} /> : <MousePointerClick size={12} />}{refunded ? "Refund reported" : sale ? `Sale reported: ${sale.orderId}` : "Click only"}</span></td></tr>;
      })}</tbody></table>{!allClicks.length && <div className="admin-empty"><MousePointerClick size={25} /><p>Activated links appear here when members visit a firm through APEX.</p></div>}</div>}

      {view === "setup" && <div className="partner-setup">
        <div className="partner-setup-intro"><Webhook size={24} /><div><h3>Connect real partner sale reporting</h3><p>Automatic reporting requires cooperation from the prop firm or its affiliate platform. This is APEX's signed webhook contract, not a universal plug-in for every provider.</p></div></div>
        <label className="form-field"><span>Choose partner firm</span><div><select value={integrationFirm} onChange={(event) => setIntegrationFirm(event.target.value)}>{firms.map((firm) => <option value={firm.id} key={firm.id}>{firm.name}</option>)}</select></div></label>
        {setupError && <div className="form-error">{setupError}</div>}
        {current && <>
          <div className="integration-readiness"><span><i className={current.affiliateUrl ? "ready" : ""} />{current.affiliateUrl ? "Affiliate URL configured" : "Affiliate URL not yet configured"}</span><span><i className={current.webhookConfigured ? "ready" : ""} />{current.webhookConfigured ? "Signing key created" : "Signing key not created"}</span><span><i className={current.lastReceivedAt ? "ready" : ""} />{current.lastReceivedAt ? `Last report: ${new Date(current.lastReceivedAt).toLocaleString()}` : "No signed report received yet"}</span></div>
          <ol className="partner-setup-steps"><li><strong>Use the affiliate link assigned to APEX.</strong><p>Edit this firm in Prop firms. Set its partner-issued affiliate URL, your actual coupon code and the click/sub-ID parameter supported by that provider. A reference code shown on the website does not create a partnership.</p></li><li><strong>Share the endpoint and signing key securely.</strong><p>Your partner or an adapter must send the documented USD order payload, including the click ID, member code or checkout email. Keep the secret off the public website.</p></li><li><strong>Check receipts, then approve eligible rewards.</strong><p>Signed sale receipts appear in this tab. Unmatched orders require member reconciliation. No rewards are approved just because someone clicked.</p></li></ol>
          <div className="webhook-endpoint"><span>Partner POST endpoint</span><code>{window.location.origin}{current.endpoint}</code><button type="button" onClick={() => void copy(`${window.location.origin}${current.endpoint}`)}><Copy size={14} />Copy endpoint</button></div>
          <div className="webhook-key-actions"><button className="button button-outline" onClick={() => void rotateKey()} disabled={busy}><KeyRound size={15} />{busy ? "Creating key..." : current.webhookConfigured ? "Rotate signing key" : "Create signing key"}</button><button className="text-button" onClick={() => void loadIntegrations()}><RefreshCw size={13} /> Refresh status</button></div>
          {secret && <div className="webhook-secret"><strong>Signing key: shown only now</strong><code>{secret}</code><button onClick={() => void copy(secret)}><Copy size={13} /> Copy key</button></div>}
          <details className="webhook-contract"><summary>View the signed request contract</summary><p>Headers: <code>X-Apex-Timestamp</code> (Unix seconds), <code>X-Apex-Signature</code> (hex HMAC-SHA256 of timestamp + "." + the exact raw JSON body). Timestamps expire after five minutes. Repeated event IDs are acknowledged without duplicate credit.</p><pre>{JSON.stringify({ eventId: "partner-event-id", orderId: "partner-order-id", amount: 199, currency: "USD", status: "completed", purchasedAt: "2026-01-01T12:00:00.000Z", clickId: "click-id-received-in-subid", couponCode: "YOUR-PARTNER-CODE" }, null, 2)}</pre><p>Adapt this contract to your provider's documented postback API. No provider credentials or external sales connection have been configured automatically.</p></details>
        </>}
      </div>}
    </section>

    <Modal open={recording} onClose={() => { if (!busy) setRecording(false); }} title="Record a partner-reported sale" eyebrow="MANUAL RECONCILIATION">
      <form onSubmit={submitReport}><div className="attribution-explainer"><ReceiptText size={18} /><p>Use this only after checking an actual affiliate order report. This records manual evidence, not a signed webhook, and does not automatically approve cashback.</p></div><div className="form-grid-two">
        <label className="form-field"><span>Firm</span><div><select value={report.firmId} onChange={(event) => setReport({ ...report, firmId: event.target.value })}>{firms.map((firm) => <option value={firm.id} key={firm.id}>{firm.name}</option>)}</select></div></label>
        <label className="form-field"><span>Order ID from partner</span><div><input value={report.orderId} onChange={(event) => setReport({ ...report, orderId: event.target.value })} maxLength={100} required /></div></label>
        <label className="form-field"><span>Verified net amount (USD)</span><div><input type="number" min="0.01" step="0.01" value={report.amount} onChange={(event) => setReport({ ...report, amount: event.target.value })} required /></div></label>
        <label className="form-field"><span>Purchase date</span><div><input type="date" value={report.purchasedAt} onChange={(event) => setReport({ ...report, purchasedAt: event.target.value })} required /></div></label>
        <label className="form-field"><span>Checkout email (optional)</span><div><input type="email" value={report.buyerEmail} onChange={(event) => setReport({ ...report, buyerEmail: event.target.value })} /></div></label>
        <label className="form-field"><span>Coupon used (optional)</span><div><input value={report.couponCode} onChange={(event) => setReport({ ...report, couponCode: event.target.value })} maxLength={60} /></div></label>
      </div><label className="form-field"><span>Partner click / sub-ID (optional)</span><div><input value={report.clickId} onChange={(event) => setReport({ ...report, clickId: event.target.value })} maxLength={100} /></div></label>{recordError && <div className="form-error" role="alert">{recordError}</div>}<div className="admin-form-actions"><button type="submit" className="button button-lime" disabled={busy}><Check size={15} />{busy ? "Recording..." : "Record verified report"}</button></div></form>
    </Modal>
    <Modal open={Boolean(matchingReceipt)} onClose={() => setMatching(null)} title="Match sale to a member" eyebrow="RECONCILIATION">
      {matchingReceipt && <form onSubmit={matchSale}><p className="attribution-match-copy">Order #{matchingReceipt.orderId} · {formatMoney(matchingReceipt.amount)}. {matchingReceipt.matchReason} Confirm identity using the actual partner order before matching.</p><label className="form-field"><span>Correct member</span><div><select value={memberId} onChange={(event) => setMemberId(event.target.value)} required><option value="">Select member</option>{members.filter((member) => !member.suspended).map((member) => <option value={member.id} key={member.id}>{member.name} · {member.email}</option>)}</select></div></label><div className="admin-form-actions"><button className="button button-lime" type="submit" disabled={busy || !memberId}><Link2 size={15} />{busy ? "Matching..." : "Match sale to member"}</button></div></form>}
    </Modal>
  </>;
}