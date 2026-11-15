-- Roles, permissions, ledger integrity, and atomic business functions.

insert into roles(key,name) values
 ('member','Member'),('super_admin','Super Admin'),('admin','Admin'),('finance','Finance/Rewards Manager'),
 ('moderator','Moderator'),('support','Support Agent'),('content','Content Manager'),('partner_manager','Partner Manager');
insert into permissions(key,description) values
 ('users.read','View member profiles'),('users.manage','Suspend/restore members'),
 ('submissions.review','Review purchase submissions'),('credits.read','View ledger'),('credits.manage','Adjust/reverse credits'),
 ('rewards.manage','Manage rewards & stock'),('redemptions.process','Fulfil redemptions'),
 ('partners.manage','Manage partners, offers, codes, links'),('content.manage','Manage CMS content'),
 ('support.manage','Handle support tickets'),('analytics.read','View analytics'),
 ('staff.manage','Assign staff roles'),('audit.read','Read audit logs'),('settings.manage','Edit site settings');
-- super_admin is handled in has_permission(); explicit grants for the others:
insert into role_permissions select r.id, p.key from roles r, permissions p where r.key='admin' and p.key <> 'staff.manage';
insert into role_permissions select r.id, p.key from roles r, permissions p where r.key='finance'
  and p.key in ('credits.read','credits.manage','rewards.manage','redemptions.process','submissions.review','analytics.read');
insert into role_permissions select r.id, p.key from roles r, permissions p where r.key='moderator' and p.key in ('content.manage','support.manage');
insert into role_permissions select r.id, p.key from roles r, permissions p where r.key='support' and p.key in ('support.manage');
insert into role_permissions select r.id, p.key from roles r, permissions p where r.key='content' and p.key in ('content.manage');
insert into role_permissions select r.id, p.key from roles r, permissions p where r.key='partner_manager' and p.key in ('partners.manage','analytics.read');

create or replace function has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and (r.key = 'super_admin'
           or exists (select 1 from role_permissions rp where rp.role_id = r.id and rp.permission_key = p))
  );
$$;

