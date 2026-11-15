#!/usr/bin/env bash
# Step-1 verification, in order. Needs: psql, node 22+, and DATABASE_URL pointing at a CLEAN, DISPOSABLE Supabase dev database.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to a clean dev database}"
for f in supabase/migrations/*.sql; do echo "== apply $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
echo "== seed";            psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
echo "== ledger tests";    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/ledger.test.sql
echo "== e2e workflow";    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/e2e_workflow.test.sql
echo "== concurrency";     node scripts/concurrent-redeem.mjs
echo "== install";         npm ci || npm install
echo "== unit tests";      npm run test:unit
echo "== typecheck";       npm run typecheck
echo "== lint";            npm run lint
echo "== build";           NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-http://localhost} NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-x} npm run build
echo "ALL CHECKS PASSED"
