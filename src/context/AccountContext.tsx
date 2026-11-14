import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firms as seedFirms, type Firm } from "../data/firms";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { contact } from "../data/contact";

export type UserRole = "member" | "admin";
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  referredBy?: string;
  createdAt: string;
  role?: UserRole;
  suspended?: boolean;
};
type StoredUser = PublicUser & { passwordHash: string; salt: string };
export type PurchaseStatus = "pending" | "approved" | "paid" | "rejected";
export type Purchase = {
  id: string; userId: string; firmId: string; orderId: string; amount: number;
  cashbackRate: number; cashbackAmount: number; codeUsed: string; purchaseDate: string;
  createdAt: string; status: PurchaseStatus; notes: string; adminNote?: string; reviewedAt?: string; referralClickId?: string;
};
export type AffiliateConversionStatus = "matched" | "unmatched" | "reviewed" | "rejected";
export type AffiliateConversion = {
  id: string; partnerEventId: string; clickId?: string; userId?: string; firmId: string; purchaseId?: string;
  orderId?: string; purchaseAmount: number; commissionAmount: number; currency: string; source: string;
  status: AffiliateConversionStatus; createdAt: string; payload?: Record<string, unknown>;
};
export type ReviewStatus = "published" | "pending" | "hidden";
export type TraderReview = {
  id: string; userId: string; userName: string; firmId: string; rating: number;
  accountModel: string; title: string; body: string; recommend: boolean;
  createdAt: string; updatedAt?: string; status?: ReviewStatus;
};
export type ReferralClick = { id: string; userId: string; firmId: string; createdAt: string };
export type RedemptionStatus = "requested" | "fulfilled" | "cancelled";
export type Redemption = { id: string; userId: string; itemId: string; itemName: string; cost: number; status: RedemptionStatus; createdAt: string; fulfilledAt?: string };
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected" | "cancelled";
export type PayoutRequest = { id: string; userId: string; amount: number; method: string; details: string; status: PayoutStatus; adminNote?: string; createdAt: string; updatedAt?: string };
export type PlatformSettings = {
  creditRate: number; minPayout: number; reviewModeration: boolean; cashbackEnabled: boolean;
  announcement: string; socialX: string; socialDiscord: string; socialInstagram: string; supportEmail: string; payoutMethods: string[];
};
export type AuditEntry = { id: string; actor: string; action: string; target: string; detail: string; createdAt: string };
type Result = { ok: boolean; message: string };

export const creditsForPurchase = (purchase: Pick<Purchase, "amount">, rate = 1) => Math.floor(purchase.amount * rate);

type AccountContextValue = {
  user: PublicUser | null;
  backendConfigured: boolean;
  backendStatus: "local" | "connecting" | "connected" | "error";
  backendError: string;
  authLoading: boolean;
  firms: Firm[];
  purchases: Purchase[];
  reviews: TraderReview[];
  referralClicks: ReferralClick[];
  redemptions: Redemption[];
  payoutRequests: PayoutRequest[];
  credits: { pending: number; available: number; spent: number; lifetime: number };
  platformSettings: PlatformSettings;
  members: PublicUser[];
  allPurchases: Purchase[];
  allRedemptions: Redemption[];
  allPayoutRequests: PayoutRequest[];
  affiliateConversions: AffiliateConversion[];
  allClicks: ReferralClick[];
  auditLog: AuditEntry[];
  redeemItem: (item: { id: string; name: string; cost: number }) => Promise<Result>;
  requestPayout: (method: string, details: string) => Promise<Result>;
  cancelPayoutRequest: (id: string) => void;
  cancelRedemption: (redemptionId: string) => void;
  setPurchaseStatus: (purchaseId: string, status: PurchaseStatus) => void;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  logIn: (email: string, password: string) => Promise<Result>;
  logOut: () => void;
  updateProfile: (name: string) => Result;
  addPurchase: (input: Omit<Purchase, "id" | "userId" | "createdAt" | "status" | "cashbackAmount">) => Result;
  saveReview: (input: Omit<TraderReview, "id" | "userId" | "userName" | "createdAt" | "updatedAt" | "status">) => Result;
  deleteReview: (reviewId: string) => void;
  recordReferralClick: (firmId: string) => Promise<string | null>;
  adminUpdatePurchase: (id: string, status: PurchaseStatus, adminNote: string, actor: string) => void;
  adminUpdateRedemption: (id: string, status: RedemptionStatus, actor: string) => void;
  adminUpdatePayout: (id: string, status: PayoutStatus, note: string, actor: string) => void;
  adminUpdateConversion: (id: string, status: AffiliateConversionStatus, actor: string) => void;
  adminModerateReview: (id: string, status: ReviewStatus, actor: string) => void;
  adminDeleteReview: (id: string, actor: string) => void;
  adminUpdateUser: (id: string, patch: Pick<PublicUser, "role" | "suspended">, actor: string) => void;
  saveFirm: (firm: Firm, actor: string) => Result;
  archiveFirm: (id: string, archived: boolean, actor: string) => void;
  updatePlatformSettings: (settings: PlatformSettings, actor: string) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);
