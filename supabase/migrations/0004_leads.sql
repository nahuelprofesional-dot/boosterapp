-- Phase 2 feature 3: leads detected from conversations.

create type public.lead_interest_level as enum ('alta', 'media', 'baja');

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  guest_name      text,
  dates_interest  text,
  room_type       text,
  interest_level  public.lead_interest_level not null,
  summary         text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conversation_id)
);

create index leads_hotel_idx on public.leads (hotel_id);
create index leads_interest_idx on public.leads (hotel_id, interest_level);

create or replace function public.touch_lead()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_lead_before_update
  before update on public.leads
  for each row execute function public.touch_lead();

alter table public.leads enable row level security;

-- Same-hotel members can read.
create policy leads_select on public.leads
  for select using (hotel_id = public.current_user_hotel_id());

-- Only admins of the same hotel can mutate. (Service role bypasses RLS, which
-- is what the analyze endpoint uses to upsert in bulk.)
create policy leads_admin_write on public.leads
  for all using (
    hotel_id = public.current_user_hotel_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    hotel_id = public.current_user_hotel_id()
    and public.current_user_role() = 'admin'
  );
