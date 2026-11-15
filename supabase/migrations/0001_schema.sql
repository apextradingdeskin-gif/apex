-- Apex Trading Community — core schema (PostgreSQL / Supabase)
create extension if not exists pgcrypto;

create type submission_status as enum ('pending','under_review','more_info_required','approved','rejected');
create type ledger_type as enum ('purchase_reward','redemption','admin_credit','admin_deduction','reversal','promo_bonus');
create type redemption_status as enum ('pending','processing','fulfilled','rejected','cancelled');
create type ticket_status as enum ('open','pending','resolved','closed');

-- ───────── Access control ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  country text,
  avatar_url text,
  discord_username text,
  preferred_market text,
  interests text[] not null default '{}',
  onboarded boolean not null default false,
  suspended boolean not null default false,
  email_prefs jsonb not null default '{"marketing":false,"transactional":true}',
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now()
);
create table roles (id serial primary key, key text unique not null, name text not null);
create table permissions (key text primary key, description text);
create table role_permissions (
  role_id int references roles(id) on delete cascade,
  permission_key text references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);
create table user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role_id int references roles(id) on delete cascade,
  granted_by uuid, created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- ───────── Marketplace ─────────
create table partner_categories (
  id serial primary key, slug text unique not null, name text not null, sort int default 0
);
create table partners (
  id uuid primary key default gen_random_uuid(),
  category_id int not null references partner_categories(id),
  name text not null, slug text unique not null,
  logo_url text, banner_url text, description text, website_url text,
  market text check (market in ('forex','crypto','futures','perps','multi')),
  terms text, featured boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now()
);
-- commission data is staff-only (separate table, no public policy)
create table partner_private (
  partner_id uuid primary key references partners(id) on delete cascade,
  commission_info text, tracking_params jsonb default '{}'
);
create table partner_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  name text not null, challenge_type text, account_size int,
  price numeric(12,2), currency char(3) default 'USD',
  discount_percent numeric(5,2) check (discount_percent between 0 and 100),
  credit_base int not null default 0,          -- flat credits
  credit_rate numeric(8,4) not null default 0, -- credits per currency unit
  min_purchase numeric(12,2) default 0,
  attribution_notes text, active boolean not null default true
);
create table discount_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  code text not null, active boolean not null default true, unique (partner_id, code)
);
create table affiliate_links (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  offer_id uuid references partner_offers(id) on delete set null,
  url text not null check (url ~ '^https://'), active boolean not null default true
);
create table affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  click_ref text unique not null default encode(gen_random_bytes(9),'hex'),
  user_id uuid references auth.users(id) on delete set null,
  partner_id uuid not null references partners(id),
  offer_id uuid references partner_offers(id),
  created_at timestamptz not null default now()
);
create index on affiliate_clicks (partner_id, created_at);

-- ───────── Purchases ─────────
create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,   -- profiles(id) = auth.users(id); enables API embeds
  partner_id uuid not null references partners(id),
  offer_id uuid references partner_offers(id),
  order_id text not null check (length(trim(order_id)) > 0),
  purchase_date date not null, amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'USD', discount_code text, partner_email text, notes text,
  status submission_status not null default 'pending',
  credits_requested int not null default 0 check (credits_requested >= 0),
  credits_approved int check (credits_approved >= 0),
  reviewer_id uuid, review_notes text, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (partner_id, order_id)            -- one claim per partner order, platform-wide
);
create index on submissions (user_id, created_at desc);
create index on submissions (status, created_at);
create table submission_proofs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  storage_path text not null, mime_type text, created_at timestamptz not null default now()
);
create table submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  reviewer_id uuid not null, decision submission_status not null, notes text,
  created_at timestamptz not null default now()
);
create table email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google', encrypted_refresh_token text not null,
  scopes text[] not null, consented_at timestamptz not null default now(), revoked_at timestamptz,
  unique (user_id, provider)
);
create table email_sync_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references email_connections(id) on delete cascade,
  event text not null, detail jsonb, created_at timestamptz not null default now()
);

-- ───────── Credits (append-only) ─────────
create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  type ledger_type not null,
  amount int not null check (amount <> 0),          -- signed: + earn, − spend
  reference_type text, reference_id uuid, description text not null,
  idempotency_key text not null unique,
  actor_id uuid, created_at timestamptz not null default now()
);
create index on credit_ledger (user_id, created_at desc);
create table wallet_balance_cache (
  user_id uuid primary key references auth.users(id),
  balance bigint not null default 0 check (balance >= 0),   -- DB refuses overdraft
  total_earned bigint not null default 0,
  total_spent bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────── Rewards ─────────
create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null, image_url text, region text, currency char(3),
  credits_cost int not null check (credits_cost > 0),
  fulfillment_method text not null default 'manual',
  featured boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table reward_inventory (
  reward_id uuid primary key references rewards(id) on delete cascade,
  stock int check (stock >= 0)            -- NULL = unlimited
);
create table redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  reward_id uuid not null references rewards(id),
  credits_spent int not null check (credits_spent > 0), currency char(3),
  status redemption_status not null default 'pending',
  admin_id uuid, notes text,
  created_at timestamptz not null default now(), fulfilled_at timestamptz
);
create index on redemptions (user_id, created_at desc);
create table redemption_fulfillments (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references redemptions(id) on delete cascade,
  code_reference text, notes text, admin_id uuid, created_at timestamptz not null default now()
);

-- ───────── Community & content ─────────
create table announcements (id uuid primary key default gen_random_uuid(), title text not null, body text, published boolean default false, created_at timestamptz default now());
create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, title text not null, body text, read_at timestamptz, created_at timestamptz default now()
);
create index on notifications (user_id, read_at);
create table support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, subject text not null, status ticket_status default 'open', created_at timestamptz default now());
create table support_messages (id uuid primary key default gen_random_uuid(), ticket_id uuid not null references support_tickets(id) on delete cascade, author_id uuid not null, body text not null, created_at timestamptz default now());
create table faq_entries (id serial primary key, question text not null, answer text not null, sort int default 0, published boolean default true);
create table testimonials (id uuid primary key default gen_random_uuid(), author text not null, handle text, body text not null, approved boolean default false, featured boolean default false, created_at timestamptz default now());
create table blog_posts (id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, excerpt text, body text, cover_url text, published boolean default false, published_at timestamptz);
create table video_embeds (id serial primary key, youtube_url text not null, title text, description text, sort int default 0, published boolean default true);
create table saved_partners (user_id uuid references auth.users(id) on delete cascade, partner_id uuid references partners(id) on delete cascade, primary key (user_id, partner_id));

-- ───────── Platform ─────────
create table site_settings (key text primary key, value jsonb not null);
create table site_statistics (key text primary key, label text not null, value bigint not null, sort int default 0, visible boolean default true);
create table admin_audit_logs (
  id bigserial primary key, actor_id uuid, action text not null, entity_type text, entity_id text,
  reason text, detail jsonb, created_at timestamptz not null default now()
);
create table feature_flags (key text primary key, enabled boolean not null default false, note text);
