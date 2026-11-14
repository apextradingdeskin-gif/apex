import { cashbackRateFor, firms as seedFirms, type Firm } from "../data/firms";
let firms = seedFirms;
import { rewardCatalog } from "../data/rewards";
import { contact } from "../data/contact";
import type { PayoutRequest, PublicUser, Purchase } from "../context/AccountContext";

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
  payoutRequests: PayoutRequest[];
  payoutMethods: string[];
  firms?: Firm[];
  minPayout?: number;
  social?: { socialX: string; socialDiscord: string; socialInstagram: string; supportEmail: string };
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
    `• PropApex cashback: ${cashbackRateFor(firm)}%${firm.code ? ` · Listed code: ${firm.code}` : ""}`,
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
    ["PropApex cashback", (firm) => `${cashbackRateFor(firm)}%`],
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

const humanHandoff = (ctx: AssistantContext): AssistantAction[] => [
  { type: "link", label: "Join Discord", href: ctx.social?.socialDiscord || contact.discord, external: true },
  { type: "event", label: "Email the team", event: "human" },
];

const intents: Intent[] = [
  {
    id: "greeting",
    keywords: ["hi", "hello", "hey", "yo", "morning", "evening", "sup", "help"],
    phrases: ["good morning", "good evening", "need help"],
    weight: 1,
    reply: (_q, ctx) => ({
      confidence: "high",
      text: `Hi${ctx.user ? ` ${ctx.user.name.split(" ")[0]}` : ""}! I'm PropApex Assist, the automated helper for PropApex TRADING. I can explain cashback and credits, pull up any firm in our directory, compare two firms, or point you to the right tool. What do you need?`,
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
    reply: (_query, ctx) => ({
      confidence: "high",
      text: `No problem. The fastest route is our Discord, where the team and other traders are active. For account-specific issues (payouts, verification, disputes) email **${ctx.social?.supportEmail || contact.email}** and include your Member ID from the dashboard settings page. I can pre-fill an email with this conversation for you.`,
      actions: humanHandoff(ctx),
    }),
  },
  {
    id: "social",
    keywords: ["twitter", "instagram", "insta", "ig", "social", "follow", "x.com", "channel", "community"],
    reply: (_query, ctx) => ({
      confidence: "high",
      text: `You can find PropApex here:\n• X: ${ctx.social?.socialX || contact.x}\n• Instagram: ${ctx.social?.socialInstagram || contact.instagram}\n• Discord: community server\n• Email: ${ctx.social?.supportEmail || contact.email}`,
      actions: [
        { type: "link", label: "X", href: ctx.social?.socialX || contact.x, external: true },
        { type: "link", label: "Instagram", href: ctx.social?.socialInstagram || contact.instagram, external: true },
        { type: "link", label: "Discord", href: ctx.social?.socialDiscord || contact.discord, external: true },
      ],
    }),
  },
  {
    id: "affiliate-attribution",
    keywords: ["purchase", "purchased", "bought", "conversion", "conversions", "attribution", "affiliate", "link", "code", "confirm", "confirmation", "know", "sold"],
    phrases: ["how will i know", "someone purchased", "someone bought", "purchase through my link", "purchase with my code", "affiliate conversion", "track a sale"],
    weight: 1.3,
    reply: (_query, ctx) => ({
      confidence: "high",
      text: `PropApex creates a unique click ID when a member activates an enabled firm's PropApex link. A real purchase confirmation appears in the admin **Affiliate conversions** panel only if that firm or its affiliate network sends PropApex a signed server-to-server postback containing the click ID (or a matching PropApex code and order ID). A visit or a user-entered order is not proof of a sale. Some firms do not support postbacks, so their orders need manual verification.\n\n${ctx.user ? "You can follow your own submitted order in Dashboard → Purchases." : "Members can submit an order in their dashboard; it stays pending until verified."}`,
      actions: [{ type: "link", label: "Open firm offers", href: "#top-prop-firms-section" }, { type: "link", label: "Cashback details", href: "#cashback" }],
    }),
  },
  {
    id: "cashback-how",
    keywords: ["cashback", "cash", "back", "rebate", "earn", "reward", "rewards", "work", "works", "how"],
    phrases: ["how does cashback", "cashback work", "how do i earn", "get cashback", "how to earn"],
    reply: () => ({
      confidence: "high",
      text: "Cashback in four steps:\n1. **Activate** a firm's offer from your PropApex account (we save the referral click).\n2. **Purchase** on the firm's official site through the tracked link or listed code.\n3. **Submit** the order ID, date and net amount in your dashboard.\n4. **Get rewarded** once the order is verified — cashback moves from pending to available, and you also earn 1 PropApex Credit per $1 of net spend.\n\nRates range from 3% to 8% depending on the firm. Refunded, duplicate or untracked orders may not qualify.",
      actions: [{ type: "link", label: "See cashback rates", href: "#cashback" }, { type: "event", label: "Track a purchase", event: "purchase" }],
      suggestions: ["Which firm has the best cashback?", "When can I withdraw?", "What are PropApex Credits?"],
    }),
  },
  {
    id: "cashback-best",
    keywords: ["best", "highest", "most", "top", "maximum", "max", "cashback", "rate", "rates", "percent"],
    phrases: ["best cashback", "highest cashback", "most cashback", "cashback rates", "which firm has the best"],
    reply: () => {
      const ranked = [...firms].sort((a, b) => cashbackRateFor(b) - cashbackRateFor(a)).slice(0, 5);
      return {
        confidence: "high",
        text: `Current top PropApex cashback rates:\n${ranked.map((firm, index) => `${index + 1}. **${firm.name}** — ${cashbackRateFor(firm)}%${firm.code ? ` (code ${firm.code})` : ""}`).join("\n")}\n\nA higher rate shouldn't outweigh rule fit, though. Check drawdown type and payout terms first, then let cashback be the tiebreaker.`,
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
      const approved = ctx.purchases.filter((purchase) => purchase.status === "approved").reduce((sum, purchase) => sum + purchase.cashbackAmount, 0);
      const reserved = ctx.payoutRequests.filter((request) => ["requested", "processing", "paid"].includes(request.status)).reduce((sum, request) => sum + request.amount, 0);
      const available = Math.max(0, approved - reserved);
      const pending = ctx.purchases.filter((purchase) => purchase.status === "pending").reduce((sum, purchase) => sum + purchase.cashbackAmount, 0);
      const threshold = ctx.minPayout ?? 25;
      const latestRequest = ctx.payoutRequests[0];
      const personal = ctx.user
        ? `\n\nYour account right now: **${money(available)} available**, ${money(reserved)} reserved for payout, and ${money(pending)} pending purchase verification.${latestRequest ? ` Your latest payout request is **${latestRequest.status}** for ${money(latestRequest.amount)}.` : ""} ${available >= threshold ? "You've met the threshold — request a payout from Dashboard → Cashback." : `You need ${money(Math.max(0, threshold - available))} more available cashback to reach the threshold.`}`
        : "\n\nLog in and I can tell you exactly where your balance stands.";
      return {
        confidence: "high",
        text: `Only **available** cashback can be requested. The minimum is **${money(threshold)}**. Open Dashboard → Cashback, select *Request payout*, choose one of these methods (${ctx.payoutMethods.join(", ")}), and add the receiving email or wallet reference needed for that method. The request appears in your payout history and the balance is reserved until it is paid, rejected or cancelled.${personal}`,
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
      if (ctx.purchases.length === 0) return { confidence: "high", text: "You haven't submitted any purchases yet. After you buy through an PropApex link or code, add the order ID and net amount and I'll track it for you.", actions: [{ type: "event", label: "Track a purchase", event: "purchase" }] };
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
        text: `**PropApex Credits** are earned alongside cashback: 1 credit for every $1 of eligible net spend you submit. Credits stay pending until the purchase is approved, then become spendable in the Marketplace on challenge credits, trader tools, gift cards and experiences. Credits have no cash value and can't be transferred.${personal}`,
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
      text: `The Marketplace currently lists ${rewardCatalog.length} rewards across four categories:\n${["Challenges", "Tools", "Gift cards", "Experiences"].map((category) => `• **${category}**: ${rewardCatalog.filter((item) => item.category === category).map((item) => `${item.name} (${item.cost.toLocaleString()})`).join(", ")}`).join("\n")}\n\nNote: the catalog is a preview — redemptions are saved as requests until the rewards backend confirms fulfilment.`,
      actions: [{ type: "link", label: "Open the Marketplace", href: "#marketplace" }],
    }),
  },
  {
    id: "code",
    keywords: ["code", "coupon", "promo", "discount", "voucher", "offer", "deal"],
    reply: (_q, _ctx, matched) => {
      if (matched.length) {
        const firm = matched[0];
        return { confidence: "high", text: firm.code ? `For **${firm.name}** the listed code is **${firm.code}** (${firm.promo}). ${firm.offerDetails}` : `**${firm.name}** doesn't have a listed code right now — cashback is tracked through the activated link instead (${cashbackRateFor(firm)}% back). ${firm.offerDetails}`, actions: [{ type: "link", label: `Open ${firm.name}`, href: `#firm-${firm.id}` }] };
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
        const trustNote = /legit|trust|safe|scam|good/.test(query) ? `\n\nOn trust: ${firm.verified ? "it's listed and reviewed in our directory" : "it's listed but not yet marked as reviewed by PropApex"}, with a ${firm.rating}/5 community rating. We don't guarantee any firm — read recent trader reviews, test support, and start with a size you can afford to lose.` : "";
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
      if (/forgot|reset|password/.test(query)) return { confidence: "high", text: `In this preview, accounts are stored only in your browser, so there's no email-based password reset yet. If you're locked out, email **${ctx.social?.supportEmail || contact.email}** from the address you registered with and the team will help. Once the full backend is live, you'll be able to reset directly from the login screen.`, actions: humanHandoff(ctx) };
      if (/delete/.test(query)) return { confidence: "high", text: `To delete your account and data, email **${ctx.social?.supportEmail || contact.email}** with the subject "Delete my PropApex account" from your registered address. Clearing your browser's site data also removes everything stored locally in this preview.`, actions: [{ type: "event", label: "Email the team", event: "human" }] };
      if (ctx.user) return { confidence: "high", text: `You're logged in as **${ctx.user.name}** (${ctx.user.email}). You can update your display name and copy your referral code (${ctx.user.referralCode}) in Dashboard → Settings.`, actions: [{ type: "link", label: "Open Settings", href: "#dashboard" }] };
      return { confidence: "high", text: "Creating an account is free and takes a few seconds — name, email and a password of 8+ characters. It unlocks cashback tracking, PropApex Credits, the Marketplace and reviews.", actions: [{ type: "event", label: "Create account / log in", event: "auth" }] };
    },
  },
  {
    id: "referral",
    keywords: ["referral", "refer", "invite", "friend", "link", "share"],
    reply: (_q, ctx) => ({
      confidence: "high",
      text: ctx.user ? `Your referral code is **${ctx.user.referralCode}**. Copy your invite link from Dashboard → Settings and share it — new members who sign up through it are attached to your account. Referral rewards are confirmed once the rewards backend is connected.` : "Every member gets a personal referral code and invite link in Dashboard → Settings. Create an account to get yours.",
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
    reply: () => ({ confidence: "medium", text: "I can't tell you whether to buy a challenge or predict if you'll pass — PropApex is a research and rewards platform, not a financial adviser, and we don't sell signals. What I can do is show you a firm's rules, compare options, and help you size risk with the toolkit so the decision is yours and informed. Trading leveraged products carries real risk of loss.", actions: [{ type: "link", label: "Challenge planner", href: "#tools" }, { type: "link", label: "Our methodology", href: "#methodology" }] }),
  },
  {
    id: "what-is-apex",
    keywords: ["apex", "what", "is", "this", "site", "website", "do", "you", "platform", "legit"],
    phrases: ["what is apex", "what is this", "what do you do", "is apex legit", "how does apex make money"],
    reply: () => ({ confidence: "medium", text: "**PropApex TRADING** is an independent prop-firm comparison and rewards platform. We list firms with their rules, payouts and platforms; you earn cashback and PropApex Credits when you buy through our tracked links or codes; and the community shares reviews. We earn an affiliate commission from firms when you buy through us, and we share part of that back with you as cashback. We're not a broker, don't hold your funds, and don't give financial advice.", actions: [{ type: "link", label: "Why PropApex", href: "#about" }], suggestions: ["How does cashback work?", "Which firm has the best cashback?"] }),
  },
];

const fallbackSuggestions = ["How does cashback work?", "Which firm has the best cashback?", "What are PropApex Credits?", "Talk to a human"];

export function answerQuestion(rawQuery: string, ctx: AssistantContext): AssistantReply {
  if (ctx.firms) firms = ctx.firms.filter((firm) => firm.status !== "archived");
  const query = normalize(rawQuery);
  if (!query) return { confidence: "low", text: "Ask me anything about PropApex — cashback, credits, a specific firm, or where to find something.", suggestions: fallbackSuggestions };

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
    text: "I'm not sure I understood that. I'm an automated assistant trained on PropApex's own help content, so I'm best at questions about cashback, credits, the marketplace, our listed firms and the tools. For anything else — or if you'd rather talk to a person — the team is on Discord and email.",
    actions: humanHandoff(ctx),
    suggestions: fallbackSuggestions,
  };
}
