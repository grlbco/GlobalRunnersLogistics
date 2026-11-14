-- Driver-facing wording: no owner name, speak as "our team" (2026-11-14).
update public.workflows set
  name = 'Team reminder after an application',
  description = 'Driver applied: remind the team after 2 hours if nobody called, then nudge the driver the next day.',
  steps = (
    select jsonb_agg(case when s->>'type' = 'send_text' and s->>'body' like '%Ken from Global Runners%'
      then jsonb_set(s, '{body}', '"Hey {{first_name}}, our team at Global Runners wants to go over your application with you. What time works for a quick call?"')
      else s end)
    from jsonb_array_elements(steps) s
  ),
  updated_at = now()
where name = 'Ken reminder after an application';

update public.crm_forms set schema = jsonb_set(jsonb_set(schema,
    '{settings,description}', '"Takes 30 seconds. Someone from our team will reach out."'),
    '{settings,es,description}', '"Toma 30 segundos. Alguien de nuestro equipo te contacta."')
where schema->'settings'->>'description' = 'Takes 30 seconds. Ken or someone from the team will reach out.';
