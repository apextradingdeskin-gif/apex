import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, CircleHelp, CreditCard, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useAccount, type PayoutMethod, type PayoutQuestion } from "../../context/AccountContext";
import Modal from "../Modal";

const question = (): PayoutQuestion => ({ id: `q_${crypto.randomUUID().slice(0, 8)}`, label: "", type: "text", required: true, placeholder: "", help: "", validation: "none", sensitive: false, purpose: "other", options: [] });
const blank = (): PayoutMethod => ({ id: "", name: "", description: "", instructions: "", status: "active", minimum: 0, currency: "USD", order: 10, version: 1, questions: [question()] });

export default function PayoutMethods({ onNotice }: { onNotice: (message: string) => void }) {
  const { payoutMethods, savePayoutMethod, deletePayoutMethod, platformSettings } = useAccount();
  const [editing, setEditing] = useState<PayoutMethod | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [optionsText, setOptionsText] = useState<Record<string, string>>({});
  const methods = [...payoutMethods].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  useEffect(() => { setError(""); setOptionsText({}); }, [editing?.id]);
  const update = (patch: Partial<PayoutMethod>) => setEditing((current) => current ? { ...current, ...patch } : current);
  const updateQuestion = (index: number, patch: Partial<PayoutQuestion>) => {
    if (!editing) return;
    update({ questions: editing.questions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  };
  const move = (index: number, direction: number) => {
    if (!editing) return; const items = [...editing.questions];
    const target = index + direction; if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]]; update({ questions: items });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!editing || saving) return;
    const id = editing.id || editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (isNew && payoutMethods.some((item) => item.id === id)) { setError("A method with this name already exists. Edit it instead."); return; }
    setSaving(true); setError(""); const result = await savePayoutMethod({ ...editing, id }); setSaving(false);
    if (!result.ok) { setError(result.message); return; } setEditing(null); onNotice(result.message);
  };
  return <>
    <section className="admin-card payout-methods-panel">
      <div className="admin-section-title"><div><h2>Payout methods</h2><p>Choose which methods members can use and exactly what details each method asks for.</p></div><button className="button button-lime button-small" onClick={() => { setIsNew(true); setError(""); setEditing(blank()); }}><Plus size={15} /> Add payout method</button></div>
      <div className="method-management-list">{methods.map((method) => <article key={method.id} className={method.status === "retired" ? "retired" : ""}>
        <span className="method-management-icon"><CreditCard size={21} /></span>
        <div className="method-management-copy"><div><h3>{method.name}</h3><span className={`admin-status status-${method.status === "active" ? "active" : "archived"}`}>{method.status}</span></div><p>{method.description || method.instructions || "Custom payout method"}</p><small>{method.questions.length} questions · {method.currency} settlement · ${Math.max(platformSettings.minPayout, method.minimum)} minimum</small></div>
        <div className="method-management-actions"><button onClick={() => { setIsNew(false); setError(""); setEditing(structuredClone(method)); }}><Pencil size={14} /> Edit</button><button onClick={async () => { const result = await savePayoutMethod({ ...method, status: method.status === "active" ? "retired" : "active" }); onNotice(result.message); }}><EyeOff size={14} />{method.status === "active" ? "Retire" : "Activate"}</button>{method.status === "retired" && <button className="danger" onClick={async () => { if (!window.confirm(`Remove ${method.name}? Historical requests will remain unchanged.`)) return; const result = await deletePayoutMethod(method.id); onNotice(result.message); }}><Trash2 size={14} /> Remove</button>}</div>
      </article>)}{!methods.length && <div className="admin-empty"><CreditCard size={27} /><p>Add a payout method to allow member withdrawals.</p></div>}</div>
      <p className="method-safety-note"><CircleHelp size={16} /> Retiring hides a method from new requests. Editing questions does not change old requests. Remove a retired method only after its open requests are resolved.</p>
    </section>
    <Modal open={Boolean(editing)} onClose={() => { if (!saving) setEditing(null); }} title={isNew ? "Add payout method" : `Edit ${editing?.name ?? "payout method"}`} eyebrow="PAYOUT CONFIGURATION" wide>
      {editing && <form className="method-editor" onSubmit={submit}>
        <div className="method-editor-basics">
          <label className="form-field"><span>Method name</span><div><input value={editing.name} onChange={(event) => update({ name: event.target.value })} placeholder="e.g. Wise, UPI, bank transfer" minLength={2} maxLength={70} required /></div></label>
          <label className="form-field"><span>Availability</span><div><select value={editing.status} onChange={(event) => update({ status: event.target.value as PayoutMethod["status"] })}><option value="active">Active</option><option value="retired">Retired</option></select></div></label>
          <label className="form-field"><span>Settlement currency</span><div><input value={editing.currency} onChange={(event) => update({ currency: event.target.value.toUpperCase() })} minLength={3} maxLength={3} placeholder="USD" required /></div></label>
          <label className="form-field"><span>Method minimum (USD)</span><div><input type="number" min={0} max={100000} step="0.01" value={editing.minimum} onChange={(event) => update({ minimum: Number(event.target.value) })} /></div></label>
          <label className="form-field"><span>Display order</span><div><input type="number" min={0} max={1000} value={editing.order} onChange={(event) => update({ order: Number(event.target.value) })} /></div></label>
          <label className="form-field"><span>Short description</span><div><input value={editing.description} onChange={(event) => update({ description: event.target.value })} maxLength={240} /></div></label>
        </div>
        <label className="form-field"><span>Member instructions</span><textarea value={editing.instructions} onChange={(event) => update({ instructions: event.target.value })} rows={2} maxLength={800} placeholder="Requirements, supported regions, settlement and conversion details" /></label>
        <div className="method-questions-heading"><div><h3>Questions for this method</h3><p>Only these questions will appear when a member selects this payout method.</p></div><button type="button" className="button button-outline button-small" disabled={editing.questions.length >= 8} onClick={() => update({ questions: [...editing.questions, question()] })}><Plus size={14} /> Add question</button></div>
        <div className="method-question-list">{editing.questions.map((item, index) => <fieldset className="method-question-editor" key={item.id}>
          <legend>Question {index + 1}</legend><div className="question-order-actions"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move question ${index + 1} up`}><ArrowUp size={13} /></button><button type="button" disabled={index === editing.questions.length - 1} onClick={() => move(index, 1)} aria-label={`Move question ${index + 1} down`}><ArrowDown size={13} /></button><button type="button" disabled={editing.questions.length <= 1} onClick={() => update({ questions: editing.questions.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove question ${index + 1}`}><Trash2 size={13} /></button></div>
          <div className="form-grid-two"><label className="form-field"><span>Question label</span><div><input value={item.label} onChange={(event) => updateQuestion(index, { label: event.target.value })} minLength={2} maxLength={100} required /></div></label><label className="form-field"><span>Answer type</span><div><select value={item.type} onChange={(event) => { const type = event.target.value as PayoutQuestion["type"]; updateQuestion(index, { type, validation: type === "email" ? "email" : "none", options: type === "select" ? item.options?.length ? item.options : ["Option 1", "Option 2"] : [] }); }}><option value="text">Short text</option><option value="email">Email address</option><option value="number">Number</option><option value="select">Choose an option</option><option value="textarea">Long text</option></select></div></label><label className="form-field"><span>Example / placeholder</span><div><input value={item.placeholder ?? ""} onChange={(event) => updateQuestion(index, { placeholder: event.target.value })} maxLength={160} /></div></label><label className="form-field"><span>Answer purpose</span><div><select value={item.purpose ?? "other"} onChange={(event) => updateQuestion(index, { purpose: event.target.value as PayoutQuestion["purpose"] })}><option value="payee">Account holder name</option><option value="destination">Payment destination</option><option value="other">Additional detail</option></select></div></label><label className="form-field"><span>Validation</span><div><select value={item.validation ?? "none"} onChange={(event) => updateQuestion(index, { validation: event.target.value as PayoutQuestion["validation"] })}><option value="none">Standard text</option><option value="email">Email</option><option value="upi">UPI ID</option><option value="ifsc">IFSC code</option><option value="iban">IBAN</option></select></div></label><label className="form-field"><span>Helper text</span><div><input value={item.help ?? ""} onChange={(event) => updateQuestion(index, { help: event.target.value })} maxLength={240} /></div></label></div>
          {item.type === "select" && <label className="form-field"><span>Options (comma separated)</span><div><input value={optionsText[item.id] ?? item.options?.join(", ") ?? ""} onChange={(event) => { setOptionsText({ ...optionsText, [item.id]: event.target.value }); updateQuestion(index, { options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }); }} required /></div></label>}
          <div className="question-checks"><label><input type="checkbox" checked={item.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} /> Required answer</label><label><input type="checkbox" checked={item.sensitive ?? false} onChange={(event) => updateQuestion(index, { sensitive: event.target.checked })} /> Private payment detail</label></div>
        </fieldset>)}</div>
        <p className="method-safety-note"><CircleHelp size={16} /> All answers are encrypted on the server. Never ask for passwords, PINs, OTPs, card numbers or security codes. The method minimum cannot override the site's higher minimum.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="admin-form-actions"><button type="button" className="button button-outline" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button button-lime" disabled={saving}><Check size={15} />{saving ? "Saving..." : "Save payout method"}</button></div>
      </form>}
    </Modal>
  </>;
}