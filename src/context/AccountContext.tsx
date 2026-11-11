import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { firms as seedFirms, synchronizeFirmRates, type Firm } from "../data/firms";
import { api, ApiError } from "../lib/api";
import { defaultContact, synchronizeContact, type ContactSettings } from "../data/contact";

export type UserRole = "member" | "admin";
export type PublicUser = {
  id: string; name: string; email: string; referralCode: string; referredBy?: string;
  createdAt: string; role?: UserRole; suspended?: boolean;
};
export type PurchaseStatus = "pending" | "approved" | "paid" | "rejected";
export type Purchase = {
  id: string; userId: string; firmId: string; orderId: string; amount: number;
  cashbackRate: number; cashbackAmount: number; codeUsed: string; purchaseDate: string;
  createdAt: string; status: PurchaseStatus; notes: string; adminNote?: string; reviewedAt?: string; creditsEarned?: number;
  source?: "member" | "partner" | "partner_report"; verification?: "unverified" | "partner_confirmed" | "report_matched" | "refunded";
  amountMismatch?: boolean; partnerAmount?: number; conversionId?: string;
};
export type ReviewStatus = "published" | "pending" | "hidden";
export type TraderReview = {
  id: string; userId: string; userName: string; firmId: string; rating: number; accountModel: string;
  title: string; body: string; recommend: boolean; createdAt: string; updatedAt?: string; status?: ReviewStatus;
};
export type ReferralClick = { id: string; userId: string; firmId: string; createdAt: string };
export type RedemptionStatus = "requested" | "fulfilled" | "cancelled";
export type Redemption = { id: string; userId: string; itemId: string; itemName: string; cost: number; status: RedemptionStatus; createdAt: string; fulfilledAt?: string };
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected" | "cancelled";
export type PayoutQuestion = { id: string; label: string; type: "text" | "email" | "number" | "select" | "textarea"; required: boolean; placeholder?: string; help?: string; validation?: "none" | "email" | "upi" | "ifsc" | "iban"; sensitive?: boolean; purpose?: "payee" | "destination" | "other"; options?: string[] };
export type PayoutMethod = { id: string; name: string; description: string; instructions: string; status: "active" | "retired"; minimum: number; currency: string; order: number; questions: PayoutQuestion[]; version: number; updatedAt?: string };
export type Payout = { id: string; userId: string; amount: number; currency: "USD"; method: string; methodId?: string; methodSnapshot?: { name: string; questions: PayoutQuestion[]; version?: number }; answers?: Record<string, string>; payeeName: string; destination: string; status: PayoutStatus; createdAt: string; updatedAt?: string; paidAt?: string; paymentReference?: string; note?: string; requestKey: string };
export type CashbackBalance = { available: number; pending: number; reserved: number; paid: number; approved: number; total: number };
export type Conversion = { id: string; firmId: string; eventId: string; orderId: string; amount: number; currency: "USD"; status: "completed" | "refunded"; purchasedAt: string; receivedAt: string; source: "webhook" | "partner_report"; match: "matched" | "unmatched"; matchReason: string; userId?: string; purchaseId?: string; clickId?: string; memberCode?: string; buyerEmail?: string; couponCode: string; amountMismatch?: boolean };
export type PayoutInput = { amount: number; methodId: string; methodVersion: number; answers: Record<string, string>; requestKey: string };
export type PartnerSaleInput = Pick<Conversion, "firmId" | "eventId" | "orderId" | "amount" | "currency" | "status" | "purchasedAt" | "couponCode"> & Partial<Pick<Conversion, "clickId" | "memberCode" | "buyerEmail">>;
export type PlatformSettings = { creditRate: number; minPayout: number; reviewModeration: boolean; cashbackEnabled: boolean; announcement: string; siteLogo?: string; contact?: ContactSettings };
export type AuditEntry = { id: string; actor: string; action: string; target: string; detail: string; createdAt: string };
export type Result = { ok: boolean; message: string; redirectUrl?: string; clickId?: string };
type Credits = { pending: number; available: number; spent: number; lifetime: number };
type PurchaseInput = Omit<Purchase, "id" | "userId" | "createdAt" | "status" | "cashbackAmount">;
type ReviewInput = Omit<TraderReview, "id" | "userId" | "userName" | "createdAt" | "updatedAt" | "status">;

