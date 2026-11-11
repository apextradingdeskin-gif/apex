import { firms as seedFirms, getCashbackRate, type Firm } from "../data/firms";
let firms = seedFirms;
import { rewardCatalog } from "../data/rewards";
import { contact } from "../data/contact";
import type { CashbackBalance, PublicUser, Purchase } from "../context/AccountContext";

export type AssistantAction =
  | { type: "link"; label: string; href: string; external?: boolean }
  | { type: "event"; label: string; event: "auth" | "purchase" | "review" | "human" };

export type AssistantReply = {
  text: string;
  actions?: AssistantAction[];
  suggestions?: string[];
  confidence: "high" | "medium" | "low";
};

export type AssistantContext = {
  user: PublicUser | null;
  purchases: Purchase[];
  credits: { pending: number; available: number; spent: number; lifetime: number };
  firms?: Firm[];
  minPayout?: number;
  cashback?: CashbackBalance;
  creditRate?: number;
};

const normalize = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9$%./:+\s-]/g, " ").replace(/\s+/g, " ").trim();

const money = (value: number) => `$${value.toFixed(2)}`;

const firmAliases: Record<string, string[]> = {
  "shark-funded": ["shark", "sharkfunded"],
  "the5ers": ["5ers", "the5ers", "five percenters", "5%ers"],
  "e8-markets": ["e8", "e8 markets", "e8markets"],
  "fundingpips": ["fundingpips", "funding pips", "fp"],
  "atlas-funded": ["atlas"],
  "funded-trader-markets": ["ftm", "funded trader markets", "funded trader market"],
  "aquafunded": ["aqua", "aquafunded", "aqua funded"],
  "alpine-funded": ["alpine"],
  "funding-traders": ["funding traders", "fundingtraders"],
  "fundednext": ["fundednext", "funded next", "fn"],
  "funded-trading-plus": ["funded trading plus", "ft+", "ftplus", "fundedtradingplus"],
  "tradeify": ["tradeify"],
};

function findFirms(query: string): Firm[] {
  const found: Firm[] = [];
  for (const firm of firms) {
    const aliases = [firm.name.toLowerCase(), ...(firmAliases[firm.id] ?? [])];
    if (aliases.some((alias) => alias.length > 2 && new RegExp(`(^|\\s)${alias.replace(/[+.]/g, "\\$&")}(\\s|$)`).test(query))) {
      found.push(firm);
    }
  }
  return found;
}

function firmSummary(firm: Firm) {
  return [
    `**${firm.name}** (${firm.market}, ${firm.country}, since ${firm.founded})`,
    `• Max allocation: ${firm.allocationLabel} · Profit split: ${firm.profitSplit}`,
    `• Leverage: ${firm.leverage} · Max drawdown: ${firm.drawdown}`,
    `• Payouts: ${firm.payout} · Platforms: ${firm.platforms.join(", ")}`,
    `• Models: ${firm.models.join(", ")}`,
    `• APEX cashback: ${getCashbackRate(firm.id)}%${firm.code ? ` · Listed code: ${firm.code}` : ""}`,
    `• Rating: ${firm.rating}/5 from ${firm.reviews.toLocaleString()} reviews`,
  ].join("\n");
}

function compareFirms(list: Firm[]) {
  const rows: [string, (firm: Firm) => string][] = [
    ["Market", (firm) => firm.market],
    ["Max allocation", (firm) => firm.allocationLabel],
    ["Profit split", (firm) => firm.profitSplit],
    ["Leverage", (firm) => firm.leverage],
    ["Max drawdown", (firm) => firm.drawdown],
    ["Payouts", (firm) => firm.payout],
    ["Platforms", (firm) => firm.platforms.join(", ")],
    ["APEX cashback", (firm) => `${getCashbackRate(firm.id)}%`],
    ["Rating", (firm) => `${firm.rating}/5`],
  ];
  return [
    `Here's **${list.map((firm) => firm.name).join(" vs ")}** side by side:`,
    ...rows.map(([label, getter]) => `• ${label}: ${list.map((firm) => `${firm.name.split(" ")[0]} ${getter(firm)}`).join(" · ")}`),
    "",
    "The headline numbers matter less than how each firm calculates drawdown and consistency for the exact model you'd buy. Open each firm in the directory and confirm on their official site before purchasing.",
  ].join("\n");
}

