-- Run this once in Supabase Dashboard > SQL Editor.
-- This is one shared planner: every device sees and edits the same data.
-- Do not use this schema for data that must be private from anyone with the app URL.

create table if not exists public.save_me_shared_settings (
  id text primary key default 'save-me-shared-planner',
  nickname text not null default 'coco',
  bio text not null default '',
  profile_image text,
  spotify_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.save_me_shared_categories (
  id text primary key,
  name text not null,
  account_name text,
  start_month text not null,
  end_month text not null,
  deposit_amount bigint not null default 0 check (deposit_amount >= 0),
  target_amount bigint not null default 0 check (target_amount >= 0),
  manual_months text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (start_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  check (end_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);

alter table public.save_me_shared_categories
  add column if not exists manual_months text[] not null default '{}',
  add column if not exists sort_order integer not null default 0;

create table if not exists public.save_me_shared_checks (
  category_id text not null,
  savings_month text not null,
  is_checked boolean not null default true,
  primary key (category_id, savings_month),
  foreign key (category_id) references public.save_me_shared_categories(id) on delete cascade,
  check (savings_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);

create table if not exists public.save_me_shared_travel_transactions (
  id text primary key,
  category_id text not null,
  transaction_date date not null,
  amount bigint not null check (amount > 0),
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal')),
  memo text,
  created_at timestamptz not null default now(),
  foreign key (category_id) references public.save_me_shared_categories(id) on delete cascade
);

alter table public.save_me_shared_settings enable row level security;
alter table public.save_me_shared_categories enable row level security;
alter table public.save_me_shared_checks enable row level security;
alter table public.save_me_shared_travel_transactions enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.save_me_shared_settings to anon, authenticated;
grant select, insert, update, delete on public.save_me_shared_categories to anon, authenticated;
grant select, insert, update, delete on public.save_me_shared_checks to anon, authenticated;
grant select, insert, update, delete on public.save_me_shared_travel_transactions to anon, authenticated;

drop policy if exists "shared planner settings" on public.save_me_shared_settings;
create policy "shared planner settings" on public.save_me_shared_settings for all to anon, authenticated using (true) with check (true);
drop policy if exists "shared planner categories" on public.save_me_shared_categories;
create policy "shared planner categories" on public.save_me_shared_categories for all to anon, authenticated using (true) with check (true);
drop policy if exists "shared planner checks" on public.save_me_shared_checks;
create policy "shared planner checks" on public.save_me_shared_checks for all to anon, authenticated using (true) with check (true);
drop policy if exists "shared planner transactions" on public.save_me_shared_travel_transactions;
create policy "shared planner transactions" on public.save_me_shared_travel_transactions for all to anon, authenticated using (true) with check (true);
