# Supabase Setup And Launch Requirements

## Important Security Action

The Supabase secret API key shared in chat must be revoked or rotated in your
Supabase dashboard before launch. It is not stored in this project and is not
needed by this Postgres backend. Do not paste a replacement secret into chat or
put it in a `VITE_` or `NEXT_PUBLIC_` environment variable.

Your supplied project URL and publishable key were accepted by the public
Supabase API during development. That verifies the public project endpoint,
not a migrated application database.

## What Is Connected

The app supports two real storage modes:

- `DATA_BACKEND=sqlite`: private local SQLite for development.
- `DATA_BACKEND=supabase`: server-side Postgres in your Supabase project.

The website continues to use the existing Node API and HTTP-only sessions. User
accounts are stored in the application's private database schema; this setup
does not claim to enable Supabase Auth, social login, or email verification.
Browsers never receive the database password, encryption key, or private SQL
access. The private schema has RLS enabled and no access granted to Supabase's
`anon` or `authenticated` roles.

## Required Server Configuration

1. In Supabase, open **Connect > Session pooler** and copy the connection string.
   Copy the real host and username; do not guess a pooler region. Replace its
   password placeholder with your **database password**, URL-encoding special
   characters. A publishable or secret API key is not a database password.
2. Set `SUPABASE_DB_URL` privately in your server `.env` or hosting environment.
   Do not send it through the website or chat.
3. Set `DATA_BACKEND=supabase`.
4. Set a stable server-only `DATA_ENCRYPTION_KEY`: 32 cryptographically random
   bytes encoded as 64 hexadecimal characters. Keep it securely backed up.
   Payout answers cannot be recovered if this key is lost or changed.
   Generate one in a private terminal using
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`,
   then copy it only into your private server environment.
5. If TLS validation needs the project's root certificate, download it from
   Supabase database settings and set `SUPABASE_CA_FILE` to the private file.
   Certificate verification is enabled; do not disable it for Supabase.
6. Run `npm run db:migrate`. The idempotent migration creates only the app-owned
   `apex_private` schema, tables, indexes and security settings. It does not
   overwrite unrelated tables in your project.
7. Run `npm run admin:create` with Supabase mode enabled to provision the owner
   in the cloud database. Normal registrations cannot create administrators.
8. Build with `npm run build`, deploy the Node server, and run `npm start`.
   Configure `PUBLIC_ORIGIN` to the real HTTPS website address. Use
   `TRUST_PROXY=1` only behind a trusted reverse proxy.

The schema migration is in
`supabase/migrations/202611110001_apex_private.sql` for review.

Changing storage mode does not automatically upload existing development users,
orders, payout history, images, or encryption keys. Back up the old database and
plan a private data migration before switching any already-live site. Do not
use the sanitized admin JSON report as an authentication backup.

## Payout Methods

Open **Admin > Payout requests > Payout methods** to create, edit, activate,
retire or remove methods. Each method has its own name, settlement currency,
minimum, instructions and question set. Questions support text, email, number,
choice and long-text answers, with required flags and selected validations.

New requests use only active methods. Existing requests preserve their original
method and question snapshot, so editing or deleting a method never changes
the details of an old request. A method with open requests must be resolved
before it can be removed.

All submitted answers are encrypted. Public/member snapshots and exports omit
the encrypted payload and plaintext answers. An authorised admin loads the
answers separately when reviewing an individual payout, and that access is
recorded in the audit trail.

Adding a method does not connect a payment processor. Administrators still
perform the actual transfer using the agreed provider and record its reference.
Balances are USD; any settlement conversion must be agreed with the member.

## Before Publishing

Use **Admin > Launch checklist**. It reports actual database mode, project API
reachability, encryption configuration, HTTPS origin, admin access and active
payout methods. Manual checks cannot be automatically certified by this app:

- Rotate the exposed Supabase secret.
- Confirm partner-issued affiliate URLs/codes and real reward availability.
- Review your privacy policy, terms, business identity and data retention.
- Set up a verified member account-recovery/email process.
- Test the deployed HTTPS sign-in, purchase, payout and admin flows.

The Postgres adapter, migration, transactions, RLS restrictions and application
workflows are tested against a local PostgreSQL-compatible engine. The live
Supabase database cannot be activated until the server connection string is
configured. Do not treat a successful frontend build as proof that those live
deployment steps are complete.