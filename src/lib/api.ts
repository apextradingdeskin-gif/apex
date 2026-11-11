export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "API_ERROR") { super(message); this.status = status; this.code = code; }
}

export function responseFailure(status: number, jsonResponse: boolean) {
  if (status === 404 || status === 405) return new ApiError(`The account API is missing at this website address (HTTP ${status}). Run the full APEX Node server, not a frontend-only or static preview.`, status, "API_NOT_DEPLOYED");
  if ([502, 503, 504].includes(status)) return new ApiError(`The account server is unavailable (HTTP ${status}). Check that the Node server is running and its database settings are complete.`, status, "SERVER_UNAVAILABLE");
  if (status === 401) return new ApiError("Your account session has expired. Please sign in again.", status, "SESSION_EXPIRED");
  if (status === 403) return new ApiError("The server refused this request. Check your session and the website's allowed origin.", status, "ACCESS_DENIED");
  if (status === 429) return new ApiError("Too many requests. Please wait a moment before trying again.", status, "RATE_LIMITED");
  if (!jsonResponse) return new ApiError(`The account API returned a webpage instead of account data (HTTP ${status}). Make sure /api is routed to the APEX Node server.`, status || 503, "API_WRONG_RESPONSE");
  return new ApiError(`The account server returned HTTP ${status}. Check the server terminal for the underlying error.`, status, "SERVER_ERROR");
}

export async function api<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`/api${path}`, {
      method, credentials: "same-origin", signal: controller.signal, cache: "no-store",
      headers: { "Accept": "application/json", "X-Apex-Client": "web", ...(data === undefined ? {} : { "Content-Type": "application/json" }) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const jsonResponse = /\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(response.headers.get("content-type") ?? "");
    const payload = jsonResponse ? await response.json().catch(() => null) : null;
    if (!response.ok) {
      if (["/bootstrap", "/health"].includes(path) && [404, 405].includes(response.status)) throw responseFailure(response.status, Boolean(payload));
      if (typeof payload?.message === "string" && payload.message.trim()) {
        const message = payload.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[private database connection]").replace(/sb_secret_[a-zA-Z0-9_-]+/g, "[private API key]").slice(0, 600);
        const code = typeof payload.code === "string" && /^[A-Z0-9_:-]{1,80}$/.test(payload.code) ? payload.code : "API_ERROR";
        throw new ApiError(message, response.status, code);
      }
      throw responseFailure(response.status, Boolean(payload));
    }
    if (!payload || typeof payload !== "object") throw responseFailure(response.status, false);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError("The account server took too long to respond. Check the server and database connection, then retry.", 504, "REQUEST_TIMEOUT");
    throw new ApiError("Cannot reach the account server. Check your internet connection and make sure the full APEX Node server is running.", 503, "NETWORK_UNREACHABLE");
  } finally { window.clearTimeout(timeout); }
}