-- APEX Trading backend: Auth profiles, firm directory, orders, rewards, reviews, storage and RLS.
-- Apply with `supabase db push` or paste this migration into the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  referral_code text not null unique,
  referred_by text,
  role text not null default 'member' check (role in ('member', 'admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.firms (
  id text primary key, name text not null, market text not null default 'Forex',
  status text not null default 'active' check (status in ('active', 'archived')),
  cashback_rate numeric(6, 2) not null default 0 check (cashback_rate between 0 and 100),
  logo_url text, payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.app_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.purchases (
  id text primary key, user_id uuid not null references public.profiles (id) on delete cascade,
  firm_id text not null references public.firms (id), order_id text not null,
  amount numeric(12, 2) not null check (amount > 0), cashback_rate numeric(6, 2) not null default 0,
  cashback_amount numeric(12, 2) not null default 0, code_used text not null default '',
  referral_click_id text,
  purchase_date timestamptz not null, status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'rejected')),
  notes text not null default '', admin_note text, reviewed_at timestamptz,
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique (user_id, firm_id, order_id)
);
create table if not exists public.reviews (
  id text primary key, user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default '', firm_id text not null references public.firms (id) on delete cascade,
  rating integer not null check (rating between 1 and 5), account_model text not null default '',
  title text not null check (char_length(title) between 4 and 80),
  body text not null check (char_length(body) between 40 and 1200), recommend boolean not null default true,
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz, unique (user_id, firm_id)
);
create table if not exists public.redemptions (
  id text primary key, user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null, item_name text not null, cost integer not null check (cost > 0),
  status text not null default 'requested' check (status in ('requested', 'fulfilled', 'cancelled')),
  fulfilled_at timestamptz, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.payout_requests (
  id text primary key, user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0), method text not null,
  payout_details text not null, status text not null default 'requested'
    check (status in ('requested', 'processing', 'paid', 'rejected', 'cancelled')),
  admin_note text, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.referral_clicks (
  id text primary key, user_id uuid not null references public.profiles (id) on delete cascade,
  firm_id text not null references public.firms (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.affiliate_conversions (
  id text primary key, click_id text, user_id uuid references public.profiles (id) on delete set null,
  firm_id text not null references public.firms (id), purchase_id text references public.purchases (id) on delete set null,
  order_id text, purchase_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0, currency text not null default 'USD',
  status text not null default 'unmatched' check (status in ('matched', 'unmatched', 'reviewed', 'rejected')),
  source text not null default 'partner-postback', payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.reward_catalog (
  id text primary key, name text not null, category text not null, cost integer not null check (cost > 0),
  value text not null, description text not null, active boolean not null default true
);
create table if not exists public.audit_log (
  id text primary key, actor text not null, action text not null, target text not null,
  detail text not null default '', created_at timestamptz not null default now()
);

create index if not exists purchases_user_status_idx on public.purchases (user_id, status);
create index if not exists purchases_created_at_idx on public.purchases (created_at desc);
create index if not exists reviews_firm_status_idx on public.reviews (firm_id, status);
create index if not exists redemptions_user_status_idx on public.redemptions (user_id, status);
create index if not exists payout_requests_user_status_idx on public.payout_requests (user_id, status);
create index if not exists referral_clicks_user_idx on public.referral_clicks (user_id, created_at desc);
create index if not exists affiliate_conversions_click_idx on public.affiliate_conversions (click_id);
create index if not exists affiliate_conversions_firm_idx on public.affiliate_conversions (firm_id, created_at desc);

insert into public.app_settings (key, value) values
  ('credit_rate', '1'::jsonb), ('min_payout', '25'::jsonb),
  ('review_moderation', 'false'::jsonb), ('cashback_enabled', 'true'::jsonb),
  ('announcement', '"Research the rules. Compare the value. Trade your plan."'::jsonb),
  ('social_x', '"https://x.com/apexXtrades"'::jsonb),
  ('social_discord', '"https://discord.gg/fgkSY352aT"'::jsonb),
  ('social_instagram', '"https://www.instagram.com/apexxdesk/"'::jsonb),
  ('support_email', '"apextradingdesk.in@gmail.com"'::jsonb),
  ('payout_methods', '["PayPal", "Bank transfer", "Crypto wallet", "Other"]'::jsonb)
on conflict (key) do nothing;

insert into public.reward_catalog (id, name, category, cost, value, description) values
  ('challenge-10', '$10 Challenge Credit', 'Challenges', 1000, '$10', 'Credit toward an eligible prop-firm challenge fee, applied as a voucher or account credit.'),
  ('challenge-25', '$25 Challenge Credit', 'Challenges', 2400, '$25', 'A larger challenge credit with a small credit bonus built into the price.'),
  ('challenge-50', '$50 Challenge Credit', 'Challenges', 4500, '$50', 'Put a meaningful amount back toward your next evaluation account.'),
  ('challenge-100', '$100 Challenge Credit', 'Challenges', 8500, '$100', 'Our highest challenge credit tier for active traders who buy regularly.'),
  ('charting-month', 'Charting Platform Credit', 'Tools', 1500, '$15', 'Credit toward a charting or analytics subscription of your choice.'),
  ('journal-year', 'Trading Journal Credit', 'Tools', 3000, '$30', 'Credit toward a trade-journaling or performance analytics tool.'),
  ('vps-quarter', 'Trading VPS Credit', 'Tools', 3600, '$36', 'Credit toward a virtual server for running platforms and automated strategies.'),
  ('gift-10', '$10 Digital Gift Card', 'Gift cards', 1100, '$10', 'A digital gift card from a major retailer, delivered by email after fulfilment.'),
  ('gift-25', '$25 Digital Gift Card', 'Gift cards', 2700, '$25', 'A mid-size digital gift card for everyday spending.'),
  ('gift-50', '$50 Digital Gift Card', 'Gift cards', 5300, '$50', 'A larger digital gift card for travel, tech or shopping.'),
  ('coaching-30', '30-Minute Strategy Review', 'Experiences', 6000, '1 session', 'A one-to-one review of your risk plan, journal and challenge approach.'),
  ('workshop-seat', 'Live Workshop Seat', 'Experiences', 2000, '1 seat', 'Reserve a seat in an upcoming APEX trader workshop on challenge rules and risk.')
on conflict (id) do nothing;

create or replace function public.is_apex_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and not p.suspended
  );
$$;
revoke all on function public.is_apex_admin() from public;
grant execute on function public.is_apex_admin() to anon, authenticated;

create or replace function public.is_active_apex_member()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and not p.suspended
  );
$$;
revoke all on function public.is_active_apex_member() from public;
grant execute on function public.is_active_apex_member() to anon, authenticated;

create or replace function public.create_profile_for_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, referral_code, referred_by)
  values (
    new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'APX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    nullif(new.raw_user_meta_data ->> 'referred_by', '')
  );
  return new;
end;
$$;
drop trigger if exists on_apex_auth_user_created on auth.users;
create trigger on_apex_auth_user_created after insert on auth.users
  for each row execute procedure public.create_profile_for_new_auth_user();

create or replace function public.prevent_member_privilege_escalation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  if not public.is_apex_admin() and (
    new.role is distinct from old.role or new.suspended is distinct from old.suspended or
    new.referral_code is distinct from old.referral_code or new.referred_by is distinct from old.referred_by or
    new.email is distinct from old.email
  ) then raise exception 'Only an APEX administrator may change protected profile fields.'; end if;
  return new;
end;
$$;
drop trigger if exists protect_apex_profile_privileges on public.profiles;
create trigger protect_apex_profile_privileges before update on public.profiles
  for each row execute procedure public.prevent_member_privilege_escalation();

create or replace function public.prepare_apex_purchase()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  rate numeric(6, 2);
  enabled boolean;
  apex_code text;
  firm_status text;
begin
  if tg_op = 'INSERT' then
    if not public.is_apex_admin() then
      new.user_id := auth.uid();
      new.status := 'pending';
      new.admin_note := null;
      new.reviewed_at := null;
      select coalesce((value #>> '{}')::boolean, true) into enabled
        from public.app_settings where key = 'cashback_enabled';
      if enabled is false then raise exception 'Cashback submissions are paused.'; end if;
    end if;
    select f.cashback_rate, f.payload ->> 'apexCode', f.status into rate, apex_code, firm_status from public.firms f where f.id = new.firm_id;
    if firm_status is distinct from 'active' then raise exception 'Firm is not active for cashback.'; end if;
    if rate is null then raise exception 'Firm is not active for cashback.'; end if;
    if new.referral_click_id is not null then
      if not exists (select 1 from public.referral_clicks c where c.id = new.referral_click_id and c.user_id = new.user_id and c.firm_id = new.firm_id) then
        raise exception 'The referral click could not be verified for this account and firm.';
      end if;
    elsif apex_code is null or upper(trim(new.code_used)) <> upper(trim(apex_code)) then
      raise exception 'Submit an eligible APEX referral click or APEX promo code to request cashback.';
    end if;
    new.cashback_rate := rate;
    new.cashback_amount := round(new.amount * rate / 100, 2);
  elsif not public.is_apex_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only an administrator can update purchase verification.';
  end if;
  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'id', new.id, 'userId', new.user_id, 'firmId', new.firm_id, 'orderId', new.order_id,
    'amount', new.amount, 'cashbackRate', new.cashback_rate, 'cashbackAmount', new.cashback_amount,
    'codeUsed', new.code_used, 'referralClickId', new.referral_click_id, 'purchaseDate', new.purchase_date, 'createdAt', new.created_at,
    'status', new.status, 'notes', new.notes, 'adminNote', new.admin_note, 'reviewedAt', new.reviewed_at
  );
  return new;
end;
$$;
drop trigger if exists prepare_apex_purchase_row on public.purchases;
create trigger prepare_apex_purchase_row before insert or update on public.purchases
  for each row execute procedure public.prepare_apex_purchase();

create or replace function public.prepare_apex_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  moderate boolean;
begin
  if not public.is_apex_admin() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();
      select p.full_name into new.user_name from public.profiles p where p.id = auth.uid();
    elsif new.user_id is distinct from old.user_id then
      raise exception 'Review owner cannot be changed.';
    end if;
    select coalesce((value #>> '{}')::boolean, false) into moderate
      from public.app_settings where key = 'review_moderation';
    if moderate then new.status := 'pending';
    elsif tg_op = 'INSERT' then new.status := 'published';
    else new.status := old.status; end if;
  end if;
  new.updated_at := now();
  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'id', new.id, 'userId', new.user_id, 'userName', new.user_name, 'firmId', new.firm_id,
    'rating', new.rating, 'accountModel', new.account_model, 'title', new.title, 'body', new.body,
    'recommend', new.recommend, 'createdAt', new.created_at, 'updatedAt', new.updated_at, 'status', new.status
  );
  return new;
end;
$$;
drop trigger if exists prepare_apex_review_row on public.reviews;
create trigger prepare_apex_review_row before insert or update on public.reviews
  for each row execute procedure public.prepare_apex_review();

create or replace function public.protect_apex_redemption()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_apex_admin() and (
    new.user_id is distinct from old.user_id or new.item_id is distinct from old.item_id or
    new.item_name is distinct from old.item_name or new.cost is distinct from old.cost or
    old.status <> 'requested' or new.status not in ('requested', 'cancelled')
  ) then raise exception 'Members may only cancel their own pending redemption.'; end if;
  if new.status = 'fulfilled' and public.is_apex_admin() then new.fulfilled_at := now(); end if;
  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'id', new.id, 'userId', new.user_id, 'itemId', new.item_id, 'itemName', new.item_name,
    'cost', new.cost, 'status', new.status, 'createdAt', new.created_at, 'fulfilledAt', new.fulfilled_at
  );
  return new;
end;
$$;
drop trigger if exists protect_apex_redemption_row on public.redemptions;
create trigger protect_apex_redemption_row before update on public.redemptions
  for each row execute procedure public.protect_apex_redemption();

create or replace function public.protect_apex_payout_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'requested';
    new.admin_note := null;
  elsif not public.is_apex_admin() and (
    new.user_id is distinct from old.user_id or new.amount is distinct from old.amount or
    new.method is distinct from old.method or new.payout_details is distinct from old.payout_details or
    old.status <> 'requested' or new.status not in ('requested', 'cancelled')
  ) then
    raise exception 'Members may only cancel their own requested payout.';
  end if;
  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'id', new.id, 'userId', new.user_id, 'amount', new.amount, 'method', new.method,
    'details', new.payout_details, 'status', new.status, 'adminNote', new.admin_note,
    'createdAt', new.created_at, 'updatedAt', new.updated_at
  );
  return new;
end;
$$;
drop trigger if exists protect_apex_payout_request_row on public.payout_requests;
create trigger protect_apex_payout_request_row before insert or update on public.payout_requests
  for each row execute procedure public.protect_apex_payout_request();

create or replace function public.request_apex_payout(p_method text, p_details text)
returns public.payout_requests language plpgsql security definer set search_path = ''
as $$
declare
  minimum_amount numeric;
  approved_amount numeric;
  reserved_amount numeric;
  request_amount numeric;
  result public.payout_requests%rowtype;
begin
  if auth.uid() is null or not public.is_active_apex_member() then raise exception 'Active member access is required.'; end if;
  if not exists (
    select 1 from public.app_settings s, jsonb_array_elements_text(s.value) as methods(value)
    where s.key = 'payout_methods' and methods.value = p_method
  ) then raise exception 'This payout method is not currently available.'; end if;
  if char_length(trim(p_details)) < 3 or char_length(trim(p_details)) > 240 then raise exception 'Enter a valid payout email or wallet reference.'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text)::bigint);
  select coalesce((value #>> '{}')::numeric, 25) into minimum_amount from public.app_settings where key = 'min_payout';
  select coalesce(sum(cashback_amount), 0) into approved_amount
    from public.purchases where user_id = auth.uid() and status = 'approved';
  select coalesce(sum(amount), 0) into reserved_amount
    from public.payout_requests where user_id = auth.uid() and status in ('requested', 'processing', 'paid');
  request_amount := round(approved_amount - reserved_amount, 2);
  if request_amount < minimum_amount then raise exception 'Available cashback is below the payout threshold.'; end if;
  if exists (select 1 from public.payout_requests where user_id = auth.uid() and status in ('requested', 'processing')) then
    raise exception 'You already have a payout request being processed.';
  end if;
  insert into public.payout_requests (id, user_id, amount, method, payout_details, status)
  values ('payout_' || replace(gen_random_uuid()::text, '-', ''), auth.uid(), request_amount, p_method, trim(p_details), 'requested')
  returning * into result;
  return result;
end;
$$;
revoke all on function public.request_apex_payout(text, text) from public;
grant execute on function public.request_apex_payout(text, text) to authenticated;

create or replace function public.request_apex_redemption(p_reward_id text)
returns public.redemptions language plpgsql security definer set search_path = ''
as $$
declare
  reward public.reward_catalog%rowtype;
  credit_rate numeric;
  earned bigint;
  spent bigint;
  result public.redemptions%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to redeem credits.'; end if;
  if not public.is_active_apex_member() then raise exception 'Active member access is required.'; end if;
  select * into reward from public.reward_catalog where id = p_reward_id and active;
  if reward.id is null then raise exception 'This reward is unavailable.'; end if;
  select coalesce((value #>> '{}')::numeric, 1) into credit_rate
    from public.app_settings where key = 'credit_rate';
  select coalesce(sum(floor(p.amount * credit_rate)), 0)::bigint into earned
    from public.purchases p where p.user_id = auth.uid() and p.status in ('approved', 'paid');
  select coalesce(sum(r.cost), 0)::bigint into spent
    from public.redemptions r where r.user_id = auth.uid() and r.status in ('requested', 'fulfilled');
  if earned - spent < reward.cost then raise exception 'Not enough approved APEX credits.'; end if;
  insert into public.redemptions (id, user_id, item_id, item_name, cost, status, payload)
  values (
    'redeem_' || replace(gen_random_uuid()::text, '-', ''), auth.uid(), reward.id,
    reward.name, reward.cost, 'requested', jsonb_build_object('itemId', reward.id, 'itemName', reward.name)
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.request_apex_redemption(text) from public;
grant execute on function public.request_apex_redemption(text) to authenticated;

create or replace function public.admin_update_profile(p_user_id uuid, p_role text, p_suspended boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_apex_admin() then raise exception 'Administrator access required.'; end if;
  if p_role not in ('member', 'admin') then raise exception 'Invalid member role.'; end if;
  update public.profiles set role = p_role, suspended = p_suspended where id = p_user_id;
end;
$$;
revoke all on function public.admin_update_profile(uuid, text, boolean) from public;
grant execute on function public.admin_update_profile(uuid, text, boolean) to authenticated;

alter table public.profiles enable row level security;
alter table public.firms enable row level security;
alter table public.app_settings enable row level security;
alter table public.purchases enable row level security;
alter table public.reviews enable row level security;
alter table public.redemptions enable row level security;
alter table public.payout_requests enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.firms, public.app_settings, public.purchases,
  public.reviews, public.redemptions, public.payout_requests, public.referral_clicks, public.affiliate_conversions, public.reward_catalog,
  public.audit_log from anon, authenticated;
grant select on public.profiles, public.firms, public.app_settings, public.purchases,
  public.reviews, public.redemptions, public.payout_requests, public.referral_clicks, public.affiliate_conversions, public.reward_catalog,
  public.audit_log to authenticated;
grant select on public.firms, public.app_settings, public.reviews, public.reward_catalog to anon;
grant update (full_name) on public.profiles to authenticated;
grant insert on public.purchases, public.reviews, public.referral_clicks to authenticated;
grant delete on public.reviews to authenticated;
grant update on public.purchases, public.reviews, public.redemptions to authenticated;
grant update on public.payout_requests to authenticated;
grant update on public.affiliate_conversions to authenticated;
grant insert, update, delete on public.firms, public.app_settings, public.audit_log to authenticated;
grant insert, update, delete on public.reward_catalog to authenticated;
-- Service-role grants are used only by the server-side signed affiliate postback function.
grant all on public.purchases, public.affiliate_conversions to service_role;

create policy "profile owner or admin reads profiles" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_apex_admin()));
create policy "profile owner or admin updates profiles" on public.profiles for update to authenticated
  using (((select auth.uid()) = id and (select public.is_active_apex_member())) or (select public.is_apex_admin()))
  with check (((select auth.uid()) = id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));

create policy "public reads active firms" on public.firms for select to anon, authenticated
  using (status = 'active' or (select public.is_apex_admin()));
create policy "admin creates firms" on public.firms for insert to authenticated with check ((select public.is_apex_admin()));
create policy "admin updates firms" on public.firms for update to authenticated using ((select public.is_apex_admin())) with check ((select public.is_apex_admin()));
create policy "admin deletes firms" on public.firms for delete to authenticated using ((select public.is_apex_admin()));

create policy "public reads settings" on public.app_settings for select to anon, authenticated using (true);
create policy "admin creates settings" on public.app_settings for insert to authenticated with check ((select public.is_apex_admin()));
create policy "admin updates settings" on public.app_settings for update to authenticated using ((select public.is_apex_admin())) with check ((select public.is_apex_admin()));

create policy "members read own purchases admins read all" on public.purchases for select to authenticated
  using (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));
create policy "members submit own pending purchases" on public.purchases for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and (select public.is_active_apex_member()));
create policy "admin updates purchases" on public.purchases for update to authenticated
  using ((select public.is_apex_admin())) with check ((select public.is_apex_admin()));

create policy "public reads published reviews" on public.reviews for select to anon, authenticated
  using (status = 'published' or ((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));
create policy "members create own reviews" on public.reviews for insert to authenticated
  with check ((select auth.uid()) = user_id and status in ('pending', 'published') and (select public.is_active_apex_member()));
create policy "members update own reviews" on public.reviews for update to authenticated
  using (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()))
  with check (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));
create policy "members delete own reviews admins delete all" on public.reviews for delete to authenticated
  using (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));

