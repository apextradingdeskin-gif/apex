# APEX TRADING Website

The React website and Express API run together on one origin. Accounts, sessions,
firm listings, purchases, reviews, credits, redemptions, uploaded logos and audit
events persist in local SQLite or Supabase Postgres. Browser storage is only for non-sensitive
preferences and unsaved image drafts.

## Run Locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and choose a persistent `DATABASE_PATH`.
3. Start the website and API with `npm run dev`.
4. Open `http://localhost:5173`.

If the site displays an account connection warning, keep the server terminal
open and run `npm run doctor` in a second terminal. See
[Account Connection Help](docs/CONNECTION_TROUBLESHOOTING.md).

### Windows PowerShell

Use a current Node.js LTS release and open PowerShell inside the extracted
project folder. Install dependencies before starting the website:

```powershell
npm install --include=dev
npm run dev
```

Wait for installation to finish successfully. Do not install Vite globally.
If installation fails, resolve that error before trying to start the site.

If `npm run dev` prints `> vite`, your folder contains an older frontend-only
version. Download the latest backend-enabled project, which includes
`server/index.mjs` and the `admin:create` script. Its development command prints
`> node server/index.mjs`.

Before starting the server, you can create your owner account by running
`npm run admin:create`. If the server is already running, use a second terminal
in the same project folder. Then open `http://localhost:5173/admin`.

Normal registrations always create **member** accounts. Old browser-only demo
accounts and admin flags are not trusted or automatically migrated. Register a
new member account after upgrading.

## Provision The Owner

Run `npm run admin:create` on the server. It asks for the administrator email
and a unique password of at least 12 characters. The interactive password input
is visible, so run it from a private terminal. For automation, supply
`APEX_ADMIN_EMAIL`, `APEX_ADMIN_PASSWORD` and optionally `APEX_ADMIN_NAME`
through the server environment instead. Never use a `VITE_` variable for secrets.

Then open `/admin` and sign in. There is **no public admin-setup endpoint**.
An existing owner can assign another member the admin role. A member cannot
promote themselves, approve purchases, change rates, upload media, or export
private data. The server rejects those requests even if the UI is modified.
Rerun the provisioning command to reset an owner's password from the server.

## Logos

In **Admin > Settings & data > Website branding**, choose an image, drag it
into the picker, or copy an actual image and press Ctrl+V / Cmd+V inside the
picker. The Paste Image button also works when clipboard permission is granted.
An instant preview and a recoverable local draft appear before saving.

Choose **Save website logo** to upload it to the backend. Firm editors provide
the same picker. PNG, JPEG and WebP are accepted up to 4 MB. The backend verifies
the actual image bytes, limits dimensions, strips metadata and saves a WebP
image in the database. No third-party image link is necessary.

## Production

For your Supabase project, follow [Supabase Setup](docs/SUPABASE_SETUP.md).
The supplied public project API is reachable, but cloud database activation
requires `SUPABASE_DB_URL` from the Connect dialog and a server encryption key.
The secret key shared in chat is not used or stored; rotate it before launch.

- Build with `npm run build` and run `npm start`.
- `npm run preview` also runs the backend, on port 4173 by default.
- Set `PORT`, `DATABASE_PATH` and `PUBLIC_ORIGIN=https://your-domain.com`.
- Serve over HTTPS. Production sessions use Secure, HTTP-only, SameSite cookies.
- If a trusted reverse proxy terminates HTTPS, set `TRUST_PROXY=1`.
- In SQLite mode, keep the database and payout-key file on a persistent private disk, not an ephemeral deployment
  filesystem. This setup is intended for a single application instance.
- Back up the SQLite database and its media. A consistent online backup can be
  created using SQLite's backup tooling. The admin JSON export is a sanitized
  operations report, not an authentication backup.
- Firm-catalog imports are validated and never create users or change roles.
- The website cannot be hosted as static HTML alone: `/api` must reach this
  server. `npm start` serves the built website and API together.

Members can submit payout requests directly on the website; the admin payout
desk manages reservations, review and recorded payment references. Actual fund
transfers remain a human operation. No payment processor is configured.

Partner sales can be reconciled manually or received through the signed webhook
contract. Automatic reporting requires the real firm's affiliate URL and an
adapter/postback configured by that partner. Merely showing a coupon or recording
a click does not confirm a purchase. See [Partner Tracking](docs/PARTNER_TRACKING.md)
for setup, signature details, payout rules and editable social settings.

No email-delivery provider is configured.
APEX Assist remains a site-knowledge automated helper, not an external LLM.

## Verification

- `npm run test:backend`: permission boundaries, session security, private-data
  isolation, cashback calculations, redemptions, image validation, moderation,
  and persistence after restart.
- `npx tsc --noEmit`: frontend type checking.
- `npm run build`: production website build.
- `npm run db:migrate`: create the private application schema in the configured Supabase database.
- `npm run doctor`: inspect account API connectivity without printing secrets.
- `npm run test:browser`: Chromium checks for member restrictions, admin login,
  image upload/paste, local draft recovery and branding persistence. Install the
  browser once with `npx playwright install --with-deps chromium`.