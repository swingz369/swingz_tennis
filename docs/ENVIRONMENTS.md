# Umgebungen & Datenbanken

> Zuletzt verifiziert: 4. September 2026 (Backup-Pfad auf Dev-Maschine korrigiert)
> Warum es genau so aufgeteilt ist (und nicht mit Staging von Anfang an): [`decisions/adr-003-datenbank-umgebungen.md`](decisions/adr-003-datenbank-umgebungen.md)

Dieses Dokument beschreibt, welche Datenbank wofür da ist, wer darauf schreiben darf und wie eine Änderung von der Entwicklung nach Produktion kommt. Es ist ein **lebendes Dokument** — wer die Aufteilung ändert, ändert diese Datei mit.

---

## 1. Ausgangslage (Stand 16.08.2026)

Es gibt genau **eine** Datenbank: den self-hosted Supabase-Stack auf dem manitu-VPS (`supabase.swingz.cloud`, Verzeichnis `/home/deploy/swingz-supabase/`). Sie ist gleichzeitig Entwicklungs-, Test- und Produktionsdatenbank.

Konkret heißt das im Ist-Zustand:

- `.env.local` zeigt auf die Produktions-DB. Jeder lokale `npm run dev`, jeder E2E-Testlauf und jedes KI-Agenten-Skript schreibt in Produktion.
- `npm run seed:reset` löscht laut eigener Beschreibung „alle Vereine, Nutzer und Auth-Accounts außer dem Owner" — bisher hätte dieser Befehl das in **Produktion** getan.
- Vercel deployt jeden Stand direkt nach Produktion; es gibt keine Umgebung, in der ein Fehler folgenlos bleibt.

Das war tragbar, solange in der DB ausschließlich Testdaten lagen. Ab dem ersten echten Verein ist es das nicht mehr — deshalb die folgende Aufteilung.

---

## 2. Zielbild: zwei Datenbanken, drei Umgebungen

| Umgebung       | Datenbank                         | Wer schreibt                             | Zurücksetzen                     |
| -------------- | --------------------------------- | ---------------------------------------- | -------------------------------- |
| **Lokal**      | Docker-Stack, `127.0.0.1:54322`   | Entwickler, KI-Agenten, E2E-Tests, Seed  | jederzeit, `supabase db reset`   |
| **CI**         | Wegwerf-Postgres im GitHub-Runner | nur der Workflow selbst                  | pro Lauf neu                     |
| **Produktion** | VPS, `supabase.swingz.cloud`      | echte Nutzer + `npm run db:migrate:prod` | **nie** — nur Restore aus Backup |

**Kein Staging.** Solange kein zahlender Verein produktiv ist, ist eine dritte Datenbank Pflegeaufwand ohne Gegenwert. Der Auslöser, ab dem sie doch kommt, steht in Abschnitt 8.

Die Trennung ersetzt das bisherige Lane-Konzept nicht, sondern trägt es: `user`- und `agent`-Lane (siehe [`decisions/adr-001-testdaten-lanes.md`](decisions/adr-001-testdaten-lanes.md)) existieren jetzt **lokal**, nicht mehr in Produktion.

---

## 3. Env-Dateien

| Datei             | Zeigt auf      | Genutzt von                                                 | In Git |
| ----------------- | -------------- | ----------------------------------------------------------- | ------ |
| `.env.local`      | lokaler Stack  | `npm run dev`, Tests, Seed, `npm run db:migrate`            | nein   |
| `.env.prod.local` | VPS-Produktion | **nur** `npm run db:*:prod` und `scripts/restore-backup.ts` | nein   |
| `.env.example`    | —              | Vorlage, dokumentiert alle Variablen                        | ja     |
| Vercel Env Vars   | VPS-Produktion | die deployte App                                            | —      |

Der Standardfall ist damit lokal. Produktion erreicht man nur, indem man ausdrücklich einen `:prod`-Befehl tippt — es gibt keinen Weg, sie versehentlich zu treffen.

### `.env.prod.local` anlegen

Die heutigen Produktionswerte stehen aktuell noch in `.env.local`. Einmalig:

