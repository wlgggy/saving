-- Run this once in Supabase Dashboard > SQL Editor.
-- Authentication > Providers > Anonymous must also be enabled.

create table if not exists public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_states enable row level security;

drop policy if exists "planner state: own data" on public.planner_states;
create policy "planner state: own data"
  on public.planner_states
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
