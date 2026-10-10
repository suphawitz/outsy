-- REVIEW REQUIRED. Apply only AFTER 001 and explicit approval.
-- Adds narrow customer INSERT/SELECT; keeps slips private, immutable to customers.
begin;
do $$ begin
  if not exists(select 1 from storage.buckets where id='slips' and public=false) then raise exception 'slips must already be PRIVATE'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='payment_approved') then raise exception 'Apply reviewed booking migration first'; end if;
end $$;
update storage.buckets set file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='slips';

-- Existing generated legacy names contain no URI-encoded characters. Unusual URLs
-- are deliberately rejected and must be inventoried/mapped by an administrator.
create function private.outsy_document_path(p_value text)
returns text language sql immutable set search_path='' as $$
  select case
    when p_value like 'https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/slips/%'
    then split_part(substr(p_value,length('https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/slips/')+1),'?',1)
    when p_value !~ '^[a-zA-Z]+:' and p_value !~ '(^/|\\|%|\?|#|(^|/)\.\.?(/|$))' then p_value
    else null end;
$$;

create function private.outsy_can_read_document(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.bookings b where b.user_id=auth.uid() and private.outsy_document_path(b.slip)=p_name)
    or exists(select 1 from public.refund_requests r join public.bookings b on b.booking_id=r.booking_id
      where b.user_id=auth.uid() and private.outsy_document_path(r.book_bank_url)=p_name)
    or exists(select 1 from public.bookings b where b.user_id=auth.uid()
      and p_name ~ ('^'||auth.uid()::text||'/'||b.booking_id::text||'/(slip|bookbank)/[0-9a-f-]{36}\.(jpg|png|webp)$'))
  );
$$;
create function private.outsy_can_upload_document(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.bookings b where b.user_id=auth.uid() and (
      (not b.payment_approved and b.booking_status in ('รอชำระเงิน','รอตรวจสอบยอด')
        and p_name ~ ('^'||auth.uid()::text||'/'||b.booking_id::text||'/slip/[0-9a-f-]{36}\.(jpg|png|webp)$'))
      or (b.payment_approved and b.booking_status='ยกเลิก (คืนเงินเต็มจำนวน)'
        and p_name ~ ('^'||auth.uid()::text||'/'||b.booking_id::text||'/bookbank/[0-9a-f-]{36}\.(jpg|png|webp)$'))
    )
  );
$$;
revoke all on function private.outsy_document_path(text),private.outsy_can_read_document(text),private.outsy_can_upload_document(text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.outsy_document_path(text),private.outsy_can_read_document(text),private.outsy_can_upload_document(text) to authenticated;
create policy outsy_slips_customer_read on storage.objects for select to authenticated
  using (bucket_id='slips' and private.outsy_can_read_document(name));
create policy outsy_slips_customer_insert on storage.objects for insert to authenticated
  with check (bucket_id='slips' and private.outsy_can_upload_document(name));
-- No customer UPDATE, DELETE, upsert or public read. Existing admin-only policies stay.
-- Do not delete Storage objects via SQL; removal must use the Storage API.
commit;
