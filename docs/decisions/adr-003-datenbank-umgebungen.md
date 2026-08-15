# ADR-003: Zwei Datenbanken (lokal + Produktion), kein Staging

- **Status:** akzeptiert
- **Datum:** 16. August 2026
- **Betrifft:** [`docs/ENVIRONMENTS.md`](../ENVIRONMENTS.md), `scripts/migrate.ts`, `scripts/seed-testdata.ts`, `.github/workflows/ci.yml`
- **Vorgänger:** [ADR-001](adr-001-testdaten-lanes.md) (Testdaten-Lanes), [ADR-002](adr-002-migrations-tracking.md) (Migrations-Tracking)

## Kontext

SwingZ hatte genau eine Datenbank — den self-hosted Supabase-Stack auf dem VPS. Sie diente gleichzeitig als Entwicklungs-, Test- und Produktionsdatenbank: `.env.local` zeigte darauf, also schrieben lokaler Dev-Server, E2E-Tests, Seed-Skripte und KI-Agenten alle in Produktion. `npm run seed:reset` hätte dort jeden Verein gelöscht.

Solange ausschließlich Testdaten in der DB lagen, war der Schaden hypothetisch. Mit dem ersten echten Verein ist er es nicht mehr. Gleichzeitig wollte niemand drei Umgebungen pflegen, für die es weder Personal noch Nutzer gibt.

ADR-001 hatte dasselbe Problem bereits einmal abgemildert — die `user`/`agent`-Lanes trennen, wem Testdaten gehören. Das schützt aber nur Testdaten voreinander, nicht Produktionsdaten vor Testläufen.

## Entscheidung

**Zwei Datenbanken:**

1. **Lokal** — der bereits konfigurierte Docker-Stack (`supabase/config.toml`, seit jeher vorhanden, nur nie benutzt). Jede schreibende Entwicklung, jeder Test, jeder Agentenlauf, das gesamte Lane-Konzept aus ADR-001 findet hier statt.
2. **Produktion** — der VPS-Stack. Schreibzugriff haben ausschließlich echte Nutzer und `npm run db:migrate:prod`.

**Kein Staging**, bis einer dieser Auslöser eintritt (dokumentiert in `ENVIRONMENTS.md` § 8): erster zahlender Verein produktiv, mehr als eine deployende Person, oder Release-Abnahme durch Dritte.

Getrennt werden die Umgebungen über zwei Env-Dateien: `.env.local` (lokal, Standard) und `.env.prod.local` (Produktion, nur über ausdrückliche `:prod`-Befehle erreichbar). Vercel-Preview-Deployments bleiben abgeschaltet, solange sie sonst auf die Produktions-DB zeigen würden.

Durchgesetzt wird die Entscheidung an drei Stellen im Code, nicht nur in Prosa — nach demselben Muster wie `npm run docs:check` in AGENTS.md § 3a:

- `scripts/seed-testdata.ts` bricht ab, wenn `DATABASE_URL` nicht auf localhost zeigt. Kein Override-Flag.
- `scripts/migrate.ts` gibt vor jedem Lauf Zielhost und Env-Datei aus.
- CI-Job `Migrationen gegen leere DB` prüft, dass `supabase/migrations/` eine leere Datenbank überhaupt in den erwarteten Zustand bringt — sonst ist die lokale Umgebung nicht herstellbar.

## Verworfene Alternativen

**Drei Umgebungen von Anfang an (lokal/Staging/Produktion).** Die klassische Antwort, hier aber falsch dimensioniert: eine Staging-DB ohne Nutzer und ohne Abnahmeprozess wird nicht gepflegt, driftet vom Produktionsschema weg und lügt danach bei jedem Test. Sie kostet außerdem entweder ein zweites Cloud-Projekt oder einen zweiten Stack auf dem VPS — dessen Port-Konflikt mit dem fremden `tsow`-Stack schon einmal einen Produktionsausfall verursacht hat.

**Bei einer DB bleiben und nur Disziplin verabreden.** Genau das war der Zustand. Die Lane-Regeln aus ADR-001 standen dokumentiert und trotzdem lief jeder Testlauf gegen Produktion, weil der Standardpfad (`.env.local`) dorthin zeigte. Eine Regel, die der bequemste Weg verletzt, hält nicht.

**Preview-Deployments gegen die Produktions-DB laufen lassen.** Bequem und der Auslieferungsstandard von Vercel, aber es macht jeden Feature-Branch schreibberechtigt auf Produktionsdaten — dasselbe Problem, nur mit mehr Beteiligten.

## Konsequenzen

- Entwicklung braucht ab jetzt einen laufenden Docker-Stack (`supabase start`) — mehr Setup, dafür ist jeder destruktive Test folgenlos.
- Der Migrations-Altbestand musste dafür konsolidiert werden. Beim ersten `supabase start` zeigte sich, dass die 177 Dateien eine leere DB gar nicht aufbauen können — `001_rls_policies.sql` setzt die Tabelle `clubs` voraus, die keine Migration anlegt. Das war der eigentliche Grund, warum es nie eine lokale Umgebung gab: sie war nicht herstellbar. Ergebnis: eine Baseline aus dem Produktionsschema, Altbestand nach `supabase/migrations/archive/` (Details in `DATABASE.md` § Baseline-Konsolidierung).
- Produktionsmigrationen sind ein bewusster, separater Schritt vor dem Deploy. Daraus folgt die Pflicht zu additiven Migrationen (Umbenennung = zwei Releases).
- Sichtbar geworden ist dabei eine zweite Lücke, die diese ADR nicht löst, sondern nur benennt: das tägliche JSON-App-Backup liegt im Storage desselben VPS und enthält kein Schema. Ein `pg_dump` mit Kopie außerhalb des Servers ist in `ENVIRONMENTS.md` § 7 beschrieben und noch einzurichten.
