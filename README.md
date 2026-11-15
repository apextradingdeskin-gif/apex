# Apex Trading Community — milestone 2 (marketplace, calculator, admin partners & rewards)

## Verification status — read this first
| Check | Result |
|---|---|
| Credits estimator unit tests (`npm run test:unit`, 7 tests) | **Executed, 7/7 passed** (Node 22) |
| Syntax parse of all 29 `.ts/.tsx` files | **Executed, 0 syntax errors** (this is NOT a type check) |
| `scripts/verify.sh` and `concurrent-redeem.mjs` syntax | **Executed** (`bash -n`, `node --check`) |
| Apply migrations 0001–0004 to a clean Supabase project | **NOT RUN** — no Postgres or network in the authoring sandbox |
| `ledger.test.sql`, `e2e_workflow.test.sql` | **NOT RUN** |
| `concurrent-redeem.mjs` (8 parallel redemptions) | **NOT RUN** |
| `npm install`, `tsc`, ESLint, `next build` | **NOT RUN** |
| Member vs admin permission tests against a live database | **NOT RUN** (written into `e2e_workflow.test.sql`) |

**One command runs every unexecuted step in order:** `DATABASE_URL=<clean dev db> npm run verify`.
Expect to fix some errors on the first run — the SQL and TSX have never been compiled or executed. Send me the output and I will fix them.

## What this milestone added
- `0004_marketplace_admin.sql`: configurable earning rules (`credit_cap`, `credit_conditions`), DB-level audit triggers on catalogue/reward tables, public `partner-logos` / `reward-images` buckets with permission-checked writes, `partner_has_link()`.
- Marketplace: `/marketplace`, `/marketplace/[category]` (search, sort, Forex/Crypto/Futures/Perps filter on prop firms, featured first), `/marketplace/[category]/[slug]` (logo, codes, offers table, estimated credits, terms, tracked referral button via `/go/[partnerId]`). Gift cards list the reward catalogue.
- `/credits-calculator`: reads offers from Supabase, shows discount, estimated credits, step-by-step explanation, conditions and disclaimer. It never writes credits. Rules are edited in admin; the same `estimateCredits()` function feeds the submission form.
- Admin: `/admin/partners` (+ `[id]`: edit, logo upload, feature, archive/restore, offers & earning rules, discount codes, referral links), `/admin/categories`, `/admin/rewards` (create/edit, image upload, INR/USD, cost, stock, active, region label, redemption queue with fulfil / processing / reject-and-refund through the existing `fulfill_redemption`).
- Tests: `tests/credits.test.ts`, `supabase/tests/e2e_workflow.test.sql` (all 15 workflow steps plus rejection, insufficient credits, duplicates, unauthorized operations, moderator isolation, refund-once, ledger immutability), `scripts/concurrent-redeem.mjs`.

## Unresolved issues
1. Nothing above the "executed" rows has been run (see table).
2. "Delete partner" is an archive (`active=false`) because submissions and clicks reference partners.
3. Reward `region` is a display label only; redemption is not restricted by member country yet.
4. `partners.commission_info` UI is not built (table `partner_private` exists, staff-only).
5. Marketplace sort by credits/discount is computed in the app after fetching the category (fine for hundreds of partners, not thousands).
6. Gift Cards marketplace page shows rewards, but there is no per-reward detail page.
7. Member resubmission after "more info required", proof-upload retry, onboarding, password reset, notifications UI and the earlier "Not built yet" list are still open.
8. Admin pages gate on `partners.manage` / `rewards.manage` / `redemptions.process`; the submissions queue page still only requires any staff role at the layout level (the database functions enforce `submissions.review`).
9. The concurrency script cannot clean up after itself (the ledger is append-only); use a disposable database.

## Setup
1. Create a Supabase project. Copy `.env.example` → `.env.local` and fill in the values.
2. Apply migrations in order with the SQL editor or `supabase db push`. Run `0002` as the project owner (it creates a trigger on `auth.users`).
3. Dev only: run `supabase/seed.sql`.
4. Auth settings: enable "Confirm email"; set Site URL and redirect URLs; add rate limits; add Google provider if wanted.
5. `npm install && npm run dev`.
6. First admin (no credentials in code): sign up normally, then in the SQL editor:
   `insert into user_roles(user_id, role_id) select '<your-user-uuid>', id from roles where key='super_admin';`
7. Verify everything: `DATABASE_URL=<clean dev db> npm run verify` (applies migrations, seeds, runs SQL + concurrency tests, installs, type-checks, lints, builds).

## Key design decisions
- **Money is only written by SECURITY DEFINER functions.** Browser roles have no INSERT/UPDATE on `credit_ledger`, `wallet_balance_cache`, `redemptions`.
- **Ledger is append-only** (trigger blocks UPDATE/DELETE/TRUNCATE). Corrections are reversal rows; an entry can be reversed once (unique idempotency key).
- **Overdraft is blocked by the database** (`wallet_balance_cache.balance >= 0` CHECK, row-locked upsert). `wallet_cache_drift()` should always return zero rows.
- **Duplicate claims:** `unique(partner_id, order_id)` plus a status guard under `FOR UPDATE` in `award_submission`.
- **Affiliate URLs are not publicly readable**; visitors go through `record_affiliate_click`, which logs the click.
- **Moderators get no financial or user-data permissions** by default; see `role_permissions` in `0002`.
- **Reward pools / raffles are not implemented**; `feature_flags.reward_pools` is seeded `false`. Do not enable without legal approval.
- Credits are *requested* from the offer rule at submission time, but staff set the final amount at approval.

## Known gaps to review
- Members cannot yet edit a submission after "more info required" (needs a resubmit function).
- Proof upload happens after the submission row; if upload fails the member must retry (add cleanup/retry).
- Username availability check in `register` is racy; the UNIQUE constraint is the real guard and its error should be surfaced.
- Rate limiting: rely on Supabase Auth limits now; add Upstash or similar for server actions.
- `site_settings` is publicly readable — never store secrets there.
- Regulatory review needed for affiliate disclosure, rewards terms, and any chance-based feature in IN/US.
