# APEX Backend Setup

The site supports Supabase Auth, Postgres, Row Level Security and Supabase Storage. The supplied project URL and publishable key are configured locally in the ignored `.env.local`. The project is reachable, but the APEX database migration has not been applied yet; the live `profiles` table currently returns “not found.”

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com). In **Project Settings → API Keys**, copy the Project URL and the publishable key (or legacy anon key).

Never put a `service_role` or secret key in the website. The browser client uses only the publishable/anon key; Postgres RLS controls its access. A Supabase secret key was pasted into the conversation during setup. Rotate it in the Supabase dashboard now; do not add it to `.env.local`, Vite variables, or client code.

## 2. Configure the website

For your Windows checkout, copy `.env.example` to `.env.local` in the project root and replace the two values with the Supabase URL and publishable key you supplied:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Restart the Vite dev server after changing environment variables. Add the same two variables to your hosting provider before deploying. `.env.local` is git-ignored.

## 3. Apply the database schema

Open the Supabase **SQL Editor**, paste in `supabase/migrations/20260827000000_apex_backend.sql`, and run it. The migration creates:

- Member profiles with server-controlled roles and suspension status
- Firms, platform settings, orders, reviews and referral-click tables
- Marketplace catalog and server-validated credit-redemption RPC
- Purchase cashback calculation on the database, not the browser
- Configurable payout methods and server-validated payout requests
- Affiliate click IDs and an admin-only conversion ledger
- Row Level Security policies for member-owned records and admin operations
- A public-read logo bucket whose uploads and edits are admin-only

## 4. Create the first administrator

1. Open the website and create a normal account with the sign-up form.
2. If email confirmation is enabled, confirm the account using the email Supabase sends.
3. In the Supabase SQL Editor, promote that account by its exact email:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

4. Sign out and sign back in. The Admin console link will now appear for this account.

The website intentionally has no production “create admin” or “make me admin” browser flow. Direct visits to `#admin` by guests and members show an access gate, while database policies independently reject non-admin operations. If Supabase is not configured, the Vite **development server only** offers a local preview unlock so you can test the firm editor and image picker. That preview is omitted from production builds and must not be used for real member data.

To use that local-only image editor while developing, run `npm run dev`, visit `http://localhost:5173/#admin`, and select **Open local preview**. That development session only manages this browser's preview data.

## 5. Logo uploads

The firm editor accepts a file picker, drag-and-drop, and pasted images. Without Supabase credentials, the preview compresses logos and stores them in this browser's localStorage. With Supabase enabled, an authorized admin uploads the optimized logo to the `apex-firm-logos` Storage bucket; the firm record saves the public image URL.

## 6. Configure affiliate purchase confirmation

An order entered by a member is a **claim**, not proof that the firm received payment. APEX creates a unique click ID when a member activates a configured offer. In **Admin → Prop firms**, set that firm's actual affiliate URL and the sub-ID parameter accepted by its partner network (such as `sub_id`, `click_id`, or `s1`). URLs may include `{click_id}` where the network accepts a token in the URL itself. Enter an APEX promo code only if the firm assigned you one.

To receive automatic purchase confirmations, deploy `supabase/functions/affiliate-postback/index.ts`. Store the shared webhook secret in Supabase Function Secrets, never in the website:

```text
APEX_POSTBACK_SECRET=<long random secret shared with your affiliate network>
```

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Deploy with:

```powershell
npx supabase functions deploy affiliate-postback
```

Give the affiliate network this callback URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/affiliate-postback
```

The included `supabase/config.toml` disables Supabase JWT verification only for this public webhook; the function independently requires a valid HMAC signature. The network must send the click ID back as `click_id` and sign the raw JSON request body with HMAC-SHA256 in the `x-apex-signature` header. Expected fields are `event_id`, `click_id` (or `apex_code`), `firm_id`, `order_id`, `purchase_amount`, `commission_amount`, and `currency`. A signed matching postback appears in **Admin → Affiliate conversions** and can approve its matching purchase. Unmatched events remain visible for review. Networks that do not support click IDs or purchase postbacks cannot automatically confirm conversions.

## Important migration note

Data created by the earlier localStorage preview is not automatically uploaded to Supabase. Sign-up accounts, orders, reviews and redemption requests created before backend setup remain in their original browser storage. Export or migrate any records you need before switching users to the new backend.

The development preview cannot securely assign admin roles or verify cashback. Use Supabase Auth and the included RLS policies for real member data and admin access. APEX affiliate links/codes and the partner callback still need to be supplied and configured before cashback can be attributed for each firm.