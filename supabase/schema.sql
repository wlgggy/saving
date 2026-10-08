-- Run this once in Supabase Dashboard > SQL Editor.
-- Authentication > Providers > Anonymous must also be enabled.

create table if not exists public.save_me_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'coco',
  bio text not null default '',
  profile_image text,
  spotify_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.save_me_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  account_name text,
  start_month text not null,
  end_month text not null,
  deposit_amount bigint not null default 0 check (deposit_amount >= 0),
  target_amount bigint not null default 0 check (target_amount >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (start_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  check (end_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);

create table if not exists public.save_me_checks (
  user_id uuid not null,
  category_id text not null,
  savings_month text not null,
  is_checked boolean not null default true,
  primary key (user_id, category_id, savings_month),
  foreign key (user_id, category_id) references public.save_me_categories(user_id, id) on delete cascade,
  check (savings_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);

create table if not exists public.save_me_travel_transactions (
  user_id uuid not null,
  id text not null,
  category_id text not null,
  transaction_date date not null,
  amount bigint not null check (amount > 0),
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal')),
  memo text,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.save_me_categories(user_id, id) on delete cascade
);

alter table public.save_me_settings enable row level security;
alter table public.save_me_categories enable row level security;
alter table public.save_me_checks enable row level security;
alter table public.save_me_travel_transactions enable row level security;

drop policy if exists "own save_me_settings" on public.save_me_settings;
create policy "own save_me_settings" on public.save_me_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own save_me_categories" on public.save_me_categories;
create policy "own save_me_categories" on public.save_me_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own save_me_checks" on public.save_me_checks;
create policy "own save_me_checks" on public.save_me_checks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own save_me_travel_transactions" on public.save_me_travel_transactions;
create policy "own save_me_travel_transactions" on public.save_me_travel_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
