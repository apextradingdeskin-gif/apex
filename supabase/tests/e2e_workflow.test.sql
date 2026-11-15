-- End-to-end earn → redeem workflow, run as real Postgres roles with RLS in force.
-- Needs migrations 0001–0004 applied (Supabase provides auth.users and the anon/authenticated roles).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/e2e_workflow.test.sql
-- Everything is rolled back at the end. It has NOT been executed in the environment where it was written.
begin;

create function t_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;
create function t_reset() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create function t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;
create function t_fails(stmt text, label text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then return; end;
  raise exception 'FAIL: % unexpectedly succeeded', label;
end $$;
create function t_balance(uid uuid) returns bigint language sql as
  $$ select coalesce((select balance from wallet_balance_cache where user_id = uid), 0) $$;

-- fixtures (as superuser)
insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','member@t.dev','{"username":"e2e_member"}'),
 ('22222222-2222-2222-2222-222222222222','finance@t.dev','{"username":"e2e_finance"}'),
 ('33333333-3333-3333-3333-333333333333','other@t.dev','{"username":"e2e_other"}'),
 ('44444444-4444-4444-4444-444444444444','mod@t.dev','{"username":"e2e_mod"}');
insert into user_roles(user_id, role_id) select '22222222-2222-2222-2222-222222222222', id from roles where key='finance';
insert into user_roles(user_id, role_id) select '44444444-4444-4444-4444-444444444444', id from roles where key='moderator';
insert into partner_categories(slug,name) values ('e2e-cat','E2E');
insert into partners(id,category_id,name,slug,market) select '55555555-5555-5555-5555-555555555555', id, 'E2E Firm','e2e-firm','futures' from partner_categories where slug='e2e-cat';
insert into partner_offers(id,partner_id,name,price,credit_base) values ('66666666-6666-6666-6666-666666666666','55555555-5555-5555-5555-555555555555','E2E 50K',100,100);
insert into affiliate_links(partner_id,url) values ('55555555-5555-5555-5555-555555555555','https://example.com/ref');
insert into rewards(id,name,currency,credits_cost) values
 ('77777777-7777-7777-7777-777777777777','Cheap card','USD',100),('88888888-8888-8888-8888-888888888888','Expensive card','USD',100000);
insert into reward_inventory(reward_id,stock) values ('77777777-7777-7777-7777-777777777777',1),('88888888-8888-8888-8888-888888888888',5);

-- 1. member clicks the referral link; click is recorded with their id
select t_as('11111111-1111-1111-1111-111111111111');
do $$ declare r record; begin
  select * into r from record_affiliate_click('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
  perform t_assert(r.url = 'https://example.com/ref', 'redirect url');
  perform t_assert(exists(select 1 from affiliate_clicks where click_ref = r.click_ref and user_id = '11111111-1111-1111-1111-111111111111'), 'click recorded for member');
end $$;
select t_assert(not exists(select 1 from affiliate_links), 'members cannot read affiliate URLs directly');

-- 2. member submits an order; the same order cannot be submitted again
-- (members may not choose the row id, so insert without it, then pin a known id as superuser for later steps)
insert into submissions(user_id,partner_id,offer_id,order_id,purchase_date,amount,credits_requested)
 values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666','ORD-1',current_date,100,100);
select t_reset();
update submissions set id = 'aaaaaaaa-0000-0000-0000-000000000001' where order_id = 'ORD-1';
select t_as('11111111-1111-1111-1111-111111111111');
select t_fails($$insert into submissions(user_id,partner_id,order_id,purchase_date,amount) values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','ORD-1',current_date,100)$$, 'duplicate order id');
select t_fails($$insert into submissions(user_id,partner_id,order_id,purchase_date,amount,status) values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','ORD-X',current_date,100,'approved')$$, 'member self-approving status');

-- 3. unauthorized operations by a member
select t_fails($$select award_submission('aaaaaaaa-0000-0000-0000-000000000001', 100, null)$$, 'member awarding credits');
select t_fails($$insert into credit_ledger(user_id,type,amount,description,idempotency_key) values ('11111111-1111-1111-1111-111111111111','admin_credit',999,'x','hack1')$$, 'member inserting ledger row');
select t_fails($$update wallet_balance_cache set balance = 999999$$, 'member editing wallet cache');
select t_fails($$update submissions set status='approved'$$, 'member editing submission');
select t_fails($$select admin_adjust_credits('11111111-1111-1111-1111-111111111111', 500, 'x', 'hack2')$$, 'member adjusting credits');
select t_fails($$update profiles set suspended = true where id = '11111111-1111-1111-1111-111111111111'$$, 'member changing suspended flag');
select t_fails($$insert into user_roles(user_id, role_id) select '11111111-1111-1111-1111-111111111111', id from roles where key='super_admin'$$, 'member granting self a role');
select t_fails($$select assign_role('11111111-1111-1111-1111-111111111111','super_admin')$$, 'member assigning role');
select t_fails($$select fulfill_redemption(gen_random_uuid(),'fulfilled')$$, 'member fulfilling redemption');

-- 4. moderator has no financial access
select t_reset(); select t_as('44444444-4444-4444-4444-444444444444');
select t_fails($$select award_submission('aaaaaaaa-0000-0000-0000-000000000001', 100, null)$$, 'moderator awarding credits');
select t_assert((select count(*) from credit_ledger) = 0 and (select count(*) from submissions) = 0, 'moderator sees no financial/submission rows');

-- 5. finance staff approves; credits awarded exactly once
select t_reset(); select t_as('22222222-2222-2222-2222-222222222222');
select award_submission('aaaaaaaa-0000-0000-0000-000000000001', 100, 'verified');
select t_fails($$select award_submission('aaaaaaaa-0000-0000-0000-000000000001', 100, 'again')$$, 'second award of the same submission');
select t_reset();
select t_assert((select count(*) from credit_ledger where reference_id='aaaaaaaa-0000-0000-0000-000000000001') = 1, 'exactly one ledger row per submission');
select t_assert(t_balance('11111111-1111-1111-1111-111111111111') = 100, 'balance is 100 after approval');
select t_assert(exists(select 1 from admin_audit_logs where action='submission.approve'), 'approval audited');

-- 6. member sees balance; another member cannot see it
select t_as('11111111-1111-1111-1111-111111111111');
select t_assert(t_balance('11111111-1111-1111-1111-111111111111') = 100, 'member sees updated balance');
select t_reset(); select t_as('33333333-3333-3333-3333-333333333333');
select t_assert((select count(*) from credit_ledger) = 0 and (select count(*) from wallet_balance_cache) = 0, 'other member cannot see someone else''s credits');

-- 7. rejection path: no credits, reason required
select t_reset(); select t_as('11111111-1111-1111-1111-111111111111');
insert into submissions(user_id,partner_id,order_id,purchase_date,amount) values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','ORD-2',current_date,50);
select t_reset();
update submissions set id = 'aaaaaaaa-0000-0000-0000-000000000002' where order_id = 'ORD-2';
select t_reset(); select t_as('22222222-2222-2222-2222-222222222222');
select t_fails($$select decide_submission('aaaaaaaa-0000-0000-0000-000000000002','rejected','')$$, 'rejecting without a reason');
select decide_submission('aaaaaaaa-0000-0000-0000-000000000002','rejected','Proof does not match order');
select t_fails($$select award_submission('aaaaaaaa-0000-0000-0000-000000000002', 10, null)$$, 'awarding a rejected submission');
select t_reset();
select t_assert(t_balance('11111111-1111-1111-1111-111111111111') = 100, 'rejection did not change balance');
select t_assert(exists(select 1 from notifications where user_id='11111111-1111-1111-1111-111111111111' and kind='submission_rejected'), 'rejection notified');

-- 8. insufficient credits
select t_as('11111111-1111-1111-1111-111111111111');
select t_fails($$select redeem_reward('88888888-8888-8888-8888-888888888888','poor-1')$$, 'redeeming beyond balance');
select t_reset(); select t_assert(t_balance('11111111-1111-1111-1111-111111111111') = 100, 'failed redemption left balance untouched');

-- 9. redeem: atomic deduction, stock, idempotent retry
select t_as('11111111-1111-1111-1111-111111111111');
create temp table t_red(id uuid); grant all on t_red to public;
insert into t_red select redeem_reward('77777777-7777-7777-7777-777777777777','k1');
select t_assert((select redeem_reward('77777777-7777-7777-7777-777777777777','k1')) = (select id from t_red), 'same key returns same redemption');
select t_fails($$select redeem_reward('77777777-7777-7777-7777-777777777777','k2')$$, 'second redemption with no credits and no stock');
select t_reset();
select t_assert(t_balance('11111111-1111-1111-1111-111111111111') = 0, 'balance 0 after redemption');
select t_assert((select count(*) from credit_ledger where type='redemption') = 1, 'one debit row');
select t_assert((select stock from reward_inventory where reward_id='77777777-7777-7777-7777-777777777777') = 0, 'stock decremented');

-- 10. staff fulfils; member sees code
select t_as('22222222-2222-2222-2222-222222222222');
select fulfill_redemption((select id from t_red), 'fulfilled', 'CODE-123', 'sent by email');
select t_fails($$select fulfill_redemption((select id from t_red), 'fulfilled')$$, 'fulfilling twice');
select t_reset(); select t_as('11111111-1111-1111-1111-111111111111');
select t_assert((select code_reference from redemption_fulfillments limit 1) = 'CODE-123', 'member sees fulfilment code');
select t_assert((select status from redemptions where id = (select id from t_red)) = 'fulfilled', 'member sees fulfilled status');

-- 11. cancel path: refund once, restock
select t_reset();
update reward_inventory set stock = 3 where reward_id='77777777-7777-7777-7777-777777777777';
select t_as('22222222-2222-2222-2222-222222222222');
select admin_adjust_credits('11111111-1111-1111-1111-111111111111', 100, 'goodwill', 'adj-1');
select t_fails($$select admin_adjust_credits('11111111-1111-1111-1111-111111111111', 100, 'goodwill', 'adj-1')$$, 'repeating an adjustment key');
select t_fails($$select admin_adjust_credits('11111111-1111-1111-1111-111111111111', -500, 'too much', 'adj-2')$$, 'deduction that would overdraw');
select t_reset(); select t_as('11111111-1111-1111-1111-111111111111');
create temp table t_red2(id uuid); grant all on t_red2 to public;
insert into t_red2 select redeem_reward('77777777-7777-7777-7777-777777777777','k3');
select t_reset(); select t_as('22222222-2222-2222-2222-222222222222');
select fulfill_redemption((select id from t_red2), 'cancelled', null, 'member asked');
select t_reset();
select t_assert(t_balance('11111111-1111-1111-1111-111111111111') = 100, 'refund restored credits');
select t_assert((select stock from reward_inventory where reward_id='77777777-7777-7777-7777-777777777777') = 3, 'refund restored stock');
select t_assert((select count(*) from credit_ledger where idempotency_key like 'redemption_refund:%') = 1, 'exactly one refund row');

-- 12. ledger is immutable even for superuser; cache matches ledger
select t_fails($$update credit_ledger set amount = 1$$, 'ledger update');
select t_fails($$delete from credit_ledger$$, 'ledger delete');
select t_assert(not exists(select 1 from wallet_cache_drift()), 'wallet cache equals ledger sum');

rollback;
select 'e2e workflow tests passed' as result;
