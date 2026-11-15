-- Run against a scratch database after migrations + seed. Each block should raise on failure.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ledger.test.sql
begin;
  -- two users + one staff finance role
  insert into auth.users(id,email,raw_user_meta_data) values
   ('00000000-0000-0000-0000-0000000000a1','a@test.dev','{"username":"alice1"}'),
   ('00000000-0000-0000-0000-0000000000b1','staff@test.dev','{"username":"staff1"}');
  insert into user_roles(user_id,role_id) select '00000000-0000-0000-0000-0000000000b1', id from roles where key='finance';

  -- act as staff
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
  select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1"}',true);

  -- 1. approve once; second approval must fail (no duplicate award)
  insert into submissions(id,user_id,partner_id,order_id,purchase_date,amount)
   select '00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000000a1',id,'ORD-1',current_date,150 from partners limit 1;
  select award_submission('00000000-0000-0000-0000-00000000c001',100,'ok');
  do $$ begin perform award_submission('00000000-0000-0000-0000-00000000c001',100,'again');
    raise exception 'FAIL: duplicate award allowed'; exception when others then
    if sqlerrm like 'FAIL%' then raise; end if; end $$;
  do $$ begin if (select balance from wallet_balance_cache where user_id='00000000-0000-0000-0000-0000000000a1') <> 100
    then raise exception 'FAIL: balance'; end if; end $$;

  -- 2. ledger is append-only
  do $$ begin update credit_ledger set amount=999; raise exception 'FAIL: ledger mutable';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

  -- 3. reversal works once, and cache matches ledger
  do $$ declare l uuid; begin
    select id into l from credit_ledger where type='purchase_reward';
    perform reverse_ledger_entry(l,'test');
    begin perform reverse_ledger_entry(l,'again'); raise exception 'FAIL: double reversal';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  end $$;
  do $$ begin if exists (select 1 from wallet_cache_drift()) then raise exception 'FAIL: cache drift'; end if; end $$;

  -- 4. overdraft is refused
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
  select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1"}',true);
  do $$ begin perform redeem_reward((select id from rewards limit 1),'k1'); raise exception 'FAIL: overdraft';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
rollback;
select 'ledger tests passed' as result;
