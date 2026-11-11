import { ExternalLink, RefreshCw, ServerOff } from "lucide-react";
import { useAccount } from "../context/AccountContext";

export default function ConnectionNotice() {
  const { connection, connectionError, connectionIssue, reconnecting, refresh } = useAccount();
  if (connection !== "offline") return null;
  const apiMissing = ["API_NOT_DEPLOYED", "API_WRONG_RESPONSE", "API_VERSION_MISMATCH"].includes(connectionIssue);
  return <section className="backend-connection-warning account-service-notice" role="status" aria-live="polite">
    <ServerOff size={20} />
    <div className="account-service-message"><strong>{apiMissing ? "The account API is not connected to this address" : "Account services are temporarily unavailable"}</strong><p>{connectionError}</p>
      <details><summary>Connection help</summary><ol>
        <li>From the latest project folder, run <code>npm install --include=dev</code>, then <code>npm run dev</code>. The startup command must be <code>node server/index.mjs</code>, not just Vite.</li>
        <li>Open <a href="/api/health" target="_blank" rel="noreferrer">the API health check <ExternalLink size={11} /></a>. It should return JSON with <code>service: apex-account-api</code> and <code>ready: true</code>.</li>
        <li>If using Supabase mode, the server needs its private database connection string and payout encryption key. Public API keys alone do not configure the account database.</li>
        <li>For a deployed website, use a Node host or forward <code>/api</code> to this backend. Uploading only the <code>dist</code> folder cannot run accounts.</li>
      </ol><p>Run <code>npm run doctor</code> in the server terminal for a secret-safe diagnostic report. Do not delete the database or share passwords/API secrets.</p></details>
    </div>
    <button onClick={() => void refresh()} disabled={reconnecting}><RefreshCw size={13} className={reconnecting ? "connection-spinning" : ""} />{reconnecting ? "Reconnecting..." : "Reconnect"}</button>
  </section>;
}