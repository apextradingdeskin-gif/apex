import { createClient } from "npm:@supabase/supabase-js@2";

const projectUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const postbackSecret = Deno.env.get("APEX_POSTBACK_SECRET");
const headers = { "content-type": "application/json", "cache-control": "no-store" };

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function isValidSignature(rawBody: string, signature: string) {
  if (!postbackSecret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(postbackSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = toHex(digest);
  const provided = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (expected.length !== provided.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return respond({ error: "POST required." }, 405);
  if (!projectUrl || !serviceKey || !postbackSecret) return respond({ error: "Affiliate postback is not configured." }, 503);

  const rawBody = await request.text();
  if (!(await isValidSignature(rawBody, request.headers.get("x-apex-signature") ?? ""))) {
    return respond({ error: "Invalid postback signature." }, 401);
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; }
  catch { return respond({ error: "Invalid JSON payload." }, 400); }

  const eventId = String(body.event_id ?? "").trim();
  const firmId = String(body.firm_id ?? "").trim();
  const clickId = String(body.click_id ?? "").trim();
  const apexCode = String(body.apex_code ?? "").trim();
  const orderId = String(body.order_id ?? "").trim();
  const purchaseAmount = Number(body.purchase_amount ?? 0);
  const commissionAmount = Number(body.commission_amount ?? 0);
  const currency = String(body.currency ?? "USD").trim().toUpperCase().slice(0, 3);

  if (!eventId || !firmId || (!clickId && !apexCode) || !Number.isFinite(purchaseAmount) || purchaseAmount < 0 || !Number.isFinite(commissionAmount) || commissionAmount < 0) {
    return respond({ error: "event_id, firm_id, click_id or apex_code, and valid amounts are required." }, 400);
  }

  const supabase = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let userId: string | null = null;
  let purchase: Record<string, unknown> | null = null;

  if (clickId) {
    const { data: click, error } = await supabase.from("referral_clicks").select("id,user_id,firm_id").eq("id", clickId).maybeSingle();
    if (error) return respond({ error: "Referral click lookup failed." }, 500);
    if (click && click.firm_id !== firmId) return respond({ error: "Referral click does not match this firm." }, 400);
    if (click) userId = click.user_id;
  }

  if (orderId && clickId && userId) {
    const { data, error } = await supabase.from("purchases").select("*").eq("user_id", userId).eq("firm_id", firmId).eq("order_id", orderId).maybeSingle();
    if (error) return respond({ error: "Purchase lookup failed." }, 500);
    purchase = data as Record<string, unknown> | null;
  } else if (orderId && apexCode) {
    const { data, error } = await supabase.from("purchases").select("*").eq("firm_id", firmId).eq("order_id", orderId).ilike("code_used", apexCode).limit(2);
    if (error) return respond({ error: "Code purchase lookup failed." }, 500);
    if (data?.length === 1) {
      purchase = data[0] as Record<string, unknown>;
      userId = String(data[0].user_id);
    }
  }

  let status: "matched" | "unmatched" = "unmatched";
  let purchaseId: string | null = null;
  if (purchase) {
    purchaseId = String(purchase.id);
    const memberReportedAmount = Number(purchase.amount ?? 0);
    // Do not auto-approve if the partner's purchase value differs from the member claim.
    if (purchaseAmount > 0 && Math.abs(memberReportedAmount - purchaseAmount) <= 0.02) status = "matched";
  }

  const conversion = {
    id: eventId,
    click_id: clickId || null,
    user_id: userId,
    firm_id: firmId,
    purchase_id: purchaseId,
    order_id: orderId || null,
    purchase_amount: purchaseAmount,
    commission_amount: commissionAmount,
    currency,
    status,
    source: String(body.source ?? "partner-postback").slice(0, 100),
    payload: body,
    created_at: new Date().toISOString(),
  };
  const { error: conversionError } = await supabase.from("affiliate_conversions").upsert(conversion, { onConflict: "id" });
  if (conversionError) return respond({ error: "Conversion could not be recorded." }, 500);

  if (purchase && purchase.status === "pending") {
    const payload = purchase.payload && typeof purchase.payload === "object" ? purchase.payload as Record<string, unknown> : {};
    const nextPayload = { ...payload, status: "approved", adminNote: `Affiliate postback verified (${eventId})`, reviewedAt: new Date().toISOString() };
    const { error: purchaseError } = await supabase.from("purchases").update({
      status: "approved", admin_note: nextPayload.adminNote, reviewed_at: nextPayload.reviewedAt, payload: nextPayload,
    }).eq("id", purchaseId);
    if (purchaseError) return respond({ error: "Conversion was recorded but the purchase approval failed.", event_id: eventId }, 500);
  }

  return respond({ ok: true, event_id: eventId, status, purchase_id: purchaseId });
});
