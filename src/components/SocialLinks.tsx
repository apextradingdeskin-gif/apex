import { Mail } from "lucide-react";
import { contact } from "../data/contact";
import { useAccount } from "../context/AccountContext";

export function XIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.9l-5.4-7.06L4.5 22H1.24l8.02-9.17L0 2h7.08l4.88 6.45L18.244 2Zm-1.21 18h1.8L7.04 3.9H5.1L17.034 20Z" /></svg>;
}
export function DiscordIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.44 2.9a13.9 13.9 0 0 0-.63 1.29 18.3 18.3 0 0 0-5.6 0A13 13 0 0 0 8.56 2.9a19.7 19.7 0 0 0-4.89 1.5C.57 9.05-.27 13.6.15 18.07a19.9 19.9 0 0 0 6 3.03c.49-.66.92-1.37 1.29-2.1a12.9 12.9 0 0 1-2.03-.98l.5-.4a14.2 14.2 0 0 0 12.19 0l.5.4c-.65.38-1.33.71-2.04.98.37.73.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6-3.03c.5-5.18-.84-9.68-3.53-13.7ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z" /></svg>;
}
export function InstagramIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

export default function SocialLinks({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { platformSettings } = useAccount();
  const socialLinks = [
    { id: "x", label: "X (Twitter)", handle: platformSettings.socialX.replace(/^https?:\/\/(www\.)?/, ""), href: platformSettings.socialX, Icon: XIcon },
    { id: "discord", label: "Discord", handle: "Join the community", href: platformSettings.socialDiscord, Icon: DiscordIcon },
    { id: "instagram", label: "Instagram", handle: platformSettings.socialInstagram.replace(/^https?:\/\/(www\.)?/, ""), href: platformSettings.socialInstagram, Icon: InstagramIcon },
    { id: "email", label: "Email", handle: platformSettings.supportEmail || contact.email, href: `mailto:${platformSettings.supportEmail || contact.email}`, Icon: ({ size = 16 }: { size?: number }) => <Mail size={size} /> },
  ];
  return (
    <div className={`social-links ${compact ? "compact" : ""} ${className}`}>
      {socialLinks.map(({ id, label, handle, href, Icon }) => (
        <a key={id} href={href} target={id === "email" ? undefined : "_blank"} rel={id === "email" ? undefined : "noreferrer"} aria-label={label} title={label}>
          <span className="social-icon"><Icon size={16} /></span>
          {!compact && <span className="social-text"><strong>{label}</strong><small>{handle}</small></span>}
        </a>
      ))}
    </div>
  );
}