type Intent = {
  id: string;
  keywords: string[];
  phrases?: string[];
  weight?: number;
  reply: (query: string, ctx: AssistantContext, matchedFirms: Firm[]) => AssistantReply;
};

const humanHandoff = (): AssistantAction[] => [
  ...(contact.discord ? [{ type: "link" as const, label: "Join Discord", href: contact.discord, external: true }] : []),
  { type: "event", label: "Email the team", event: "human" },
];

const intents: Intent[] = [
  {
    id: "purchase-attribution",
    keywords: ["webhook", "attribution", "affiliate", "conversion", "detect", "tracking", "proof", "partner"],
    phrases: ["know someone purchased", "know if someone", "confirm a purchase", "track code purchases", "track my link"],
    reply: (_query, ctx) => ({
      confidence: "high",
      text: "A click or shared coupon is not purchase proof. APEX records unique link activations, member-submitted order claims, and actual partner sale receipts separately. Partner receipts come from a signed webhook or an affiliate report checked by an administrator. Click IDs, member codes or checkout emails link a sale to a member; unmatched sales need manual reconciliation. Automatic detection requires the actual firm or affiliate provider to connect its reporting to APEX. No reward is approved just because a link was clicked.",
      actions: ctx.user?.role === "admin" ? [{ type: "link", label: "Open purchase attribution", href: "#admin/attribution" }] : [{ type: "event", label: "Submit my order", event: "purchase" }],
    }),
  },
  {
    id: "greeting",
    keywords: ["hi", "hello", "hey", "yo", "morning", "evening", "sup", "help"],
    phrases: ["good morning", "good evening", "need help"],
    weight: 1,
    reply: (_q, ctx) => ({
      confidence: "high",
      text: `Hi${ctx.user ? ` ${ctx.user.name.split(" ")[0]}` : ""}! I'm APEX Assist, the automated helper for APEX TRADING. I can explain cashback and credits, pull up any firm in our directory, compare two firms, or point you to the right tool. What do you need?`,
      suggestions: ["How does cashback work?", "Which firm has the best cashback?", "Compare FundingPips vs FundedNext", "Talk to a human"],
    }),
  },
  {
    id: "thanks",
    keywords: ["thanks", "thank", "thx", "cheers", "appreciate"],
    weight: 0.7,
    reply: () => ({ confidence: "high", text: "You're welcome! If anything else comes up, I'm right here. Good luck with the challenge.", suggestions: ["Show me the trader toolkit", "Join the Discord"] }),
  },
  {
    id: "human",
    keywords: ["human", "agent", "person", "team", "staff", "someone", "real", "support", "contact", "email", "discord", "reach", "talk", "speak", "complaint", "escalate"],
    phrases: ["talk to a human", "real person", "contact support", "speak to someone", "customer service"],
    reply: () => ({
      confidence: "high",
      text: `For account-specific issues (payouts, verification or disputes), email **${contact.email}** and include your Member ID from the dashboard settings page. You can also use the enabled community links below. I can pre-fill an email with this conversation for you.`,
      actions: humanHandoff(),
    }),
  },
  {
    id: "social",
    keywords: ["twitter", "instagram", "insta", "ig", "social", "follow", "x.com", "channel", "community"],
    reply: () => ({
      confidence: "high",
      text: ["You can find APEX here:", contact.x ? `X: ${contact.xHandle}` : "", contact.instagram ? `Instagram: ${contact.instagramHandle}` : "", contact.discord ? "Discord: community server" : "", `Email: ${contact.email}`].filter(Boolean).join("\n"),
      actions: [
        ...(contact.x ? [{ type: "link" as const, label: "X", href: contact.x, external: true }] : []),
        ...(contact.instagram ? [{ type: "link" as const, label: "Instagram", href: contact.instagram, external: true }] : []),
        ...(contact.discord ? [{ type: "link" as const, label: "Discord", href: contact.discord, external: true }] : []),
      ],
    }),
  },
  {
    id: "cashback-how",
    keywords: ["cashback", "cash", "back", "rebate", "earn", "reward", "rewards", "work", "works", "how"],
    phrases: ["how does cashback", "cashback work", "how do i earn", "get cashback", "how to earn"],
    reply: (_query, ctx) => ({
      confidence: "high",
      text: `Cashback in four steps:\n1. **Activate** a firm's offer from your APEX account. We record a unique referral click, not a completed purchase.\n2. **Purchase** through the actual partner link or eligible code.\n3. **Verify** your order using the partner's sale report or submit your order details for review.\n4. **Get rewarded** once approved. You also earn ${ctx.creditRate ?? 1} APEX Credits per $1 of eligible net spend at the published rate.\n\nCashback rates are shown per firm. Refunded, duplicate or untracked orders may not qualify.`,
      actions: [{ type: "link", label: "See cashback rates", href: "#cashback" }, { type: "event", label: "Track a purchase", event: "purchase" }],
      suggestions: ["Which firm has the best cashback?", "When can I withdraw?", "What are APEX Credits?"],
    }),
  },
  {
    id: "cashback-best",
    keywords: ["best", "highest", "most", "top", "maximum", "max", "cashback", "rate", "rates", "percent"],
    phrases: ["best cashback", "highest cashback", "most cashback", "cashback rates", "which firm has the best"],
    reply: () => {
      const ranked = [...firms].sort((a, b) => getCashbackRate(b.id) - getCashbackRate(a.id)).slice(0, 5);
      return {
        confidence: "high",
        text: `Current top APEX cashback rates:\n${ranked.map((firm, index) => `${index + 1}. **${firm.name}** — ${getCashbackRate(firm.id)}%${firm.code ? ` (code ${firm.code})` : ""}`).join("\n")}\n\nA higher rate shouldn't outweigh rule fit, though. Check drawdown type and payout terms first, then let cashback be the tiebreaker.`,
        actions: [{ type: "link", label: "Open the rewards section", href: "#cashback" }],
        suggestions: ["Tell me about Shark Funded", "How does cashback work?"],
      };
    },
  },
  {
    id: "withdraw",
    keywords: ["withdraw", "withdrawal", "payout", "paid", "threshold", "minimum", "when", "receive", "money", "cash out", "balance"],
    phrases: ["when can i withdraw", "payout threshold", "cash out", "get paid"],
    reply: (_q, ctx) => {
      const approved = ctx.cashback?.available ?? ctx.purchases.filter((purchase) => purchase.status === "approved").reduce((sum, purchase) => sum + purchase.cashbackAmount, 0);
      const pending = ctx.purchases.filter((purchase) => purchase.status === "pending").reduce((sum, purchase) => sum + purchase.cashbackAmount, 0);
      const threshold = ctx.minPayout ?? 25;
      const personal = ctx.user
        ? `\n\nYour account right now: **${money(approved)} available** and ${money(pending)} pending. ${approved >= threshold ? "You've met the threshold — use *Request payout* in the Cashback tab." : `You need ${money(Math.max(0, threshold - approved))} more approved cashback to reach the threshold.`}`
        : "\n\nLog in and I can tell you exactly where your balance stands.";
      return {
        confidence: "high",
        text: `Only **approved** cashback counts toward withdrawals, with a **${money(threshold)} minimum** payout threshold. Pending amounts are waiting on purchase verification. Once you're over ${money(threshold)}, use *Request payout* in your dashboard's Cashback tab to submit a request inside APEX. You can follow requested, processing and paid statuses in the dashboard. Requested funds are reserved until the request is paid, rejected or cancelled.${personal}`,
        actions: ctx.user ? [{ type: "link", label: "Open Cashback tab", href: "#dashboard" }] : [{ type: "event", label: "Log in", event: "auth" }],
      };
    },
  },
  {
    id: "status",
    keywords: ["status", "pending", "approved", "verified", "verification", "my", "order", "orders", "purchase", "purchases", "submitted", "where", "long", "take"],
    phrases: ["my purchase", "my order", "how long", "still pending", "order status", "check status"],
    reply: (_q, ctx) => {
      if (!ctx.user) return { confidence: "medium", text: "To check a purchase I need you logged in — your orders are private to your account. Once you're in, ask me again and I'll summarise them.", actions: [{ type: "event", label: "Log in or sign up", event: "auth" }] };
      if (ctx.purchases.length === 0) return { confidence: "high", text: "You haven't submitted any purchases yet. After you buy through an APEX link or code, add the order ID and net amount and I'll track it for you.", actions: [{ type: "event", label: "Track a purchase", event: "purchase" }] };
      const lines = ctx.purchases.slice(0, 5).map((purchase) => {
        const firm = firms.find((item) => item.id === purchase.firmId);
        return `• ${firm?.name ?? "Firm"} #${purchase.orderId} — ${money(purchase.amount)} → ${money(purchase.cashbackAmount)} cashback · **${purchase.status}**`;
      });
      const pendingCount = ctx.purchases.filter((purchase) => purchase.status === "pending").length;
      return {
        confidence: "high",
        text: `Here are your latest purchases:\n${lines.join("\n")}${ctx.purchases.length > 5 ? `\n…and ${ctx.purchases.length - 5} more in your dashboard.` : ""}\n\n${pendingCount ? `${pendingCount} order${pendingCount > 1 ? "s are" : " is"} pending verification. Verification normally completes within a few business days once the firm confirms attribution; if an order has been pending for more than 7 days, email the team with the order ID.` : "Nothing is waiting on verification right now."}`,
        actions: [{ type: "link", label: "Open Purchases", href: "#dashboard" }, { type: "event", label: "Email the team", event: "human" }],
      };
    },
  },
  {
    id: "credits",
    keywords: ["credit", "credits", "points", "marketplace", "redeem", "redemption", "spend", "gift", "card", "voucher", "shop", "store"],
    phrases: ["apex credits", "what are credits", "how do credits work", "redeem credits"],
    reply: (_q, ctx) => {
      const cheapest = [...rewardCatalog].sort((a, b) => a.cost - b.cost)[0];
      const personal = ctx.user ? `\n\nYou currently have **${ctx.credits.available.toLocaleString()} spendable credits** (${ctx.credits.pending.toLocaleString()} pending). ${ctx.credits.available >= cheapest.cost ? `That's enough for the ${cheapest.name}.` : `The entry-level reward (${cheapest.name}) costs ${cheapest.cost.toLocaleString()}.`}` : "";
      return {
        confidence: "high",
        text: `**APEX Credits** are earned alongside cashback: 1 credit for every $1 of eligible net spend you submit. Credits stay pending until the purchase is approved, then become spendable in the Marketplace on challenge credits, trader tools, gift cards and experiences. Credits have no cash value and can't be transferred.${personal}`,
        actions: [{ type: "link", label: "Browse the Marketplace", href: "#marketplace" }],
        suggestions: ["What can I redeem?", "How does cashback work?"],
      };
    },
  },
  {
    id: "catalog",
    keywords: ["what", "can", "redeem", "catalog", "catalogue", "items", "available", "rewards", "prizes", "list"],
    phrases: ["what can i redeem", "what rewards", "what's in the marketplace", "list rewards"],
    reply: () => ({
      confidence: "high",
      text: `The Marketplace currently lists ${rewardCatalog.length} rewards across four categories:\n${["Challenges", "Tools", "Gift cards", "Experiences"].map((category) => `• **${category}**: ${rewardCatalog.filter((item) => item.category === category).map((item) => `${item.name} (${item.cost.toLocaleString()})`).join(", ")}`).join("\n")}\n\nNote: redemptions are saved to your account as requests until the APEX team confirms availability and fulfilment.`,
      actions: [{ type: "link", label: "Open the Marketplace", href: "#marketplace" }],
    }),
  },
  {
    id: "code",
    keywords: ["code", "coupon", "promo", "discount", "voucher", "offer", "deal"],
    reply: (_q, _ctx, matched) => {
      if (matched.length) {
        const firm = matched[0];
        return { confidence: "high", text: firm.code ? `For **${firm.name}** the listed code is **${firm.code}** (${firm.promo}). ${firm.offerDetails}` : `**${firm.name}** doesn't have a listed code right now — cashback is tracked through the activated link instead (${getCashbackRate(firm.id)}% back). ${firm.offerDetails}`, actions: [{ type: "link", label: `Open ${firm.name}`, href: `#firm-${firm.id}` }] };
      }
      const withCodes = firms.filter((firm) => firm.code);
      return { confidence: "medium", text: `${withCodes.length} firms currently have a listed code:\n${withCodes.map((firm) => `• ${firm.name} — **${firm.code}** (${firm.promo})`).join("\n")}\n\nTell me a firm name and I'll give you its full offer details. Codes change often, so always confirm at checkout.`, actions: [{ type: "link", label: "See the offer desk", href: "#offers" }] };
    },
  },
  {
    id: "compare",
    keywords: ["compare", "vs", "versus", "difference", "better", "or", "between"],
    weight: 1.2,
    reply: (_q, _ctx, matched) => {
      if (matched.length >= 2) return { confidence: "high", text: compareFirms(matched.slice(0, 3)), actions: matched.slice(0, 3).map((firm) => ({ type: "link" as const, label: firm.name, href: `#firm-${firm.id}` })) };
      if (matched.length === 1) return { confidence: "medium", text: `I found **${matched[0].name}** — which firm would you like to compare it with? You can also tick up to three firms in the directory and use the compare tray.`, suggestions: firms.filter((firm) => firm.id !== matched[0].id).slice(0, 3).map((firm) => `Compare ${matched[0].name} vs ${firm.name}`) };
      return { confidence: "medium", text: "Name two firms and I'll compare them — for example *\"Compare FundingPips vs FundedNext\"*. Or use the directory: tick up to three firms and open the compare tray.", actions: [{ type: "link", label: "Open the directory", href: "#top-prop-firms-section" }] };
    },
  },
  {
    id: "firm-info",
    keywords: ["about", "tell", "info", "information", "details", "review", "legit", "trust", "trusted", "good", "safe", "scam", "drawdown", "leverage", "split", "payout", "platform", "platforms", "allocation", "rules"],
    weight: 0.9,
    reply: (query, _ctx, matched) => {
      if (matched.length === 1) {
        const firm = matched[0];
        const trustNote = /legit|trust|safe|scam|good/.test(query) ? `\n\nOn trust: ${firm.verified ? "it's listed and reviewed in our directory" : "it's listed but not yet marked as reviewed by APEX"}, with a ${firm.rating}/5 community rating. We don't guarantee any firm — read recent trader reviews, test support, and start with a size you can afford to lose.` : "";
        return { confidence: "high", text: `${firmSummary(firm)}\n\n${firm.summary}${trustNote}`, actions: [{ type: "link", label: `Open ${firm.name}`, href: `#firm-${firm.id}` }, { type: "event", label: "Write a review", event: "review" }] };
      }
      if (matched.length > 1) return { confidence: "high", text: compareFirms(matched.slice(0, 3)) };
      return { confidence: "low", text: `Which firm are you asking about? I have details on ${firms.length} firms: ${firms.map((firm) => firm.name).join(", ")}.`, suggestions: ["Tell me about FundingPips", "Is The5ers legit?", "Shark Funded drawdown rules"] };
    },
  },
  {
    id: "beginner",
    keywords: ["beginner", "beginners", "new", "start", "started", "first", "newbie", "recommend", "recommendation", "suggest", "which", "choose", "pick"],
    phrases: ["best prop firm", "which firm should", "where do i start", "for beginners", "recommend a firm"],
    reply: () => ({
      confidence: "medium",
      text: "There's no single best firm — it depends on your strategy, platform and how much rule pressure you can handle. For a first challenge, most traders do better with:\n• **Simple, static drawdown** rather than trailing\n• **No hard consistency rule**\n• A platform you already know (MT5, cTrader, etc.)\n• A fee you can afford to lose twice\n\nUse the directory filters for your platform, shortlist two or three, then run the numbers in the **Challenge planner** tool before paying. I'm not a financial adviser, so treat this as a research framework, not a recommendation.",
      actions: [{ type: "link", label: "Open the directory", href: "#top-prop-firms-section" }, { type: "link", label: "Challenge planner", href: "#tools" }],
      suggestions: ["Compare The5ers vs FundingPips", "Which firm has the best cashback?"],
    }),
  },
  {
    id: "tools",
    keywords: ["calculator", "calculate", "tool", "tools", "toolkit", "position", "size", "lot", "lots", "pip", "risk", "ratio", "planner"],
    phrases: ["position size", "risk reward", "lot size", "how many lots"],
    reply: () => ({
      confidence: "high",
      text: "The free **Trader Toolkit** has three calculators that run in your browser:\n• **Position size** — lots from balance, risk % and stop distance\n• **Challenge planner** — trades needed to hit target and how many losses breach drawdown\n• **Risk : reward** — ratio and break-even win rate from your entry, stop and target\n\nNothing is saved or sent anywhere.",
      actions: [{ type: "link", label: "Open the toolkit", href: "#tools" }],
    }),
  },
  {
    id: "account",
    keywords: ["account", "sign", "signup", "register", "login", "log", "password", "forgot", "reset", "delete", "profile", "name", "change"],
    phrases: ["sign up", "log in", "create account", "forgot password", "reset password", "delete account"],
    reply: (query, ctx) => {
      if (/forgot|reset|password/.test(query)) return { confidence: "high", text: `Your account is stored on the server. Automated password-reset email is not enabled yet. If you're locked out, email **${contact.email}** from the address you registered with and the team will help. For security, the team must verify account ownership before arranging a reset.`, actions: humanHandoff() };
      if (/delete/.test(query)) return { confidence: "high", text: `To delete your account and data, email **${contact.email}** with the subject "Delete my APEX account" from your registered address. Clearing your browser does not delete your server account or order history.`, actions: [{ type: "event", label: "Email the team", event: "human" }] };
      if (ctx.user) return { confidence: "high", text: `You're logged in as **${ctx.user.name}** (${ctx.user.email}). You can update your display name and copy your referral code (${ctx.user.referralCode}) in Dashboard → Settings.`, actions: [{ type: "link", label: "Open Settings", href: "#dashboard" }] };
      return { confidence: "high", text: "Creating an account is free and takes a few seconds — name, email and a password of 8+ characters. It unlocks cashback tracking, APEX Credits, the Marketplace and reviews.", actions: [{ type: "event", label: "Create account / log in", event: "auth" }] };
    },
  },
  {
    id: "referral",
    keywords: ["referral", "refer", "invite", "friend", "link", "share"],
    reply: (_q, ctx) => ({
      confidence: "high",
      text: ctx.user ? `Your referral code is **${ctx.user.referralCode}**. Copy your invite link from Dashboard → Settings and share it — new members who sign up through it are attached to your account. Referral attribution is recorded by APEX. Any referral bonus is subject to the applicable offer and team verification.` : "Every member gets a personal referral code and invite link in Dashboard → Settings. Create an account to get yours.",
      actions: ctx.user ? [{ type: "link", label: "Open Settings", href: "#dashboard" }] : [{ type: "event", label: "Create account", event: "auth" }],
    }),
  },
  {
    id: "review",
    keywords: ["review", "reviews", "write", "rate", "rating", "feedback", "experience", "testimonial"],
    phrases: ["write a review", "leave a review", "leave feedback"],
    reply: () => ({ confidence: "high", text: "You can publish a review for any listed firm — rating, account model, a headline and at least 40 characters of detail. Reviews matched to a purchase you've submitted get a *Purchase submitted* label. You can edit or delete your reviews from the dashboard.", actions: [{ type: "event", label: "Write a review", event: "review" }, { type: "link", label: "Read community reviews", href: "#community-reviews" }] }),
  },
  {
    id: "advice",
    keywords: ["should", "buy", "invest", "profit", "guaranteed", "guarantee", "pass", "win", "signals", "signal", "advice", "make money"],
    phrases: ["will i pass", "guaranteed profit", "should i buy", "trading signals", "make money"],
    weight: 0.8,
    reply: () => ({ confidence: "medium", text: "I can't tell you whether to buy a challenge or predict if you'll pass — APEX is a research and rewards platform, not a financial adviser, and we don't sell signals. What I can do is show you a firm's rules, compare options, and help you size risk with the toolkit so the decision is yours and informed. Trading leveraged products carries real risk of loss.", actions: [{ type: "link", label: "Challenge planner", href: "#tools" }, { type: "link", label: "Our methodology", href: "#methodology" }] }),
  },
  {
    id: "what-is-apex",
    keywords: ["apex", "what", "is", "this", "site", "website", "do", "you", "platform", "legit"],
    phrases: ["what is apex", "what is this", "what do you do", "is apex legit", "how does apex make money"],
    reply: () => ({ confidence: "medium", text: "**APEX TRADING** is an independent prop-firm comparison and rewards platform. We list firms with their rules, payouts and platforms; you earn cashback and APEX Credits when you buy through our tracked links or codes; and the community shares reviews. We earn an affiliate commission from firms when you buy through us, and we share part of that back with you as cashback. We're not a broker, don't hold your funds, and don't give financial advice.", actions: [{ type: "link", label: "Why APEX", href: "#about" }], suggestions: ["How does cashback work?", "Which firm has the best cashback?"] }),
  },
];

