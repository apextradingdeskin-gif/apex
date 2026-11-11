import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ClipboardPaste, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";

async function prepareImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPG or WebP image.");
  if (file.size > 4 * 1024 * 1024) throw new Error("Please choose an image smaller than 4 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 20_000_000) throw new Error("This image is too large. Use an image under 20 megapixels.");
    const ratio = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.9);
  } finally { URL.revokeObjectURL(url); }
}

export default function ImagePicker({ value, onChange, draftKey, label = "Logo image" }: {
  value?: string; onChange: (value: string) => void; draftKey: string; label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [savedDraft, setSavedDraft] = useState("");

  useEffect(() => {
    try { setSavedDraft(localStorage.getItem(draftKey) ?? ""); } catch { setSavedDraft(""); }
  }, [draftKey, value]);

  const select = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const image = await prepareImage(file);
      onChange(image); setSavedDraft(image);
      try { localStorage.setItem(draftKey, image); } catch { setError("Image selected. Your browser cannot save the local draft; save the form before leaving."); }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not read this image."); }
    finally { setBusy(false); }
  };
  const paste = (event: ClipboardEvent) => {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
    if (item) { event.preventDefault(); void select(item.getAsFile() ?? undefined); }
  };
  const readClipboard = async () => {
    if (!navigator.clipboard?.read) { setError("Click this image area and press Ctrl+V (or Cmd+V) to paste your copied image."); return; }
    try {
      const entries = await navigator.clipboard.read();
      for (const entry of entries) {
        const type = entry.types.find((mime) => ["image/png", "image/jpeg", "image/webp"].includes(mime));
        if (type) { const blob = await entry.getType(type); await select(new File([blob], "pasted-logo", { type })); return; }
      }
      setError("No image found. Copy an image (not its address), then paste it here.");
    } catch { setError("Clipboard permission was blocked. Click the image area and press Ctrl+V or Cmd+V instead."); }
  };
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); void select(event.dataTransfer.files[0]); };
  const clear = () => { onChange(""); setSavedDraft(""); setError(""); localStorage.removeItem(draftKey); };

  return <div className="image-picker-field">
    <span className="image-picker-label">{label}</span>
    <div className={`image-picker ${dragging ? "dragging" : ""}`} tabIndex={0} role="group" aria-label={`${label}. Upload, drop or paste an image.`}
      onPaste={paste} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <div className={`image-picker-preview ${value ? "has-image" : ""}`}>
        {busy ? <LoaderCircle className="image-picker-spinner" size={24} /> : value ? <img src={value} alt="Selected logo preview" /> : <ImagePlus size={29} />}
      </div>
      <div className="image-picker-copy"><strong>{value ? "Your logo is ready" : "Choose, drop or paste a logo"}</strong><p>PNG, JPG or WebP, up to 4 MB. Click here and use Ctrl+V / Cmd+V to paste an image.</p>
        <div className="image-picker-actions">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={13} /> Choose image</button>
          <button type="button" onClick={() => void readClipboard()} disabled={busy}><ClipboardPaste size={13} /> Paste image</button>
          {value && <button type="button" onClick={clear} aria-label="Remove logo"><Trash2 size={13} /></button>}
        </div>
      </div>
      <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void select(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {savedDraft && savedDraft !== value && <button className="image-restore-draft" type="button" onClick={() => onChange(savedDraft)}>Restore unsaved image from this device</button>}
    {value?.startsWith("data:image/") && <small className="image-picker-note">Instant preview saved locally. Save this form to upload the logo to your website.</small>}
    {error && <p className="image-picker-error" role="alert">{error}</p>}
  </div>;
}