export const creditsForPurchase = (purchase: Pick<Purchase, "amount">, rate = 1) => Math.floor(purchase.amount * rate);
type Snapshot = {
  user: PublicUser | null; firms: Firm[]; purchases: Purchase[]; reviews: TraderReview[];
  referralClicks: ReferralClick[]; redemptions: Redemption[]; credits: Credits; platformSettings: PlatformSettings;
  payouts: Payout[]; cashback: CashbackBalance;
  payoutMethods: PayoutMethod[];
  storage?: { database: string };
};
type AdminSnapshot = { members: PublicUser[]; firms: Firm[]; allPurchases: Purchase[]; allRedemptions: Redemption[]; allClicks: ReferralClick[]; reviews: TraderReview[]; auditLog: AuditEntry[]; platformSettings: PlatformSettings; allPayouts: Payout[]; conversions: Conversion[]; payoutMethods: PayoutMethod[] };
type AccountContextValue = Snapshot & Omit<AdminSnapshot, "firms" | "reviews" | "platformSettings" | "payoutMethods"> & {
  loading: boolean; connection: "connecting" | "connected" | "offline"; connectionError: string;
  connectionIssue: string; reconnecting: boolean;
  refresh: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  logIn: (email: string, password: string) => Promise<Result>;
  logInAdmin: (email: string, password: string) => Promise<Result>;
  logOut: () => Promise<Result>;
  updateProfile: (name: string) => Promise<Result>;
  addPurchase: (input: PurchaseInput) => Promise<Result>;
  saveReview: (input: ReviewInput) => Promise<Result>;
  deleteReview: (id: string) => Promise<Result>;
  recordReferralClick: (firmId: string) => Promise<Result>;
  redeemItem: (item: { id: string; name: string; cost: number }) => Promise<Result>;
  cancelRedemption: (id: string) => Promise<Result>;
  adminUpdatePurchase: (id: string, status: PurchaseStatus, note: string, actor?: string, verifiedAmount?: number) => Promise<Result>;
  adminUpdateRedemption: (id: string, status: RedemptionStatus, actor?: string) => Promise<Result>;
  adminModerateReview: (id: string, status: ReviewStatus, actor?: string) => Promise<Result>;
  adminDeleteReview: (id: string, actor?: string) => Promise<Result>;
  adminUpdateUser: (id: string, patch: Pick<PublicUser, "role" | "suspended">, actor?: string) => Promise<Result>;
  saveFirm: (firm: Firm, actor?: string) => Promise<Result>;
  archiveFirm: (id: string, archived: boolean, actor?: string) => Promise<Result>;
  updatePlatformSettings: (settings: PlatformSettings, actor?: string) => Promise<Result>;
  requestPayout: (input: PayoutInput) => Promise<Result>;
  cancelPayout: (id: string) => Promise<Result>;
  adminUpdatePayout: (id: string, input: { status: "processing" | "paid" | "rejected"; paymentReference: string; note: string }) => Promise<Result>;
  recordPartnerSale: (input: PartnerSaleInput) => Promise<Result>;
  matchPartnerSale: (id: string, userId: string) => Promise<Result>;
  savePayoutMethod: (method: PayoutMethod) => Promise<Result>;
  deletePayoutMethod: (id: string) => Promise<Result>;
};

