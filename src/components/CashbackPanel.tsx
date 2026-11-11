import { useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleCheck, Clock3, CreditCard, Mail, ShieldCheck, WalletCards, X } from "lucide-react";
import { useAccount, type PayoutMethod } from "../context/AccountContext";
import { mailto } from "../data/contact";
import Modal from "./Modal";

export const formatMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function CashbackPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const { user, cashback, payouts, platformSettings, payoutMethods, requestPayout, cancelPayout } = useAccount();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [methodVersion, setMethodVersion] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [requestKey, setRequestKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const methods = payoutMethods.filter((method) => method.status === "active").sort((a, b) => a.order - b.order);
  const method = methods.find((candidate) => candidate.id === methodId);
  const minimum = Math.max(platformSettings.minPayout, method?.minimum ?? 0);
  const lowestMinimum = methods.length ? Math.min(...methods.map((candidate) => Math.max(platformSettings.minPayout, candidate.minimum))) : platformSettings.minPayout;
  const eligible = methods.length > 0 && methods.some((candidate) => cashback.available >= Math.max(platformSettings.minPayout, candidate.minimum));
  const chooseMethod = (selected: PayoutMethod) => {
    setMethodId(selected.id); setMethodVersion(selected.version); setError("");
    setAnswers(Object.fromEntries(selected.questions.map((item) => [item.id, item.purpose === "payee" ? user?.name ?? "" : ""])));
  };
  const startRequest = () => {
    const first = methods.find((candidate) => cashback.available >= Math.max(platformSettings.minPayout, candidate.minimum));
    if (!first) return; chooseMethod(first); setAmount(cashback.available.toFixed(2));
    setError(""); setConfirmed(false); setRequestKey(crypto.randomUUID()); setOpen(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving || !method) return;
    if (!confirmed) { setError("Confirm the payout details before submitting."); return; }
    setSaving(true); setError("");
    const result = await requestPayout({ amount: Number(amount), methodId, methodVersion, answers, requestKey });
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false); onNotice(result.message);
  };
  return <section className="member-cashback-panel" aria-label="Cashback and payout requests">
    <div className="cashback-balance-card depth-wallet">
      <div><p>Available to withdraw</p><strong data-testid="available-cashback">{formatMoney(cashback.available)}</strong><span>{formatMoney(cashback.pending)} pending verification</span></div>
      <span className="balance-wallet"><WalletCards size={30} /></span>
      <div className="balance-progress"><div><span>Minimum available payout</span><strong>{formatMoney(cashback.available)} / {formatMoney(lowestMinimum)}</strong></div><div><span style={{ width: `${Math.min(100, cashback.available / lowestMinimum * 100)}%` }} /></div><small>{!methods.length ? "Payout requests are temporarily unavailable. Please contact support." : eligible ? "Your approved cashback is ready to request." : `${formatMoney(Math.max(0, lowestMinimum - cashback.available))} more available cashback is needed. Pending and reserved funds cannot be withdrawn.`}</small></div>
      <button className="button button-lime payout-start" onClick={startRequest} disabled={!eligible}><CreditCard size={16} /> Request payout <ArrowRight size={16} /></button>
      <a className="payout-help-link" href={mailto("APEX cashback support")}><Mail size={13} /> Need help? Contact support</a>
    </div>

    <div className="cashback-status-grid payout-balance-grid">
      <div><span className="status-dot-large pending"><Clock3 size={19} /></span><strong>{formatMoney(cashback.pending)}</strong><p>Pending verification</p><small>Submitted orders awaiting invoice and attribution checks.</small></div>
      <div><span className="status-dot-large approved"><ShieldCheck size={19} /></span><strong>{formatMoney(cashback.reserved)}</strong><p>Reserved for payouts</p><small>Held for requests that are awaiting review or processing.</small></div>
      <div><span className="status-dot-large paid"><CircleCheck size={19} /></span><strong>{formatMoney(cashback.paid)}</strong><p>Paid out</p><small>Completed payouts and previously settled cashback.</small></div>
    </div>

    <div className="payout-process-note"><ShieldCheck size={19} /><p>The APEX team reviews payout requests before sending payment. Your status and payment reference will appear below.</p></div>
    <div className="dashboard-panel-heading"><div><span>YOUR PAYOUTS</span><h2>Payout request history</h2></div><span className="payout-history-count">{payouts.length} request{payouts.length === 1 ? "" : "s"}</span></div>
    {payouts.length ? <div className="dashboard-table-wrap payout-history"><table className="dashboard-table"><thead><tr><th>Request</th><th>Amount</th><th>Method</th><th>Status</th><th>Payment reference</th><th /></tr></thead><tbody>{payouts.map((item) => <tr key={item.id}>
      <td><strong>#{item.id.slice(0, 8).toUpperCase()}</strong><small>{new Date(item.createdAt).toLocaleDateString()}</small></td><td><strong className="dashboard-reward">{formatMoney(item.amount)}</strong></td><td>{item.method}</td><td><span className={`purchase-status payout-${item.status}`}>{item.status === "paid" ? <Check size={12} /> : <Clock3 size={12} />}{item.status}</span>{item.note && <small className="payout-note">{item.note}</small>}</td><td>{item.paymentReference || "Not yet issued"}</td><td>{item.status === "requested" && <button className="text-button" disabled={cancelling === item.id} onClick={async () => { setCancelling(item.id); const result = await cancelPayout(item.id); setCancelling(null); onNotice(result.message); }}><X size={12} />{cancelling === item.id ? "Cancelling..." : "Cancel"}</button>}</td>
    </tr>)}</tbody></table></div> : <div className="payout-empty"><WalletCards size={25} /><strong>No payout requests yet</strong><p>Once approved cashback reaches {formatMoney(minimum)}, request it here and follow every status update.</p></div>}

    <Modal open={open} onClose={() => { if (!saving) setOpen(false); }} title="Request a cashback payout" eyebrow="APEX PAYOUT DESK">
      <form className="payout-request-form" onSubmit={submit}>
        <div className="payout-request-summary"><span><WalletCards size={22} /></span><div><small>Available approved cashback</small><strong>{formatMoney(cashback.available)}</strong></div><p>Minimum {formatMoney(minimum)}</p></div>
        <div className="form-grid-two">
          <label className="form-field"><span>Payout amount (USD)</span><div><input type="number" min={minimum} max={cashback.available} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div></label>
          <label className="form-field"><span>Payout method</span><div><select value={method?.id ?? ""} onChange={(event) => { const selected = methods.find((item) => item.id === event.target.value); if (selected) chooseMethod(selected); }} required><option value="" disabled>Select a payout method</option>{methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></label>
        </div>
        {!method && <div className="form-error">This method is no longer available. Please select another option.</div>}
        {method?.instructions && <p className="payout-method-instructions">{method.instructions}</p>}
        {method?.questions.map((item) => <label className="form-field dynamic-payout-question" key={`${method.id}-${item.id}`}><span>{item.label}{!item.required && <em>Optional</em>}</span>
          {item.type === "textarea" ? <textarea rows={3} value={answers[item.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [item.id]: event.target.value })} placeholder={item.placeholder} maxLength={500} required={item.required} autoComplete="off" /> : <div>{item.type === "select" ? <select value={answers[item.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [item.id]: event.target.value })} required={item.required}><option value="">Choose an option</option>{item.options?.map((option) => <option value={option} key={option}>{option}</option>)}</select> : <input type={item.type === "email" || item.validation === "email" ? "email" : item.type === "number" ? "number" : "text"} value={answers[item.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [item.id]: event.target.value })} placeholder={item.placeholder} maxLength={500} required={item.required} autoComplete={item.purpose === "payee" ? "name" : "off"} step={item.type === "number" ? "any" : undefined} />}</div>}
          {item.help && <small className="question-help">{item.help}</small>}
        </label>)}
        <p className="payout-privacy"><ShieldCheck size={15} />Payment details are encrypted and available only to authorised staff. Never share passwords, PINs or one-time codes.</p>
        <label className="form-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><Check size={12} /></span><p>I confirm these details are correct. I understand this amount is reserved until my request is completed, cancelled or rejected.</p></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="button button-lime payout-submit" disabled={saving || !method}>{saving ? "Submitting request..." : "Submit payout request"}<ArrowRight size={16} /></button>
      </form>
    </Modal>
  </section>;
}