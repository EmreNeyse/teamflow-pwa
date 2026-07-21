-- TeamFlow — QR cihaz eşleştirme (geçici oturum)
-- schema.sql çalıştırıldıktan sonra bu dosyayı da Supabase SQL Editor'de çalıştırın.

create table if not exists public.device_pairings (
  token text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

alter table public.device_pairings enable row level security;

create policy "Create pairing session"
  on public.device_pairings
  for insert
  to anon, authenticated
  with check (expires_at > now());

create policy "Read active pairing session"
  on public.device_pairings
  for select
  to anon, authenticated
  using (expires_at > now() and consumed_at is null);

create policy "Consume pairing session"
  on public.device_pairings
  for update
  to anon, authenticated
  using (expires_at > now() and consumed_at is null)
  with check (consumed_at is not null);

create index if not exists device_pairings_expires_idx
  on public.device_pairings (expires_at desc);
