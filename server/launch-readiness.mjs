import { availablePayoutMethods } from './payout-methods.mjs';

export function mountLaunchReadiness(app, store, vault) {
  app.get('/api/admin/launch-readiness', async (_req, res) => {
    const config = await store.settings();
    const methods = await availablePayoutMethods(store);
    const projectUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    let projectStatus = 'not-configured';
    if (projectUrl && publicKey && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(projectUrl.replace(/\/$/, ''))) {
      try {
        const result = await fetch(`${projectUrl.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(6000) });
        projectStatus = result.ok ? 'reachable' : 'unavailable';
      } catch { projectStatus = 'unavailable'; }
    }
    const secureOrigin = /^https:\/\//.test(process.env.PUBLIC_ORIGIN || '');
    const adminCount = (await store.db.prepare("SELECT count(*) AS total FROM users WHERE role='admin' AND suspended=0").get()).total;
    const checks = [
      { id: 'database', label: 'Supabase database', state: store.kind === 'supabase-postgres' ? 'ready' : 'attention', detail: store.kind === 'supabase-postgres' ? 'Application records are stored in the private Postgres schema.' : 'Currently using local SQLite. Set SUPABASE_DB_URL and DATA_BACKEND=supabase to activate cloud storage.' },
      { id: 'project', label: 'Supabase project API', state: projectStatus === 'reachable' ? 'ready' : 'attention', detail: projectStatus === 'reachable' ? 'Project URL and publishable key accepted. This does not imply the app database is migrated.' : 'Configure the public project URL and publishable key on the server.' },
      { id: 'encryption', label: 'Payout detail encryption', state: vault.environmentKey ? 'ready' : 'attention', detail: vault.environmentKey ? 'A server environment encryption key is configured.' : 'Encrypted locally. Set a persistent DATA_ENCRYPTION_KEY before cloud deployment.' },
      { id: 'https', label: 'Production HTTPS origin', state: secureOrigin ? 'ready' : 'attention', detail: secureOrigin ? 'PUBLIC_ORIGIN is configured for HTTPS. Verify the deployed certificate and cookie flow.' : 'Set PUBLIC_ORIGIN to the HTTPS address of the deployed website.' },
      { id: 'owner', label: 'Administrator access', state: Number(adminCount) > 0 ? 'ready' : 'attention', detail: `${adminCount} active administrator account(s). Member registrations cannot grant admin access.` },
      { id: 'methods', label: 'Member payout methods', state: methods.length ? 'ready' : 'attention', detail: methods.length ? `${methods.length} active payout method(s). Review their questions and payment instructions.` : 'Add or activate at least one payout method.' },
      { id: 'contact', label: 'Support contact', state: config.contact.email ? 'ready' : 'attention', detail: config.contact.email ? `Support email configured: ${config.contact.email}. Test delivery manually.` : 'Set a support email in Settings.' },
      { id: 'key-rotation', label: 'Rotate the exposed Supabase secret', state: 'manual', detail: 'The secret previously shared in chat must be revoked or rotated in Supabase. This app does not use or retain that key.' },
      { id: 'partner', label: 'Partner offers and fulfilment', state: 'manual', detail: 'Confirm actual affiliate codes, refund terms, payout processing, credit reward availability, and any partner postback connection.' },
      { id: 'legal', label: 'Launch policies and email recovery', state: 'manual', detail: 'Publish owner-approved privacy/terms and configure a verified account recovery process. No automated email provider is connected.' },
    ];
    res.json({ database: store.kind, projectUrl: projectUrl || null, checks, automaticChecksReady: checks.filter((check) => check.state !== 'manual').every((check) => check.state === 'ready'), manualChecksRequired: true });
  });
}