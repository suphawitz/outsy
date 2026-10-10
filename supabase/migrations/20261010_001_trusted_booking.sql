-- REVIEW REQUIRED. Do not execute on production without explicit approval.
-- Based on the owner's outsy_audit export received on 2026-10-10.
-- Transactional migration: aborts on unresolved legacy data; never disables RLS.
begin;

-- Verify generators and RLS rather than guessing whether bigint IDs are identity.
do $$
declare item record;
begin
  if to_regprocedure('private.outsy_is_admin()') is null then raise exception 'Missing verified admin helper'; end if;
  for item in select * from (values ('bookings','booking_id'),('booking_travelers','traveler_id')) t(tab,col) loop
    if not exists (
      select 1 from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=to_regclass('public.' || quote_ident(item.tab)) and a.attname=item.col
        and (a.attidentity<>'' or d.oid is not null)
    ) then raise exception 'Review ID generator for %.%',item.tab,item.col; end if;
  end loop;
  if exists (select 1 from pg_class where oid in ('public.bookings'::regclass,'public.booking_travelers'::regclass,'public.refund_requests'::regclass) and not relrowsecurity)
  then raise exception 'RLS must already be enabled'; end if;
  if exists (select 1 from public.bookings where booking_status is null or booking_status not in (
    'รอชำระเงิน','รอตรวจสอบยอด','ชำระเงินแล้ว','ยืนยันแล้ว','สำเร็จ','ทริปเสร็จสิ้น','เสร็จสิ้น',
    'ยกเลิก','ยกเลิก (คืนเงินเต็มจำนวน)','คืนเงินเรียบร้อยแล้ว'))
  then raise exception 'Review unknown or pending legacy booking states before migration'; end if;
end $$;

lock table public.bookings, public.booking_travelers, public.refund_requests, public."Tour_Schedules" in share row exclusive mode;
alter table public.bookings
  add column request_id uuid,
  add column request_fingerprint text,
  add column requested_schedule_id bigint,
  add column status_before_request varchar,
  add column seat_reserved boolean not null default false,
  add column payment_approved boolean not null default false;
create unique index outsy_booking_idempotency on public.bookings(user_id,request_id) where request_id is not null;
create unique index outsy_one_pending_refund on public.refund_requests(booking_id) where status='รอดำเนินการ';

-- Normalize only known aliases; unresolved pending requests above stop deployment.
update public.bookings set booking_status='ชำระเงินแล้ว' where booking_status in ('ยืนยันแล้ว','สำเร็จ');
update public.bookings set booking_status='ทริปเสร็จสิ้น' where booking_status='เสร็จสิ้น';
update public.bookings set payment_approved=true where booking_status in ('ชำระเงินแล้ว','ทริปเสร็จสิ้น','คืนเงินเรียบร้อยแล้ว');
update public.bookings b set tour_date_id=s.schedule_id
from public."Tour_Schedules" s where s.package_id=b.package_id and s.travel_date::text=b.travel_date;
update public.bookings set seat_reserved=true where booking_status in ('รอชำระเงิน','รอตรวจสอบยอด','ชำระเงินแล้ว','ทริปเสร็จสิ้น');

do $$ begin
  if exists (select 1 from public.bookings b where b.seat_reserved and (
    b.number_people is null or b.number_people not between 1 and 10 or not exists (
      select 1 from public."Tour_Schedules" s where s.schedule_id=b.tour_date_id and s.package_id=b.package_id and s.travel_date::text=b.travel_date)))
  then raise exception 'Reconcile active legacy bookings and schedules before migration'; end if;
end $$;
-- Reviewed reconciliation: actual booking reservations become the capacity authority.
update public."Tour_Schedules" s set booked_count=coalesce((select sum(b.number_people) from public.bookings b where b.tour_date_id=s.schedule_id and b.seat_reserved),0);
do $$ begin
  if exists (select 1 from public."Tour_Schedules" where max_capacity is null or max_capacity<1 or booked_count>max_capacity or booked_count<0)
  then raise exception 'Reconcile legacy capacity before migration'; end if;
