-- Feature: handoff when no receptionist is online.
--
-- 1) Extend the conversation_status enum with 'offline_handoff'.
-- 2) Create receptionist_heartbeats: each open ChatClient pings every 30 s so
--    the webhook can know in O(1) whether any receptionist is currently active
--    for a given hotel. Presence state lives in Realtime memory only, which
--    server-side code can't query — this is the DB mirror of that signal.

alter type public.conversation_status add value if not exists 'offline_handoff';

create table if not exists public.receptionist_heartbeats (
  user_id   uuid primary key references public.users(id) on delete cascade,
  hotel_id  uuid not null references public.hotels(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index if not exists receptionist_heartbeats_hotel_last_seen_idx
  on public.receptionist_heartbeats (hotel_id, last_seen desc);

alter table public.receptionist_heartbeats enable row level security;

-- A user can read/write only their own heartbeat (RLS scopes by auth.uid()).
drop policy if exists heartbeats_self_select on public.receptionist_heartbeats;
create policy heartbeats_self_select
  on public.receptionist_heartbeats for select
  using (user_id = auth.uid());

drop policy if exists heartbeats_self_upsert on public.receptionist_heartbeats;
create policy heartbeats_self_upsert
  on public.receptionist_heartbeats for insert
  with check (user_id = auth.uid());

drop policy if exists heartbeats_self_update on public.receptionist_heartbeats;
create policy heartbeats_self_update
  on public.receptionist_heartbeats for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
