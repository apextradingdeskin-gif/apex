-- DEMO DATA ONLY. Do not run in production. Placeholder partners, URLs and credit rates are fictional.
insert into feature_flags(key,enabled,note) values
 ('reward_pools',false,'Chance-based features stay OFF until qualified legal counsel approves.'),
 ('email_sync',false,'Enable after Google OAuth is configured and tested.')
on conflict do nothing;

insert into partner_categories(slug,name,sort) values
 ('prop-firms','Prop Firms',1),('brokers','FX Brokers',2),('tools','Trading Tools',3),
 ('gift-cards','Gift Cards',4),('flight-deals','Flight Deals',5),('hotel-deals','Hotel Deals',6),('experiences','Experiences',7)
on conflict do nothing;

insert into partners(category_id,name,slug,description,website_url,market,featured)
select c.id,'Demo Futures Firm','demo-futures-firm','Placeholder partner for development.','https://example.com','futures',true
from partner_categories c where c.slug='prop-firms';
insert into partner_offers(partner_id,name,challenge_type,account_size,price,discount_percent,credit_base,credit_rate)
select id,'50K Evaluation','Two-step',50000,150,20,0,1.0 from partners where slug='demo-futures-firm';
insert into discount_codes(partner_id,code) select id,'APEXDEMO' from partners where slug='demo-futures-firm';
insert into affiliate_links(partner_id,url) select id,'https://example.com/?ref=apex-demo' from partners where slug='demo-futures-firm';

insert into rewards(name,region,currency,credits_cost,featured) values
 ('Demo Gift Card (INR)','IN','INR',500,true),('Demo Gift Card (USD)','US','USD',1000,false);
insert into reward_inventory(reward_id,stock) select id,25 from rewards;

-- Statistics are editable in /admin. These are demo values, not real platform figures.
insert into site_statistics(key,label,value,sort) values
 ('discord_members','Discord members',1000,1),('partners','Partner firms',1,2),('offers','Available offers',1,3),('credits_rewarded','Credits rewarded',0,4)
on conflict do nothing;
insert into faq_entries(question,answer,sort) values
 ('How do I earn credits?','Buy through a partner link with your Apex code, then submit your order ID and proof. Credits are added after we verify the purchase.',1),
 ('How long does verification take?','Set this in admin settings once your review process is defined.',2);
