# TICKET-billing-tables-rls-scoping — Abrechnungstabellen: Superadmin-Scoping + auth.uid()-Bug

> **Epic:** RLS-Cleanup (Folge von `20260805000000`/`20260805010000`) · **Quartal:** Roadmap · **Aufwand:** 0,5-1 Tag
> **Status:** ✅ Erledigt (Migration `20260815180000`) · _zuletzt geprüft: 2026-08-15_

## Ziel

`billing_periods`, `trainer_billings`, `billing_line_items` haben zwei unabhängige, offene RLS-Probleme, die beim Superadmin-Scoping-Fix (`docs/DATABASE.md`) bewusst zurückgestellt wurden:

1. **Kein `club_id` in der Tabelle erreichbar** — `is_superadmin()` bleibt dort unscoped (jeder Superadmin sieht/bearbeitet alle Abrechnungsperioden/Trainer-Abrechnungen plattformweit, nicht nur die eigenen Vereine). Vermutlich ist `billing_periods` konzeptionell plattformweit gemeint (keine Vereinszuordnung) — das muss zuerst fachlich geklärt werden, bevor eine Scoping-Lösung entworfen wird (Spalte `club_id` ergänzen? Über `trainer_billings` → `trainers` → `trainer_club` scopen?).
2. **`trainer_id` wird direkt mit `auth.uid()` verglichen** in `trainer_billings`/`billing_line_items`-Policies — derselbe Bug, der für `hours_logs`/`attendance_records`/`trainer_availabilities` bereits gefixt wurde (`trainers.id` ≠ `auth.uid()`, der Link läuft über `trainers.user_id`). Trainer haben dadurch vermutlich aktuell keinen funktionierenden RLS-Zugriff auf ihre eigenen Abrechnungen.

## Voraussetzungen

- Klären: ist `billing_periods` bewusst plattformweit (z. B. gemeinsame Abrechnungszyklen für alle Vereine) oder sollte es `club_id` bekommen?
- Prüfen, ob die App aktuell überhaupt über den RLS-aktiven User-Client auf diese Tabellen zugreift, oder durchgängig Service-Client nutzt (dann ist der Bug niedriger priorisiert, weil RLS gar nicht greift).

## Geänderte / neue Dateien

- _(noch keine — Ticket beschreibt offenen Zustand)_

## Akzeptanzkriterien

- [x] Fachliche Klärung: `billing_periods` plattformweit oder pro Verein? → **pro Verein** (Owner, 2026-08-15).
- [x] `trainer_billings`/`billing_line_items`-Policies auf `trainers.user_id = auth.uid()`-Join umgestellt (analog `20260801010000_fix_hours_logs_attendance_rls.sql`)
- [x] Superadmin-Scoping via `is_superadmin_of(club_id)` (Muster aus `20260805000000_scope_superadmin_to_managed_clubs.sql`); `billing_periods` bekommt `club_id`.
- [x] `docs/DATABASE.md` aktualisiert (Abschnitt "Bewusst zurückgestellt" → erledigt verschoben)

## Out-of-Scope

- `background_jobs`/`job_execution_log` (bewusst unscoped, kein Ticket — `club_id` steckt nur optional im JSONB-Payload, nicht jeder Job ist vereinsbezogen)

## Nächste Aktion

Erledigt. Migration: `supabase/migrations/20260815180000_billing_tables_club_scoping.sql`.
Noch vom Owner anzuwenden — vorher die Live-Policy-Namen per `pg_policies` verifizieren
(siehe Header-Kommentar der Migration).
