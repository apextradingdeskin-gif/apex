import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { ImagePlus, LoaderCircle, Save, Trash2, Upload } from "lucide-react";
import Modal from "../Modal";
import { cashbackRateFor, type Firm } from "../../data/firms";
import { storeFirmLogo } from "../../lib/firmLogo";

const blankFirm: Firm = {
  id: "", name: "", monogram: "", country: "", countryCode: "", founded: new Date().getFullYear(), rating: 0, reviews: 0,
  assets: ["Forex"], market: "Forex", platforms: ["MT5"], allocation: 100000, allocationLabel: "$100K",
  profitSplit: "Up to 90%", leverage: "1:100", drawdown: "Model-specific", payout: "Every 14 days", promo: "Cashback available",
  offerDetails: "Confirm the current promotion and eligibility on the official firm website.", website: "", color: "#72e7ff",
  verified: false, models: ["2 Step"], summary: "", cashbackRate: 5, status: "active", affiliateClickParam: "sub_id",
};

export default function FirmEditor({ firm, onClose, onSave }: { firm: Firm | null | undefined; onClose: () => void; onSave: (firm: Firm) => void }) {
  const [draft, setDraft] = useState<Firm>(blankFirm);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (firm !== undefined) { setDraft(firm ? { ...firm, cashbackRate: cashbackRateFor(firm) } : { ...blankFirm }); setError(""); setLogoError(""); } }, [firm]);
  if (firm === undefined) return null;
  const update = <K extends keyof Firm>(key: K, value: Firm[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const list = (key: "assets" | "platforms" | "models", value: string) => update(key, value.split(",").map((item) => item.trim()).filter(Boolean));
  const saveLogoImage = async (file: File | undefined) => {
    if (!file) return;
    setLogoError(""); setLogoBusy(true);
    try {
      const generatedId = draft.id || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-firm";
      const logo = await storeFirmLogo(file, generatedId);
      update("logo", logo);
    } catch (caught) {
      setLogoError(caught instanceof Error ? caught.message : "The image could not be added.");
    } finally { setLogoBusy(false); }
  };
  const pasteLogo = (event: ClipboardEvent<HTMLDivElement>) => {
    const image = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"))?.getAsFile();
    if (image) { event.preventDefault(); void saveLogoImage(image); }
  };
  const dropLogo = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    void saveLogoImage(event.dataTransfer.files[0]);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.website.trim()) { setError("Firm name and official website are required."); return; }
    try { new URL(draft.website); } catch { setError("Enter a complete official website URL, including https://."); return; }
    if (draft.affiliateUrl?.trim()) {
      try { const affiliate = new URL(draft.affiliateUrl); if (affiliate.protocol !== "https:") throw new Error(); }
      catch { setError("The affiliate URL must be a valid https:// link."); return; }
    }
    if (draft.affiliateClickParam && !/^[a-zA-Z0-9_-]{1,40}$/.test(draft.affiliateClickParam)) { setError("Use letters, numbers, underscores or hyphens for the partner click-ID parameter."); return; }
    const id = draft.id || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    onSave({ ...draft, id, name: draft.name.trim(), monogram: draft.monogram || draft.name.slice(0, 2).toUpperCase(), allocation: Number(draft.allocation), founded: Number(draft.founded), rating: Number(draft.rating), reviews: Number(draft.reviews), cashbackRate: Number(draft.cashbackRate) });
  };
  return <Modal open onClose={onClose} title={firm ? `Edit ${firm.name}` : "Add a prop firm"} eyebrow="DIRECTORY MANAGEMENT" wide>
    <form className="admin-firm-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <label><span>Firm name *</span><input value={draft.name} onChange={(e) => update("name", e.target.value)} required /></label>
        <label><span>Monogram</span><input value={draft.monogram} maxLength={4} onChange={(e) => update("monogram", e.target.value)} placeholder="Auto" /></label>
        <label><span>Official website *</span><input type="url" value={draft.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" required /></label>
        <div className="span-2 admin-logo-field"><span>Firm logo</span><div className={`admin-logo-upload ${dragging ? "dragging" : ""}`} tabIndex={0} onPaste={pasteLogo} onDrop={dropLogo} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}>
          <div className="admin-logo-preview">{draft.logo ? <img src={draft.logo} alt={`${draft.name || "Firm"} logo preview`} /> : <ImagePlus size={26} />}</div>
          <div className="admin-logo-copy"><strong>{draft.logo ? "Logo ready" : "Add a logo"}</strong><small>Choose an image, drag it here, or focus this area and paste an image from your clipboard.</small><small>PNG, JPG, WebP or GIF · optimized before saving</small></div>
          <div className="admin-logo-actions"><button type="button" className="admin-logo-choose" onClick={() => fileInput.current?.click()} disabled={logoBusy}>{logoBusy ? <LoaderCircle size={14} className="admin-spin" /> : <Upload size={14} />}{logoBusy ? "Saving" : "Choose image"}</button>{draft.logo && <button type="button" className="admin-logo-remove" onClick={() => update("logo", undefined)} aria-label="Remove firm logo"><Trash2 size={14} /></button>}</div>
          <input ref={fileInput} className="admin-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void saveLogoImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </div>{logoError && <small className="admin-logo-error">{logoError}</small>}</div>
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
        <label className="span-2"><span>PropApex affiliate URL</span><input type="url" value={draft.affiliateUrl ?? ""} onChange={(e) => update("affiliateUrl", e.target.value)} placeholder="Your firm's unique affiliate URL" /><small>Use a URL with {"{click_id}"} in the query string or configure its click-ID parameter.</small></label>
        <label><span>Partner click-ID parameter</span><input value={draft.affiliateClickParam ?? "sub_id"} onChange={(e) => update("affiliateClickParam", e.target.value)} placeholder="sub_id" /></label>
        <label><span>Your PropApex promo code</span><input value={draft.apexCode ?? ""} onChange={(e) => update("apexCode", e.target.value)} placeholder="Only if the firm assigned one" /></label>
        <label><span>Brand color</span><input type="color" value={draft.color} onChange={(e) => update("color", e.target.value)} /></label>
        <label className="admin-check"><input type="checkbox" checked={draft.verified} onChange={(e) => update("verified", e.target.checked)} /><span>Mark as listed & reviewed</span></label>
        <label className="span-2"><span>Platforms (comma separated)</span><input value={draft.platforms.join(", ")} onChange={(e) => list("platforms", e.target.value)} /></label>
        <label className="span-2"><span>Assets (comma separated)</span><input value={draft.assets.join(", ")} onChange={(e) => list("assets", e.target.value)} /></label>
        <label className="span-2"><span>Account models (comma separated)</span><input value={draft.models.join(", ")} onChange={(e) => list("models", e.target.value)} /></label>
        <label className="span-2"><span>Short summary</span><textarea rows={3} value={draft.summary} onChange={(e) => update("summary", e.target.value)} /></label>
        <label className="span-2"><span>Offer terms & context</span><textarea rows={3} value={draft.offerDetails} onChange={(e) => update("offerDetails", e.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="admin-form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-lime" type="submit"><Save size={15} /> Save firm</button></div>
    </form>
  </Modal>;
}
