-- BoosterApp seed
--
-- Supabase Auth credentials live in auth.users. The cleanest path is:
--   1. Run 0001_init.sql.
--   2. In Supabase Studio → Authentication → Users, click "Add user" and
--      create admin@hotelcosta.test / pick a password. Note the user's UUID.
--   3. Replace the placeholders below and run this file.
--
-- Repeat the users insert for each receptionist after creating them in Studio.

do $$
declare
  v_hotel_id uuid;
  v_admin_id uuid := '00000000-0000-0000-0000-000000000000'; -- ← replace with auth.users.id
begin
  insert into public.hotels (name)
  values ('Hotel Costa')
  returning id into v_hotel_id;

  insert into public.users (id, hotel_id, display_name, email, role)
  values (v_admin_id, v_hotel_id, 'Jorge', 'admin@hotelcosta.test', 'admin');

  raise notice 'Seeded hotel %', v_hotel_id;
end $$;

-- To add a receptionist later:
-- insert into public.users (id, hotel_id, display_name, email, role)
-- values ('<auth.users.id>', '<hotel id>', 'María', 'maria@hotelcosta.test', 'receptionist');
