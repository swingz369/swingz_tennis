# Umgebungen & Datenbanken

> Zuletzt verifiziert: 23. September 2026 (CI-Tests gegen frische Supabase-DB, Auslieferungsweg, lokale Test-/Dev-Server-Rezepte)
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
| `.env.local`      | lokaler Stack  | `npm run dev`, Tests, Seed (Migrationen: siehe § 5a)        | nein   |
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

Stand Entwicklungsphase (19.09.2026): Push nach `main` liefert automatisch aus. Der Weg ist bewusst kurz — Absicherung leisten CI, Pre-Commit-Hook und der Health-Check nach dem Deploy.

```
lokal entwickeln → prüfen (§ 5b) → Commit (Hook) → merge/push nach main → ci → deploy.yml → Health-Check
```

1. **Branch.** Ein Branch, ein Vorhaben; kein Arbeitsstand älter als eine Woche außerhalb von `main` (Begründung: [`AGENTS.md`](../AGENTS.md) § Auslieferung — am 18.08.2026 lagen 50 Commits vor `main`, in Produktion lief nichts davon).
2. **Lokal prüfen** — je nach Änderungsart siehe § 5b. Immer: `npx tsc --noEmit`, `npx vitest run`.
3. **Commit.** Der `pre-commit`-Hook (`.husky/pre-commit`) läuft `lint-staged` (eslint + prettier), bei `.md`-Änderungen `npm run docs:check`, `dependency-cruiser` (Architektur-Regeln, Warnungen sind Baseline) und prüft die Git-Identität (Vercel blockt fremde Autoren, Details [`CONTRIBUTING.md`](CONTRIBUTING.md)). Nie mit `--no-verify` umgehen. Commit-Nachricht im Conventional-Commits-Format; KI-Sessions hängen die vom Harness vorgegebene `Co-Authored-By`-Zeile an.
4. **Auslieferung.** Per PR nach `main` oder direkt `pnpm ship` (= `git push origin HEAD:main`). Dann laufen automatisch:
   - **`ci.yml`:** Typecheck, Lint, Design-Token-Guardrail, Unit-Tests, Dependency-Audit; auf Pushes und PRs zusätzlich „Migrationen gegen leere DB“ (`supabase db reset`) und RLS-/Mandanten-Integrationstests gegen diese frische DB.
   - **`deploy.yml`** (startet nach grüner CI auf `main`, oder manuell per `workflow_dispatch`): 1. Migrationen auf Produktion — **nur** wenn die Repo-Variable `AUTO_MIGRATE=true` gesetzt ist; 2. `vercel deploy --prod` per CLI; 3. Health-Check auf `https://swingz.vercel.app/api/health` (bricht rot ab, wenn nicht grün).
   - Die Reihenfolge Migration → Deploy ist fest eingebaut. Daraus folgt: Migrationen müssen **additiv** sein (Spalte hinzufügen, nicht umbenennen) — zwischen beiden Schritten läuft der alte Code auf dem neuen Schema. Eine Umbenennung wird zu zwei Releases.
5. **Nach dem Merge prüfen, nicht hoffen** ([`AGENTS.md`](../AGENTS.md) § Auslieferung, Regel 3): `gh run list --workflow deploy --limit 3` (grün?), `curl -s https://swingz.vercel.app/api/health`, und einmal nachsehen, dass `monitor.yml` läuft (`schedule` läuft nur auf `main`).
6. **Migrationen von Hand** (wenn `AUTO_MIGRATE` aus ist — der Zustand nach dem Launch):

   ```bash
   npm run db:status:prod     # was ist offen
   npm run db:dry:prod        # Trockenlauf mit Rollback — muss sauber sein
   npm run db:migrate:prod    # anwenden, VOR dem Deploy
   ```

   Jeder dieser Befehle gibt zuerst das Ziel aus (`→ supabase.swingz.cloud:6543 (.env.prod.local)`). Steht dort etwas anderes als erwartet: abbrechen.

**Vor dem Launch zurückdrehen** (Liste: [`OPEN_ITEMS.md`](OPEN_ITEMS.md) § Vor dem Launch): `AUTO_MIGRATE` löschen, Pull Requests mit Freigabe wieder Pflicht, `SUBSCRIPTION_ENFORCEMENT` entfernen.

### 5a. Migrationen lokal anwenden — `npm run db:migrate` geht hier nicht

`npm run db:migrate` / `db:status` / `db:dry` sind für **Produktion** verlässlich (`:prod`-Varianten). Auf der lokalen DB sind sie es nicht: Der lokale Stack wird vom Supabase-CLI aufgebaut (Tracking in `supabase_migrations.schema_migrations`, endet bei `20260914120000`), die eigene Tabelle `public.schema_migrations` bleibt leer. Folge: `db:status` meldet alles als offen, `db:migrate` bricht an der Baseline mit `type "…" already exists` ab. Neuere lokale Migrationen wurden von Hand eingespielt. **Nicht** `npm run db:baseline` lokal ausführen — es würde auch nie angewendete Dateien als angewendet markieren.

