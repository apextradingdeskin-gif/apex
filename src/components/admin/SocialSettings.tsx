import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Link2, Mail } from "lucide-react";
import { useAccount } from "../../context/AccountContext";
import { defaultContact, type ContactSettings } from "../../data/contact";
import { DiscordIcon, InstagramIcon, XIcon } from "../SocialLinks";

export default function SocialSettings({ onNotice }: { onNotice: (message: string) => void }) {
  const { platformSettings, updatePlatformSettings } = useAccount();
  const [draft, setDraft] = useState<ContactSettings>(platformSettings.contact ?? defaultContact);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!dirty) setDraft(platformSettings.contact ?? defaultContact); }, [platformSettings.contact, dirty]);
  const fields = [
    { key: "x" as const, label: "X / Twitter profile URL", Icon: XIcon, placeholder: "https://x.com/yourprofile" },
    { key: "instagram" as const, label: "Instagram profile URL", Icon: InstagramIcon, placeholder: "https://www.instagram.com/yourprofile/" },
    { key: "discord" as const, label: "Discord invite URL", Icon: DiscordIcon, placeholder: "https://discord.gg/yourinvite" },
    { key: "email" as const, label: "Support email", Icon: Mail, placeholder: "support@example.com" },
  ];
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    const result = await updatePlatformSettings({ ...platformSettings, contact: draft });
    setSaving(false); if (!result.ok) setError(result.message); else { setDirty(false); onNotice("Social redirects and support email updated across the website."); }
  };
  return <form className="admin-card admin-social-settings" onSubmit={submit}>
    <div className="admin-section-title"><div><h2><Link2 size={18} /> Social media & contact links</h2><p>Update the header, footer, support assistant and community links from one place. Leave a social URL empty to hide it.</p></div></div>
    <div className="social-settings-fields">{fields.map(({ key, label, Icon, placeholder }) => <label key={key}><span><Icon size={14} />{label}</span><div><input type={key === "email" ? "email" : "url"} value={draft[key]} onChange={(event) => { setDirty(true); setDraft({ ...draft, [key]: event.target.value }); }} placeholder={placeholder} required={key === "email"} />{draft[key] && <a aria-label={`Test ${key} link`} href={key === "email" ? `mailto:${draft[key]}` : draft[key]} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /></a>}</div></label>)}</div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="admin-form-actions"><button className="button button-lime" disabled={saving || !dirty} type="submit"><Check size={15} />{saving ? "Saving links..." : "Save social links"}</button></div>
  </form>;
}