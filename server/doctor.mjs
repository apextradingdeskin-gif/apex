import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';

const urlFlag = process.argv.indexOf('--url');
const jsonOutput = process.argv.includes('--json');
const configuredTarget = urlFlag >= 0 ? process.argv[urlFlag + 1] : `http://127.0.0.1:${process.env.PORT || 5173}`;
const mode = (process.env.DATA_BACKEND || 'sqlite').trim().toLowerCase();
const checks = [];
let target;
try { target = new URL('/api/health', configuredTarget); if (!['http:', 'https:'].includes(target.protocol)) throw new Error(); target.username = ''; target.password = ''; }
catch { console.error('Use a valid http/https website URL with --url.'); process.exit(1); }

const add = (name, ok, detail) => checks.push({ name, ok, detail });
add('Database mode', ['sqlite', 'supabase'].includes(mode), mode === 'supabase' ? 'Supabase Postgres selected.' : mode === 'sqlite' ? 'Private local SQLite selected.' : 'DATA_BACKEND must be sqlite or supabase.');
if (mode === 'supabase') {
  add('Database connection setting', Boolean(process.env.SUPABASE_DB_URL), process.env.SUPABASE_DB_URL ? 'SUPABASE_DB_URL is present (value hidden).' : 'Set SUPABASE_DB_URL privately using the actual database connection string from Supabase > Connect.');
  add('Payout encryption setting', /^[a-f0-9]{64}$/i.test(process.env.DATA_ENCRYPTION_KEY || ''), 'Supabase requires the existing persistent 64-character hexadecimal DATA_ENCRYPTION_KEY. Values are never printed.');
}
let startup = '';
try { startup = JSON.parse(readFileSync('package.json', 'utf8')).scripts?.dev || ''; } catch { /* reported below */ }
add('Integrated startup script', startup.includes('server/index.mjs'), startup.includes('server/index.mjs') ? 'npm run dev starts the website and API together.' : 'This folder is not the latest backend-enabled project. Do not run only Vite.');
const builtWebsite = existsSync('dist/index.html');
const devToolsAvailable = existsSync('node_modules/vite/package.json');
add('Installed dependencies', existsSync('node_modules/express/package.json') && (devToolsAvailable || builtWebsite), builtWebsite && !devToolsAvailable ? 'Production dependencies and built website detected.' : 'If dependencies are missing, run npm install --include=dev from this project folder.');

let healthy = false;
try {
  const response = await fetch(target, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  const json = /application\/json/i.test(response.headers.get('content-type') || '');
  const body = json ? await response.json().catch(() => null) : null;
  healthy = response.ok && body?.service === 'apex-account-api' && body?.ready === true;
  add('Account API health', healthy, healthy ? `Ready. Connected database: ${body.database}.` : `HTTP ${response.status}. ${body?.service === 'apex-account-api' ? `APEX is responding but not ready (${body.code || 'database unavailable'}). Check the server terminal.` : 'This address is not serving the APEX account API. Start the Node server or route /api to it; a static HTML upload cannot run accounts.'}`);
} catch { add('Account API health', false, 'No account API response. Start npm run dev and keep that terminal open. If startup fails, fix the reported configuration error.'); }

const report = { target: target.origin + target.pathname, ready: healthy && checks.every((item) => item.ok), checks };
if (jsonOutput) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`APEX connection check: ${report.target}`);
  for (const check of checks) console.log(`${check.ok ? '[OK]' : '[ACTION]'} ${check.name}: ${check.detail}`);
  if (!report.ready) console.log('Next: npm install --include=dev, then npm run dev. Open the exact URL printed by that server. Do not delete data or share private keys.');
}
if (!report.ready) process.exitCode = 1;