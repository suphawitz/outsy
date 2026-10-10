-- REVIEW REQUIRED: the audit found an unrelated remaining ALL/true policy.
-- Only removes the explicitly observed broad policy; public SELECT is preserved.
begin;
drop policy if exists "All" on public.provinces;
create policy outsy_provinces_admin_write on public.provinces for all to authenticated
  using ((select private.outsy_is_admin())) with check ((select private.outsy_is_admin()));
commit;
