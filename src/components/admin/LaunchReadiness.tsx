import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CircleAlert, ClipboardCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";

type Report = { database: string; projectUrl: string | null; automaticChecksReady: boolean; manualChecksRequired: boolean; checks: { id: string; label: string; state: "ready" | "attention" | "manual"; detail: string }[] };

export default function LaunchReadiness() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { setReport(await api<Report>("/admin/launch-readiness")); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not check launch configuration."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const automatic = report?.checks.filter((item) => item.state !== "manual") ?? [];
  return <section className="admin-card launch-readiness-panel">
    <div className="admin-section-title"><div><h2><ClipboardCheck size={20} /> Launch checklist</h2><p>Check the actual server configuration before publishing. Public API access is not the same as a connected application database.</p></div><button className="button button-outline button-small" disabled={loading} onClick={() => void load()}><RefreshCw size={14} />{loading ? "Checking..." : "Refresh checks"}</button></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {report && <>
      <div className="launch-check-summary"><ShieldCheck size={23} /><div><strong>{report.automaticChecksReady ? "Automatic checks passed" : "Configuration needs attention"}</strong><p>{automatic.filter((item) => item.state === "ready").length} of {automatic.length} automated checks passed. Owner review is still required for the manual items.</p></div><span>{report.database === "supabase-postgres" ? "Supabase Postgres" : "Local SQLite"}</span></div>
      <div className="launch-check-list">{report.checks.map((item) => <article key={item.id} className={`check-${item.state}`}><span>{item.state === "ready" ? <Check size={17} /> : <CircleAlert size={17} />}</span><div><h3>{item.label}</h3><p>{item.detail}</p></div><small>{item.state === "ready" ? "Configured" : item.state === "manual" ? "Owner review" : "Action needed"}</small></article>)}</div>
      {report.projectUrl && <a className="launch-project-link" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase dashboard <ArrowUpRight size={15} /></a>}
    </>}
    {!report && loading && <div className="admin-empty"><RefreshCw size={24} /><p>Checking the database and deployment settings...</p></div>}
  </section>;
}