create policy "members read own redemptions admins read all" on public.redemptions for select to authenticated
  using (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));
create policy "members cancel own requested redemptions" on public.redemptions for update to authenticated
  using (((select auth.uid()) = user_id and status = 'requested' and (select public.is_active_apex_member())) or (select public.is_apex_admin()))
  with check (((select auth.uid()) = user_id and status in ('requested', 'cancelled') and (select public.is_active_apex_member())) or (select public.is_apex_admin()));

create policy "members read own payouts admins read all" on public.payout_requests for select to authenticated
  using (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));
create policy "members cancel own requested payouts admins update all" on public.payout_requests for update to authenticated
  using (((select auth.uid()) = user_id and status = 'requested' and (select public.is_active_apex_member())) or (select public.is_apex_admin()))
  with check (((select auth.uid()) = user_id and status in ('requested', 'cancelled') and (select public.is_active_apex_member())) or (select public.is_apex_admin()));

create policy "members read own referral clicks admins read all" on public.referral_clicks for select to authenticated
  using (((select auth.uid()) = user_id and (select public.is_active_apex_member())) or (select public.is_apex_admin()));
create policy "members record own referral clicks" on public.referral_clicks for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_active_apex_member()));

create policy "admins read affiliate conversions" on public.affiliate_conversions for select to authenticated
  using ((select public.is_apex_admin()));
