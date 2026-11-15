-- Comparison-table fields for firm listings. All editable in /admin/partners/[id].
alter table partners
  add column if not exists tagline text,
  add column if not exists country text,
  add column if not exists years_operating int check (years_operating is null or years_operating >= 0),
  add column if not exists assets text[] not null default '{}',
  add column if not exists platforms text[] not null default '{}',
  add column if not exists max_allocation bigint check (max_allocation is null or max_allocation >= 0),
  add column if not exists rank int,
  add column if not exists rating numeric(2,1) check (rating is null or rating between 0 and 5),
  add column if not exists review_count int not null default 0 check (review_count >= 0),
  add column if not exists recommended boolean not null default false,
  add column if not exists payout_guarantee boolean not null default false;
create index if not exists partners_listing_idx on partners (category_id, active, rank);
