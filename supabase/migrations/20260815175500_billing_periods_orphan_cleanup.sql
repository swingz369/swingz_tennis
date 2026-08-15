-- Migration: billing_periods ohne zuordenbaren Verein entfernen
--
-- Warum der Zeitstempel VOR 20260815180000 liegt: jene Migration setzt
-- `billing_periods.club_id NOT NULL`, nachdem sie den Verein über
-- trainer_billings → trainers → trainer_club backfillt. Zeilen, die dieser Pfad
-- nicht auflöst, lassen die Migration im Ganzen scheitern (sie läuft in einer
-- Transaktion). Beide Dateien waren zum Zeitpunkt dieser Ergänzung noch nirgends
-- angewendet — die Sortierung davor ist die einzige Stelle, an der die
-- Bereinigung wirken kann, ohne 20260815180000 nachträglich zu editieren
-- (AGENTS.md → Migrationen, Regel 3).
--
-- Befund vom 15.08.2026 auf der Live-DB: 93 Perioden, davon 62 ohne jede
-- Trainer-Abrechnung und 31 mit Abrechnungen, deren Trainer keinen
-- `trainer_club`-Eintrag haben. Der Backfill löst damit **null** Zeilen auf.
-- `billing_line_items` ist leer — es hängt kein einziger Abrechnungsposten
-- daran. Es handelt sich durchweg um Rückstände wiederholter Testläufe des
-- Abrechnungs-Moduls seit dem DB-Reset am 13.08.2026.
--
-- Gelöscht wird genau die Menge, die `club_id NOT NULL` nicht annehmen kann:
-- Perioden, für die kein Verein ermittelbar ist. Perioden mit auflösbarem
-- Verein bleiben unangetastet — auf einer DB ohne solche Rückstände ist diese
-- Migration ein No-op.

BEGIN;

DELETE FROM billing_periods bp
WHERE NOT EXISTS (
  SELECT 1
  FROM trainer_billings tb
  JOIN trainers t ON t.id = tb.trainer_id
  JOIN trainer_club tc ON tc.trainer_id = t.id
  WHERE tb.billing_period_id = bp.id
);

COMMIT;
