export const contact = {
  email: "apextradingdesk.in@gmail.com",
  x: "https://x.com/apexXtrades",
  xHandle: "@apexXtrades",
  discord: "https://discord.gg/fgkSY352aT",
  instagram: "https://www.instagram.com/apexxdesk/",
  instagramHandle: "@apexxdesk",
};

export const mailto = (subject: string, body?: string, email = contact.email) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
