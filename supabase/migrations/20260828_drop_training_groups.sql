-- Entfernt das zweite, nie befüllte Gruppen-System.
--
-- SwingZ führte zwei Gruppen-Tabellen nebeneinander: `groups` (club-weit,
-- `member_ids` JSONB, von der SeasonClusteringEngine erzeugt) und
-- `training_groups` (+ `training_group_memberships`, an `schedules` gehängt).
-- `season_plan_entries.group_id` zeigt per FK auf `groups`; `training_groups`
-- war in allen Vereinen leer, hatte keinen Aufrufer in der Oberfläche und
-- brachte zwei API-Routen dazu, gegen die falsche Tabelle zu joinen — der
-- Saisonplan lieferte dadurch zu jedem Eintrag `group_name: null`.
--
-- Befund und Nachweis: docs/ARCHIV/2026-08-28-grundfunktionen-harmonisierung.md
-- (F-3, F-4, F-6). Einzige Quelle für Gruppenzugehörigkeit ist ab jetzt
-- `groups.member_ids`.

drop table if exists public.training_group_memberships cascade;
drop table if exists public.training_groups cascade;
