-- Make sure conversations and messages are published on the supabase_realtime
-- publication so ChatClient's postgres_changes subscriptions receive INSERT
-- and UPDATE events. Without this, rows are written to the DB but the UI
-- only sees them after a manual page refresh.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.conversations';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
