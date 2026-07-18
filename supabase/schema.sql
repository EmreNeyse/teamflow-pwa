-- TeamFlow bulut senkronu (Supabase)
-- Supabase Dashboard → SQL Editor içinde çalıştırın.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users read own cloud data"
  on public.user_data
  for select
  using (auth.uid() = user_id);

create policy "Users insert own cloud data"
  on public.user_data
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own cloud data"
  on public.user_data
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own cloud data"
  on public.user_data
  for delete
  using (auth.uid() = user_id);

create index if not exists user_data_updated_at_idx
  on public.user_data (updated_at desc);