end $$;
alter table public."Tour_Schedules" add constraint outsy_capacity_bounds check (max_capacity>0 and booked_count>=0 and booked_count<=max_capacity);
alter table public.bookings add constraint outsy_people_bounds check (number_people between 1 and 10) not valid;

-- All customer and admin booking mutations go through narrowly authorized RPCs.
-- SELECT remains governed by the verified existing ownership/admin policies.
revoke insert,update,delete on public.bookings,public.booking_travelers,public.refund_requests from public,anon,authenticated;
revoke update,delete on public."Tour_Schedules" from public,anon,authenticated;
drop policy if exists outsy_travelers_insert on public.booking_travelers;
drop policy if exists outsy_refunds_insert on public.refund_requests;
-- Ownership RLS does not restrict columns. Restrict profile changes to names only.
revoke update on public.users from public,anon,authenticated;
-- Remove any old column-level write grants too; table REVOKE alone is insufficient.
do $$
declare col record;
begin
  for col in select table_name,column_name from information_schema.columns
    where table_schema='public' and table_name in ('users','bookings','booking_travelers','refund_requests','Tour_Schedules') loop
    execute format('revoke update (%I) on public.%I from public,anon,authenticated',col.column_name,col.table_name);
    if col.table_name in ('bookings','booking_travelers','refund_requests','users') then
      execute format('revoke insert (%I) on public.%I from public,anon,authenticated',col.column_name,col.table_name);
    end if;
  end loop;
end $$;
revoke insert,delete on public.users from public,anon,authenticated;
grant update(username) on public.users to authenticated;

