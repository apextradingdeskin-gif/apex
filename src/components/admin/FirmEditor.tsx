import { useEffect, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import Modal from "../Modal";
import { getCashbackRate, type Firm } from "../../data/firms";
import ImagePicker from "./ImagePicker";

const blankFirm: Firm = {
  id: "", name: "", monogram: "", country: "", countryCode: "", founded: new Date().getFullYear(), rating: 0, reviews: 0,
  assets: ["Forex"], market: "Forex", platforms: ["MT5"], allocation: 100000, allocationLabel: "$100K",
  profitSplit: "Up to 90%", leverage: "1:100", drawdown: "Model-specific", payout: "Every 14 days", promo: "Cashback available",
  offerDetails: "Confirm the current promotion and eligibility on the official firm website.", website: "", color: "#72e7ff",
  verified: false, models: ["2 Step"], summary: "", cashbackRate: 5, status: "active",
};

export default function FirmEditor({ firm, onClose, onSave }: { firm: Firm | null | undefined; onClose: () => void; onSave: (firm: Firm) => Promise<void> }) {
  const [draft, setDraft] = useState<Firm>(blankFirm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [listInputs, setListInputs] = useState({ assets: "Forex", platforms: "MT5", models: "2 Step" });
  useEffect(() => { if (firm !== undefined) {
    const next = firm ? { ...firm, cashbackRate: getCashbackRate(firm.id) } : { ...blankFirm };
    setDraft(next); setError(""); setListInputs({ assets: next.assets.join(", "), platforms: next.platforms.join(", "), models: next.models.join(", ") });
  } }, [firm]);
  if (firm === undefined) return null;
  const update = <K extends keyof Firm>(key: K, value: Firm[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const list = (key: "assets" | "platforms" | "models", value: string) => {
    setListInputs((current) => ({ ...current, [key]: value }));
    update(key, value.split(",").map((item) => item.trim()).filter(Boolean));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.website.trim()) { setError("Firm name and official website are required."); return; }
    try { new URL(draft.website); } catch { setError("Enter a complete official website URL, including https://."); return; }
    const id = draft.id || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSaving(true);
    try { await onSave({ ...draft, id, name: draft.name.trim(), monogram: draft.monogram || draft.name.slice(0, 2).toUpperCase(), allocation: Number(draft.allocation), founded: Number(draft.founded), rating: Number(draft.rating), reviews: Number(draft.reviews), cashbackRate: Number(draft.cashbackRate) }); }
    finally { setSaving(false); }
  };
  return <Modal open onClose={onClose} title={firm ? `Edit ${firm.name}` : "Add a prop firm"} eyebrow="DIRECTORY MANAGEMENT" wide>
    <form className="admin-firm-form" onSubmit={submit}>
      <ImagePicker value={draft.logo} onChange={(value) => update("logo", value)} draftKey={`apex_logo_draft_firm_${firm?.id ?? "new"}`} label="Firm logo" />
      <div className="admin-form-grid">
        <label><span>Firm name *</span><input value={draft.name} onChange={(e) => update("name", e.target.value)} required /></label>
        <label><span>Monogram</span><input value={draft.monogram} maxLength={4} onChange={(e) => update("monogram", e.target.value)} placeholder="Auto" /></label>
        <label><span>Official website *</span><input type="url" value={draft.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" required /></label>
        <label className="span-2"><span>APEX partner affiliate URL (optional)</span><input type="url" value={draft.affiliateUrl ?? ""} onChange={(event) => update("affiliateUrl", event.target.value)} placeholder="The referral URL actually assigned to APEX" /></label><label><span>Click / sub-ID query parameter</span><input value={draft.trackingParameter ?? "apex_click"} onChange={(event) => update("trackingParameter", event.target.value)} placeholder="Provider-supported subid or apex_click" /></label>
        <label><span>Market</span><select value={draft.market} onChange={(e) => update("market", e.target.value as Firm["market"])}><option>Forex</option><option>Futures</option></select></label>
        <label><span>Directory status</span><select value={draft.status ?? "active"} onChange={(e) => update("status", e.target.value as Firm["status"])}><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <label><span>Country</span><input value={draft.country} onChange={(e) => update("country", e.target.value)} /></label>
        <label><span>Country code</span><input value={draft.countryCode} maxLength={3} onChange={(e) => update("countryCode", e.target.value.toUpperCase())} /></label>
        <label><span>Founded</span><input type="number" min="1990" max={new Date().getFullYear()} value={draft.founded} onChange={(e) => update("founded", Number(e.target.value))} /></label>
        <label><span>Rating (0–5)</span><input type="number" min="0" max="5" step="0.1" value={draft.rating} onChange={(e) => update("rating", Number(e.target.value))} /></label>
        <label><span>Review count</span><input type="number" min="0" value={draft.reviews} onChange={(e) => update("reviews", Number(e.target.value))} /></label>
        <label><span>Cashback rate (%)</span><input type="number" min="0" max="100" step="0.1" value={draft.cashbackRate} onChange={(e) => update("cashbackRate", Number(e.target.value))} /></label>
        <label><span>Max allocation (USD)</span><input type="number" min="0" value={draft.allocation} onChange={(e) => update("allocation", Number(e.target.value))} /></label>
        <label><span>Allocation label</span><input value={draft.allocationLabel} onChange={(e) => update("allocationLabel", e.target.value)} /></label>
        <label><span>Profit split</span><input value={draft.profitSplit} onChange={(e) => update("profitSplit", e.target.value)} /></label>
        <label><span>Leverage</span><input value={draft.leverage} onChange={(e) => update("leverage", e.target.value)} /></label>
        <label><span>Max drawdown</span><input value={draft.drawdown} onChange={(e) => update("drawdown", e.target.value)} /></label>
        <label><span>Payout rhythm</span><input value={draft.payout} onChange={(e) => update("payout", e.target.value)} /></label>
        <label><span>Promotion</span><input value={draft.promo} onChange={(e) => update("promo", e.target.value)} /></label>
        <label><span>Discount code</span><input value={draft.code ?? ""} onChange={(e) => update("code", e.target.value)} placeholder="Optional" /></label>
        <label><span>Brand color</span><input type="color" value={draft.color} onChange={(e) => update("color", e.target.value)} /></label>
        <label className="admin-check"><input type="checkbox" checked={draft.verified} onChange={(e) => update("verified", e.target.checked)} /><span>Mark as listed & reviewed</span></label>
        <label className="span-2"><span>Platforms (comma separated)</span><input value={listInputs.platforms} onChange={(e) => list("platforms", e.target.value)} /></label>
        <label className="span-2"><span>Assets (comma separated)</span><input value={listInputs.assets} onChange={(e) => list("assets", e.target.value)} /></label>
        <label className="span-2"><span>Account models (comma separated)</span><input value={listInputs.models} onChange={(e) => list("models", e.target.value)} /></label>
        <label className="span-2"><span>Short summary</span><textarea rows={3} value={draft.summary} onChange={(e) => update("summary", e.target.value)} /></label>
        <label className="span-2"><span>Offer terms & context</span><textarea rows={3} value={draft.offerDetails} onChange={(e) => update("offerDetails", e.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="admin-form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-lime" type="submit" disabled={saving}><Save size={15} /> {saving ? "Saving..." : "Save firm"}</button></div>
    </form>
  </Modal>;
}
