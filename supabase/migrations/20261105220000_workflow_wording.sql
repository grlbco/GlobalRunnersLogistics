-- Built-in "Ken reminder after an application": don't claim Ken already tried to call.
update public.workflows set steps = (
  select jsonb_agg(case when s->>'type' = 'send_text' and s->>'body' like '%has been trying to reach you%'
    then jsonb_set(s, '{body}', '"Hey {{first_name}}, Ken from Global Runners wants to go over your application with you. What time works for a quick call?"')
    else s end)
  from jsonb_array_elements(steps) s
), updated_at = now()
where name = 'Ken reminder after an application';
