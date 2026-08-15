-- Benachrichtigungen: erlaubte Typen an den tatsächlich verwendeten Stand angleichen.
--
-- Befund vom 13.08.2026: `notifications_type_check` ließ nur
--   info | warning | success | error | booking | invoice | training
-- zu. Der Anwendungscode schreibt aber an zehn Stellen Benachrichtigungen, davon
-- neun mit einem semantischen Typ (`waitlist_promoted`, `member_deactivated`,
-- `absence_alert`, `billing`, `message_received`, `membership_created`,
-- `booking_cancelled`, `booking_reactivated`, `waitlist`). Jeder dieser Inserts
-- verletzte die Constraint und schlug fehl — und weil alle Aufrufer den Fehler
-- als nicht-fatal abfangen, blieb es unbemerkt. Die Tabelle enthielt zum Zeitpunkt
-- des Funds systemweit 0 Zeilen.
--
-- Live-Zustand vor dieser Migration geprüft (pg_constraint), exakter Name
-- übernommen. Die bisher erlaubten Werte bleiben gültig.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (
      ARRAY[
        -- allgemeine Schweregrade
        'info', 'warning', 'success', 'error',
        -- fachliche Typen (bereits erlaubt)
        'booking', 'invoice', 'training',
        -- fachliche Typen, die der Code schreibt
        'booking_cancelled', 'booking_reactivated',
        'waitlist', 'waitlist_promoted',
        'absence_alert',
        'membership_created', 'member_deactivated',
        'message_received',
        'billing'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS
  'Erlaubte Benachrichtigungstypen. Neue Typen im Code brauchen hier einen Eintrag — sonst schlaegt der Insert still fehl (siehe Migration 20260813090000).';
