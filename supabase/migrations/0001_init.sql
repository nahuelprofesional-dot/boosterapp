-- BoosterApp initial schema
-- Run this in Supabase SQL editor (or via `supabase db push`).

-- Extensions
create extension if not exists "pgcrypto";

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.hotels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create type public.user_role as enum ('admin', 'receptionist');

-- The `users` profile table is keyed to auth.users(id).
-- auth.users owns credentials; this row holds hotel scoping and display data.
create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  hotel_id          uuid not null references public.hotels(id) on delete restrict,
  display_name      text not null,
  email             text not null unique,
  role              public.user_role not null default 'receptionist',
  push_subscription jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index users_hotel_id_idx on public.users (hotel_id);

create type public.conversation_status as enum
  ('bot_active', 'waiting', 'human_active', 'resolved');

create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  session_id  text not null,
  guest_name  text,
  channel     text not null default 'web',
  status      public.conversation_status not null default 'bot_active',
  assigned_to uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (hotel_id, session_id)
);

create index conversations_hotel_status_idx on public.conversations (hotel_id, status);
create index conversations_updated_idx      on public.conversations (hotel_id, updated_at desc);

create type public.sender_type as enum ('guest', 'bot', 'human');

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type     public.sender_type not null,
  sender_name     text,
  content         text not null,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  subscription jsonb not null,
  endpoint     text generated always as (subscription->>'endpoint') stored,
  created_at   timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ─── Triggers ────────────────────────────────────────────────────────────────

create or replace function public.touch_conversation()
returns trigger language plpgsql as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger touch_conversation_on_message
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- Make conversations & messages broadcast over Supabase Realtime.

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;

-- ─── RLS helpers ────────────────────────────────────────────────────────────

create or replace function public.current_user_hotel_id() returns uuid
language sql stable security definer set search_path = public as $$
  select hotel_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

-- ─── RLS policies ───────────────────────────────────────────────────────────
-- All policies scope by the caller's hotel. Service-role bypasses RLS for the
-- webhook + push fan-out paths.

alter table public.hotels             enable row level security;
alter table public.users              enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.push_subscriptions enable row level security;

-- hotels: only the user's own hotel
create policy hotels_select on public.hotels
  for select using (id = public.current_user_hotel_id());

-- users: same-hotel members visible; can update own row only
create policy users_select on public.users
  for select using (hotel_id = public.current_user_hotel_id());

create policy users_update_self on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- conversations: same hotel
create policy conversations_select on public.conversations
  for select using (hotel_id = public.current_user_hotel_id());

create policy conversations_update on public.conversations
  for update using (hotel_id = public.current_user_hotel_id())
  with check (hotel_id = public.current_user_hotel_id());

-- messages: visible if the conversation is in caller's hotel
create policy messages_select on public.messages
  for select using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.hotel_id = public.current_user_hotel_id()
  ));

create policy messages_insert on public.messages
  for insert with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.hotel_id = public.current_user_hotel_id()
  ));

-- push_subscriptions: own only
create policy push_subscriptions_select on public.push_subscriptions
  for select using (user_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());

create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());
