-- "To call": drivers who asked for a call or won't fill out the form. The team calls them; the form chase stops.
alter table public.contacts drop constraint if exists contacts_stage_check;
alter table public.contacts add constraint contacts_stage_check check (stage in ('new','contacted','replied','interested','form_sent','chasing','to_call','applied','qualified','sent_to_ken','hired','nurture','not_fit','not_interested','unsubscribed','bounced'));
