-- DRAFT / NOT APPLIED. Fixes customer booking INSERT only, not the whole workflow.
-- Does not change existing rows, counters, columns or existing policies.
-- Capacity check is NOT concurrency-safe; coordinated seat management is still required.
begin;
create policy outsy_customer_booking_insert
on public.bookings for insert to authenticated
with check (
  user_id = (select auth.uid())
  and booking_status = 'รอชำระเงิน'
  and slip is null
  and coalesce(old_travel_date, '') = ''
  and number_people between 1 and 10
  and exists (
    select 1 from public."Tour_Packages" p
    join public."Tour_Schedules" s on s.package_id = p.package_id
    where p.package_id = bookings.package_id
      and p.status = 'available'
      and p.price > 0
      and bookings.total_price = p.price * bookings.number_people
      and s.schedule_id = bookings.tour_date_id
      and s.travel_date::text = bookings.travel_date
      and s.travel_date >= (now() at time zone 'Asia/Bangkok')::date
      and s.status = 'open'
      and coalesce(s.booked_count, 0) + bookings.number_people <= s.max_capacity
  )
);
commit;
-- Rollback this policy only: drop policy outsy_customer_booking_insert on public.bookings;
