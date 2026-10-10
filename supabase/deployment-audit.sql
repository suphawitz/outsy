-- READ ONLY: one JSON result, no customer rows or secrets.
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(t)) from (
    select tablename, rowsecurity from pg_tables where schemaname = 'public'
  ) t),
  'columns', (select jsonb_agg(to_jsonb(t)) from (
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns where table_schema = 'public'
      and table_name in ('users','Tour_Packages','Tour_Schedules','Package_Itineraries','bookings','booking_travelers','refund_requests')
    order by table_name, ordinal_position
  ) t),
  'constraints', (select jsonb_agg(to_jsonb(t)) from (
    select c.conrelid::regclass::text as table_name, c.conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'
  ) t),
  'policies', (select jsonb_agg(to_jsonb(t)) from (
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public','storage')
  ) t),
  'buckets', (select jsonb_agg(to_jsonb(t)) from (
    select id, name, public, file_size_limit, allowed_mime_types from storage.buckets
    where id in ('slips','tourist_images')
  ) t),
  'triggers', (select jsonb_agg(to_jsonb(t)) from (
    select event_object_schema, event_object_table, trigger_name, action_statement
    from information_schema.triggers where event_object_schema in ('public','auth')
  ) t),
  'functions', (select jsonb_agg(to_jsonb(t)) from (
    select n.nspname as schema_name, p.proname, p.prosecdef as security_definer,
      pg_get_function_identity_arguments(p.oid) as arguments, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname='handle_new_user')
      or (n.nspname='private' and p.proname='outsy_is_admin')
  ) t)
) as outsy_audit;