const emptyAdmin = { members: [], allPurchases: [], allRedemptions: [], allClicks: [], auditLog: [], allPayouts: [], conversions: [] };
const initial: Snapshot = {
  user: null, firms: seedFirms, purchases: [], reviews: [], referralClicks: [], redemptions: [],
  payouts: [], cashback: { available: 0, pending: 0, reserved: 0, paid: 0, approved: 0, total: 0 },
  payoutMethods: [],
  credits: { pending: 0, available: 0, spent: 0, lifetime: 0 },
  platformSettings: { creditRate: 1, minPayout: 25, reviewModeration: false, cashbackEnabled: true, announcement: "Research the rules. Compare the value. Trade your plan.", siteLogo: "", contact: defaultContact },
};
const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [admin, setAdmin] = useState<Omit<AdminSnapshot, "firms" | "reviews" | "platformSettings" | "payoutMethods">>(emptyAdmin);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<AccountContextValue["connection"]>("connecting");
  const [connectionError, setConnectionError] = useState("");
  const [connectionIssue, setConnectionIssue] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setReconnecting(true);
    try {
      const current = await api<Snapshot>("/bootstrap");
      if (!Array.isArray(current.firms) || !Array.isArray(current.purchases) || !Array.isArray(current.payoutMethods) || !current.platformSettings || !current.cashback || !("user" in current)) {
        throw new ApiError("This address is not serving the current APEX account API. Start the latest backend-enabled project and route /api to it.", 502, "API_VERSION_MISMATCH");
      }
      let adminData: AdminSnapshot | null = null;
      if (current.user?.role === "admin") adminData = await api<AdminSnapshot>("/admin/state");
      if (version !== requestVersion.current) return;
      const next = adminData ? { ...current, firms: adminData.firms, reviews: adminData.reviews, platformSettings: adminData.platformSettings, payoutMethods: adminData.payoutMethods } : current;
      synchronizeFirmRates(next.firms);
      synchronizeContact(next.platformSettings.contact);
      setSnapshot(next); setAdmin(adminData ?? emptyAdmin);
      setConnection("connected"); setConnectionError(""); setConnectionIssue("");
    } catch (error) {
      if (version !== requestVersion.current) return;
      setConnection("offline"); setConnectionError(error instanceof Error ? error.message : "Cannot connect to APEX.");
      setConnectionIssue(error instanceof ApiError ? error.code : "UNKNOWN_ERROR");
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        setAdmin(emptyAdmin);
        setSnapshot((value) => ({ ...value, user: null, purchases: [], payouts: [], redemptions: [], referralClicks: [], credits: initial.credits, cashback: initial.cashback }));
      }
    } finally { if (version === requestVersion.current) { setLoading(false); setReconnecting(false); } }
  }, []);

  useEffect(() => {
    // Browser storage is never trusted for identity, roles, balances or sessions.
    for (const key of ["apex_users_v2", "apex_session_v2", "apex_admin_profile_v1", "apex_admin_session_v1"]) {
      try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* private browsing */ }
    }
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    const timer = window.setInterval(onFocus, 30000);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.clearInterval(timer); };
  }, [refresh]);

  const mutate = async (path: string, method: string, data?: unknown): Promise<Result> => {
    try { const result = await api<Result>(path, method, data); await refresh(); return result; }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : "The request failed." }; }
  };
  const saveImage = async (value?: string) => {
    if (!value?.startsWith("data:image/")) return value;
    const result = await api<{ url: string }>("/admin/media", "POST", { dataUrl: value });
    return result.url;
  };
  const value: AccountContextValue = {
    ...snapshot, ...admin, loading, connection, connectionError, connectionIssue, reconnecting, refresh,
    signUp: (name, email, password) => mutate("/auth/register", "POST", { name, email, password, referredBy: localStorage.getItem("apex_referred_by") ?? undefined }),
    logIn: (email, password) => mutate("/auth/login", "POST", { email, password }),
    logInAdmin: (email, password) => mutate("/auth/admin-login", "POST", { email, password }),
    logOut: async () => {
      const result = await mutate("/auth/logout", "POST");
      if (result.ok) { setSnapshot((current) => ({ ...current, user: null, purchases: [], redemptions: [], referralClicks: [], payouts: [], credits: initial.credits, cashback: initial.cashback })); setAdmin(emptyAdmin); }
      return result;
    },
    updateProfile: (name) => mutate("/profile", "PATCH", { name }),
    addPurchase: (input) => mutate("/purchases", "POST", input),
    saveReview: (input) => mutate("/reviews", "POST", input),
    deleteReview: (id) => mutate(`/reviews/${encodeURIComponent(id)}`, "DELETE"),
    recordReferralClick: (firmId) => mutate("/clicks", "POST", { firmId }),
    redeemItem: (item) => mutate("/redemptions", "POST", { itemId: item.id }),
    cancelRedemption: (id) => mutate(`/redemptions/${encodeURIComponent(id)}`, "DELETE"),
    adminUpdatePurchase: (id, status, note, _actor, verifiedAmount) => mutate(`/admin/purchases/${encodeURIComponent(id)}`, "PATCH", { status, adminNote: note, verifiedAmount }),
    adminUpdateRedemption: (id, status) => mutate(`/admin/redemptions/${encodeURIComponent(id)}`, "PATCH", { status }),
    adminModerateReview: (id, status) => mutate(`/admin/reviews/${encodeURIComponent(id)}`, "PATCH", { status }),
    adminDeleteReview: (id) => mutate(`/admin/reviews/${encodeURIComponent(id)}`, "DELETE"),
    adminUpdateUser: (id, patch) => mutate(`/admin/members/${encodeURIComponent(id)}`, "PATCH", patch),
    archiveFirm: (id, archived) => mutate(`/admin/firms/${encodeURIComponent(id)}`, "PATCH", { archived }),
    requestPayout: (input) => mutate("/payouts", "POST", input),
    cancelPayout: (id) => mutate(`/payouts/${encodeURIComponent(id)}`, "DELETE"),
    adminUpdatePayout: (id, input) => mutate(`/admin/payouts/${encodeURIComponent(id)}`, "PATCH", input),
    recordPartnerSale: (input) => mutate("/admin/conversions", "POST", input),
    matchPartnerSale: (id, userId) => mutate(`/admin/conversions/${encodeURIComponent(id)}`, "PATCH", { userId }),
    savePayoutMethod: (method) => mutate(`/admin/payout-methods/${encodeURIComponent(method.id)}`, "PUT", method),
    deletePayoutMethod: (id) => mutate(`/admin/payout-methods/${encodeURIComponent(id)}`, "DELETE"),
    saveFirm: async (firm) => {
      try {
        const logo = await saveImage(firm.logo);
        return await mutate(`/admin/firms/${encodeURIComponent(firm.id)}`, "PUT", { ...firm, logo, cashbackRate: firm.cashbackRate ?? 3 });
      } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not upload logo." }; }
    },
    updatePlatformSettings: async (settings) => {
      try {
        const siteLogo = await saveImage(settings.siteLogo);
        return await mutate("/admin/settings", "PUT", { ...settings, siteLogo: siteLogo ?? "" });
      } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not save website branding." }; }
    },
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within AccountProvider");
  return context;
}