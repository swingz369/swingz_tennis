-- Drei neue Konflikttypen für die Saisonplanung zulassen
--
-- Der QA-Durchlauf vom 12.08.2026 zeigte, dass die Konfliktprüfung einen Plan als
-- "konfliktfrei" freigab, in dem eine Gruppe keinen Platz hatte, vier Mitglieder
-- außerhalb ihrer angegebenen Verfügbarkeit eingeteilt waren und vier weitere gar
-- nicht eingeplant wurden. `lib/season-planning/conflict-detector.ts` prüft diese
-- Fälle jetzt; ohne die erweiterte Liste hier scheitert das Speichern der
-- gefundenen Konflikte und damit die gesamte Veröffentlichung.
--
-- Live-Zustand vor dieser Migration per pg_get_constraintdef geprüft (AGENTS.md):
-- der Constraint listete die acht ursprünglichen Typen.

ALTER TABLE planning_conflicts
  DROP CONSTRAINT IF EXISTS planning_conflicts_conflict_type_check;

ALTER TABLE planning_conflicts
  ADD CONSTRAINT planning_conflicts_conflict_type_check
  CHECK (conflict_type IN (
    'trainer_double_booking',
    'member_double_booking',
    'no_trainer_assigned',
    'court_unavailable',
    'trainer_over_limit',
    'high_failure_rate_slot',
    'large_niveau_span',
    'avoid_partner_conflict',
    -- neu, 12.08.2026
    'no_court_assigned',
    'member_unavailable',
    'member_unplanned'
  ));