create policy "admins review affiliate conversions" on public.affiliate_conversions for update to authenticated
  using ((select public.is_apex_admin())) with check ((select public.is_apex_admin()));

create policy "public reads active rewards" on public.reward_catalog for select to anon, authenticated
  using (active or (select public.is_apex_admin()));
create policy "admin manages reward catalog" on public.reward_catalog for all to authenticated
  using ((select public.is_apex_admin())) with check ((select public.is_apex_admin()));
create policy "admin reads audit log" on public.audit_log for select to authenticated using ((select public.is_apex_admin()));
create policy "admin writes audit log" on public.audit_log for insert to authenticated with check ((select public.is_apex_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apex-firm-logos', 'apex-firm-logos', true, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
create policy "public views firm logos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'apex-firm-logos');
create policy "admins upload firm logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'apex-firm-logos' and (select public.is_apex_admin()));
create policy "admins update firm logos" on storage.objects for update to authenticated
  using (bucket_id = 'apex-firm-logos' and (select public.is_apex_admin()))
  with check (bucket_id = 'apex-firm-logos' and (select public.is_apex_admin()));
create policy "admins delete firm logos" on storage.objects for delete to authenticated
  using (bucket_id = 'apex-firm-logos' and (select public.is_apex_admin()));

-- First admin only: run manually from the Supabase SQL editor after signing up.
-- update public.profiles set role = 'admin' where email = 'you@example.com';


-- Seeded directory firms. Existing administrator edits are preserved on later migration runs.
insert into public.firms (id, name, market, status, cashback_rate, logo_url, payload) values
  ('shark-funded', 'Shark Funded', 'Forex', 'active', 8, 'https://res.cloudinary.com/dqtei9nao/image/upload/v1776846121/the-forex-clue/firm-logos/shark-funded/ofgdn87nqnn3ap6vaynm.png', '{"id":"shark-funded","name":"Shark Funded","monogram":"SF","logo":"https://res.cloudinary.com/dqtei9nao/image/upload/v1776846121/the-forex-clue/firm-logos/shark-funded/ofgdn87nqnn3ap6vaynm.png","country":"United States","countryCode":"US","founded":2023,"rating":4.8,"reviews":1864,"assets":["Forex","Indices","Crypto","Metals"],"market":"Forex","platforms":["MT5","Match-Trader"],"allocation":100000,"allocationLabel":"$100K","profitSplit":"Up to 100%","leverage":"1:100","drawdown":"Up to 10%","payout":"On demand","promo":"50% OFF","code":"TFC","offerDetails":"The referenced offer lists code TFC for Shark Funded challenges. Eligibility and discount vary by account model; confirm the live checkout terms before buying.","website":"https://sharkfunded.com/","color":"#d2ff52","verified":true,"models":["1 Step","2 Step","Shark Bolt"],"summary":"A multi-model evaluation firm with MT5 and Match-Trader access. Compare drawdown and payout conditions by model rather than relying on the headline discount.","cashbackRate":8,"status":"active"}'::jsonb),
  ('the5ers', 'The5ers', 'Forex', 'active', 4, null, '{"id":"the5ers","name":"The5ers","monogram":"5","country":"Israel","countryCode":"IL","founded":2016,"rating":4.9,"reviews":3210,"assets":["Forex","Indices","Metals","Crypto"],"market":"Forex","platforms":["MT5"],"allocation":4000000,"allocationLabel":"$4M","profitSplit":"Up to 100%","leverage":"1:30","drawdown":"Programme-specific","payout":"Every 14 days","promo":"Scaling plan","offerDetails":"The5ers publishes several evaluation and growth programmes. Drawdown, leverage and scaling terms are programme-specific, so validate the rules for your selected account.","website":"https://the5ers.com/","color":"#86e7ff","verified":true,"models":["Hyper Growth","High Stakes","Bootcamp"],"summary":"An established forex funding brand known for multiple growth paths. Its scaling potential is useful only when the chosen programme’s risk limits fit your strategy.","cashbackRate":4,"status":"active"}'::jsonb),
  ('e8-markets', 'E8 Markets', 'Forex', 'active', 5, null, '{"id":"e8-markets","name":"E8 Markets","monogram":"E8","country":"United States","countryCode":"US","founded":2021,"rating":4.7,"reviews":1482,"assets":["Forex","Futures","Indices","Crypto"],"market":"Forex","platforms":["cTrader","Match-Trader","MT5"],"allocation":250000,"allocationLabel":"$250K","profitSplit":"80%","leverage":"1:50","drawdown":"8%","payout":"Every 14 days","promo":"Offer available","code":"TFC5","offerDetails":"The reference directory lists E8 Markets offers and model-specific discounts. Check the eligible account type, current code and any regional restrictions on the official checkout.","website":"https://e8markets.com/","color":"#b6a5ff","verified":true,"models":["E8 One","E8 Classic","E8 Track"],"summary":"A multi-platform firm with configurable evaluation routes. Its appeal is flexibility; the key comparison is how each route handles daily and maximum loss.","cashbackRate":5,"status":"active"}'::jsonb),
  ('fundingpips', 'FundingPips', 'Forex', 'active', 6, null, '{"id":"fundingpips","name":"FundingPips","monogram":"FP","country":"United Arab Emirates","countryCode":"AE","founded":2022,"rating":4.8,"reviews":2756,"assets":["Forex","Indices","Crypto","Metals","Energies"],"market":"Forex","platforms":["cTrader","Match-Trader","MT5"],"allocation":200000,"allocationLabel":"$200K","profitSplit":"Up to 100%","leverage":"Up to 1:100","drawdown":"Up to 12%","payout":"From 4 days","promo":"Up to 25% OFF","code":"TFC","offerDetails":"The source offer page lists FundingPips promotions of up to 25% off selected challenges. The final discount depends on the active campaign and challenge model.","website":"https://fundingpips.com/","color":"#ffcd6b","verified":true,"models":["1 Step","2 Step Standard","2 Step Flex"],"summary":"A high-recognition evaluation firm with several payout cycles and platforms. Compare its consistency requirements alongside the advertised drawdown.","cashbackRate":6,"status":"active"}'::jsonb),
  ('atlas-funded', 'Atlas Funded', 'Forex', 'active', 4, null, '{"id":"atlas-funded","name":"Atlas Funded","monogram":"AF","country":"United Kingdom","countryCode":"GB","founded":2023,"rating":4.6,"reviews":927,"assets":["Forex","Indices","Crypto","Metals"],"market":"Forex","platforms":["MT5","Match-Trader","cTrader"],"allocation":200000,"allocationLabel":"$200K","profitSplit":"Up to 90%","leverage":"1:100","drawdown":"Model-specific","payout":"Every 14 days","promo":"View offers","offerDetails":"Atlas Funded runs multiple account programmes with different drawdown and payout conditions. Verify the selected programme directly before checkout.","website":"https://atlasfunded.com/","color":"#6be7c8","verified":false,"models":["1 Phase","2 Phase","Instant"],"summary":"A flexible prop-firm option spanning evaluation and instant models. Rules differ materially between models, making side-by-side comparison especially useful.","cashbackRate":4,"status":"active"}'::jsonb),
  ('funded-trader-markets', 'Funded Trader Markets', 'Forex', 'active', 5, null, '{"id":"funded-trader-markets","name":"Funded Trader Markets","monogram":"FTM","country":"United Arab Emirates","countryCode":"AE","founded":2024,"rating":4.4,"reviews":2578,"assets":["Forex","Indices","Crypto","Metals","Energies"],"market":"Forex","platforms":["cTrader","TradeLocker","Match-Trader"],"allocation":300000,"allocationLabel":"$300K","profitSplit":"Up to 90%","leverage":"Up to 1:100","drawdown":"Up to 10%","payout":"Every 10 days","promo":"10% OFF","code":"TRUSTED","offerDetails":"The referenced listing shows code TRUSTED for 10% off eligible challenges and mentions purchase rewards. Confirm whether rewards and discounts can be combined.","website":"https://fundedtradermarkets.com/","color":"#73a7ff","verified":true,"models":["1 Step","2 Step","Instant"],"summary":"A Dubai-based funding firm with evaluation and instant options. Account-size and model selection can change leverage, drawdown and reward rates.","cashbackRate":5,"status":"active"}'::jsonb),
  ('aquafunded', 'AquaFunded', 'Forex', 'active', 7, 'https://res.cloudinary.com/dqtei9nao/image/upload/v1777376047/the-forex-clue/firm-logos/aquafunded/h6d9fgwogharpkcitdol.png', '{"id":"aquafunded","name":"AquaFunded","monogram":"AF","logo":"https://res.cloudinary.com/dqtei9nao/image/upload/v1777376047/the-forex-clue/firm-logos/aquafunded/h6d9fgwogharpkcitdol.png","country":"United Arab Emirates","countryCode":"AE","founded":2023,"rating":4.6,"reviews":1729,"assets":["Forex","Indices","Crypto","Metals"],"market":"Forex","platforms":["MT5","cTrader","TradeLocker"],"allocation":100000,"allocationLabel":"$100K","profitSplit":"90%","leverage":"1:100","drawdown":"Model-specific","payout":"Every 14 days","promo":"25% OFF","code":"TFC","offerDetails":"The reference offer directory lists code TFC for 25% off AquaFunded challenges and a spend-based bonus campaign. Bonus eligibility requires checking current terms.","website":"https://aquafunded.com/","color":"#58d8ff","verified":true,"models":["1 Phase","2 Phase","Instant"],"summary":"A multi-platform firm with several evaluation formats. Compare the actual loss model and consistency conditions before weighing any promotional incentive.","cashbackRate":7,"status":"active"}'::jsonb),
  ('alpine-funded', 'Alpine Funded', 'Forex', 'active', 4, null, '{"id":"alpine-funded","name":"Alpine Funded","monogram":"AF","country":"Switzerland","countryCode":"CH","founded":2023,"rating":4.5,"reviews":684,"assets":["Forex","Indices","Metals","Crypto"],"market":"Forex","platforms":["MT5","cTrader"],"allocation":2000000,"allocationLabel":"$2M","profitSplit":"Up to 100%","leverage":"1:100 / 1:30","drawdown":"5% violation threshold","payout":"Every 14 days","promo":"Scaling plan","offerDetails":"Alpine Funded’s source listing distinguishes Standard and Swing leverage and references programme-specific rules. Check which account family you are comparing.","website":"https://alpinefunded.com/","color":"#c6ff75","verified":true,"models":["Standard","Swing","Instant"],"summary":"A scaling-oriented firm with Standard and Swing variations. Leverage and drawdown need to be read together to understand the practical risk budget.","cashbackRate":4,"status":"active"}'::jsonb),
  ('funding-traders', 'Funding Traders', 'Forex', 'active', 5, null, '{"id":"funding-traders","name":"Funding Traders","monogram":"FT","country":"United States","countryCode":"US","founded":2023,"rating":4.5,"reviews":1108,"assets":["Forex","Indices","Crypto","Metals"],"market":"Forex","platforms":["MT5","TradeLocker"],"allocation":400000,"allocationLabel":"$400K","profitSplit":"80%–100%","leverage":"1:100","drawdown":"6%–10%","payout":"Every 14 days","promo":"Offer available","offerDetails":"Funding Traders offers multiple models, including instant funding. Profit split and drawdown vary by account, so confirm current model rules before purchase.","website":"https://fundingtraders.com/","color":"#ff8e80","verified":true,"models":["1 Step","2 Step","Instant"],"summary":"A multi-model firm with a broad advertised profit-split range. The useful comparison is the starting split and its upgrade conditions, not only the maximum.","cashbackRate":5,"status":"active"}'::jsonb),
  ('fundednext', 'FundedNext', 'Forex', 'active', 6, null, '{"id":"fundednext","name":"FundedNext","monogram":"FN","country":"United Arab Emirates","countryCode":"AE","founded":2022,"rating":4.7,"reviews":4120,"assets":["Forex","Indices","Crypto","Metals","Energies"],"market":"Forex","platforms":["MT4","MT5","cTrader","Match-Trader"],"allocation":4000000,"allocationLabel":"$4M scaling","profitSplit":"Up to 95%","leverage":"Up to 1:100","drawdown":"Model-specific","payout":"Every 14 days","promo":"10% OFF + rewards","code":"TFC","offerDetails":"The source firm listing shows code TFC and a 10% promotional offer with purchase rewards on eligible accounts. Current campaign terms should be checked at checkout.","website":"https://fundednext.com/","color":"#8e7cff","verified":true,"models":["Stellar 1-Step","Stellar 2-Step","Stellar Instant"],"summary":"A large global funding brand with several Stellar models and broad platform support. Scaling and maximum allocation are not the same as starting account size.","cashbackRate":6,"status":"active"}'::jsonb),
  ('funded-trading-plus', 'Funded Trading Plus', 'Forex', 'active', 5, null, '{"id":"funded-trading-plus","name":"Funded Trading Plus","monogram":"FT+","country":"United Kingdom","countryCode":"GB","founded":2021,"rating":4.4,"reviews":2314,"assets":["Forex","Indices","Crypto","Metals","Energies"],"market":"Forex","platforms":["MT5","cTrader","Match-Trader"],"allocation":200000,"allocationLabel":"$200K","profitSplit":"Up to 100%","leverage":"Up to 1:30","drawdown":"Model-specific","payout":"From day 3","promo":"10% OFF","code":"TFC","offerDetails":"The reference listing shows code TFC for an exclusive 10% discount and purchase rewards. Weekend holding and copy-trading rules vary by programme.","website":"https://www.fundedtradingplus.com/","color":"#69e4aa","verified":true,"models":["Experienced","Advanced","Master","Premium"],"summary":"An established UK firm with a wide programme range. Its Master and Advanced programmes can differ on weekend holding and strategy permissions.","cashbackRate":5,"status":"active"}'::jsonb),
  ('tradeify', 'Tradeify', 'Futures', 'active', 4, 'https://the-forex-clue-api.theforexclue.workers.dev/assets/the-forex-clue/firm-logos/offer-tradeify/83d79721-a495-4eff-b8b9-18cb6e5f11cc-White-logo-no-background-scaled.png', '{"id":"tradeify","name":"Tradeify","monogram":"T","logo":"https://the-forex-clue-api.theforexclue.workers.dev/assets/the-forex-clue/firm-logos/offer-tradeify/83d79721-a495-4eff-b8b9-18cb6e5f11cc-White-logo-no-background-scaled.png","country":"United States","countryCode":"US","founded":2022,"rating":4.6,"reviews":1395,"assets":["CME Futures","Indices","Energies","Metals"],"market":"Futures","platforms":["Tradovate","NinjaTrader","TradingView"],"allocation":750000,"allocationLabel":"$750K","profitSplit":"90%","leverage":"Contract-based","drawdown":"End-of-day trailing","payout":"Policy-based","promo":"Futures offers","offerDetails":"Tradeify focuses on CME futures funding, with account types that use end-of-day trailing drawdown. Promotions are time-sensitive; verify the active campaign directly.","website":"https://tradeify.co/","color":"#f0f1ff","verified":false,"models":["Growth","Advanced","Straight to Sim Funded"],"summary":"A futures-specific funding provider with CME market access. Contract limits and trailing-drawdown mechanics matter more here than forex-style leverage comparisons.","cashbackRate":4,"status":"active"}'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
