# Account API Connection Help

The website can display its public layout without its account server. However,
sign-in, accounts, purchases, admin changes and payouts must reach the Node API.
Reconnect retries that API; it cannot start a stopped backend or create a database
connection from a publishable API key.

## Windows / Local Development

In PowerShell, open the latest extracted project folder and run:

```powershell
npm install --include=dev
npm run dev
```

Keep that terminal open. The command must print `node server/index.mjs` and an
`APEX website + API` URL. If it prints only `vite`, use the current backend-enabled
project, not an older download. Stop an old Vite process with Ctrl+C before
starting the combined server on the same port.

Open the exact URL printed by the integrated server. The default is
`http://localhost:5173`. Do not open `dist/index.html` directly and do not use a
frontend-only preview to test account features.

In another terminal, run `npm run doctor`. It checks configuration flags and
the public API health response without printing database passwords or API secrets.

## Check The Endpoint

Open `http://localhost:5173/api/health` (or `/api/health` on the deployed domain).
A healthy combined server returns JSON containing:

```json
{
  "ok": true,
  "ready": true,
  "service": "apex-account-api",
  "database": "sqlite"
}
```

`database` is `supabase-postgres` when cloud database mode is configured.

- HTTP 404/405: `/api` is not reaching the current account backend.
- HTML instead of JSON: a static host or frontend SPA fallback handled `/api`.
- HTTP 502/503/504: the Node process is unavailable, starting, or cannot reach
  its account database. Inspect the server terminal.
- HTTP 401/403: inspect the session, website origin or hosting access rules.
- `ready: false` with an APEX error code: follow the database/configuration
  instruction and restart the server after changing environment variables.

For a deployed domain, run `npm run doctor -- --url https://your-domain.com`.
Do not include passwords, tokens or database connection strings in that URL.

## Supabase Mode

If `DATA_BACKEND=supabase`, configure the private `SUPABASE_DB_URL` from the
Supabase Connect dialog and the existing persistent `DATA_ENCRYPTION_KEY`.
See [Supabase setup](SUPABASE_SETUP.md). API keys do not replace the database
password. Do not silently switch an existing live cloud account database to
SQLite to hide the error; that would use a different data store.

If encrypted payment records already exist, restore their original key. Do not
delete the database or generate a replacement key to resolve a connection warning.

## Hosting

Build with `npm run build`, then run `npm start` on a Node-capable host. This
serves the built website and `/api` on one origin. A static upload of the `dist`
folder cannot execute this backend. If using a reverse proxy, forward `/api`
to the same APEX backend and configure `PUBLIC_ORIGIN` for the actual HTTPS site.

If the issue remains, share the HTTP status, non-sensitive `/api/health` JSON,
and the redacted server terminal error. Never share API secrets, database URLs,
passwords, encryption keys or payout details.