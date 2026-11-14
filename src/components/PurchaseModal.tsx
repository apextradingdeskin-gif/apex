import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, BadgePercent, Check, CheckCircle2, Copy, ExternalLink, ReceiptText, ShieldCheck } from "lucide-react";
import Modal from "./Modal";
import FirmLogo from "./FirmLogo";
import { cashbackRateFor, isAffiliateTrackingReady, type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";
import { copyText } from "../utils/copyText";

type Props = { open: boolean; initialFirm: Firm | null; onClose: () => void; onNotice: (message: string) => void };

export default function PurchaseModal({ open, initialFirm, onClose, onNotice }: Props) {
  const { user, firms, addPurchase, recordReferralClick, backendConfigured, platformSettings } = useAccount();
  const eligibleFirms = useMemo(() => firms.filter((item) => item.status !== "archived" && isAffiliateTrackingReady(item)), [firms]);
  const [firmId, setFirmId] = useState(initialFirm?.id ?? eligibleFirms[0]?.id ?? firms[0].id);
  const [stage, setStage] = useState<"activate" | "report" | "success">(initialFirm ? "activate" : "report");
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [codeUsed, setCodeUsed] = useState(initialFirm?.code ?? "");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submittedReward, setSubmittedReward] = useState(0);
  const [activeClickId, setActiveClickId] = useState("");

  const firm = useMemo(() => firms.find((item) => item.id === firmId) ?? eligibleFirms[0] ?? firms[0], [firms, firmId, eligibleFirms]);
  const rate = cashbackRateFor(firm);
  const estimate = Math.round((Number(amount) || 0) * rate) / 100;

  useEffect(() => {
    if (!open) return;
    setFirmId(initialFirm?.id ?? eligibleFirms[0]?.id ?? firms[0].id);
    setStage(initialFirm ? "activate" : "report");
    setCodeUsed(initialFirm?.apexCode ?? "");
    setActiveClickId("");
    setOrderId(""); setAmount(""); setNotes(""); setConfirmed(false); setError("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
  }, [open, initialFirm]);

  const trackedUrl = (clickId: string) => {
    const affiliateUrl = firm.affiliateUrl || firm.website;
    const templatedUrl = affiliateUrl.replace(/\{click_id\}/g, encodeURIComponent(clickId));
    const url = new URL(templatedUrl);
    url.searchParams.set("utm_source", "apextrading");
    url.searchParams.set("utm_medium", "cashback");
    url.searchParams.set("utm_campaign", "apex_rewards");
    if (user) url.searchParams.set("apex_ref", user.referralCode);
    url.searchParams.set("apex_click_id", clickId);
    if (firm.affiliateClickParam) url.searchParams.set(firm.affiliateClickParam, clickId);
    return url.toString();
  };

  const continueToFirm = async () => {
    if (!isAffiliateTrackingReady(firm)) {
      setError("PropApex has not connected an affiliate link or code for this firm yet. No cashback can be attributed.");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    if (!popup) { onNotice("Your browser blocked the new tab. Allow pop-ups, then try again."); return; }
    const clickId = await recordReferralClick(firm.id);
    if (!clickId) { popup.close(); setError("Your referral click could not be saved. Please retry or contact support."); return; }
    setActiveClickId(clickId);
    popup.opener = null;
    popup.location.href = trackedUrl(clickId);
    setStage("report");
  };

  const copyCode = async () => {
    const code = firm.apexCode || firm.code;
    if (!code) return;
    const success = await copyText(code);
    onNotice(success ? `${code} copied to your clipboard.` : `Copy unavailable. Code: ${code}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!confirmed) {
      setError("Confirm that these order details are accurate.");
      return;
    }
    if (!isAffiliateTrackingReady(firm)) {
      setError("Cashback is not available for this firm yet. Choose an PropApex-enabled offer or contact support.");
      return;
    }
    if (!activeClickId && (!firm.apexCode || codeUsed.trim().toUpperCase() !== firm.apexCode.trim().toUpperCase())) {
      setError("Activate this PropApex link first, or enter the firm's PropApex promo code.");
      return;
    }
    const result = addPurchase({
      firmId: firm.id, orderId, amount: Number(amount), cashbackRate: rate,
      codeUsed, referralClickId: activeClickId || undefined, purchaseDate: new Date(`${purchaseDate}T12:00:00`).toISOString(), notes,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmittedReward(estimate);
    setStage("success");
    onNotice(result.message);
  };

  return (
    <Modal open={open} onClose={onClose} title={stage === "success" ? "Purchase submitted" : stage === "report" ? "Track your purchase" : `Activate ${rate}% cashback`} eyebrow="PropApex CASHBACK">
      {stage === "success" ? (
        <div className="submission-success">
          <span><CheckCircle2 size={34} /></span>
          <h3>Your purchase has been saved.</h3>
          <p>{backendConfigured ? `We saved your ${firm.name} order in your account with an estimated cashback reward of $${submittedReward.toFixed(2)}. It remains pending until an administrator verifies the order and referral.` : `We saved your ${firm.name} purchase on this device with an estimated cashback reward of $${submittedReward.toFixed(2)}. It remains pending until a rewards backend is connected and the order is verified.`}</p>
          <div className="success-timeline"><div className="done"><Check size={13} /> Purchase submitted</div><div className="current">Verification pending</div><div>Cashback available</div></div>
          <button className="button button-lime" onClick={() => { onClose(); window.location.hash = "#dashboard"; }}>Open my dashboard <ArrowRight size={16} /></button>
        </div>
      ) : stage === "activate" ? (
        <div className="activate-purchase">
          <div className="activate-firm"><FirmLogo firm={firm} large /><div><h3>{firm.name}</h3><p>Up to {rate}% cashback on an eligible purchase</p></div><span>{rate}%</span></div>
          <div className="activation-steps">
            <div><span>1</span><p><strong>Activate this offer</strong><small>Your referral click is saved to your PropApex dashboard.</small></p></div>
            <div><span>2</span><p><strong>Complete your purchase</strong><small>Buy directly on the firm’s official website.</small></p></div>
            <div><span>3</span><p><strong>Submit the order details</strong><small>Your estimated reward stays pending during verification.</small></p></div>
          </div>
          {(firm.apexCode || firm.code) && <button className="activation-code" onClick={copyCode}><span>{firm.apexCode ? "PropApex partner code" : "Listed discount code"}</span><strong>{firm.apexCode || firm.code}</strong><Copy size={17} /></button>}
          <div className="activation-note"><ShieldCheck size={17} /><p>{isAffiliateTrackingReady(firm) ? `An PropApex click ID is attached to this offer${firm.apexCode ? `; use PropApex code ${firm.apexCode} if link tracking is unavailable` : ""}. Cashback is approved only after the firm confirms the order.` : "Cashback links for this firm are being prepared. The Admin → Prop firms panel must contain an affiliate URL or PropApex code before activation."}</p></div>
          <button className="button button-lime activate-link" onClick={continueToFirm} disabled={!isAffiliateTrackingReady(firm)}>Activate & visit {firm.name} <ExternalLink size={16} /></button>
          <button className="already-purchased" onClick={() => setStage("report")}>I already purchased — submit my order <ArrowRight size={14} /></button>
        </div>
      ) : eligibleFirms.length === 0 ? (
        <div className="tracking-empty-modal"><span><ShieldCheck size={24} /></span><h3>Cashback offers are being prepared.</h3><p>PropApex is setting up official affiliate links and codes with our firm partners. Purchase tracking opens here as soon as an eligible offer is available.</p><a className="button button-outline" href={`mailto:${platformSettings.supportEmail}?subject=PropApex%20affiliate%20offer%20question`}>Ask about offers <ArrowRight size={15} /></a></div>
      ) : (
        <form className="purchase-form" onSubmit={submit}>
          <div className="purchase-form-heading"><ReceiptText size={21} /><div><strong>Submit order details</strong><p>Enter the invoice information exactly as shown by the firm.</p></div></div>
          <div className="form-grid-two">
            <label className="form-field"><span>Prop firm</span><div><select value={firmId} onChange={(event) => { setFirmId(event.target.value); const next = firms.find((item) => item.id === event.target.value); setCodeUsed(next?.apexCode ?? ""); setActiveClickId(""); }} disabled={Boolean(initialFirm)}>{eligibleFirms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div></label>
            <label className="form-field"><span>Purchase date</span><div><input type="date" max={new Date().toISOString().slice(0, 10)} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} required /></div></label>
            <label className="form-field"><span>Order / invoice ID</span><div><input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="e.g. INV-10482" required /></div></label>
            <label className="form-field"><span>Net purchase amount (USD)</span><div><span className="input-prefix">$</span><input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="499.00" required /></div></label>
            <label className="form-field"><span>Code used</span><div><BadgePercent size={16} /><input value={codeUsed} onChange={(event) => setCodeUsed(event.target.value)} placeholder="PropApex code, if applicable" /></div></label>
            <div className="cashback-estimate"><span>Estimated pending cashback</span><strong>${estimate.toFixed(2)}</strong><small>{rate}% of eligible net spend</small></div>
          </div>
          <label className="form-field"><span>Notes for verification <em>Optional</em></span><div><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Account model, checkout email clue, or other useful detail" maxLength={180} /></div></label>
          <label className="form-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><Check size={12} /></span><p>I confirm this purchase was made through an PropApex link or eligible code and these details are accurate.</p></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="purchase-submit-row"><p>Submission does not mean automatic approval. You can follow the status in your dashboard.</p><button className="button button-lime" type="submit">Submit for verification <ArrowRight size={16} /></button></div>
        </form>
      )}
    </Modal>
  );
}
