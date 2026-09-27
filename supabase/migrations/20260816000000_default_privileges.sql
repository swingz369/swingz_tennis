-- Supabase vergibt ab 2026-10-30 keine automatischen Data-API-Grants mehr für neue Tabellen.
-- Stellt das bisherige Verhalten für db reset / Preview-Branches / neue Projekte wieder her;
-- spätere REVOKEs greifen weiterhin. Direkt nach der Baseline einsortiert, damit alle
-- danach angelegten Tabellen die Grants bekommen. Die Baseline selbst bleibt unverändert
-- (Prüfsumme in schema_migrations).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
