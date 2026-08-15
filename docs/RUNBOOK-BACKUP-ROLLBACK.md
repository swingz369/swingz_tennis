# Runbook: Backup & Rollback

> Zuletzt verifiziert: 16.08.2026 (Abschnitt 3 korrigiert — self-hosted hat kein PITR)

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

## 3. Datenbank-Backup auf Serverebene (`pg_dump`) — das echte Backup

⚠️ **Korrektur (16.08.2026):** Hier stand bis dahin, ein Full-Restore laufe über
Point-in-Time-Recovery im Supabase-Dashboard. Das gilt nur für Supabase Cloud.
SwingZ läuft **self-hosted** — es gibt kein Dashboard-PITR und keine
Plattform-Snapshots. Der tatsächliche Weg ist der folgende.

Das App-Backup aus Abschnitt 1 ist kein Datenbank-Backup: nur Tabelleninhalte,
kein Schema, keine RLS-Policies, keine `auth.users`, und es liegt im Storage
desselben VPS. Für einen echten Restore ist die Kette hier maßgeblich:

**Kette (existiert, am 16.08.2026 geprüft):**

| Stufe                       | Was                                                                                                                                                  | Wo                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| VPS, täglich 03:00          | `/home/deploy/swingz-supabase/backup-db.sh` (crontab `deploy`): `pg_dump -Fc` der DB `postgres`, gzip, mit `age` verschlüsselt, 14 Tage Aufbewahrung | `/home/deploy/backups/swingz_<ts>.dump.gz.age` |
| Dev-Maschine, täglich 08:00 | systemd-User-Timer `swingz-backup-sync.timer` → `rsync` vom VPS, ohne Löschen (behält also länger als 14 Tage)                                       | `~/swingz-backups/`, Protokoll `sync.log`      |
| Schlüssel                   | age-Identity — **ohne diese Datei ist kein Backup lesbar**                                                                                           | `~/.age/swingz-backup-key.txt`                 |

Fehlerzeilen `Network is unreachable` in `sync.log` sind normal: der Timer feuert
auch, wenn die Dev-Maschine aus oder offline ist. Kritisch wird es erst, wenn
**gar kein** neuer Lauf mehr durchgeht — die neueste Datei in `~/swingz-backups/`
ist der Ist-Stand, nicht das Protokoll.

### Restore (am 16.08.2026 einmal komplett durchgespielt)

```bash
NEU=$(ls -t ~/swingz-backups/swingz_*.age | head -1)
age -d -i ~/.age/swingz-backup-key.txt -o /tmp/rt.dump.gz "$NEU" && gunzip /tmp/rt.dump.gz

# Zielbank im lokalen Stack anlegen
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "create database restore_test"

# WICHTIG: im Container wiederherstellen, nicht auf dem Host
docker cp /tmp/rt.dump supabase_db_swingz:/tmp/rt.dump
docker exec supabase_db_swingz pg_restore -U postgres -d restore_test --no-owner --no-acl /tmp/rt.dump
```

**Stolperfalle, die genau hier Zeit kostet:** Der Dump entsteht mit PostgreSQL 17
(im Container), das `pg_restore` des Ubuntu-Hosts ist Version 16 und bricht mit
`unsupported version (1.16) in file header` ab. Restore deshalb immer im
Container ausführen (oder mit einem `pg_restore` ≥ der Dump-Version).

Zwei Fehlermeldungen sind erwartbar und unkritisch: `permission denied for table
secrets` (Supabase Vault) und `permission denied to set parameter
log_min_messages`. Ergebnis des Testlaufs: 116 Tabellen, alle Vereins- und
Auth-Daten vorhanden.

### Bekannte Lücke

`pg_dump -d postgres` sichert **keine Cluster-Rollen**. Bei einem Totalverlust des
Servers müssten `anon`, `authenticated`, `service_role` & Co. beim Neuaufbau aus
dem Supabase-Stack selbst kommen. Ein zusätzliches `pg_dumpall --globals-only`
im Backup-Skript würde das schließen — noch nicht eingerichtet.

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
2. **Nur im Notfall (Produktions-Incident):** Restore aus dem letzten
   `pg_dump` (siehe Abschnitt 3) — danach betroffene Migration(en) aus der
   `public.schema_migrations`-Tracking-Tabelle entfernen, bevor sie erneut
   (korrigiert) angewendet werden. Verlorene Änderungen seit dem Dump lassen
   sich, soweit sie nur Daten betreffen, aus dem App-Backup (Abschnitt 2)
   nachziehen.
3. Lokal/Staging: `supabase db reset` spielt alle Migrationen von Grund auf
   neu ein — geeignet zum Testen einer Korrektur, **nicht** für Produktion.

---

## 5. Kontrollfragen vor jedem riskanten Eingriff

- Gibt es ein App-Backup, das jünger als die letzte bekannte gute
  Datenlage ist? (`--list` prüfen)
- Wurde der Trockenlauf des Restore-Skripts geprüft, bevor `--confirm`
  verwendet wird?
- Betrifft der Rollback nur Daten (App-Backup reicht) oder auch das Schema
  (dann `pg_dump`-Restore nach Abschnitt 3 — PITR gibt es hier nicht)?
- Ist der age-Schlüssel (`~/.age/swingz-backup-key.txt`) erreichbar? Ohne ihn
  ist jedes Backup unlesbar.