const KEYS = {
  users: "apex_users_v2", session: "apex_session_v2", purchases: "apex_purchases_v2",
  reviews: "apex_reviews_v2", clicks: "apex_referral_clicks_v2", redemptions: "apex_redemptions_v1", payouts: "apex_payout_requests_v1",
  firms: "apex_firms_admin_v1", settings: "apex_platform_settings_v1", audit: "apex_audit_log_v1",
};
const DEFAULT_SETTINGS: PlatformSettings = {
  creditRate: 1, minPayout: 25, reviewModeration: false, cashbackEnabled: true,
  announcement: "Research the rules. Compare the value. Trade your plan.",
  socialX: contact.x, socialDiscord: contact.discord, socialInstagram: contact.instagram, supportEmail: contact.email,
  payoutMethods: ["PayPal", "Bank transfer", "Crypto wallet", "Other"],
};

function readStore<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function makeId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `APX-${Array.from(bytes, (byte) => chars[byte % chars.length]).join("")}`;
}
async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function publicUser(stored: StoredUser): PublicUser {
  return { id: stored.id, name: stored.name, email: stored.email, referralCode: stored.referralCode, referredBy: stored.referredBy, createdAt: stored.createdAt, role: "member", suspended: false };
}
function remoteProfile(row: Record<string, unknown>): PublicUser {
  return {
    id: String(row.id), name: String(row.full_name ?? ""), email: String(row.email ?? ""),
    referralCode: String(row.referral_code ?? ""), referredBy: typeof row.referred_by === "string" ? row.referred_by : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()), role: row.role === "admin" ? "admin" : "member",
    suspended: Boolean(row.suspended),
  };
}
function remotePayload<T extends { id: string }>(row: Record<string, unknown>): T {
  const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
  const fieldMap: Record<string, string> = {
    user_id: "userId", firm_id: "firmId", order_id: "orderId", cashback_rate: "cashbackRate",
    cashback_amount: "cashbackAmount", code_used: "codeUsed", purchase_date: "purchaseDate",
    referral_click_id: "referralClickId",
    admin_note: "adminNote", reviewed_at: "reviewedAt", fulfilled_at: "fulfilledAt",
    item_id: "itemId", item_name: "itemName", user_name: "userName", account_model: "accountModel",
    payout_details: "details", created_at: "createdAt", updated_at: "updatedAt",
    click_id: "clickId", purchase_id: "purchaseId", purchase_amount: "purchaseAmount", commission_amount: "commissionAmount",
  };
  const normalized: Record<string, unknown> = { ...payload };
  for (const [column, property] of Object.entries(fieldMap)) {
    if (row[column] !== undefined && row[column] !== null) normalized[property] = row[column];
  }
  for (const property of ["status", "id", "source", "currency", "amount", "rating", "title", "body", "recommend", "cost", "notes", "code_used"] as const) {
    if (row[property] !== undefined && row[property] !== null) normalized[property] = row[property];
  }
  normalized.id = String(row.id);
  if (row.status !== undefined) normalized.status = row.status;
  return normalized as unknown as T;
}
function initialFirms() {
  const saved = readStore<Firm[]>(KEYS.firms, []);
  if (!saved.length) return seedFirms.map((firm) => ({ ...firm }));
  const savedIds = new Set(saved.map((firm) => firm.id));
  return [...saved, ...seedFirms.filter((firm) => !savedIds.has(firm.id)).map((firm) => ({ ...firm }))];
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>(() => supabaseConfigured ? [] : readStore(KEYS.users, []));
  const [sessionId, setSessionId] = useState<string | null>(() => supabaseConfigured ? null : readStore(KEYS.session, null));
  const [allPurchases, setAllPurchases] = useState<Purchase[]>(() => supabaseConfigured ? [] : readStore(KEYS.purchases, []));
  const [allReviews, setAllReviews] = useState<TraderReview[]>(() => supabaseConfigured ? [] : readStore(KEYS.reviews, []));
  const [allClicks, setAllClicks] = useState<ReferralClick[]>(() => supabaseConfigured ? [] : readStore(KEYS.clicks, []));
  const [allRedemptions, setAllRedemptions] = useState<Redemption[]>(() => supabaseConfigured ? [] : readStore(KEYS.redemptions, []));
  const [allPayoutRequests, setAllPayoutRequests] = useState<PayoutRequest[]>(() => supabaseConfigured ? [] : readStore(KEYS.payouts, []));
  const [affiliateConversions, setAffiliateConversions] = useState<AffiliateConversion[]>([]);
  const [firmList, setFirmList] = useState<Firm[]>(() => supabaseConfigured ? seedFirms.map((firm) => ({ ...firm })) : initialFirms());
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() => supabaseConfigured ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, ...readStore(KEYS.settings, DEFAULT_SETTINGS) });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => supabaseConfigured ? [] : readStore(KEYS.audit, []));
  const [remoteUser, setRemoteUser] = useState<PublicUser | null>(null);
  const [remoteMembers, setRemoteMembers] = useState<PublicUser[]>([]);
  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [backendStatus, setBackendStatus] = useState<"local" | "connecting" | "connected" | "error">(supabaseConfigured ? "connecting" : "local");
  const [backendError, setBackendError] = useState("");

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    let active = true;
    let activeAuthId: string | null | undefined;

    const hydrate = async (authId: string | null) => {
      if (!supabase || !active) return;
      const identityChanged = activeAuthId !== authId;
      if (identityChanged) {
        activeAuthId = authId;
        setRemoteUser(null);
        setRemoteMembers([]);
        setAllPurchases([]); setAllReviews([]); setAllRedemptions([]); setAllPayoutRequests([]); setAllClicks([]); setAffiliateConversions([]); setAuditLog([]);
        setAuthLoading(true);
      }
      setBackendStatus("connecting"); setBackendError("");
      try {
        let profile: PublicUser | null = null;
        if (authId) {
          const { data, error } = await supabase.from("profiles").select("*").eq("id", authId).maybeSingle();
          if (error) throw error;
          if (data) profile = remoteProfile(data as Record<string, unknown>);
          if (profile?.suspended) {
            await supabase.auth.signOut();
            profile = null;
          }
        }
        if (!active) return;
        setRemoteUser(profile);

        const profileRequest = profile?.role === "admin"
          ? supabase.from("profiles").select("*").order("created_at", { ascending: false })
          : Promise.resolve({ data: profile ? [{ ...profile, full_name: profile.name, referral_code: profile.referralCode, referred_by: profile.referredBy, created_at: profile.createdAt }] : [], error: null });
        const purchaseRequest = profile ? supabase.from("purchases").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null });
        const redemptionRequest = profile ? supabase.from("redemptions").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null });
        const payoutRequest = profile ? supabase.from("payout_requests").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null });
        const clickRequest = profile ? supabase.from("referral_clicks").select("*").order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null });
        const auditRequest = profile?.role === "admin" ? supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [], error: null });
        const conversionRequest = profile?.role === "admin" ? supabase.from("affiliate_conversions").select("*").order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [], error: null });
        const [firmResult, settingsResult, purchaseResult, reviewResult, redemptionResult, payoutResult, clickResult, memberResult, auditResult, conversionResult] = await Promise.all([
          supabase.from("firms").select("id,status,cashback_rate,payload"),
          supabase.from("app_settings").select("key,value"),
          purchaseRequest,
          supabase.from("reviews").select("*").order("created_at", { ascending: false }),
          redemptionRequest,
          payoutRequest,
          clickRequest,
          profileRequest,
          auditRequest,
          conversionRequest,
        ]);
        const failed = [firmResult, settingsResult, purchaseResult, reviewResult, redemptionResult, payoutResult, clickResult, memberResult, auditResult, conversionResult].find((result) => result.error);
        if (failed?.error) throw failed.error;
        if (!active) return;

        const remoteFirms = (firmResult.data ?? []).map((row) => {
          const payload = row.payload && typeof row.payload === "object" ? row.payload as Firm : {} as Firm;
          return { ...payload, id: row.id, status: row.status, cashbackRate: Number(row.cashback_rate) } as Firm;
        });
        if (remoteFirms.length) {
          const overrides = new Map(remoteFirms.map((firm) => [firm.id, firm]));
          const remoteIds = new Set(remoteFirms.map((firm) => firm.id));
          const merged = [...remoteFirms, ...seedFirms.filter((firm) => !remoteIds.has(firm.id)).map((firm) => overrides.get(firm.id) ?? firm)];
          setFirmList(merged);
        }
        const settingValue = (key: string) => (settingsResult.data ?? []).find((item) => item.key === key)?.value;
        const toBoolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
        const toNumber = (value: unknown, fallback: number) => typeof value === "number" ? value : Number(value) || fallback;
        const nextSettings: PlatformSettings = {
          creditRate: toNumber(settingValue("credit_rate"), DEFAULT_SETTINGS.creditRate),
          minPayout: toNumber(settingValue("min_payout"), DEFAULT_SETTINGS.minPayout),
          reviewModeration: toBoolean(settingValue("review_moderation"), DEFAULT_SETTINGS.reviewModeration),
          cashbackEnabled: toBoolean(settingValue("cashback_enabled"), DEFAULT_SETTINGS.cashbackEnabled),
          announcement: typeof settingValue("announcement") === "string" ? settingValue("announcement") as string : DEFAULT_SETTINGS.announcement,
          socialX: typeof settingValue("social_x") === "string" ? settingValue("social_x") as string : DEFAULT_SETTINGS.socialX,
          socialDiscord: typeof settingValue("social_discord") === "string" ? settingValue("social_discord") as string : DEFAULT_SETTINGS.socialDiscord,
          socialInstagram: typeof settingValue("social_instagram") === "string" ? settingValue("social_instagram") as string : DEFAULT_SETTINGS.socialInstagram,
          supportEmail: typeof settingValue("support_email") === "string" ? settingValue("support_email") as string : DEFAULT_SETTINGS.supportEmail,
          payoutMethods: Array.isArray(settingValue("payout_methods")) ? (settingValue("payout_methods") as unknown[]).filter((item): item is string => typeof item === "string") : DEFAULT_SETTINGS.payoutMethods,
        };
        setPlatformSettings(nextSettings);

        const purchases = (purchaseResult.data ?? []).map((row) => remotePayload<Purchase>(row as Record<string, unknown>));
        const reviews = (reviewResult.data ?? []).map((row) => remotePayload<TraderReview>(row as Record<string, unknown>));
        const redemptions = (redemptionResult.data ?? []).map((row) => remotePayload<Redemption>(row as Record<string, unknown>));
        const payouts = (payoutResult.data ?? []).map((row) => remotePayload<PayoutRequest>(row as Record<string, unknown>));
        const clicks = (clickResult.data ?? []).map((row) => ({ id: row.id, userId: row.user_id, firmId: row.firm_id, createdAt: row.created_at } as ReferralClick));
        const members = (memberResult.data ?? []).map((row) => remoteProfile(row as Record<string, unknown>));
        const audit = (auditResult.data ?? []).map((row) => ({ id: row.id, actor: row.actor, action: row.action, target: row.target, detail: row.detail, createdAt: row.created_at } as AuditEntry));
        const conversions = (conversionResult.data ?? []).map((row) => ({ ...remotePayload<AffiliateConversion>(row as Record<string, unknown>), partnerEventId: String(row.id) }));

        setAllPurchases(purchases);
        setAllReviews(reviews);
        setAllRedemptions(redemptions);
        setAllPayoutRequests(payouts);
        setAllClicks(clicks);
        setAffiliateConversions(conversions);
        setRemoteMembers(members);
        setAuditLog(audit);
        setBackendError(""); setBackendStatus("connected");
      } catch (error) {
        if (!active) return;
        setBackendStatus("error");
        setBackendError(error instanceof Error ? error.message : "Could not connect to Supabase.");
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { if (active) void hydrate(session?.user.id ?? null); }, 0);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return hydrate(data.session?.user.id ?? null);
    }).catch((error: unknown) => {
      if (active) {
        setBackendStatus("error");
        setBackendError(error instanceof Error ? error.message : "Could not restore the Supabase session.");
        setAuthLoading(false);
      }
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const user = useMemo(() => {
    if (supabaseConfigured) return remoteUser;
    const stored = users.find((candidate) => candidate.id === sessionId);
    return stored && !stored.suspended ? publicUser(stored) : null;
  }, [users, sessionId, remoteUser]);
  const members = useMemo(() => supabaseConfigured ? remoteMembers : users.map(publicUser), [users, remoteMembers]);
  const persistUsers = (next: StoredUser[]) => { setUsers(next); writeStore(KEYS.users, next); };
  const startSession = (id: string) => { setSessionId(id); writeStore(KEYS.session, id); };
  const audit = (actor: string, action: string, target: string, detail: string) => {
    const entry = { id: makeId("audit"), actor, action, target, detail, createdAt: new Date().toISOString() };
    setAuditLog((current) => { const next = [entry, ...current].slice(0, 300); if (!supabaseConfigured) writeStore(KEYS.audit, next); return next; });
    if (supabaseConfigured && supabase && user?.role === "admin") {
      remoteWrite("Audit log", supabase.from("audit_log").insert({ id: entry.id, actor, action, target, detail, created_at: entry.createdAt }));
    }
  };

  const remoteWrite = (label: string, query: PromiseLike<{ error: { message: string } | null }>) => {
    if (!supabaseConfigured) return;
    void Promise.resolve(query).then(({ error }) => {
      if (error) { setBackendStatus("error"); setBackendError(`${label}: ${error.message}`); }
      else { setBackendStatus("connected"); setBackendError(""); }
    }).catch((error: unknown) => {
      setBackendStatus("error"); setBackendError(`${label}: ${error instanceof Error ? error.message : "The server request failed."}`);
    });
  };

  const signUp = async (name: string, email: string, password: string): Promise<Result> => {
    const cleanName = name.trim(); const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) return { ok: false, message: "Enter your full name." };
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return { ok: false, message: "Enter a valid email address." };
    if (password.length < 8) return { ok: false, message: "Use at least 8 characters for your password." };
    if (supabaseConfigured && supabase) {
      const referredBy = localStorage.getItem("apex_referred_by") ?? undefined;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: cleanName, referred_by: referredBy } },
      });
      if (error) return { ok: false, message: error.message };
      if (data.session) {
        const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
        if (profileRow) setRemoteUser(remoteProfile(profileRow as Record<string, unknown>));
        return { ok: true, message: "Your PropApex account is ready." };
      }
      return { ok: true, message: "Check your email to confirm your account, then log in to continue." };
    }
    if (users.some((candidate) => candidate.email === cleanEmail)) return { ok: false, message: "An account with this email already exists. Log in instead." };
    const salt = makeId("salt"); const passwordHash = await hashPassword(password, salt);
    const stored: StoredUser = { id: makeId("user"), name: cleanName, email: cleanEmail, referralCode: randomCode(), referredBy: localStorage.getItem("apex_referred_by") ?? undefined, createdAt: new Date().toISOString(), role: "member", suspended: false, passwordHash, salt };
    persistUsers([...users, stored]); startSession(stored.id);
    return { ok: true, message: "Your PropApex account is ready." };
  };
  const logIn = async (email: string, password: string): Promise<Result> => {
    if (supabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error || !data.user) return { ok: false, message: error?.message ?? "Sign in failed." };
      const signedInId = data.user.id;
      const { data: profileRow, error: profileError } = await supabase.from("profiles").select("*").eq("id", signedInId).maybeSingle();
      if (profileError || !profileRow) return { ok: false, message: profileError?.message ?? "Your member profile is not ready yet. Contact PropApex support." };
      const profile = remoteProfile(profileRow as Record<string, unknown>);
      if (profile.suspended) { await supabase.auth.signOut(); return { ok: false, message: "This account is suspended. Contact PropApex support." }; }
      setRemoteUser(profile);
      return { ok: true, message: `Welcome back, ${profile.name.split(" ")[0] || "trader"}.` };
    }
    const stored = users.find((candidate) => candidate.email === email.trim().toLowerCase());
    if (!stored) return { ok: false, message: "No account was found with this email." };
    if (stored.suspended) return { ok: false, message: "This account is suspended. Contact PropApex support." };
    const candidateHash = await hashPassword(password, stored.salt);
    if (candidateHash !== stored.passwordHash) return { ok: false, message: "That password is incorrect. Please try again." };
    startSession(stored.id); return { ok: true, message: `Welcome back, ${stored.name.split(" ")[0]}.` };
  };
  const logOut = () => {
    setSessionId(null); localStorage.removeItem(KEYS.session);
    if (supabaseConfigured && supabase) { setRemoteUser(null); void supabase.auth.signOut(); }
  };
  const updateProfile = (name: string): Result => {
    const cleanName = name.trim();
    if (!user) return { ok: false, message: "Log in to update your profile." };
    if (cleanName.length < 2) return { ok: false, message: "Enter your full name." };
    if (supabaseConfigured && supabase) {
      setRemoteUser({ ...user, name: cleanName });
      remoteWrite("Profile update", supabase.from("profiles").update({ full_name: cleanName }).eq("id", user.id));
      return { ok: true, message: "Profile updated." };
    }
    persistUsers(users.map((candidate) => candidate.id === user.id ? { ...candidate, name: cleanName } : candidate));
    const next = allReviews.map((review) => review.userId === user.id ? { ...review, userName: cleanName } : review);
    setAllReviews(next); if (!supabaseConfigured) writeStore(KEYS.reviews, next);
    return { ok: true, message: "Profile updated." };
  };
  const addPurchase: AccountContextValue["addPurchase"] = (input) => {
    if (!user) return { ok: false, message: "Log in to track a purchase." };
    if (!platformSettings.cashbackEnabled) return { ok: false, message: "Cashback submissions are temporarily paused." };
    if (firmList.find((firm) => firm.id === input.firmId)?.status === "archived") return { ok: false, message: "This firm is archived and is not accepting new PropApex purchases." };
    if (!input.orderId.trim()) return { ok: false, message: "Enter the firm order or invoice ID." };
    if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, message: "Enter a valid purchase amount." };
    if (allPurchases.some((purchase) => purchase.userId === user.id && purchase.firmId === input.firmId && purchase.orderId.toLowerCase() === input.orderId.trim().toLowerCase())) return { ok: false, message: "This order has already been submitted for that firm." };
    const purchase: Purchase = { ...input, id: makeId("purchase"), userId: user.id, orderId: input.orderId.trim(), codeUsed: input.codeUsed.trim(), notes: input.notes.trim(), createdAt: new Date().toISOString(), status: "pending", cashbackAmount: Math.round(input.amount * input.cashbackRate) / 100 };
    const next = [purchase, ...allPurchases]; setAllPurchases(next); if (!supabaseConfigured) writeStore(KEYS.purchases, next);
    if (supabaseConfigured && supabase) {
      const payload = {
        id: purchase.id, user_id: user.id, firm_id: purchase.firmId, order_id: purchase.orderId,
        amount: purchase.amount, cashback_rate: purchase.cashbackRate, cashback_amount: purchase.cashbackAmount,
        code_used: purchase.codeUsed, referral_click_id: purchase.referralClickId ?? null, purchase_date: purchase.purchaseDate, status: "pending",
        notes: purchase.notes, payload: purchase,
      };
      remoteWrite("Purchase submission", supabase.from("purchases").insert(payload).select("*").single());
    }
    return { ok: true, message: "Purchase submitted for cashback verification." };
  };
  const saveReview: AccountContextValue["saveReview"] = (input) => {
    if (!user) return { ok: false, message: "Log in to publish a review." };
    if (input.rating < 1 || input.rating > 5) return { ok: false, message: "Choose a rating from 1 to 5 stars." };
    if (input.title.trim().length < 4) return { ok: false, message: "Add a short review headline." };
    if (input.body.trim().length < 40) return { ok: false, message: "Share at least 40 characters so your review is useful." };
    const existing = allReviews.find((review) => review.userId === user.id && review.firmId === input.firmId);
    const now = new Date().toISOString();
    const review: TraderReview = { ...input, title: input.title.trim(), body: input.body.trim(), id: existing?.id ?? makeId("review"), userId: user.id, userName: user.name, createdAt: existing?.createdAt ?? now, updatedAt: existing ? now : undefined, status: platformSettings.reviewModeration ? "pending" : "published" };
    const next = existing ? allReviews.map((item) => item.id === existing.id ? review : item) : [review, ...allReviews];
    setAllReviews(next); if (!supabaseConfigured) writeStore(KEYS.reviews, next);
    if (supabaseConfigured && supabase) {
      remoteWrite("Review submission", supabase.from("reviews").upsert({
        id: review.id, user_id: user.id, user_name: user.name, firm_id: review.firmId,
        rating: review.rating, account_model: review.accountModel, title: review.title,
        body: review.body, recommend: review.recommend, status: review.status, payload: review,
      }, { onConflict: "user_id,firm_id" }));
    }
    return { ok: true, message: existing ? "Your review has been updated." : platformSettings.reviewModeration ? "Your review was submitted for moderation." : "Your review is now published." };
  };
  const deleteReview = (reviewId: string) => {
    if (!user) return;
    const next = allReviews.filter((review) => review.id !== reviewId || review.userId !== user.id);
    setAllReviews(next); if (!supabaseConfigured) writeStore(KEYS.reviews, next);
    if (supabaseConfigured && supabase) remoteWrite("Review deletion", supabase.from("reviews").delete().eq("id", reviewId));
  };
  const recordReferralClick = async (firmId: string) => {
    if (!user) return null;
    const click = { id: makeId("click"), userId: user.id, firmId, createdAt: new Date().toISOString() };
    const next = [click, ...allClicks].slice(0, 250); setAllClicks(next); if (!supabaseConfigured) writeStore(KEYS.clicks, next);
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.from("referral_clicks").insert({ id: click.id, user_id: user.id, firm_id: firmId, created_at: click.createdAt });
      if (error) { setBackendStatus("error"); setBackendError(`Referral click: ${error.message}`); return null; }
    }
    return click.id;
  };

  const myPurchases = user ? allPurchases.filter((purchase) => purchase.userId === user.id) : [];
  const myRedemptions = user ? allRedemptions.filter((item) => item.userId === user.id) : [];
  const myPayoutRequests = user ? allPayoutRequests.filter((item) => item.userId === user.id) : [];
  const earnedOf = (statuses: PurchaseStatus[]) => myPurchases.filter((purchase) => statuses.includes(purchase.status)).reduce((sum, purchase) => sum + creditsForPurchase(purchase, platformSettings.creditRate), 0);
  const spent = myRedemptions.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.cost, 0);
  const credits = { pending: earnedOf(["pending"]), available: Math.max(0, earnedOf(["approved", "paid"]) - spent), spent, lifetime: earnedOf(["pending", "approved", "paid"]) };
  const redeemItem: AccountContextValue["redeemItem"] = async (item) => {
    if (!user) return { ok: false, message: "Log in to redeem credits." };
    if (credits.available < item.cost) return { ok: false, message: `You need ${(item.cost - credits.available).toLocaleString()} more approved credits for this reward.` };
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.rpc("request_apex_redemption", { p_reward_id: item.id });
      if (error) return { ok: false, message: error.message };
      const { data } = await supabase.from("redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      const next = (data ?? []).map((row) => remotePayload<Redemption>(row as Record<string, unknown>));
      setAllRedemptions(next);
      return { ok: true, message: `${item.name} requested. Credits are reserved.` };
    }
    const redemption: Redemption = { id: makeId("redeem"), userId: user.id, itemId: item.id, itemName: item.name, cost: item.cost, status: "requested", createdAt: new Date().toISOString() };
    const next = [redemption, ...allRedemptions]; setAllRedemptions(next); if (!supabaseConfigured) writeStore(KEYS.redemptions, next);
    return { ok: true, message: `${item.name} requested. Credits are reserved.` };
  };
  const requestPayout: AccountContextValue["requestPayout"] = async (method, details) => {
    if (!user) return { ok: false, message: "Log in to request a payout." };
    if (!method.trim() || details.trim().length < 3) return { ok: false, message: "Choose a payout method and add your receiving email or wallet reference." };
    if (!platformSettings.payoutMethods.includes(method)) return { ok: false, message: "This payout method is no longer available. Refresh and choose an active method." };
    if (myPayoutRequests.some((request) => request.status === "requested" || request.status === "processing")) return { ok: false, message: "You already have a payout request being processed." };
    const approved = myPurchases.filter((purchase) => purchase.status === "approved").reduce((sum, purchase) => sum + purchase.cashbackAmount, 0);
    const reserved = myPayoutRequests.filter((request) => ["requested", "processing", "paid"].includes(request.status)).reduce((sum, request) => sum + request.amount, 0);
    const amount = Math.round(Math.max(0, approved - reserved) * 100) / 100;
    if (amount < platformSettings.minPayout) return { ok: false, message: `Your available cashback must reach $${platformSettings.minPayout.toFixed(2)} before you can request a payout.` };

    if (supabaseConfigured && supabase) {
      const { error } = await supabase.rpc("request_apex_payout", { p_method: method.trim(), p_details: details.trim() });
      if (error) return { ok: false, message: error.message };
      const { data, error: readError } = await supabase.from("payout_requests").select("*").order("created_at", { ascending: false });
      if (readError) return { ok: false, message: `Request saved, but payout status refresh failed: ${readError.message}` };
      setAllPayoutRequests((data ?? []).map((row) => remotePayload<PayoutRequest>(row as Record<string, unknown>)));
      return { ok: true, message: `Payout request for $${amount.toFixed(2)} submitted.` };
    }

    const request: PayoutRequest = { id: makeId("payout"), userId: user.id, amount, method: method.trim(), details: details.trim(), status: "requested", createdAt: new Date().toISOString() };
    const next = [request, ...allPayoutRequests]; setAllPayoutRequests(next); writeStore(KEYS.payouts, next);
    return { ok: true, message: `Payout request for $${amount.toFixed(2)} submitted.` };
  };
  const cancelPayoutRequest = (id: string) => {
    if (!user) return;
    const updatedAt = new Date().toISOString();
    const next = allPayoutRequests.map((item) => item.id === id && item.userId === user.id && item.status === "requested" ? { ...item, status: "cancelled" as PayoutStatus, updatedAt } : item);
    setAllPayoutRequests(next); if (!supabaseConfigured) writeStore(KEYS.payouts, next);
    if (supabaseConfigured && supabase) remoteWrite("Payout request cancellation", supabase.from("payout_requests").update({ status: "cancelled", updated_at: updatedAt }).eq("id", id));
  };
  const cancelRedemption = (redemptionId: string) => {
    if (!user) return;
    const next = allRedemptions.map((item) => item.id === redemptionId && item.userId === user.id && item.status === "requested" ? { ...item, status: "cancelled" as RedemptionStatus } : item);
    setAllRedemptions(next); if (!supabaseConfigured) writeStore(KEYS.redemptions, next);
    if (supabaseConfigured && supabase) remoteWrite("Redemption cancellation", supabase.from("redemptions").update({ status: "cancelled" }).eq("id", redemptionId));
  };
  const setPurchaseStatus = (purchaseId: string, status: PurchaseStatus) => {
    if (!user) return;
    const next = allPurchases.map((purchase) => purchase.id === purchaseId && purchase.userId === user.id ? { ...purchase, status } : purchase);
    setAllPurchases(next); if (!supabaseConfigured) writeStore(KEYS.purchases, next);
    if (supabaseConfigured && supabase) remoteWrite("Demo purchase status", supabase.from("purchases").update({ status }).eq("id", purchaseId));
  };

  const adminUpdatePurchase = (id: string, status: PurchaseStatus, adminNote: string, actor: string) => {
    const target = allPurchases.find((purchase) => purchase.id === id); if (!target) return;
    const reviewedAt = new Date().toISOString();
    const next = allPurchases.map((purchase) => purchase.id === id ? { ...purchase, status, adminNote: adminNote.trim(), reviewedAt } : purchase);
    setAllPurchases(next); if (!supabaseConfigured) writeStore(KEYS.purchases, next); audit(actor, "Purchase updated", target.orderId, `Status changed from ${target.status} to ${status}.`);
    const updated = next.find((purchase) => purchase.id === id);
    if (supabaseConfigured && supabase && updated) remoteWrite("Purchase verification", supabase.from("purchases").update({ status, admin_note: adminNote.trim(), reviewed_at: reviewedAt, payload: updated }).eq("id", id));
  };
  const adminUpdateRedemption = (id: string, status: RedemptionStatus, actor: string) => {
    const target = allRedemptions.find((item) => item.id === id); if (!target) return;
    const next = allRedemptions.map((item) => item.id === id ? { ...item, status, fulfilledAt: status === "fulfilled" ? new Date().toISOString() : undefined } : item);
    setAllRedemptions(next); if (!supabaseConfigured) writeStore(KEYS.redemptions, next); audit(actor, "Redemption updated", target.itemName, `Status changed from ${target.status} to ${status}.`);
    const updated = next.find((item) => item.id === id);
    if (supabaseConfigured && supabase && updated) remoteWrite("Redemption fulfilment", supabase.from("redemptions").update({ status, fulfilled_at: updated.fulfilledAt, payload: updated }).eq("id", id));
  };
  const adminUpdatePayout = (id: string, status: PayoutStatus, note: string, actor: string) => {
    const target = allPayoutRequests.find((item) => item.id === id); if (!target) return;
    const updatedAt = new Date().toISOString();
    const next = allPayoutRequests.map((item) => item.id === id ? { ...item, status, adminNote: note.trim(), updatedAt } : item);
    setAllPayoutRequests(next); if (!supabaseConfigured) writeStore(KEYS.payouts, next);
    audit(actor, "Payout request updated", id, `${target.status} → ${status}; $${target.amount.toFixed(2)} via ${target.method}.`);
    const updated = next.find((item) => item.id === id);
    if (supabaseConfigured && supabase && updated) remoteWrite("Payout request update", supabase.from("payout_requests").update({ status, admin_note: note.trim(), updated_at: updatedAt, payload: updated }).eq("id", id));
  };
  const adminUpdateConversion = (id: string, status: AffiliateConversionStatus, actor: string) => {
    const target = affiliateConversions.find((conversion) => conversion.id === id); if (!target) return;
    const next = affiliateConversions.map((conversion) => conversion.id === id ? { ...conversion, status } : conversion);
    setAffiliateConversions(next);
    audit(actor, "Affiliate conversion reviewed", target.partnerEventId, `Conversion status set to ${status}.`);
    const updated = next.find((conversion) => conversion.id === id);
    if (supabaseConfigured && supabase && updated) remoteWrite("Affiliate conversion review", supabase.from("affiliate_conversions").update({ status, payload: updated }).eq("id", id));
  };
  const adminModerateReview = (id: string, status: ReviewStatus, actor: string) => {
    const target = allReviews.find((review) => review.id === id); if (!target) return;
    const next = allReviews.map((review) => review.id === id ? { ...review, status } : review);
    setAllReviews(next); if (!supabaseConfigured) writeStore(KEYS.reviews, next); audit(actor, "Review moderated", target.title, `Visibility set to ${status}.`);
    const updated = next.find((review) => review.id === id);
    if (supabaseConfigured && supabase && updated) remoteWrite("Review moderation", supabase.from("reviews").update({ status, payload: updated }).eq("id", id));
  };
  const adminDeleteReview = (id: string, actor: string) => {
    const target = allReviews.find((review) => review.id === id); if (!target) return;
    const next = allReviews.filter((review) => review.id !== id); setAllReviews(next); if (!supabaseConfigured) writeStore(KEYS.reviews, next); audit(actor, "Review deleted", target.title, "Review permanently removed.");
    if (supabaseConfigured && supabase) remoteWrite("Review deletion", supabase.from("reviews").delete().eq("id", id));
  };
  const adminUpdateUser = (id: string, patch: Pick<PublicUser, "role" | "suspended">, actor: string) => {
    const target = members.find((member) => member.id === id); if (!target) return;
    const next = users.map((member) => member.id === id ? { ...member, ...patch } : member);
    if (!supabaseConfigured) persistUsers(next);
    audit(actor, "Member updated", target.email, `Role: ${patch.role}; suspended: ${Boolean(patch.suspended)}.`);
    setRemoteMembers((current) => current.map((member) => member.id === id ? { ...member, ...patch } : member));
    if (remoteUser?.id === id) setRemoteUser({ ...remoteUser, ...patch });
    if (supabaseConfigured && supabase) remoteWrite("Member access update", supabase.rpc("admin_update_profile", { p_user_id: id, p_role: patch.role ?? "member", p_suspended: patch.suspended ?? false }));
  };
  const saveFirm = (firm: Firm, actor: string): Result => {
    if (!firm.id || !firm.name.trim() || !firm.website.trim()) return { ok: false, message: "Firm ID, name and website are required." };
    const exists = firmList.some((item) => item.id === firm.id);
    const next = exists ? firmList.map((item) => item.id === firm.id ? firm : item) : [firm, ...firmList];
    setFirmList(next); if (!supabaseConfigured) writeStore(KEYS.firms, next); audit(actor, exists ? "Firm updated" : "Firm created", firm.name, `Cashback ${firm.cashbackRate ?? 0}%; status ${firm.status ?? "active"}.`);
    if (supabaseConfigured && supabase) remoteWrite("Firm save", supabase.from("firms").upsert({ id: firm.id, name: firm.name, market: firm.market, status: firm.status ?? "active", cashback_rate: firm.cashbackRate ?? 0, logo_url: firm.logo ?? null, payload: firm, updated_at: new Date().toISOString() }));
    return { ok: true, message: `${firm.name} saved.` };
  };
  const archiveFirm = (id: string, archived: boolean, actor: string) => {
    const target = firmList.find((firm) => firm.id === id); if (!target) return;
    const next = firmList.map((firm) => firm.id === id ? { ...firm, status: archived ? "archived" as const : "active" as const } : firm);
    setFirmList(next); if (!supabaseConfigured) writeStore(KEYS.firms, next); audit(actor, archived ? "Firm archived" : "Firm restored", target.name, archived ? "Hidden from the public directory." : "Visible in the public directory.");
    const updated = next.find((firm) => firm.id === id);
    if (supabaseConfigured && supabase && updated) remoteWrite("Firm status", supabase.from("firms").update({ status: updated.status, payload: updated }).eq("id", id));
  };
  const updatePlatformSettings = (settings: PlatformSettings, actor: string) => {
    setPlatformSettings(settings); if (!supabaseConfigured) writeStore(KEYS.settings, settings); audit(actor, "Platform settings saved", "Global configuration", `Credit rate ${settings.creditRate}; payout $${settings.minPayout}; moderation ${settings.reviewModeration ? "on" : "off"}.`);
    if (supabaseConfigured && supabase) {
      const values = [
        { key: "credit_rate", value: settings.creditRate }, { key: "min_payout", value: settings.minPayout },
        { key: "review_moderation", value: settings.reviewModeration }, { key: "cashback_enabled", value: settings.cashbackEnabled },
        { key: "announcement", value: settings.announcement }, { key: "social_x", value: settings.socialX },
        { key: "social_discord", value: settings.socialDiscord }, { key: "social_instagram", value: settings.socialInstagram },
        { key: "support_email", value: settings.supportEmail }, { key: "payout_methods", value: settings.payoutMethods },
      ];
      remoteWrite("Platform settings", supabase.from("app_settings").upsert(values.map((item) => ({ ...item, updated_at: new Date().toISOString() }))));
    }
  };

  const value: AccountContextValue = {
    user, backendConfigured: supabaseConfigured, backendStatus: supabaseConfigured ? backendStatus : "local", backendError, authLoading,
    firms: firmList, purchases: myPurchases, reviews: allReviews, referralClicks: user ? allClicks.filter((click) => click.userId === user.id) : [], redemptions: myRedemptions,
    payoutRequests: myPayoutRequests, credits, platformSettings,
    members, allPurchases, allRedemptions, allPayoutRequests, affiliateConversions, allClicks, auditLog,
    redeemItem, requestPayout, cancelPayoutRequest, cancelRedemption, setPurchaseStatus, signUp, logIn, logOut, updateProfile, addPurchase, saveReview, deleteReview, recordReferralClick,
    adminUpdatePurchase, adminUpdateRedemption, adminUpdatePayout, adminUpdateConversion, adminModerateReview, adminDeleteReview, adminUpdateUser, saveFirm, archiveFirm, updatePlatformSettings,
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within AccountProvider");
  return context;
}
