-- Day-by-day activity for the dashboard charts (Las Vegas time). Staff only; runs as the caller (RLS applies).
create or replace function public.crm_daily(p_days int default 30)
returns table (day date, replies int, answered int, forms int, applied int)
language plpgsql stable set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not allowed'; end if;
  return query
  with days as (
    select generate_series(
      (now() at time zone 'America/Los_Angeles')::date - (least(greatest(p_days, 7), 180) - 1),
      (now() at time zone 'America/Los_Angeles')::date, interval '1 day')::date as d
  ),
  since as (select (min(d)::timestamp at time zone 'America/Los_Angeles') as t from days)
  select d.d,
    (select count(*)::int from public.messages m where m.direction = 'inbound' and (m.created_at at time zone 'America/Los_Angeles')::date = d.d and m.created_at >= (select t from since)),
    (select count(*)::int from public.messages m where m.direction = 'outbound' and m.author in ('agent', 'human') and (m.created_at at time zone 'America/Los_Angeles')::date = d.d and m.created_at >= (select t from since)),
    (select count(*)::int from public.crm_form_submissions s where (s.created_at at time zone 'America/Los_Angeles')::date = d.d and s.created_at >= (select t from since)),
    (select count(*)::int from public.activities a where a.type = 'stage_changed' and a.data ->> 'to' = 'applied' and (a.created_at at time zone 'America/Los_Angeles')::date = d.d and a.created_at >= (select t from since))
  from days d order by d.d;
end $$;
revoke execute on function public.crm_daily(int) from public, anon;
grant execute on function public.crm_daily(int) to authenticated;
