-- PLACEHOLDER DEMO FIRMS ONLY (fictional names, fictional numbers). Replace with real partners in /admin.
-- Never publish placeholder ratings, reviews or rules as if they were real.
do $$
declare cat int; pid uuid; n text; i int := 0;
begin
  select id into cat from partner_categories where slug='prop-firms';
  if cat is null then raise exception 'run supabase/seed.sql first'; end if;
  foreach n in array array['Demo Prop Alpha','Demo Prop Bravo','Demo Prop Charlie','Demo Prop Delta','Demo Prop Echo','Demo Prop Foxtrot'] loop
    i := i + 1;
    insert into partners(category_id,name,slug,description,website_url,market,featured,tagline,country,years_operating,assets,platforms,max_allocation,rank,rating,review_count,recommended,payout_guarantee)
    values (cat, n, lower(replace(n,' ','-')), 'Placeholder listing for design review.', 'https://example.com',
      (array['forex','futures','forex','perps','forex','crypto'])[i], i <= 4, 'Placeholder tagline',
      (array['UAE','USA','UK','Cyprus','India','Australia'])[i], 2 + i,
      (array[array['FX','Metals'],array['Futures'],array['FX','Indices','Metals'],array['Perps','Crypto'],array['FX'],array['Crypto']])[i],
      (array[array['MT5','cTrader'],array['Rithmic','NinjaTrader'],array['MT4','MT5'],array['Web'],array['MT5'],array['Web']])[i],
      (array[200000,300000,400000,100000,500000,150000])[i], i, (array[4.7,4.5,4.4,4.2,4.0,3.9])[i], 0, i = 1, i <= 2)
    on conflict (slug) do nothing
    returning id into pid;
    if pid is not null then
      insert into discount_codes(partner_id, code) values (pid, 'DEMO'||i);
      insert into partner_offers(partner_id,name,account_size,price,discount_percent,credit_base,credit_rate) values (pid,'100K Challenge',100000,500,10+i,0,0.5);
      insert into affiliate_links(partner_id,url) values (pid,'https://example.com/?ref=demo'||i);
    end if;
  end loop;
end $$;
insert into faq_entries(question,answer,sort) values
 ('Are the firms listed here recommendations?','Listings are information, not financial advice. Check each firm''s own rules and terms before you buy a challenge.',3),
 ('Does using your link cost me extra?','No. Prices are set by the partner. Apex may earn a commission, and shares part of the value back to members as credits.',4),
 ('Are credits guaranteed?','No. Credits are awarded after we verify your purchase and depend on each partner''s terms.',5)
on conflict do nothing;
