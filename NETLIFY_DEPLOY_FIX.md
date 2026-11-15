# APEX Trading Community — Netlify deployment

This source tree is a React + Vite application, not a Next.js application.

## Netlify build configuration
The included netlify.toml sets:
- Build command: npm run build
- Publish directory: dist
- Node.js: 22.16.0
- SPA fallback to index.html

Commit and push this file to the same GitHub repository and branch selected by the Netlify site, then trigger a new deploy.

## Required Netlify environment variables
Set these under Site configuration → Environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY (publishable/anon key only)

Never put a Supabase service-role or secret key in a VITE_ variable. Vite exposes VITE_ variables to browser code. Trigger a new deploy after changing variables.

## Supabase database
If the site still reports missing database tables, review and apply
supabase/migrations/20260827000000_apex_backend.sql in the Supabase SQL Editor.
Review the migration before running it against a database containing existing data.

## Credentials
.env.local is intentionally excluded from this deployment ZIP. Keep credentials out of source control and shared archives.
