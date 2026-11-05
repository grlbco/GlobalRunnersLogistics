-- Security fix: signed-in users could update their own profiles.role (e.g. to 'admin') through the Data API.
-- Profiles are created by the auth trigger; users may only edit their own name, phone and language.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;
