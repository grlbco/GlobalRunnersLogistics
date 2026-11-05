-- Reports: one staff-only function that aggregates everything server-side (fast with 20k+ contacts).
insert into public.app_settings (key, value) values ('costs', '{"instantly": 107, "quo": 0, "leads": 0, "other": 0}') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('calls', '{"start":"07:00","end":"19:00","tz":"America/Los_Angeles","days":[1,2,3,4,5,6]}') on conflict (key) do nothing;

create or replace function public.crm_report(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not (select private.is_staff()) then raise exception 'not allowed'; end if;
  with reached as (
    select c.id, c.tier_label, coalesce(nullif(split_part(c.source, ':', 1), ''), 'unknown') as source, c.stage, c.created_at,
      exists (select 1 from public.activities a where a.contact_id = c.id and a.type = 'stage_changed' and a.data->>'to' in ('replied','interested','form_sent','chasing','applied','qualified','sent_to_ken','hired') and a.created_at >= p_since)
        or (c.stage in ('replied','interested','form_sent','chasing','applied','qualified','sent_to_ken','hired') and c.stage_changed_at >= p_since) as replied,
      exists (select 1 from public.activities a where a.contact_id = c.id and a.type = 'stage_changed' and a.data->>'to' in ('applied','qualified','sent_to_ken','hired') and a.created_at >= p_since)
        or (c.stage in ('applied','qualified','sent_to_ken','hired') and c.stage_changed_at >= p_since) as applied,
      exists (select 1 from public.activities a where a.contact_id = c.id and a.type = 'stage_changed' and a.data->>'to' = 'hired' and a.created_at >= p_since)
        or (c.stage = 'hired' and c.stage_changed_at >= p_since) as hired,
      (c.emails_sent > 0 or c.stage <> 'new') as contacted
    from public.contacts c
  ),
  funnel as (
    select jsonb_build_object('contacts', count(*), 'contacted', count(*) filter (where contacted), 'replied', count(*) filter (where replied),
      'form_sent', (select count(distinct contact_id) from public.form_links where sent_at >= p_since),
      'applied', count(*) filter (where applied), 'hired', count(*) filter (where hired)) as j from reached
  ),
  by_tier as (
    select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(tier_label, 'No tier'), 'total', total, 'replied', rep, 'applied', app, 'hired', hir) order by total desc), '[]') as j
    from (select tier_label, count(*) total, count(*) filter (where replied) rep, count(*) filter (where applied) app, count(*) filter (where hired) hir from reached group by tier_label) t
  ),
  by_source as (
    select coalesce(jsonb_agg(jsonb_build_object('name', source, 'total', total, 'replied', rep, 'applied', app, 'hired', hir) order by total desc), '[]') as j
    from (select source, count(*) total, count(*) filter (where replied) rep, count(*) filter (where applied) app, count(*) filter (where hired) hir from reached group by source) t
  ),
  by_campaign as (
    select coalesce(jsonb_agg(jsonb_build_object('name', cp.name, 'status', cp.status, 'members', x.members, 'replied', x.rep, 'applied', x.app, 'hired', x.hir, 'stats', cp.stats) order by cp.created_at desc), '[]') as j
    from public.campaigns cp
    left join lateral (
      select count(*) members, count(*) filter (where rc.replied) rep, count(*) filter (where rc.applied) app, count(*) filter (where rc.hired) hir
      from public.campaign_members m join reached rc on rc.id = m.contact_id where m.campaign_id = cp.id
    ) x on true
  ),
  assistant as (
    select jsonb_build_object('runs', count(*), 'replied', count(*) filter (where action in ('replied','draft')),
      'handed_off', count(*) filter (where action = 'handed_off'), 'failed', count(*) filter (where action = 'failed'),
      'cost', coalesce(round(sum(cost_usd)::numeric, 4), 0), 'avg_latency_ms', coalesce(round(avg(latency_ms) filter (where latency_ms > 0)), 0)) as j
    from public.agent_runs where created_at >= p_since
  ),
  speed as (
    select jsonb_build_object('median_min', round((percentile_cont(0.5) within group (order by mins))::numeric, 1),
      'p90_min', round((percentile_cont(0.9) within group (order by mins))::numeric, 1), 'samples', count(*)) as j
    from (
      select extract(epoch from (o.created_at - i.created_at)) / 60 as mins
      from public.messages i
      join lateral (select created_at from public.messages o2 where o2.contact_id = i.contact_id and o2.direction = 'outbound' and o2.created_at > i.created_at and o2.channel in ('sms','email') order by o2.created_at limit 1) o on true
      where i.direction = 'inbound' and i.channel in ('sms','email') and i.created_at >= p_since
    ) s
  ),
  chase as (
    select jsonb_build_object('chased', count(distinct f.contact_id),
      'completed_after', count(distinct f.contact_id) filter (where fl.completed_at is not null and fl.completed_at > f.first_at),
      'by_step', coalesce((
        select jsonb_object_agg(step, n) from (
          select (select max(attempt) from public.followups f3 where f3.contact_id = f2.contact_id and f3.kind = 'chase' and f3.status = 'done' and f3.due_at < fl2.completed_at) as step, count(*) n
          from (select contact_id, min(created_at) first_at from public.followups where kind = 'chase' and created_at >= p_since group by contact_id) f2
          join lateral (select completed_at from public.form_links where contact_id = f2.contact_id and completed_at is not null order by completed_at desc limit 1) fl2 on true
          where fl2.completed_at > f2.first_at group by 1
        ) z where step is not null), '{}')) as j
    from (select contact_id, min(created_at) first_at from public.followups where kind = 'chase' and created_at >= p_since group by contact_id) f
    left join lateral (select completed_at from public.form_links where contact_id = f.contact_id and completed_at is not null order by completed_at desc limit 1) fl on true
  ),
  forms as (
    select coalesce(jsonb_agg(jsonb_build_object('name', fm.name, 'submissions', (select count(*) from public.crm_form_submissions s where s.form_id = fm.id and s.created_at >= p_since))), '[]') as j from public.crm_forms fm
  ),
  calls as (
    select jsonb_build_object('calls', count(*), 'missed', count(*) filter (where (meta->>'missed')::boolean),
      'call_requests', (select count(*) from public.activities where type = 'call_requested' and created_at >= p_since)) as j
    from public.messages where channel = 'call' and created_at >= p_since
  )
  select jsonb_build_object('funnel', (select j from funnel), 'by_tier', (select j from by_tier), 'by_source', (select j from by_source),
    'by_campaign', (select j from by_campaign), 'assistant', (select j from assistant), 'speed', (select j from speed),
    'chase', (select j from chase), 'forms', (select j from forms), 'calls', (select j from calls),
    'costs', (select value from public.app_settings where key = 'costs')) into r;
  return r;
end;
$$;
revoke all on function public.crm_report(timestamptz) from public, anon;
grant execute on function public.crm_report(timestamptz) to authenticated;