create function private.outsy_check_document(p_booking_id bigint,p_path text,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; o record;
begin
  select * into b from public.bookings where booking_id=p_booking_id;
  if auth.uid() is null or b.user_id is distinct from auth.uid() then raise exception 'OUTSY_AUTH' using errcode='42501'; end if;
  if p_kind not in ('slip','bookbank') or p_path is null or p_path !~ ('^'||auth.uid()::text||'/'||b.booking_id::text||'/'||p_kind||'/[0-9a-f-]{36}\.(jpg|png|webp)$')
  then raise exception 'OUTSY_DOCUMENT'; end if;
  select metadata into o from storage.objects where bucket_id='slips' and name=p_path;
  if not found or coalesce(o.metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp')
    or coalesce((o.metadata->>'size')::bigint,0) not between 1 and 5242880
  then raise exception 'OUTSY_DOCUMENT'; end if;
  if (p_path like '%.jpg' and o.metadata->>'mimetype'<>'image/jpeg') or (p_path like '%.png' and o.metadata->>'mimetype'<>'image/png') or (p_path like '%.webp' and o.metadata->>'mimetype'<>'image/webp') then raise exception 'OUTSY_DOCUMENT'; end if;
end $$;
revoke all on function private.outsy_check_document(bigint,text,text) from public,anon,authenticated;

create function public.outsy_create_booking(p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); request_uuid uuid; fingerprint text; email text;
  s public."Tour_Schedules"%rowtype; pkg public."Tour_Packages"%rowtype;
  b public.bookings%rowtype; traveler jsonb; people integer; used integer;
begin
  if actor is null then raise exception 'OUTSY_AUTH' using errcode='42501'; end if;
  if jsonb_typeof(p_request)<>'object' or length(p_request::text)>65536 or exists (
    select 1 from jsonb_object_keys(p_request) k where k not in ('request_id','schedule_id','customer_name','customer_phone','special_diet','special_notes','travelers'))
  then raise exception 'Invalid booking input'; end if;
  request_uuid:=(p_request->>'request_id')::uuid;
  if request_uuid is null then raise exception 'Request ID required'; end if;
  fingerprint:=md5(p_request::text);
  -- Coarse serialization avoids booking/schedule lock-order deadlocks in demo traffic.
  perform pg_advisory_xact_lock(104271,1);
  select * into b from public.bookings where user_id=actor and request_id=request_uuid;
  if found then
    if b.request_fingerprint is distinct from fingerprint then raise exception 'OUTSY_STATE'; end if;
    return jsonb_build_object('booking_id',b.booking_id::text,'total_price',b.total_price,'booking_status',b.booking_status);
  end if;
  if jsonb_typeof(p_request->'travelers') is distinct from 'array' then raise exception 'Travelers array required'; end if;
  people:=jsonb_array_length(p_request->'travelers')+1;
  if people not between 1 and 10 or coalesce(length(btrim(p_request->>'customer_name')),0) not between 1 and 255
    or coalesce(p_request->>'customer_phone','') !~ '^[0-9]{6,20}$'
    or coalesce(length(p_request->>'special_notes'),0)>2000 or coalesce(length(p_request->>'special_diet'),0)>255
  then raise exception 'Invalid customer details'; end if;
  for traveler in select value from jsonb_array_elements(p_request->'travelers') loop
    if jsonb_typeof(traveler)<>'object' or coalesce(length(btrim(traveler->>'full_name')),0) not between 1 and 255
      or (nullif(traveler->>'phone','') is not null and traveler->>'phone' !~ '^[0-9]{6,20}$')
      or exists (select 1 from jsonb_object_keys(traveler) k where k not in ('full_name','phone'))
    then raise exception 'Invalid traveler details'; end if;
  end loop;
  select * into s from public."Tour_Schedules" where schedule_id=(p_request->>'schedule_id')::bigint for update;
  if not found or s.status is distinct from 'open' or s.travel_date<(now() at time zone 'Asia/Bangkok')::date then raise exception 'OUTSY_SCHEDULE'; end if;
  select * into pkg from public."Tour_Packages" where package_id=s.package_id for share;
  if not found or pkg.status is distinct from 'available' or pkg.price<=0 then raise exception 'OUTSY_SCHEDULE'; end if;
  select coalesce(sum(number_people),0) into used from public.bookings where tour_date_id=s.schedule_id and seat_reserved;
  if s.max_capacity is null or used+people>s.max_capacity then raise exception 'OUTSY_CAPACITY'; end if;
  select u.email into email from auth.users u where u.id=actor;
  if email is null then raise exception 'OUTSY_AUTH'; end if;
  insert into public.bookings(user_id,package_id,tour_date_id,travel_date,customer_name,customer_email,customer_phone,number_people,total_price,booking_status,special_diet,special_notes,request_id,request_fingerprint,seat_reserved)
  values(actor,pkg.package_id,s.schedule_id,s.travel_date::text,btrim(p_request->>'customer_name'),email,p_request->>'customer_phone',people,pkg.price::numeric*people,'รอชำระเงิน',p_request->>'special_diet',p_request->>'special_notes',request_uuid,fingerprint,true)
  returning * into b;
  for traveler in select value from jsonb_array_elements(p_request->'travelers') loop
    insert into public.booking_travelers(booking_id,full_name,phone) values(b.booking_id,btrim(traveler->>'full_name'),nullif(traveler->>'phone',''));
  end loop;
  update public."Tour_Schedules" set booked_count=used+people where schedule_id=s.schedule_id;
  return jsonb_build_object('booking_id',b.booking_id::text,'total_price',b.total_price,'booking_status',b.booking_status);
end $$;

create function public.outsy_booking_action(p_booking_id text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; s public."Tour_Schedules"%rowtype; new_state text;
begin
  if auth.uid() is null then raise exception 'OUTSY_AUTH' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>16384 then raise exception 'Invalid action payload'; end if;
  perform pg_advisory_xact_lock(104271,1);
  select * into b from public.bookings where booking_id=p_booking_id::bigint and user_id=auth.uid() for update;
  if not found then raise exception 'OUTSY_AUTH' using errcode='42501'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where not (
    (p_action='submit_slip' and k='path') or
    (p_action='request_reschedule' and k='travel_date') or
    (p_action='request_refund' and k in ('bank_name','account_no','account_name','phone','path'))
  )) then raise exception 'Invalid action fields'; end if;
  if p_action='submit_slip' then
    if b.booking_status not in ('รอชำระเงิน','รอตรวจสอบยอด') or b.payment_approved then raise exception 'OUTSY_STATE'; end if;
    perform private.outsy_check_document(b.booking_id,p_payload->>'path','slip');
    update public.bookings set slip=p_payload->>'path',booking_status='รอตรวจสอบยอด' where booking_id=b.booking_id;
  elsif p_action='cancel' then
    if b.booking_status in ('ยกเลิก','ยกเลิก (คืนเงินเต็มจำนวน)') then return to_jsonb(b); end if;
    if b.booking_status not in ('รอชำระเงิน','รอตรวจสอบยอด','ชำระเงินแล้ว') or b.travel_date::date<=(now() at time zone 'Asia/Bangkok')::date then raise exception 'OUTSY_STATE'; end if;
    if b.seat_reserved then
      update public."Tour_Schedules" set booked_count=booked_count-b.number_people where schedule_id=b.tour_date_id;
    end if;
    new_state:=case when b.payment_approved then 'ยกเลิก (คืนเงินเต็มจำนวน)' else 'ยกเลิก' end;
    update public.bookings set booking_status=new_state,seat_reserved=false where booking_id=b.booking_id;
  elsif p_action='request_reschedule' then
    if b.booking_status not in ('ชำระเงินแล้ว','ยกเลิก (คืนเงินเต็มจำนวน)') or not b.payment_approved then raise exception 'OUTSY_STATE'; end if;
    select * into s from public."Tour_Schedules" where package_id=b.package_id and travel_date=(p_payload->>'travel_date')::date;
    if not found or s.status is distinct from 'open' or s.schedule_id=b.tour_date_id or s.travel_date<(now() at time zone 'Asia/Bangkok')::date then raise exception 'OUTSY_SCHEDULE'; end if;
    -- Request does not change travel_date, price or capacity. Approval rechecks capacity.
    update public.bookings set requested_schedule_id=s.schedule_id,status_before_request=b.booking_status,old_travel_date=b.travel_date,booking_status='ขอเปลี่ยนวันเดินทาง' where booking_id=b.booking_id;
  elsif p_action='request_refund' then
    if b.booking_status='ส่งเรื่องขอคืนเงินแล้ว' then return to_jsonb(b); end if;
    if b.booking_status<>'ยกเลิก (คืนเงินเต็มจำนวน)' or not b.payment_approved then raise exception 'OUTSY_STATE'; end if;
    if coalesce(length(btrim(p_payload->>'account_name')),0) not between 1 and 255
      or coalesce(length(btrim(p_payload->>'bank_name')),0) not between 1 and 255
      or coalesce(p_payload->>'account_no','') !~ '^[0-9]{6,30}$'
      or coalesce(p_payload->>'phone','') !~ '^[0-9]{6,20}$' then raise exception 'Invalid refund details'; end if;
    perform private.outsy_check_document(b.booking_id,p_payload->>'path','bookbank');
    insert into public.refund_requests(booking_id,customer_name,bank_name,account_no,account_name,email,phone,book_bank_url,status)
    values(b.booking_id,b.customer_name,p_payload->>'bank_name',p_payload->>'account_no',p_payload->>'account_name',b.customer_email,p_payload->>'phone',p_payload->>'path','รอดำเนินการ');
    update public.bookings set booking_status='ส่งเรื่องขอคืนเงินแล้ว' where booking_id=b.booking_id;
  else raise exception 'Unknown customer action'; end if;
  select * into b from public.bookings where booking_id=b.booking_id;
  return jsonb_build_object('booking_id',b.booking_id::text,'booking_status',b.booking_status);
end $$;

create function public.outsy_admin_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; s public."Tour_Schedules"%rowtype; r public.refund_requests%rowtype; used integer;
begin
  if auth.uid() is null or not private.outsy_is_admin() then raise exception 'OUTSY_AUTH' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>16384 then raise exception 'Invalid admin payload'; end if;
  perform pg_advisory_xact_lock(104271,1);
  if p_action='cancel_schedule' then
    select * into s from public."Tour_Schedules" where package_id=p_payload->>'package_id' and travel_date=(p_payload->>'travel_date')::date for update;
    if not found then raise exception 'OUTSY_SCHEDULE'; end if;
    -- Lock and cancel only active reservations; pending refunds/history remain intact.
    for b in select * from public.bookings where tour_date_id=s.schedule_id and seat_reserved for update loop
      if b.booking_status='ทริปเสร็จสิ้น' then raise exception 'OUTSY_STATE'; end if;
      update public.bookings set booking_status=case when payment_approved then 'ยกเลิก (คืนเงินเต็มจำนวน)' else 'ยกเลิก' end,
        seat_reserved=false,requested_schedule_id=null,status_before_request=null,old_travel_date=travel_date where booking_id=b.booking_id;
    end loop;
    update public."Tour_Schedules" set status='cancelled',booked_count=0 where schedule_id=s.schedule_id;
    return jsonb_build_object('schedule_id',s.schedule_id::text,'status','cancelled');
  elsif p_action='delete_schedule' then
    select * into s from public."Tour_Schedules" where schedule_id=(p_payload->>'schedule_id')::bigint for update;
    if not found then raise exception 'OUTSY_SCHEDULE'; end if;
    if exists(select 1 from public.bookings where tour_date_id=s.schedule_id or requested_schedule_id=s.schedule_id)
    then raise exception 'OUTSY_STATE'; end if;
    delete from public."Tour_Schedules" where schedule_id=s.schedule_id;
    return jsonb_build_object('deleted',true);
  elsif p_action='delete_refund' then
    select * into r from public.refund_requests where id=(p_payload->>'refund_id')::integer for update;
    if not found or r.status='รอดำเนินการ' then raise exception 'OUTSY_STATE'; end if;
    -- Preserve completed financial audit records; this action is intentionally denied.
    raise exception 'Refund records must be retained; deletion is disabled';
  end if;
  select * into b from public.bookings where booking_id=(p_payload->>'booking_id')::bigint for update;
  if not found then raise exception 'OUTSY_STATE'; end if;
  if p_action='approve_payment' then
    if b.booking_status<>'รอตรวจสอบยอด' or b.slip is null or not b.seat_reserved then raise exception 'OUTSY_STATE'; end if;
    -- Admin must actually inspect the private receipt; this is still a simulated payment.
    update public.bookings set booking_status='ชำระเงินแล้ว',payment_approved=true where booking_id=b.booking_id;
  elsif p_action='reject_slip' then
    if b.booking_status<>'รอตรวจสอบยอด' or b.payment_approved then raise exception 'OUTSY_STATE'; end if;
    update public.bookings set booking_status='รอชำระเงิน' where booking_id=b.booking_id;
  elsif p_action='complete' then
    if b.booking_status<>'ชำระเงินแล้ว' or not b.payment_approved or b.travel_date::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'OUTSY_STATE'; end if;
    update public.bookings set booking_status='ทริปเสร็จสิ้น' where booking_id=b.booking_id;
  elsif p_action='cancel_booking' then
    if b.booking_status in ('ยกเลิก','ยกเลิก (คืนเงินเต็มจำนวน)') then return jsonb_build_object('booking_id',b.booking_id::text,'booking_status',b.booking_status); end if;
    if b.booking_status not in ('รอชำระเงิน','รอตรวจสอบยอด','ชำระเงินแล้ว','ขอเปลี่ยนวันเดินทาง') then raise exception 'OUTSY_STATE'; end if;
    if b.seat_reserved then update public."Tour_Schedules" set booked_count=booked_count-b.number_people where schedule_id=b.tour_date_id; end if;
    update public.bookings set booking_status=case when payment_approved then 'ยกเลิก (คืนเงินเต็มจำนวน)' else 'ยกเลิก' end,
      seat_reserved=false,requested_schedule_id=null,status_before_request=null where booking_id=b.booking_id;
  elsif p_action='approve_reschedule' then
    if b.booking_status<>'ขอเปลี่ยนวันเดินทาง' or not b.payment_approved then raise exception 'OUTSY_STATE'; end if;
    select * into s from public."Tour_Schedules" where schedule_id=b.requested_schedule_id for update;
    if not found or s.package_id<>b.package_id or s.status is distinct from 'open' or s.travel_date<(now() at time zone 'Asia/Bangkok')::date then raise exception 'OUTSY_SCHEDULE'; end if;
    select coalesce(sum(number_people),0) into used from public.bookings where tour_date_id=s.schedule_id and seat_reserved;
    if s.max_capacity is null or used+b.number_people>s.max_capacity then raise exception 'OUTSY_CAPACITY'; end if;
    if b.seat_reserved then update public."Tour_Schedules" set booked_count=booked_count-b.number_people where schedule_id=b.tour_date_id; end if;
    update public."Tour_Schedules" set booked_count=used+b.number_people where schedule_id=s.schedule_id;
    update public.bookings set tour_date_id=s.schedule_id,travel_date=s.travel_date::text,booking_status='ชำระเงินแล้ว',seat_reserved=true,
      requested_schedule_id=null,status_before_request=null where booking_id=b.booking_id;
  elsif p_action='reject_reschedule' then
    if b.booking_status<>'ขอเปลี่ยนวันเดินทาง' or b.status_before_request not in ('ชำระเงินแล้ว','ยกเลิก (คืนเงินเต็มจำนวน)') then raise exception 'OUTSY_STATE'; end if;
    update public.bookings set booking_status=status_before_request,requested_schedule_id=null,status_before_request=null where booking_id=b.booking_id;
  elsif p_action='mark_refunded' then
    select * into r from public.refund_requests where id=(p_payload->>'refund_id')::integer and booking_id=b.booking_id for update;
    if not found or r.status<>'รอดำเนินการ' or b.booking_status<>'ส่งเรื่องขอคืนเงินแล้ว' or not b.payment_approved then raise exception 'OUTSY_STATE'; end if;
    update public.refund_requests set status='คืนเงินแล้ว' where id=r.id;
    update public.bookings set booking_status='คืนเงินเรียบร้อยแล้ว' where booking_id=b.booking_id;
  elsif p_action='reject_refund' then
    select * into r from public.refund_requests where id=(p_payload->>'refund_id')::integer and booking_id=b.booking_id for update;
    if not found or r.status<>'รอดำเนินการ' or b.booking_status<>'ส่งเรื่องขอคืนเงินแล้ว' then raise exception 'OUTSY_STATE'; end if;
    update public.refund_requests set status='ปฏิเสธ' where id=r.id;
    update public.bookings set booking_status='ยกเลิก (คืนเงินเต็มจำนวน)' where booking_id=b.booking_id;
  else raise exception 'Unknown admin action'; end if;
  select * into b from public.bookings where booking_id=b.booking_id;
  return jsonb_build_object('booking_id',b.booking_id::text,'booking_status',b.booking_status);
end $$;

revoke all on function public.outsy_create_booking(jsonb) from public,anon,authenticated;
revoke all on function public.outsy_booking_action(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.outsy_admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.outsy_create_booking(jsonb),public.outsy_booking_action(text,text,jsonb),public.outsy_admin_action(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
