-- Row Level Security. Default deny; every grant is explicit.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Browser roles never write money tables directly; all writes go through SECURITY DEFINER functions.
revoke insert, update, delete, truncate on credit_ledger, wallet_balance_cache, redemptions, redemption_fulfillments,
  submission_reviews, admin_audit_logs, user_roles, roles, permissions, role_permissions from anon, authenticated;

-- profiles: users may edit only these columns (never suspended / roles)
revoke update on profiles from authenticated;
grant update (full_name, username, country, avatar_url, discord_username, preferred_market, interests, onboarded, email_prefs, deletion_requested_at)
  on profiles to authenticated;
create policy profiles_self_read on profiles for select using (id = auth.uid() or has_permission('users.read'));
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_suspend on profiles for update using (has_permission('users.manage'));
grant update (suspended) on profiles to authenticated;   -- column visible, but only users.manage rows pass RLS (self rule can't set it: see trigger)
create or replace function guard_suspended() returns trigger language plpgsql as $$
begin
  if new.suspended is distinct from old.suspended and not has_permission('users.manage') then
    raise exception 'permission denied' using errcode='42501'; end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function guard_suspended();

create policy roles_read on roles for select using (has_permission('staff.manage'));
create policy perms_read on permissions for select using (has_permission('staff.manage'));
create policy rp_read on role_permissions for select using (has_permission('staff.manage'));
create policy ur_read on user_roles for select using (user_id = auth.uid() or has_permission('staff.manage'));

-- Staff-managed tables: (table, permission)
do $$ declare r record; begin
  for r in select * from (values
    ('partner_categories','partners.manage'),('partners','partners.manage'),('partner_private','partners.manage'),
    ('partner_offers','partners.manage'),('discount_codes','partners.manage'),('affiliate_links','partners.manage'),
    ('rewards','rewards.manage'),('reward_inventory','rewards.manage'),
    ('announcements','content.manage'),('faq_entries','content.manage'),('testimonials','content.manage'),
    ('blog_posts','content.manage'),('video_embeds','content.manage'),
    ('site_settings','settings.manage'),('site_statistics','settings.manage'),('feature_flags','settings.manage')
  ) as v(t,p) loop
    execute format('create policy staff_all on %I for all using (has_permission(%L)) with check (has_permission(%L))', r.t, r.p, r.p);
  end loop;
end $$;

-- Public read of published/active content
create policy pub_read on partner_categories for select using (true);
create policy pub_read on partners for select using (active);
create policy pub_read on partner_offers for select using (active and exists (select 1 from partners p where p.id=partner_id and p.active));
create policy pub_read on discount_codes for select using (active);
create policy pub_read on rewards for select using (active);
create policy pub_read on reward_inventory for select using (true);
create policy pub_read on announcements for select using (published);
create policy pub_read on faq_entries for select using (published);
create policy pub_read on testimonials for select using (approved);
create policy pub_read on blog_posts for select using (published);
create policy pub_read on video_embeds for select using (published);
create policy pub_read on site_statistics for select using (visible);
create policy pub_read on site_settings for select using (true);       -- never store secrets here
create policy pub_read on feature_flags for select using (true);
-- affiliate_links deliberately have NO public read: clicks must go through record_affiliate_click().

create policy clicks_read on affiliate_clicks for select using (user_id = auth.uid() or has_permission('analytics.read'));

-- Submissions
revoke insert, update on submissions from authenticated;
grant insert (user_id, partner_id, offer_id, order_id, purchase_date, amount, currency, discount_code, partner_email, notes, credits_requested)
  on submissions to authenticated;
create policy sub_read on submissions for select using (user_id = auth.uid() or has_permission('submissions.review'));
create policy sub_insert on submissions for insert with check (user_id = auth.uid());
create policy proof_read on submission_proofs for select using (
  exists (select 1 from submissions s where s.id=submission_id and (s.user_id=auth.uid() or has_permission('submissions.review'))));
create policy proof_insert on submission_proofs for insert with check (
  exists (select 1 from submissions s where s.id=submission_id and s.user_id=auth.uid()
          and s.status in ('pending','more_info_required')));
create policy review_read on submission_reviews for select using (has_permission('submissions.review'));

-- Email sync: tokens are never readable from the browser
revoke all on email_connections from anon, authenticated;
grant select (id,user_id,provider,scopes,consented_at,revoked_at) on email_connections to authenticated;
create policy ec_read on email_connections for select using (user_id = auth.uid());
create policy ese_read on email_sync_events for select using (
  exists (select 1 from email_connections c where c.id=connection_id and c.user_id=auth.uid()) or has_permission('analytics.read'));

-- Money
create policy ledger_read on credit_ledger for select using (user_id = auth.uid() or has_permission('credits.read'));
create policy wallet_read on wallet_balance_cache for select using (user_id = auth.uid() or has_permission('credits.read'));
create policy red_read on redemptions for select using (user_id = auth.uid() or has_permission('redemptions.process'));
create policy fulf_read on redemption_fulfillments for select using (
  exists (select 1 from redemptions d where d.id=redemption_id and (d.user_id=auth.uid() or has_permission('redemptions.process'))));

-- Member-owned
create policy notif_read on notifications for select using (user_id = auth.uid());
revoke update on notifications from authenticated; grant update (read_at) on notifications to authenticated;
create policy notif_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_all on saved_partners for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tix_read on support_tickets for select using (user_id = auth.uid() or has_permission('support.manage'));
create policy tix_insert on support_tickets for insert with check (user_id = auth.uid());
create policy tix_update on support_tickets for update using (has_permission('support.manage'));
create policy msg_read on support_messages for select using (
  exists (select 1 from support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or has_permission('support.manage'))));
create policy msg_insert on support_messages for insert with check (author_id = auth.uid() and
  exists (select 1 from support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or has_permission('support.manage'))));
create policy audit_read on admin_audit_logs for select using (has_permission('audit.read'));

-- Private storage bucket for proofs: path = <user_id>/<submission_id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs','proofs',false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id='proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id='proofs' and ((storage.foldername(name))[1] = auth.uid()::text or has_permission('submissions.review')));
