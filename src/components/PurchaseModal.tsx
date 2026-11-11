import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, BadgePercent, Check, CheckCircle2, Copy, ExternalLink, ReceiptText, ShieldCheck } from "lucide-react";
import Modal from "./Modal";
import FirmLogo from "./FirmLogo";
import { getCashbackRate, type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";
import { copyText } from "../utils/copyText";

type Props = { open: boolean; initialFirm: Firm | null; onClose: () => void; onNotice: (message: string) => void };

export default function PurchaseModal({ open, initialFirm, onClose, onNotice }: Props) {
  const { firms, addPurchase, recordReferralClick } = useAccount();
  const [firmId, setFirmId] = useState(initialFirm?.id ?? firms[0]?.id ?? "");
  const [stage, setStage] = useState<"activate" | "report" | "success">(initialFirm ? "activate" : "report");
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [codeUsed, setCodeUsed] = useState(initialFirm?.code ?? "");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submittedReward, setSubmittedReward] = useState(0);
  const [saving, setSaving] = useState(false);

  const firm = useMemo(() => firms.find((item) => item.id === firmId) ?? firms[0], [firmId, firms]);
  const rate = getCashbackRate(firm?.id ?? "");
  const estimate = Math.round((Number(amount) || 0) * rate) / 100;

  useEffect(() => {
    if (!open) return;
    setFirmId(initialFirm?.id ?? firms[0]?.id ?? "");
    setStage(initialFirm ? "activate" : "report");
    setCodeUsed(initialFirm?.code ?? "");
    setOrderId(""); setAmount(""); setNotes(""); setConfirmed(false); setError("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
  }, [open, initialFirm]);

  if (!firm) return null;

  const continueToFirm = async () => {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    const result = await recordReferralClick(firm.id);
    if (!result.ok) { popup?.close(); onNotice(result.message); return; }
    if (popup) popup.location.href = result.redirectUrl || firm.affiliateUrl || firm.website;
    else onNotice("Your browser blocked the new tab. Allow pop-ups, then try again.");
    setStage("report");
  };

  const copyCode = async () => {
    if (!firm.code) return;
    const success = await copyText(firm.code);
    onNotice(success ? `${firm.code} copied to your clipboard.` : `Copy unavailable. Code: ${firm.code}`);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!confirmed) {
      setError("Confirm that these order details are accurate.");
      return;
    }
    setSaving(true);
    const result = await addPurchase({
      firmId: firm.id, orderId, amount: Number(amount), cashbackRate: rate,
      codeUsed, purchaseDate: new Date(`${purchaseDate}T12:00:00`).toISOString(), notes,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmittedReward(estimate);
    setStage("success");
    onNotice(result.message);
  };

  return (
    <Modal open={open} onClose={onClose} title={stage === "success" ? "Purchase added" : stage === "report" ? "Add a purchase" : "Shop with cashback"} eyebrow="APEX CASHBACK">
      {stage === "success" ? (
        <div className="submission-success">
          <span><CheckCircle2 size={34} /></span>
          <h3>Your purchase has been saved.</h3>
          <p>Your {firm.name} order is saved with an estimated cashback reward of <strong>${submittedReward.toFixed(2)}</strong>. We will review it and update your account.</p>
          <div className="success-timeline"><div className="done"><Check size={13} /> Purchase submitted</div><div className="current">Verification pending</div><div>Cashback available</div></div>
          <button className="button button-lime" onClick={() => { onClose(); window.location.hash = "#dashboard"; }}>Open my dashboard <ArrowRight size={16} /></button>
        </div>
      ) : stage === "activate" ? (
        <div className="activate-purchase">
          <div className="activate-firm"><FirmLogo firm={firm} large /><div><h3>{firm.name}</h3><p>Up to {rate}% cashback on an eligible purchase</p></div><span>{rate}%</span></div>
          <p className="purchase-intro-copy">Buy directly from the firm using its eligible APEX offer, then add the order details to your account.</p>
          {firm.code && <button className="activation-code" onClick={copyCode}><span>Use this code at eligible checkouts</span><strong>{firm.code}</strong><Copy size={17} /></button>}
          <div className="activation-note"><ShieldCheck size={17} /><p>Cashback is released after order review. Refunded or ineligible purchases do not earn rewards.</p></div>
          <button className="button button-lime activate-link" onClick={continueToFirm}>Visit {firm.name} <ExternalLink size={16} /></button>
          <button className="already-purchased" onClick={() => setStage("report")}>I already purchased — submit my order <ArrowRight size={14} /></button>
        </div>
      ) : (
        <form className="purchase-form" onSubmit={submit}>
          <div className="purchase-form-heading"><ReceiptText size={21} /><div><strong>Your order details</strong><p>Use the details from your purchase confirmation.</p></div></div>
          <div className="form-grid-two">
            <label className="form-field"><span>Prop firm</span><div><select value={firmId} onChange={(event) => { setFirmId(event.target.value); const next = firms.find((item) => item.id === event.target.value); setCodeUsed(next?.code ?? ""); }} disabled={Boolean(initialFirm)}>{firms.filter((item) => item.status !== "archived").map((item) => <option value={item.id} key={item.id}>{item.name} · {getCashbackRate(item.id)}% cashback</option>)}</select></div></label>
            <label className="form-field"><span>Purchase date</span><div><input type="date" max={new Date().toISOString().slice(0, 10)} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} required /></div></label>
            <label className="form-field"><span>Order / invoice ID</span><div><input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="e.g. INV-10482" required /></div></label>
            <label className="form-field"><span>Net purchase amount (USD)</span><div><span className="input-prefix">$</span><input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="499.00" required /></div></label>
            <div className="cashback-estimate"><span>Estimated pending cashback</span><strong>${estimate.toFixed(2)}</strong><small>{rate}% of eligible net spend</small></div>
          </div>
          <details className="purchase-extra-details"><summary>Additional details (optional)</summary><label className="form-field"><span>Code used</span><div><BadgePercent size={16} /><input value={codeUsed} onChange={(event) => setCodeUsed(event.target.value)} placeholder="Code entered at checkout" /></div></label><label className="form-field"><span>Notes</span><div><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything else that helps us review your order" maxLength={180} /></div></label></details>
          <label className="form-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><Check size={12} /></span><p>I confirm the order details above are accurate.</p></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="purchase-submit-row"><p>Cashback is subject to order review.</p><button className="button button-lime" type="submit" disabled={saving}>{saving ? "Saving..." : "Add purchase"} <ArrowRight size={16} /></button></div>
        </form>
      )}
    </Modal>
  );
}
