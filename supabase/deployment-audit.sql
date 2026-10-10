-- Read-only audit. Run in the Supabase SQL Editor; never changes data or policies.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'Tour_Packages', 'Tour_Schedules', 'Package_Itineraries', 'bookings', 'booking_travelers', 'refund_requests');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('slips', 'tourist_images');

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('users', 'Tour_Packages', 'Tour_Schedules', 'Package_Itineraries', 'bookings', 'booking_travelers', 'refund_requests')
order by table_name, ordinal_position;

select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth');

select p.proname, p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