create or replace function require_permission(p text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not has_permission(p) then
    raise exception 'permission denied: %', p using errcode = '42501';
  end if;
end $$;

create or replace function log_audit(p_action text, p_type text, p_id text, p_reason text, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into admin_audit_logs(actor_id, action, entity_type, entity_id, reason, detail)
  values (auth.uid(), p_action, p_type, p_id, p_reason, p_detail);
$$;

-- ───────── Ledger integrity ─────────
create or replace function ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'credit_ledger is append-only'; end $$;
create trigger credit_ledger_no_update before update or delete on credit_ledger
  for each row execute function ledger_immutable();
create trigger credit_ledger_no_truncate before truncate on credit_ledger
  for each statement execute function ledger_immutable();

-- Cache is maintained only by this trigger. The upsert row-lock serialises concurrent
-- writers for one user, and the CHECK (balance >= 0) rejects any overdraft.
create or replace function ledger_update_cache() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into wallet_balance_cache(user_id, balance, total_earned, total_spent)
  values (new.user_id, new.amount, greatest(new.amount,0), greatest(-new.amount,0))
  on conflict (user_id) do update set
    balance      = wallet_balance_cache.balance + new.amount,
    total_earned = wallet_balance_cache.total_earned + greatest(new.amount,0),
    total_spent  = wallet_balance_cache.total_spent + greatest(-new.amount,0),
    updated_at   = now();
  return new;
end $$;
create trigger credit_ledger_cache after insert on credit_ledger
  for each row execute function ledger_update_cache();

-- Reconciliation: returns users whose cache disagrees with the ledger (should be empty).
create or replace function wallet_cache_drift()
returns table(user_id uuid, ledger_sum bigint, cached bigint)
language sql stable security definer set search_path = public as $$
  select l.user_id, l.s, coalesce(w.balance,0)
  from (select user_id, sum(amount)::bigint s from credit_ledger group by user_id) l
  left join wallet_balance_cache w using (user_id)
  where l.s <> coalesce(w.balance,0);
$$;

-- ───────── New users ─────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user_' || substr(replace(new.id::text,'-',''),1,10));
  insert into profiles(id, full_name, username, country, discord_username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'Member'), uname,
          new.raw_user_meta_data->>'country', new.raw_user_meta_data->>'discord_username');
  insert into user_roles(user_id, role_id) select new.id, id from roles where key='member';
  return new;
end $$;
-- On Supabase, auth.users is owned by supabase_auth_admin; create this trigger as the project owner.
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Staff role assignment (members can never self-assign; only super_admin may grant admin roles).
create or replace function assign_role(p_user uuid, p_role text, p_grant boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare rid int;
begin
  perform require_permission('staff.manage');
  select id into rid from roles where key = p_role;
  if rid is null then raise exception 'unknown role'; end if;
  if p_role in ('super_admin','admin') and not exists (
       select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.key='super_admin')
  then raise exception 'only a super admin can change admin roles' using errcode='42501'; end if;
  if p_grant then
    insert into user_roles(user_id, role_id, granted_by) values (p_user, rid, auth.uid()) on conflict do nothing;
  else
    delete from user_roles where user_id=p_user and role_id=rid;
  end if;
  perform log_audit(case when p_grant then 'role.grant' else 'role.revoke' end, 'user', p_user::text, null, jsonb_build_object('role',p_role));
end $$;

-- ───────── Submissions ─────────
create or replace function award_submission(p_submission uuid, p_credits int, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare s submissions; lid uuid;
begin
  perform require_permission('submissions.review');
  if p_credits is null or p_credits <= 0 then raise exception 'credits must be positive'; end if;
  select * into s from submissions where id = p_submission for update;
  if not found then raise exception 'submission not found'; end if;
  if s.status not in ('pending','under_review','more_info_required') then
    raise exception 'submission already decided (%)', s.status; end if;

  insert into credit_ledger(user_id,type,amount,reference_type,reference_id,description,idempotency_key,actor_id)
  values (s.user_id,'purchase_reward',p_credits,'submission',s.id,'Credits for order '||s.order_id,
          'submission_award:'||s.id, auth.uid())
  returning id into lid;

  update submissions set status='approved', credits_approved=p_credits, reviewer_id=auth.uid(),
         review_notes=p_notes, reviewed_at=now() where id=s.id;
  insert into submission_reviews(submission_id,reviewer_id,decision,notes) values (s.id,auth.uid(),'approved',p_notes);
  insert into notifications(user_id,kind,title,body)
  values (s.user_id,'credits_awarded','Credits awarded', p_credits||' credits were added for order '||s.order_id);
  perform log_audit('submission.approve','submission',s.id::text,p_notes,jsonb_build_object('credits',p_credits,'ledger_id',lid));
  return lid;
end $$;

create or replace function decide_submission(p_submission uuid, p_status submission_status, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare s submissions;
begin
  perform require_permission('submissions.review');
  if p_status not in ('under_review','more_info_required','rejected') then
    raise exception 'use award_submission to approve'; end if;
  if p_status in ('rejected','more_info_required') and coalesce(trim(p_notes),'') = '' then
    raise exception 'a note is required'; end if;
  select * into s from submissions where id=p_submission for update;
  if not found then raise exception 'submission not found'; end if;
  if s.status in ('approved','rejected') then raise exception 'submission already decided (%)', s.status; end if;
  update submissions set status=p_status, reviewer_id=auth.uid(), review_notes=p_notes, reviewed_at=now() where id=s.id;
  insert into submission_reviews(submission_id,reviewer_id,decision,notes) values (s.id,auth.uid(),p_status,p_notes);
  insert into notifications(user_id,kind,title,body) values
    (s.user_id,'submission_'||p_status, case p_status when 'rejected' then 'Submission rejected'
       when 'more_info_required' then 'More proof required' else 'Submission under review' end, p_notes);
  perform log_audit('submission.'||p_status,'submission',s.id::text,p_notes);
end $$;

-- ───────── Credits administration ─────────
create or replace function reverse_ledger_entry(p_entry uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e credit_ledger; lid uuid;
begin
  perform require_permission('credits.manage');
  if coalesce(trim(p_reason),'')='' then raise exception 'reason required'; end if;
  select * into e from credit_ledger where id=p_entry;
  if not found then raise exception 'entry not found'; end if;
  if e.type='reversal' then raise exception 'cannot reverse a reversal'; end if;
  insert into credit_ledger(user_id,type,amount,reference_type,reference_id,description,idempotency_key,actor_id)
  values (e.user_id,'reversal',-e.amount,'ledger_entry',e.id,'Reversal: '||p_reason,'reversal:'||e.id,auth.uid())
  returning id into lid;   -- unique key => an entry can be reversed once
  perform log_audit('credits.reverse','ledger',e.id::text,p_reason,jsonb_build_object('reversal_id',lid));
  return lid;
end $$;

create or replace function admin_adjust_credits(p_user uuid, p_amount int, p_reason text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  perform require_permission('credits.manage');
  if p_amount = 0 then raise exception 'amount must be non-zero'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'reason required'; end if;
  insert into credit_ledger(user_id,type,amount,reference_type,description,idempotency_key,actor_id)
  values (p_user, case when p_amount>0 then 'admin_credit' else 'admin_deduction' end::ledger_type, p_amount,
          'admin', p_reason, 'admin_adjust:'||p_idempotency_key, auth.uid())
  returning id into lid;
  perform log_audit('credits.adjust','user',p_user::text,p_reason,jsonb_build_object('amount',p_amount,'ledger_id',lid));
  return lid;
end $$;

-- ───────── Redemptions ─────────
create or replace function redeem_reward(p_reward uuid, p_idempotency_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rewards; stock_left int; rid uuid; key text; existing uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if exists (select 1 from profiles where id=uid and suspended) then raise exception 'account suspended'; end if;
  key := 'redemption:'||uid||':'||p_idempotency_key;
  select reference_id into existing from credit_ledger where idempotency_key = key;
  if existing is not null then return existing; end if;      -- double-click / retry

  select * into r from rewards where id=p_reward and active;
  if not found then raise exception 'reward unavailable'; end if;
  select stock into stock_left from reward_inventory where reward_id=r.id for update;
  if found and stock_left is not null and stock_left <= 0 then raise exception 'out of stock'; end if;

  insert into redemptions(user_id,reward_id,credits_spent,currency) values (uid,r.id,r.credits_cost,r.currency)
  returning id into rid;
  begin
    insert into credit_ledger(user_id,type,amount,reference_type,reference_id,description,idempotency_key)
    values (uid,'redemption',-r.credits_cost,'redemption',rid,'Redeemed '||r.name,key);
  exception when check_violation then
    raise exception 'insufficient credits';
  end;
  update reward_inventory set stock = stock-1 where reward_id=r.id and stock is not null;
  insert into notifications(user_id,kind,title,body) values (uid,'reward_redeemed','Reward redeemed', r.name||' is being processed.');
  return rid;
end $$;

create or replace function fulfill_redemption(p_id uuid, p_status redemption_status, p_code text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d redemptions; rname text;
begin
  perform require_permission('redemptions.process');
  select * into d from redemptions where id=p_id for update;
  if not found then raise exception 'redemption not found'; end if;
  if d.status in ('fulfilled','rejected','cancelled') then raise exception 'redemption already closed (%)', d.status; end if;
  if p_status = 'pending' then raise exception 'invalid status'; end if;
  select name into rname from rewards where id=d.reward_id;

  update redemptions set status=p_status, admin_id=auth.uid(), notes=p_notes,
         fulfilled_at = case when p_status='fulfilled' then now() end where id=d.id;
  if p_status='fulfilled' then
    insert into redemption_fulfillments(redemption_id,code_reference,notes,admin_id) values (d.id,p_code,p_notes,auth.uid());
  elsif p_status in ('rejected','cancelled') then            -- refund + restock
    insert into credit_ledger(user_id,type,amount,reference_type,reference_id,description,idempotency_key,actor_id)
    values (d.user_id,'reversal',d.credits_spent,'redemption',d.id,'Refund: '||rname,'redemption_refund:'||d.id,auth.uid());
    update reward_inventory set stock=stock+1 where reward_id=d.reward_id and stock is not null;
  end if;
  insert into notifications(user_id,kind,title,body) values
    (d.user_id,'redemption_'||p_status, 'Reward '||p_status, rname);
  perform log_audit('redemption.'||p_status,'redemption',d.id::text,p_notes);
end $$;

-- ───────── Affiliate click tracking (public entry point) ─────────
create or replace function record_affiliate_click(p_partner uuid, p_offer uuid default null)
returns table(click_ref text, url text) language plpgsql security definer set search_path = public as $$
declare link_url text; ref text;
begin
  select a.url into link_url from affiliate_links a join partners p on p.id=a.partner_id
   where a.partner_id=p_partner and a.active and p.active and (a.offer_id = p_offer or a.offer_id is null)
   order by (a.offer_id is not null) desc limit 1;
  if link_url is null then raise exception 'no active link'; end if;
  insert into affiliate_clicks(user_id,partner_id,offer_id) values (auth.uid(),p_partner,p_offer) returning affiliate_clicks.click_ref into ref;
  return query select ref, link_url;
end $$;

-- ───────── Execute grants ─────────
revoke all on function award_submission, decide_submission, reverse_ledger_entry, admin_adjust_credits, redeem_reward,
  fulfill_redemption, assign_role, wallet_cache_drift, log_audit, require_permission from public, anon;
grant execute on function award_submission(uuid,int,text), decide_submission(uuid,submission_status,text),
  reverse_ledger_entry(uuid,text), admin_adjust_credits(uuid,int,text,text), redeem_reward(uuid,text),
  fulfill_redemption(uuid,redemption_status,text,text), assign_role(uuid,text,boolean) to authenticated;
grant execute on function has_permission(text) to authenticated;
grant execute on function record_affiliate_click(uuid,uuid) to anon, authenticated;
