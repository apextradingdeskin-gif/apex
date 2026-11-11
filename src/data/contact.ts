export type ContactSettings = { email: string; x: string; discord: string; instagram: string };
export const defaultContact: ContactSettings = {
  email: "apextradingdesk.in@gmail.com",
  x: "https://x.com/apexXtrades",
  discord: "https://discord.gg/fgkSY352aT",
  instagram: "https://www.instagram.com/apexxdesk/",
};
export const contact = { ...defaultContact, xHandle: "@apexXtrades", instagramHandle: "@apexxdesk" };
function handle(url: string) {
  try { const name = new URL(url).pathname.split("/").filter(Boolean)[0]; return name ? `@${name}` : "View profile"; }
  catch { return "View profile"; }
}
export function synchronizeContact(value?: Partial<ContactSettings>) {
  Object.assign(contact, defaultContact, value);
  contact.xHandle = handle(contact.x); contact.instagramHandle = handle(contact.instagram);
}

export const mailto = (subject: string, body?: string) =>
  `mailto:${contact.email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