const fallbackSuggestions = ["How does cashback work?", "Which firm has the best cashback?", "What are APEX Credits?", "Talk to a human"];

export function answerQuestion(rawQuery: string, ctx: AssistantContext): AssistantReply {
  if (ctx.firms) firms = ctx.firms.filter((firm) => firm.status !== "archived");
  const query = normalize(rawQuery);
  if (!query) return { confidence: "low", text: "Ask me anything about APEX — cashback, credits, a specific firm, or where to find something.", suggestions: fallbackSuggestions };

  const matchedFirms = findFirms(query);
  const tokens = new Set(query.split(" "));

  let best: { intent: Intent; score: number } | null = null;
  for (const intent of intents) {
    let score = 0;
    for (const phrase of intent.phrases ?? []) if (query.includes(phrase)) score += 3;
    for (const keyword of intent.keywords) if (tokens.has(keyword)) score += 1;
    score *= intent.weight ?? 1;
    if (intent.id === "compare" && matchedFirms.length >= 2) score += 4;
    if (intent.id === "firm-info" && matchedFirms.length >= 1) score += 2.5;
    if (intent.id === "code" && matchedFirms.length >= 1 && /code|coupon|promo|discount/.test(query)) score += 3;
    if (score > (best?.score ?? 0)) best = { intent, score };
  }

  // A pure greeting should never be outscored by incidental keyword overlap.
  if (tokens.size <= 2 && [...tokens].every((token) => ["hi", "hello", "hey", "yo", "sup", "there", "apex"].includes(token))) {
    return intents[0].reply(query, ctx, matchedFirms);
  }

  if (best && best.score >= 1) {
    const reply = best.intent.reply(query, ctx, matchedFirms);
    if (best.score < 2 && reply.confidence === "high") reply.confidence = "medium";
    return reply;
  }

  if (matchedFirms.length === 1) return { confidence: "medium", text: `${firmSummary(matchedFirms[0])}\n\n${matchedFirms[0].summary}`, actions: [{ type: "link", label: `Open ${matchedFirms[0].name}`, href: `#firm-${matchedFirms[0].id}` }] };

  return {
    confidence: "low",
    text: "I'm not sure I understood that. I'm an automated assistant trained on APEX's own help content, so I'm best at questions about cashback, credits, the marketplace, our listed firms and the tools. For anything else — or if you'd rather talk to a person — the team is on Discord and email.",
    actions: humanHandoff(),
    suggestions: fallbackSuggestions,
  };
}