Eine neue Migration lokal anwenden:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -1 \
  -f supabase/migrations/<datei>.sql          # -1 = eine Transaktion, bei Fehler nichts halb angewendet
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "NOTIFY pgrst, 'reload schema'"
```

Danach:

- **Typen:** `types/supabase.ts` aktualisieren (`npm run gen:types`; geht das nicht, von Hand in derselben Form ergänzen — Tabellen/Funktionen alphabetisch). Ohne den Eintrag scheitert `tsc` am neuen RPC-Aufruf.
- **Doku:** `docs/DATABASE.md` im selben Zug pflegen, sobald Policies, Helper-Funktionen oder das Rollenmodell betroffen sind ([`AGENTS.md`](../AGENTS.md) § Migrationen, Regel 2).
- **Saubere Gegenprobe** (läuft die Migration auf einer leeren DB?): `supabase db reset` — löscht **alle** lokalen Daten inklusive der Nutzer-Lane. Nur nach Rückfrage beim Menschen; danach ist `npm run seed:reset` nötig (ebenfalls destruktiv). CI führt dieselbe Prüfung bei jedem PR aus.
- **Live-Zustand vor dem Schreiben prüfen** (`pg_policies`, `pg_proc`): [`DATABASE.md`](DATABASE.md) § Wie man den echten Live-Zustand prüft.
- Neue Tabellen zusätzlich in `BACKUP_TABLES` eintragen ([`RUNBOOK-BACKUP-ROLLBACK.md`](RUNBOOK-BACKUP-ROLLBACK.md)).

### 5b. Was wann geprüft wird

| Änderung                                       | Vor dem Commit                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| jede                                           | `npx tsc --noEmit`, `npx vitest run`                                                                          |
| `.md`-Dateien                                  | `npm run docs:check` (läuft auch im Hook)                                                                     |
| API-Routen / RLS / Datenzugriff (ADR-005)      | zusätzlich `npm run test:tenant` (unten)                                                                      |
| Migration                                      | § 5a, dazu bei Policies `docs/DATABASE.md`                                                                    |
| Repository/Engine gegen echte RLS, ohne Server | temporärer Vitest mit `supabase-js`-Login als Sandbox-Admin (Passwort: `TEST-CREDENTIALS.md`); danach löschen |

**`test:tenant`** (Alpha-Admin ruft alle GET-Routen mit Gamma-IDs auf; `KNOWN_LEAKS` bleibt leer). Braucht einen Dev-Server mit abgeschaltetem Rate-Limit, dauert etwa 10 Minuten:

```bash
DISABLE_RATE_LIMITING=true npx next dev --turbopack        # Server starten, bis "Ready"
RUN_BROWSER_E2E=true npx vitest run tests/browser/tenant-isolation-http.test.ts \
  --reporter=json --outputFile=/tmp/tenant.json             # Ergebnis steht im JSON
```

Die Konsolenausgabe des Tests wird von der Test-Setup-Datei unterdrückt und die Zusammenfassung fehlt im Terminal — das Ergebnis liest man aus dem JSON (`numFailedTests`, `success`). Anschließend den Dev-Server beenden.

### 5c. Dev-Server und Speicher

Die Dev-Maschine hat wenig RAM: Dev-Server **nur starten, wenn er gebraucht wird, und danach beenden**. Zwei Fallen:

- Auf der Maschine kann ein Wrapper `while true; do npm run dev; sleep 2; done` laufen (Elternprozess systemd `--user`), der den Server nach jedem Beenden neu startet. Erst den Wrapper beenden, dann den Server.
- Nie `pkill -f <muster>`, wenn das Muster im eigenen Kommandotext vorkommt — es trifft die eigene Shell (Exit 144). Stattdessen: `ps -eo pid,args | awk '/[n]ext dev/ {print $1}' | xargs -r kill`.

---

## 6. Vercel-Deployments

- **Production** (Branch `main`) → Produktions-DB, ausgeliefert von `deploy.yml` per **Vercel-CLI mit Token**. Der Vercel-Git-Deploy ist seit 16.08.2026 auf `BLOCKED` (Hobby-Plan, privates Repo, Commit-Autor ≠ Kontoinhaber, siehe [`CONTRIBUTING.md`](CONTRIBUTING.md)); CLI-Deploys sind davon nicht betroffen. Voraussetzungen: Secrets `VERCEL_TOKEN`, `DATABASE_URL_PROD`, Repo-Variable `AUTO_MIGRATE`.
- **Preview** (jeder andere Branch) → **abgeschaltet**, solange es keine Staging-DB gibt. Sonst schreibt jeder Feature-Branch in Produktion. Abgeschaltet wird das im Repo (`vercel.json` → `ignoreCommand`), nicht im Dashboard, damit die Einstellung im Review sichtbar ist. Wenn Staging kommt: Zeile entfernen und Preview-Env-Vars auf die Staging-DB zeigen lassen.
- Ein Feature vor dem Merge ansehen: lokal per `npm run dev`.
- **Rollback:** Migrationen sind Forward-Only — eine fehlerhafte Migration wird durch eine neue, korrigierende Migration behoben, im Notfall per Restore ([`RUNBOOK-BACKUP-ROLLBACK.md`](RUNBOOK-BACKUP-ROLLBACK.md) § 4). Ein fehlerhafter App-Stand wird durch einen Revert-Commit nach `main` behoben; `deploy.yml` liefert ihn wie jeden anderen Stand aus.

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
