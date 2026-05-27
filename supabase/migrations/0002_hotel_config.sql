-- Phase 2 feature 1: chatbot content editor.
-- Stores per-hotel knobs the bot uses when answering guests.

create table public.hotel_config (
  hotel_id            uuid primary key references public.hotels(id) on delete cascade,
  checkin_time        text,
  checkout_time       text,
  breakfast_hours     text,
  parking_available   boolean not null default false,
  parking_price       text,
  cancellation_policy text,
  welcome_message     text,
  additional_info     text,
  updated_at          timestamptz not null default now()
);

create or replace function public.touch_hotel_config()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_hotel_config_before_update
  before update on public.hotel_config
  for each row execute function public.touch_hotel_config();

alter table public.hotel_config enable row level security;

-- Same-hotel users can read.
create policy hotel_config_select on public.hotel_config
  for select using (hotel_id = public.current_user_hotel_id());

-- Only admins of the same hotel can insert/update.
create policy hotel_config_insert on public.hotel_config
  for insert with check (
    hotel_id = public.current_user_hotel_id()
    and public.current_user_role() = 'admin'
  );

create policy hotel_config_update on public.hotel_config
  for update using (
    hotel_id = public.current_user_hotel_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    hotel_id = public.current_user_hotel_id()
    and public.current_user_role() = 'admin'
  );
