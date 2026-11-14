import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CircleDollarSign, ShieldCheck } from "lucide-react";
import Modal from "./Modal";

type Props = {
  open: boolean;
  amount: number;
  minimum: number;
  email: string;
  methods: string[];
  onClose: () => void;
  onRequest: (method: string, details: string) => Promise<{ ok: boolean; message: string }>;
  onNotice: (message: string) => void;
};

export default function PayoutRequestModal({ open, amount, minimum, email, methods, onClose, onRequest, onNotice }: Props) {
  const [method, setMethod] = useState(methods[0] ?? "");
  const [details, setDetails] = useState(email);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod(methods[0] ?? ""); setDetails(email); setError("");
  }, [open, methods, email]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await onRequest(method, details);
      if (!result.ok) { setError(result.message); return; }
      onNotice(result.message); onClose();
    } catch {
      setError("The payout request could not be sent. Check your connection and try again.");
    } finally { setBusy(false); }
  };

  return <Modal open={open} onClose={onClose} title="Request a cashback payout" eyebrow="CASHBACK WITHDRAWAL">
    <form className="payout-request-form" onSubmit={submit}>
      <div className="payout-request-amount"><span><CircleDollarSign size={20} /></span><div><small>Available to request</small><strong>${amount.toFixed(2)}</strong></div></div>
      <label className="form-field"><span>Payout method</span><div><select value={method} onChange={(event) => setMethod(event.target.value)} required>{methods.map((item) => <option key={item}>{item}</option>)}</select></div></label>
      <label className="form-field"><span>{/crypto|wallet/i.test(method) ? "Wallet address" : /paypal/i.test(method) ? "PayPal email" : /bank|wise/i.test(method) ? "Receiving account email or reference" : "Payout reference"}</span><div><input value={details} onChange={(event) => setDetails(event.target.value)} maxLength={240} required placeholder={/crypto|wallet/i.test(method) ? "Wallet address" : "Your receiving email or reference"} /></div></label>
      <div className="payout-security-note"><ShieldCheck size={16} /><p>Requests are reviewed by PropApex before payment. Share only the email or wallet reference needed for your chosen method; never enter passwords, card numbers or private keys.</p></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="payout-request-footer"><p>Minimum payout: ${minimum.toFixed(2)} · Once submitted, your balance is reserved until the request is paid, rejected or cancelled.</p><button className="button button-lime" type="submit" disabled={busy || amount < minimum}>{busy ? "Submitting…" : "Submit payout request"}<ArrowRight size={15} /></button></div>
    </form>
  </Modal>;
}
