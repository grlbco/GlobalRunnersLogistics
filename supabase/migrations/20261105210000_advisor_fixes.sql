-- Reports run with the caller's rights (staff-only RLS on every table already applies).
alter function public.crm_report(timestamptz) security invoker;
-- Evaluate auth.* once per query, not per row.
drop policy "driver_leads: read own or staff" on public.driver_leads;
create policy "driver_leads: read own or staff" on public.driver_leads for select to authenticated
  using (user_id = (select auth.uid()) or lower(email) = (select lower(auth.jwt() ->> 'email')) or (select private.is_staff()));
