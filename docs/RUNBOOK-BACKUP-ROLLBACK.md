# Runbook: Backup & Rollback

> Ausgeführt/verifiziert am 2. Juli 2026. Beantwortet den Audit-Fund "Keine
> Rollback-/Backup-Dokumentation" aus `docs/MARKET_READINESS_AUDIT-2026-07-02.md`.
> Die Mechanismen existieren bereits im Code — dieses Dokument bündelt sie an
> einer Stelle, damit sie im Ernstfall auffindbar sind.

---

## 1. Automatisches App-Backup (täglich)

- **Cron:** `/api/cron/backup`, läuft täglich um 04:00 UTC (`vercel.json`).
- **Was:** Exportiert alle Tabellen aus `BACKUP_TABLES` (siehe
  `app/api/cron/backup/route.ts`) als JSON via Service-Client (bypasses RLS).
- **Wohin:** Supabase Storage Bucket `swingz-files`, Pfad
  `backups/<ISO-Timestamp>.json`.
- **Aufbewahrung:** Die letzten 30 Backups (~30 Tage bei täglichem Lauf),
  ältere werden automatisch gelöscht (`cleanupOldBackups`).
- **Absicherung:** Endpoint ist per `CRON_SECRET` (Bearer-Token) geschützt.

⚠️ **Wichtig:** Wird eine neue Tabelle per Migration angelegt, muss sie
manuell in `BACKUP_TABLES` (`app/api/cron/backup/route.ts`) ergänzt werden —
sonst wird sie stillschweigend nicht gesichert.

### Backup-Status prüfen

```bash
npx tsx scripts/restore-backup.ts --list
```

Listet alle vorhandenen Backup-Dateien im Bucket (neueste zuerst).

---

## 2. Restore aus einem App-Backup

Es existiert bereits ein fertiges Restore-Skript: `scripts/restore-backup.ts`.

```bash
# 1. Verfügbare Backups auflisten
npx tsx scripts/restore-backup.ts --list

# 2. Trockenlauf (zeigt nur, was passieren würde — schreibt NICHTS)
npx tsx scripts/restore-backup.ts --file backups/2026-07-01T04-00-00-000Z.json

# 3. Optional: nur bestimmte Tabellen wiederherstellen
npx tsx scripts/restore-backup.ts --file backups/<timestamp>.json --tables clubs,users

# 4. Tatsächlich schreiben (erst nach Prüfung des Trockenlaufs!)
npx tsx scripts/restore-backup.ts --file backups/<timestamp>.json --confirm
```

**Verhalten:** Upsert per Primärschlüssel `id` — vorhandene Zeilen mit
gleicher ID werden überschrieben. Zeilen, die seit dem Backup gelöscht
wurden, werden **nicht** entfernt (kein Full-Restore/Truncate). Für einen
vollständigen Reset auf den Backup-Stand ist zusätzlich ein manuelles
Löschen betroffener Zeilen vor dem Restore nötig — nur im Ernstfall und mit
Zwei-Personen-Freigabe durchführen.

**Voraussetzung:** `SUPABASE_SERVICE_ROLE_KEY` muss lokal in `.env.local`
gesetzt sein (das Skript nutzt `createServiceClient()`).

---

## 3. Supabase-Plattform-Backups (Dashboard, außerhalb des Repos)

Zusätzlich zum App-Backup bietet Supabase je nach Plan eigene
Point-in-Time-Recovery (PITR) bzw. tägliche Snapshots auf Infrastrukturebene.
Diese sind **nicht im Repo konfigurierbar** — Prüfen/Wiederherstellen nur im
Supabase Dashboard:

`Project → Database → Backups`

Dies ist der bevorzugte Weg für einen **Full-Database-Restore** (z.B. nach
korrupter Migration), da er den kompletten DB-Zustand inkl. Schema
wiederherstellt — im Gegensatz zum App-Backup, das nur Tabelleninhalte
(keine Schema-/RLS-Definitionen) sichert.

---

## 4. Migrations-Rollback

Es gibt **keine automatischen Down-Migrationen** in diesem Projekt (Supabase
CLI-Migrationen unter `supabase/migrations/` sind Forward-Only — geprüft: kein
`*_down.sql` vorhanden).

**Vorgehen bei einer fehlerhaften Migration:**

1. **Bevorzugt:** Eine neue, korrigierende Migration schreiben, die die
   fehlerhafte Änderung rückgängig macht (z.B. `DROP COLUMN`, wenn die
   vorherige Migration eine falsche Spalte hinzugefügt hat). Konsistent mit
   dem Forward-Only-Prinzip, kein manueller DB-Eingriff nötig.
2. **Nur im Notfall (Produktions-Incident):** Point-in-Time-Recovery über das
   Supabase Dashboard (siehe Abschnitt 3) auf einen Zeitpunkt vor der
   fehlerhaften Migration — danach betroffene Migration(en) aus der
   `supabase_migrations`-Tracking-Tabelle entfernen, bevor sie erneut
   (korrigiert) angewendet werden.
3. Lokal/Staging: `supabase db reset` spielt alle Migrationen von Grund auf
   neu ein — geeignet zum Testen einer Korrektur, **nicht** für Produktion.

---

## 5. Kontrollfragen vor jedem riskanten Eingriff

- Gibt es ein App-Backup, das jünger als die letzte bekannte gute
  Datenlage ist? (`--list` prüfen)
- Wurde der Trockenlauf des Restore-Skripts geprüft, bevor `--confirm`
  verwendet wird?
- Betrifft der Rollback nur Daten (App-Backup reicht) oder auch das Schema
  (PITR über Supabase Dashboard nötig)?