```bash
cp .env.local .env.prod.local      # bleibt auf Produktion zeigen
# danach in .env.local die vier Supabase-Zeilen auf lokal umstellen (s. u.)
```

`.env.prod.local` ist über `.gitignore` (`.env.*.local`) bereits ausgeschlossen.

---

## 4. Lokale Umgebung aufsetzen

Voraussetzung: Docker läuft, Supabase CLI installiert (beides ist auf der Dev-Maschine vorhanden).

```bash
supabase start                    # Postgres 54322, API 3001, Studio 54323, Mailfänger 54324
supabase status                   # zeigt anon key + service_role key des lokalen Stacks
```

Danach in `.env.local` ersetzen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3001
NEXT_PUBLIC_SUPABASE_ANON_KEY=<aus supabase status>
SUPABASE_SERVICE_ROLE_KEY=<aus supabase status>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Alle übrigen Variablen (Stripe-Testkeys, Resend) bleiben unverändert. Testdaten:

```bash
npm run seed:reset                # baut alle 7 Testvereine neu — jetzt lokal, gefahrlos
```

E-Mails laufen lokal in Inbucket (http://127.0.0.1:54324), gehen also nicht raus.

`supabase start` baut das Schema aus `supabase/migrations/00000000000000_baseline_2026-08-16.sql` auf — einem `supabase db dump` des Produktionsstands vom 16.08.2026 (117 Tabellen, 372 Policies).

> **Warum eine Baseline:** Die 177 vorherigen Migrationsdateien konnten eine leere Datenbank nie aufbauen. Die erste von ihnen (`001_rls_policies.sql`) macht `ALTER TABLE clubs ENABLE ROW LEVEL SECURITY` — eine Tabelle, die keine Migration jemals anlegt. Das Basis-Schema entstand außerhalb der Migrationen und existierte nur noch auf der Produktions-DB; jeder Versuch, lokal aufzusetzen, scheiterte an dieser Stelle. Die Altdateien liegen unverändert in `supabase/migrations/archive/` (Historie, siehe [`AGENTS.md`](../AGENTS.md) § Migrationen) und werden von der CLI nicht mehr angewendet. Auf Produktion ist die Baseline als `baselined` markiert, ihr DDL läuft dort nicht — siehe [`DATABASE.md`](DATABASE.md) § Baseline-Konsolidierung.

---

## 5. Der Weg einer Änderung

```
lokal entwickeln  →  PR (CI prüft)  →  merge nach main  →  Migration auf Prod  →  Vercel-Deploy
```

1. **Lokal.** Schema-Änderung als neue Datei in `supabase/migrations/` (Regeln: [`AGENTS.md`](../AGENTS.md) § Migrationen). Prüfen mit `supabase db reset` — läuft die Migration auf einer leeren DB durch?
2. **PR.** CI prüft Typecheck, Unit-Tests und — bei Änderungen an `supabase/migrations/` — ob alle Migrationen gegen eine leere Datenbank durchlaufen (Job `Migrationen gegen leere DB`).
3. **Merge nach main.**
4. **Migration auf Produktion, vor dem Deploy:**

   ```bash
   npm run db:status:prod     # was ist offen
   npm run db:dry:prod        # Trockenlauf mit Rollback — muss sauber sein
   npm run db:migrate:prod    # anwenden
   ```

   Jeder dieser Befehle gibt zuerst das Ziel aus (`→ supabase.swingz.cloud:6543 (.env.prod.local)`). Steht dort etwas anderes als erwartet: abbrechen.

5. **Deploy.** Vercel baut auf `main` automatisch.

**Reihenfolge ist nicht verhandelbar:** erst Migration, dann Deploy. Daraus folgt, dass Migrationen **additiv** sein müssen (Spalte hinzufügen, nicht umbenennen) — zwischen Schritt 4 und 5 läuft der alte Code auf dem neuen Schema. Eine Umbenennung wird zu zwei Releases: neue Spalte anlegen + doppelt schreiben, später alte Spalte entfernen.

---

## 6. Vercel-Deployments

- **Production** (Branch `main`) → Produktions-DB. Wie bisher.
- **Preview** (jeder andere Branch) → **abgeschaltet**, solange es keine Staging-DB gibt. Sonst schreibt jeder Feature-Branch in Produktion, was genau das Problem ist, das diese Aufteilung löst.

  Abgeschaltet wird das im Repo statt im Dashboard — eine Zeile in `vercel.json`, damit die Einstellung im Review sichtbar ist und nicht still von jemandem zurückgeklickt wird:

  ```json
  "ignoreCommand": "test \"$VERCEL_ENV\" != \"production\""
  ```

  Exit 0 = Build überspringen. Für Previews trifft die Bedingung zu (Build entfällt), für Production nicht (Build läuft). Wenn Staging kommt: Zeile entfernen und Preview-Env-Vars auf die Staging-DB zeigen lassen.

- Ein Feature vor dem Merge ansehen: lokal per `npm run dev`.

---

## 7. Backup & Restore

Vollständiges Vorgehen im Notfall: [`RUNBOOK-BACKUP-ROLLBACK.md`](RUNBOOK-BACKUP-ROLLBACK.md). Kurzfassung der Lage:

Das tägliche App-Backup (`/api/cron/backup`) exportiert Tabelleninhalte als JSON in den Supabase-Storage — der auf **demselben VPS** liegt. Es enthält kein Schema, keine RLS-Policies und keine `auth.users`. Fällt der Server aus, sind Daten und Backup gleichzeitig weg. Es ersetzt also kein Datenbank-Backup.

Ein self-hosted Supabase hat außerdem **kein Point-in-Time-Recovery** — die Dashboard-Funktion aus der Supabase-Cloud existiert hier nicht.

Das eigentliche Backup ist ein verschlüsselter `pg_dump` auf dem VPS (täglich 03:00, 14 Tage) plus ein systemd-Timer auf der Dev-Maschine, der ihn täglich nach `~/Projektentwicklung/Backups/swingz-backups/` zieht. Beides läuft bereits. Kette, Schlüsseldatei, Restore-Kommandos und die Versions-Stolperfalle beim `pg_restore`: [`RUNBOOK-BACKUP-ROLLBACK.md` § 3](RUNBOOK-BACKUP-ROLLBACK.md).

**Ein Backup, das nie zurückgespielt wurde, ist kein Backup.** Einmal im Quartal einen Dump in den lokalen Stack einspielen (Kommandos im Runbook) — das prüft die Kette und liefert nebenbei realitätsnahe Entwicklungsdaten. Zuletzt durchgespielt: 16.08.2026, erfolgreich.

---

## 8. Wann eine Staging-Datenbank dazukommt

Auslöser — sobald **einer** davon eintritt:

- der erste zahlende Verein arbeitet produktiv, oder
- mehr als eine Person deployt, oder
- ein Release muss vor dem Livegang von jemand anderem abgenommen werden.

Dann: zweites Supabase-Projekt (Cloud Free Tier oder zweiter Stack auf dem VPS mit versetzten Ports — **Achtung**, der Port-Konflikt mit dem `tsow`-Stack hat schon einmal einen Produktionsausfall verursacht, siehe `docs/ARCHIV/`), Vercel-Preview-Deployments wieder an und auf diese DB gezeigt, Migrationen laufen dort vor Produktion.

Vorher nicht. Eine Staging-DB, die niemand pflegt, driftet vom Produktionsschema weg und lügt dann bei jedem Test.

---

## 9. DO NOT

- ❌ `.env.local` auf Produktion zeigen lassen — dafür gibt es `.env.prod.local`
- ❌ Seed-, Test- oder Aufräum-Skripte gegen Produktion laufen lassen (`scripts/seed-testdata.ts` bricht deshalb ab, wenn die DB nicht lokal ist)
- ❌ Deployen, bevor die zugehörige Migration auf Produktion angewendet ist
- ❌ Migrationen schreiben, die den laufenden alten Code brechen (Umbenennungen/Drops → zwei Releases)
- ❌ Vercel-Preview-Deployments aktivieren, solange sie auf die Produktions-DB zeigen würden
- ❌ Sich auf das JSON-App-Backup als Datenbank-Backup verlassen — es enthält kein Schema
