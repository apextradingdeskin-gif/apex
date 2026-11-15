-- Milestone 2: configurable earning rules, audit triggers, public asset buckets, link-availability check.

alter table partner_offers add column if not exists credit_cap int check (credit_cap is null or credit_cap >= 0);
alter table partner_offers add column if not exists credit_conditions text;
create index if not exists partners_category_idx on partners (category_id, active);

-- True/false only; never exposes the affiliate URL itself.
create or replace function partner_has_link(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from affiliate_links where partner_id = p and active);
$$;
grant execute on function partner_has_link(uuid) to anon, authenticated;

-- Every staff change to catalogue/reward tables is audited in the database, whichever client made it.
create or replace function audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid text;
begin
  rid := coalesce((to_jsonb(coalesce(new, old))->>'id'), (to_jsonb(coalesce(new, old))->>'reward_id'), (to_jsonb(coalesce(new, old))->>'partner_id'));
  insert into admin_audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, rid,
          jsonb_build_object('new', case when tg_op <> 'DELETE' then to_jsonb(new) end,
                             'old', case when tg_op <> 'INSERT' then to_jsonb(old) end));
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['partners','partner_offers','discount_codes','affiliate_links','partner_categories','rewards','reward_inventory'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row_change()', t);
  end loop;
end $$;

-- Public image buckets (logos / reward images). Writes require the matching permission.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('partner-logos','partner-logos',true,2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
 ('reward-images','reward-images',true,2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy logos_write on storage.objects for all to authenticated
  using (bucket_id='partner-logos' and has_permission('partners.manage'))
  with check (bucket_id='partner-logos' and has_permission('partners.manage'));
create policy rewimg_write on storage.objects for all to authenticated
  using (bucket_id='reward-images' and has_permission('rewards.manage'))
  with check (bucket_id='reward-images' and has_permission('rewards.manage'));
create policy public_images_read on storage.objects for select using (bucket_id in ('partner-logos','reward-images'));
