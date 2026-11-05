-- "Following up" stage (form link sent, not filled after 2h), follow-up kinds, where SMS consent came from.
alter table public.contacts drop constraint if exists contacts_stage_check;
alter table public.contacts add constraint contacts_stage_check check (stage in ('new','contacted','replied','interested','form_sent','chasing','applied','qualified','sent_to_ken','hired','nurture','not_fit','not_interested','unsubscribed','bounced'));
alter table public.followups add column if not exists kind text not null default 'nudge' check (kind in ('nudge','chase','chase_extra','nurture'));
alter table public.contacts add column if not exists sms_consent_source text;
