import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Clock3, CreditCard, Search, ShieldCheck, WalletCards } from "lucide-react";
import { useAccount, type Payout } from "../../context/AccountContext";
import { api } from "../../lib/api";
import { formatMoney } from "../CashbackPanel";
import Modal from "../Modal";
import PayoutMethods from "./PayoutMethods";

export default function PayoutOperations({ query, onNotice }: { query: string; onNotice: (message: string) => void }) {
  const { allPayouts, members, adminUpdatePayout } = useAccount();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"processing" | "paid" | "rejected">("processing");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"requests" | "methods">("requests");
  const [details, setDetails] = useState<Payout | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const selected = allPayouts.find((item) => item.id === selectedId);
  const closed = Boolean(selected && !["requested", "processing"].includes(selected.status));
  const member = members.find((item) => item.id === selected?.userId);
  useEffect(() => { if (selected) { setStatus("processing"); setReference(selected.paymentReference ?? ""); setNote(selected.note ?? ""); setConfirmed(false); setError(""); } }, [selectedId]);
  useEffect(() => {
    let cancelled = false; setDetails(null); if (!selectedId) return;
    setLoadingDetails(true);
    api<Payout>(`/admin/payouts/${encodeURIComponent(selectedId)}/details`).then((result) => { if (!cancelled) setDetails(result); }).catch((issue) => { if (!cancelled) setError(issue instanceof Error ? issue.message : "Could not load private payout details."); }).finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [selectedId]);
  const visible = allPayouts.filter((item) => {
    const owner = members.find((candidate) => candidate.id === item.userId);
    return (filter === "all" || filter === item.status) && [item.id, owner?.name, owner?.email, item.method].join(" ").toLowerCase().includes(query.toLowerCase());
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || saving) return;
    if (status === "paid" && !confirmed) { setError("Confirm you have actually transferred these funds before marking the request paid."); return; }
    setSaving(true); setError("");
    const result = await adminUpdatePayout(selected.id, { status, paymentReference: reference, note });
    setSaving(false); if (!result.ok) { setError(result.message); return; }
    setSelectedId(null); onNotice(result.message);
  };
  return <>
    <div className="ops-tabs payout-desk-tabs"><button className={view === "requests" ? "active" : ""} onClick={() => setView("requests")}>Payout requests</button><button className={view === "methods" ? "active" : ""} onClick={() => setView("methods")}>Payout methods</button></div>
    {view === "methods" ? <PayoutMethods onNotice={onNotice} /> : <>
    <div className="ops-stat-row">{[
      ["Awaiting review", allPayouts.filter((item) => item.status === "requested")],
      ["Processing", allPayouts.filter((item) => item.status === "processing")],
      ["Paid out", allPayouts.filter((item) => item.status === "paid")],
    ].map(([label, entries]) => { const items = entries as typeof allPayouts; return <div key={label as string}><WalletCards size={18} /><span>{label as string}</span><strong>{formatMoney(items.reduce((sum, item) => sum + item.amount, 0))}</strong><small>{items.length} request{items.length === 1 ? "" : "s"}</small></div>; })}</div>
    <section className="admin-card admin-payout-operations">
      <div className="admin-section-title"><div><h2>Payout desk</h2><p>Review requests, transfer money using your payment provider, then save the transaction reference here.</p></div><select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value)}>{["all", "requested", "processing", "paid", "rejected", "cancelled"].map((value) => <option value={value} key={value}>{value === "all" ? "All statuses" : value}</option>)}</select></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Request / member</th><th>Amount</th><th>Method</th><th>Requested</th><th>Status</th><th /></tr></thead><tbody>{visible.map((item) => {
        const owner = members.find((candidate) => candidate.id === item.userId);
        return <tr key={item.id}><td><strong>#{item.id.slice(0, 8).toUpperCase()}</strong><small className="admin-sub">{owner?.name} · {owner?.email}</small></td><td><strong className="admin-credit">{formatMoney(item.amount)}</strong></td><td>{item.method}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td><span className={`purchase-status payout-${item.status}`}>{item.status}</span></td><td><button className="admin-review-btn" onClick={() => setSelectedId(item.id)}>{["requested", "processing"].includes(item.status) ? "Review payout" : "View details"}<ArrowRight size={13} /></button></td></tr>;
      })}</tbody></table>{!visible.length && <div className="admin-empty"><Search size={23} /><p>No payout requests in this view.</p></div>}</div>
      <div className="payout-process-note"><ShieldCheck size={17} /><p>Marking a request paid records an external transfer; it does not initiate a bank or PayPal payment. Paid requests cannot be processed twice.</p></div>
    </section>
    </>}
    <Modal open={Boolean(selected)} onClose={() => { if (!saving) setSelectedId(null); }} title="Review payout request" eyebrow="CASHBACK FULFILMENT">
      {selected && <form className="payout-review-form" onSubmit={submit}>
        <div className="payout-request-summary"><span><CreditCard size={22} /></span><div><small>Requested by {member?.name}</small><strong>{formatMoney(selected.amount)}</strong></div><span className={`purchase-status payout-${selected.status}`}>{selected.status}</span></div>
        <dl className="payout-review-details"><div><dt>Member</dt><dd>{member?.email}</dd></div><div><dt>Payee name</dt><dd>{selected.payeeName}</dd></div><div><dt>Method</dt><dd>{selected.method}</dd></div><div><dt>Destination / contact</dt><dd>{selected.destination}</dd></div></dl>
        {loadingDetails ? <p className="payout-private-loading">Loading protected payment details...</p> : details?.answers && <div className="payout-private-answers"><h3>Submitted payment details</h3><dl>{details.methodSnapshot?.questions.map((question) => <div key={question.id}><dt>{question.label}</dt><dd>{details.answers?.[question.id] || "Not provided"}</dd></div>)}</dl><small>Private access to these details is recorded in the audit log.</small></div>}
        {!closed ? <>
          <label className="form-field"><span>Next status</span><div><select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setConfirmed(false); }}><option value="processing">Processing</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></div></label>
          <label className="form-field"><span>Payment reference {status === "paid" ? "(required)" : "(optional)"}</span><div><input value={reference} onChange={(event) => setReference(event.target.value)} minLength={status === "paid" ? 3 : undefined} required={status === "paid"} placeholder="Transaction ID from your payment provider" maxLength={160} /></div></label>
          <label className="form-field"><span>Member-facing note {status === "rejected" ? "(reason required)" : "(optional)"}</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} minLength={status === "rejected" ? 4 : undefined} required={status === "rejected"} maxLength={1000} /></label>
          {status === "paid" && <label className="form-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><Check size={12} /></span><p>I have already transferred this amount to the member and checked the payment reference.</p></label>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="admin-form-actions"><button type="button" className="button button-outline" onClick={() => setSelectedId(null)}>Cancel</button><button className="button button-lime" type="submit" disabled={saving}><Check size={15} />{saving ? "Saving..." : "Save payout status"}</button></div>
        </> : <div className="payout-closed-details"><Clock3 size={18} /><p><strong>This request is {selected.status}.</strong>{selected.paymentReference && ` Payment reference: ${selected.paymentReference}.`}{selected.note && ` ${selected.note}`}</p></div>}
      </form>}
    </Modal>
  </>;
}