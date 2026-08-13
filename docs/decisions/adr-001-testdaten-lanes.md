# ADR-001: Testdaten-Lanes — Eigentümer statt Inhalt trennt Testvereine

- **Status:** Akzeptiert
- **Datum:** 2026-08-13
- **Betrifft:** `scripts/seed-testdata.ts`, `AGENTS.md` → Testdaten, `.env.local` (`TEST_*`)

## Kontext

Die Datenbank enthielt 85 Vereine, 537 Profile, 1912 Rechnungen und 827 Buchungen. Der
überwiegende Teil waren Rückstände aus Testläufen: allein rund 40 Vereine namens
`Billing Test Club <unix-timestamp>`. Daneben lagen 14 verschiedene `seed-*.ts`-Skripte im
Repo, jedes mit einer eigenen Vorstellung davon, was „Testdaten" sind, teils voneinander
abhängig (`seed-e2e-flow.ts` brach ab, wenn vorher nicht `seed-test-club-rheinland.ts` lief).

Daraus folgten drei konkrete Probleme:

1. **Befunde waren nicht mehr bewertbar.** Bei einem Fehler in der Oberfläche war unklar, ob
   die zugrunde liegenden Daten echt gemeint oder Müll aus einem abgebrochenen Testlauf waren.
2. **Gegenseitiges Überschreiben.** Ein Agent, der zum Testen Mitglieder anlegte oder eine
   Saison veröffentlichte, veränderte genau die Vereine, in denen der Mensch parallel manuell
   testete — und umgekehrt.
3. **Reset war Alles-oder-Nichts.** Wer aufräumen wollte, musste die gesamte DB leeren und
   damit auch den Zustand zerstören, den die andere Seite gerade brauchte.

Die naheliegende Lösung — „einmal aufräumen und disziplinierter sein" — war schon zweimal
gescheitert (siehe `docs/ARCHIV/`). Disziplin skaliert nicht über mehrere Agenten und Sessions.

## Entscheidung

Testvereine werden nicht nach Inhalt getrennt, sondern nach **Eigentümer der Daten** („Lane").
Die Lane ist an der E-Mail-Domain der Accounts ablesbar und damit in jeder Abfrage, jedem
Log und jedem Screenshot sofort erkennbar:

| Lane    | Domain          | Eigentümer | Regel                                                 |
| ------- | --------------- | ---------- | ----------------------------------------------------- |
| `user`  | `*.swingz.test` | Mensch     | Agenten lesen höchstens. **Schreiben ist untersagt.** |
| `agent` | `*.claude.test` | KI         | Freie Spielwiese: testen, kaputtmachen, zurücksetzen. |

Daraus folgt die eigentlich tragende Eigenschaft: **jede Lane ist einzeln zurücksetzbar.**

```bash
npm run seed          # Ist-Zustand, ändert nichts
npm run seed:agent    # nur die Agent-Lane — Nutzer-Vereine bleiben unberührt
npm run seed:reset    # beide Lanes platt (nur nach ausdrücklicher Freigabe)
```

Ergänzende Festlegungen:

- **Ein Seed-Skript.** `scripts/seed-testdata.ts` ist die einzige Quelle. Neue Testdaten kommen
  als Änderung an dessen `CLUBS`-Konstante — kein zweites Skript daneben.
- **Automatisierte Tests laufen in der Agent-Lane.** Die `TEST_*`-Variablen in `.env.local`
  zeigen auf `Claude Sandbox Alpha`, weil E2E-Tests schreiben. `TEST_MEMBER_UUID` zieht das
  Seed-Skript nach jedem Lauf selbst nach.
- **Ein Verein bleibt leer.** `TC Neuland e.V.` hat keinen Platz, keinen Trainer, kein Mitglied
  und `setup_completed_at = NULL` — der Erstlogin-/Onboarding-Testfall des Menschen.
- **Zugangsdaten sind generiert.** `docs/TEST-CREDENTIALS.md` wird bei jedem Vollauf neu
  geschrieben und ist gitignored (Klartext-Passwörter). Damit kann die Doku nicht vom
  DB-Zustand abweichen.

Der Wipe verschont ausschließlich den Owner `admin@swingz.com` sowie globale Referenzdaten
(`school_holidays`, `base_interest_rates`, `system_settings`/`court_types` mit `club_id IS NULL`).

## Alternativen

**Namenspräfix statt Domain** (`[TEST] Verein X`): trennt zwar optisch, taucht aber nicht in
Accounts, Logins oder E-Mail-Logs auf. Die Zuordnung wäre bei jedem Login wieder unklar.

**Eigene Spalte `clubs.owner_lane`**: sauberer im Datenmodell, aber Migration plus Pflege im
Code, und in einem Login-Screen oder Screenshot immer noch unsichtbar. Die Domain-Konvention
kostet null Schema-Änderung und ist überall lesbar.

**Getrennte Datenbanken pro Lane**: die sauberste Trennung, aber zwei Supabase-Instanzen,
zwei Migrationsstände und doppelte Betriebskosten für ein Testdaten-Problem.

**Handgepflegte Löschliste** (wie in den alten Skripten): war bereits im Einsatz und ist genau
das, was versagt hat — die Liste deckte 28 von 115 Tabellen ab und rottete mit jeder Migration
weiter. Der Wipe arbeitet deshalb generisch über `pg_tables` bzw. über alle Tabellen mit
`club_id`, statt Tabellennamen aufzuzählen.

## Konsequenzen

**Positiv**

- Ein Agent kann seinen Sandkasten jederzeit ohne Rückfrage zurücksetzen (`npm run seed:agent`),
  ohne die manuelle Testarbeit des Menschen zu zerstören. Verifiziert: nach einem Agent-Reset
  waren die fünf Nutzer-Vereine zahlengleich (12/20/0/60/25 Mitglieder).
- 14 Seed-Skripte auf eines reduziert; die Doku der Zugänge kann nicht mehr veralten.
- Jeder Befund ist einer Lane zuordenbar, also bewertbar.

**Negativ / Kosten**

- Die Trennung ist eine **Konvention, keine technische Sperre**. Ein Agent, der `AGENTS.md`
  ignoriert, kann weiterhin in Nutzer-Vereine schreiben. Eine Durchsetzung per RLS wäre
  möglich, wurde aber als unverhältnismäßig für Testdaten verworfen.
- Nach einem Lane-Reset ändern sich alle UUIDs. Was außerhalb von `.env.local` UUIDs
  hartcodiert (einzelne E2E-Fixtures), muss nachgezogen werden.
- `npm run seed:reset` bleibt destruktiv für beide Lanes — bewusst nur hinter `--yes`.

## Umsetzungsnotizen

Drei Eigenheiten der Umgebung, die beim Bau aufgefallen sind und für Folgearbeiten gelten:

- Der Supavisor-Pooler auf Port 6543 arbeitet im Transaction-Mode. Temp-Tabellen müssen
  innerhalb **einer** `sql.begin()`-Transaktion liegen, sonst landen die Statements auf
  verschiedenen Backend-Connections.
- `seasons` erzwingt `preferences_deadline <= start_date`. Präferenz-Erfassung im laufenden
  Jahr bezieht sich deshalb auf die **kommende** Saison, nicht die aktuelle.
- `public.users` hat **keinen** Fremdschlüssel auf `auth.users`. Mitglieder ohne Login sind
  damit möglich — nur wenige Accounts brauchen echte Anmeldedaten, der Rest ist reines Profil.
