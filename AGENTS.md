# AGENTS.md — SwingZ

> Gilt für jeden KI-Agenten, der in diesem Repo arbeitet (Claude Code, Cursor, Codex, Copilot, ...).
> Vollständiger Projektkontext (Architektur, Rollen, Business Rules, Konventionen, DO-NOT-Liste): **`CLAUDE.md`** im Repo-Root — vor der ersten Änderung lesen.

Dieses Dokument ist die einzige Quelle für Doku-Governance-Regeln. Andere Agent-Config-Dateien (z. B. `CLAUDE.md`) verweisen hierher statt die Regeln zu duplizieren.

---

## Dokumentations-Regeln

Grund für diese Regeln: In `docs/` haben mehrere KI-Agenten unkoordiniert neue Dateien statt Updates an bestehenden erzeugt (`ROUTING.md`/`ROUTING2.md`, `DESIGN.md`/`DESIGN_KONZEPT.md`, sechs verschiedene `PROJEKTANALYSE*`-Varianten). Diese Regeln verhindern, dass das erneut passiert.

### 1. Vier Kategorien, keine Mischformen

Jede `.md` gehört genau einer Kategorie. Die Kategorie bestimmt den Ort, den Namen und ob die Datei später noch angefasst wird:

| Kategorie        | Ort                | Beispiele                                                     | Lebensdauer                                                                              |
| ---------------- | ------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Lebend**       | `docs/*.md`        | `README.md`, `BUSINESS_RULES.md`, `HANDBOOK.md`, `ROUTING.md` | Beschreibt den **Ist-Zustand**. Bei Code-Änderungen mitziehen — nie eine Parallel-Datei. |
| **Archiv**       | `docs/ARCHIV/`     | Audits, Analysen, Reports, Testläufe, Prompts an andere KIs   | Snapshot. Nach dem Anlegen **nie wieder editiert**. Datum im Namen.                      |
| **Entscheidung** | `docs/decisions/`  | `adr-001-testdaten-lanes.md`                                  | Begründung einer Festlegung. Unveränderlich; Revision = neue ADR mit Verweis.            |
| **Generiert**    | egal, `.gitignore` | `TEST-CREDENTIALS.md`, SBOM, Coverage-Reports                 | Von einem Skript geschrieben. **Nicht von Hand editieren**, nicht pflegen.               |

Faustregel für die Zuordnung: _Beschreibt es, wie es **ist**?_ → lebend. _Beschreibt es, was zu einem Zeitpunkt **war**?_ → Archiv. _Begründet es, **warum** etwas so festgelegt wurde?_ → ADR. _Schreibt es ein Skript?_ → generiert.

### 2. Vor dem Anlegen einer neuen `.md`

1. `docs/README.md` (Index) prüfen — gibt es zum Thema schon ein lebendes Dokument? Der Index ist die **einzige** Stelle, an der man das zuverlässig sieht; `ls docs/` reicht nicht, weil 134 Archiv-Dateien dazwischenliegen.
2. Wenn ja: **das bestehende Dokument updaten.** Kein `_v2`, `_KONZEPT`, `_NEU`, `2026-07-xx`-Suffix an einem sonst identischen Dateinamen.
3. Wenn nein und es sich um einen Ist-Zustand handelt: neues lebendes Dokument anlegen **und in `docs/README.md` verlinken** — unverlinkt findet es der nächste Agent nicht und legt es doppelt an.
4. Wenn es ein einmaliges Ergebnis ist (Audit, Analyse, Testlauf, Deep-Dive): direkt nach `docs/ARCHIV/` mit Datum im Namen (`YYYY-MM-DD-thema.md`).

### 3. Architektur-Entscheidungen

ADRs kommen nach `docs/decisions/`, Namensschema `adr-NNN-slug.md` (fortlaufend, siehe `adr-001-testdaten-lanes.md`). Einmal gemergte ADRs werden nicht mehr geändert — Revisionen bekommen eine neue ADR, die auf die alte verweist.

Eine ADR schreibt, wer eine Entscheidung trifft, die spätere Arbeit einschränkt: eine Konvention, die andere einhalten müssen; eine verworfene Alternative, die sonst jemand erneut vorschlägt; eine Trennung, die ohne Begründung willkürlich wirkt. Reine Bugfixes und Umsetzungen brauchen keine.

### 3a. Die Regeln werden geprüft, nicht geglaubt

`pnpm docs:check` prüft die Regeln 1–4 maschinell (Dubletten-Namen, fehlende Index-Einträge, tote Links, ADR-Schema, Archiv-Datumspräfix) und läuft im `pre-commit`-Hook, sobald `.md`-Dateien im Commit sind.

Grund: Die Regeln standen monatelang genau so hier und wurden trotzdem dreimal gebrochen — zuletzt entstand `docs/TESTZUGAENGE.md` neben dem bereits existierenden `docs/TEST-CREDENTIALS.md`. Prosa ohne Prüfung ist keine Regel, sondern eine Bitte. Wer eine Regel ergänzt, ergänzt den Check in `scripts/check-docs.ts` mit — sonst verfällt sie wie die vorherigen.

### 4. Pflichtfelder in lebenden Dokumenten

Kopfzeile mit Verifikationsdatum, analog zu `CLAUDE.md`:

```markdown
> Zuletzt verifiziert: <Datum>
```

Ein Agent, der ein lebendes Dokument liest und dabei eine Abweichung vom Code feststellt, korrigiert das Dokument und aktualisiert das Datum — nicht kommentarlos ignorieren, nicht separat neu dokumentieren.

### 5. Generierte Artefakte

Dateien, die ein Build-/CI-Schritt erzeugt (SBOM, Coverage-Reports, Testprotokolle) sind kein Doku-Content. Sie gehören mit `.gitignore` behandelt oder klar als generiert markiert — nicht wie ein lebendes Dokument gepflegt.

---

## Migrationen

Grund für diese Regeln: `supabase/migrations/` hatte nie eine `supabase_migrations.schema_migrations`-Tracking-Tabelle — es gibt keinen Mechanismus, der protokolliert, welche Datei tatsächlich auf die Live-DB angewendet wurde. Das führte dazu, dass mehrere Policy-Generationen für dieselbe Tabelle unter verschiedenen Namen gleichzeitig aktiv sind, mehrere Migrationen nie gepusht wurden (siehe `docs/DATABASE.md`) und mindestens eine Tabelle nur manuell im Dashboard angelegt wurde. Diese Regeln verhindern, dass das erneut passiert.

### 0. Eine Baseline, ein Archiv (seit 16.08.2026)

`supabase/migrations/` enthält die Baseline `00000000000000_baseline_2026-08-16.sql` (Abbild des
Produktionsschemas) plus alles, was danach dazukam. Die 177 Dateien davor liegen in
`supabase/migrations/archive/` — Historie, werden nicht mehr angewendet, nicht mehr editiert.
Grund und Verifikation: `docs/DATABASE.md` § Baseline-Konsolidierung.

Daraus folgt für neue Migrationen: **jede muss auf einer leeren DB durchlaufen.** Prüfen mit
`supabase db reset`, bevor der PR aufgemacht wird — CI prüft dasselbe. Wer eine Migration
schreibt, die eine vorhandene Tabelle voraussetzt, ohne dass eine Migration sie anlegt,
reißt genau die Lücke wieder auf, die die Baseline geschlossen hat.

### 1. Live-Zustand vor jeder Migration prüfen

`supabase/migrations/*.sql` ist **kein verlässliches Abbild** des Ist-Zustands. Vor dem Schreiben einer neuen Migration, die eine bestehende RLS-Policy, Funktion oder Tabellenstruktur ändert:

1. Den echten Live-Zustand direkt per SQL prüfen (`pg_policies`, `pg_proc`, `information_schema.tables` — Befehle in `docs/DATABASE.md`), nicht aus Migrationsdateien raten.
2. Exakte Policy-/Funktionsnamen aus der Live-Abfrage übernehmen, nicht aus einer älteren Migrationsdatei kopieren — sie könnte längst durch eine andere, abweichend benannte Policy überholt sein.
3. Jede `CREATE POLICY`/`CREATE FUNCTION` in der neuen Migration mit einem passenden `DROP POLICY IF EXISTS <exakter Name>`/`CREATE OR REPLACE FUNCTION` versehen — niemals eine Policy unter neuem Namen anlegen, die eine bestehende nur inhaltlich ersetzen soll (sonst bleiben beide aktiv, RLS verknüpft sie mit OR).

### 2. `docs/DATABASE.md` bei jeder Policy-relevanten Änderung mitpflegen

Wer eine Migration schreibt, die RLS-Policies, Scoping-Helper-Funktionen oder das Rollenmodell betrifft, aktualisiert im selben Zug `docs/DATABASE.md` (Rollen-/Scoping-Modell, bekannte Altlasten) — nicht als separaten Folge-PR.

### 3. Migrationsdateien sind Historie, keine lebenden Dokumente

Einmal gemergte Migrationsdateien werden nicht mehr nachträglich editiert (wie bei ADRs, siehe oben) — eine Korrektur bekommt eine neue Datei mit späterem Zeitstempel. `docs/DATABASE.md` ist der lebende Ist-Zustand; die Migrationsdateien bleiben das Änderungsprotokoll.

## Testdaten

Grund für diese Regeln: Die Datenbank enthielt 85 Vereine, 537 Profile und 1912 Rechnungen — fast alles Rückstände aus Testläufen verschiedener Agenten (`Billing Test Club <timestamp>` × 40). Parallel existierten 14 verschiedene `seed-*.ts`-Skripte mit je eigener Vorstellung davon, was „Testdaten" sind. Niemand konnte einem Befund noch ansehen, ob er echt oder Müll war. Am 13.08.2026 wurde die DB deshalb komplett zurückgesetzt.

### 1. Lanes — wem gehören die Daten

Jeder Testverein gehört genau einer Lane, erkennbar an der E-Mail-Domain seiner Accounts:

| Lane    | Domain          | Eigentümer | Regel                                                        |
| ------- | --------------- | ---------- | ------------------------------------------------------------ |
| `user`  | `*.swingz.test` | Mensch     | Ein Agent liest hier höchstens. **Schreiben ist untersagt.** |
| `agent` | `*.claude.test` | KI         | Freie Spielwiese. Hier testen, kaputtmachen, zurücksetzen.   |

Wer als Agent Daten anlegen, ändern oder löschen will, tut das in **Claude Sandbox Alpha** oder **Beta**. Muss ein Testfall zwingend in einem Nutzer-Verein laufen, vorher fragen — nicht einfach machen.

`TC Neuland e.V.` bleibt leer. Kein Mitglied, kein Trainer, kein Platz, `setup_completed_at = NULL`. Das ist der Erstlogin-Testfall des Menschen und wird von keinem Agenten bestückt.

### 2. Ein Seed-Skript, keine Sammlung

`scripts/seed-testdata.ts` ist die einzige Quelle für Testdaten. Neue Testdaten kommen als Änderung an dessen `CLUBS`-Konstante dazu — **kein zweites Seed-Skript daneben** (siehe die Doku-Regeln oben, gleiches Muster, gleicher Grund).

```bash
pnpm seed          # Ist-Zustand, ändert nichts
pnpm seed:docs     # Zugangsdaten-Doku aus dem Ist-Zustand neu schreiben
pnpm seed:agent    # nur die Agent-Lane neu — Nutzer-Vereine bleiben unberührt
pnpm seed:reset    # komplett platt + alles neu (löscht auch die Nutzer-Lane!)
```

`pnpm seed:reset` ist destruktiv für **beide** Lanes und wird ohne Rückfrage des Menschen nicht ausgeführt. Für Agenten-Arbeit reicht `pnpm seed:agent`.

### 3. Zugangsdaten sind generiert, nicht gepflegt

`docs/TEST-CREDENTIALS.md` schreibt das Seed-Skript bei jedem Vollauf neu und ist per `.gitignore` ausgeschlossen (Klartext-Passwörter). Es ist damit ein generiertes Artefakt im Sinne der Regel oben — nicht von Hand editieren, nicht als lebendes Dokument pflegen. Wer Accounts wissen will, liest die Datei oder führt `pnpm seed` aus.

## Auslieferung

> Den konkreten Ablauf (Commit-Hook, Merge, Migrationen lokal und Produktion, Tests je Änderungsart, Dev-Server) beschreibt [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) § 5. Diese Datei hält nur die Regeln und ihre Begründung.

Grund für diese Regel: Am 18.08.2026 lag der Arbeitsstand 50 Commits und 69
geänderte Dateien vor `main`. Vercel deployt aus `main` — es lief in Produktion
also nichts davon, darunter ein Sicherheitsfix und der Überwachungs-Workflow.
`schedule` in GitHub Actions läuft ausschliesslich auf dem Standard-Branch;
solange `monitor.yml` nicht auf `main` lag, fand **gar keine Überwachung
statt**. Wochenlange Arbeit war unsichtbar, und niemand hätte einen Ausfall
bemerkt.

### 1. Kein Arbeitsstand älter als eine Woche ausserhalb von `main`

Kleine Branches, häufig mergen. Ein Branch, der zwei Themen mischt, ist zwei
Branches — das Entflechten im Nachhinein kostet mehr als das Trennen vorher.

### 2. Ein Branch, ein Vorhaben

Der Branchname sagt, worum es geht. Landen unterwegs andere Änderungen im
Arbeitsverzeichnis, kommen sie in eigene Commits mit eigener Begründung, nicht
in einen Klumpen.

### 3. Nach dem Merge wird geprüft, nicht gehofft

Ein Merge ist kein Deploy und ein Deploy ist kein Beleg. Nach dem Merge:
Health-Endpunkt in Produktion abrufen und einmal nachsehen, ob der
Monitor-Workflow tatsächlich gelaufen ist.

### 4. Entwicklungsphase: Push nach `main` liefert automatisch aus

Solange Produktion und Localhost denselben Teststand haben sollen, gilt:
`pnpm ship` (= `git push origin HEAD:main`) genügt. `.github/workflows/deploy.yml`
startet nach grüner CI die Migrationen (nur mit Repo-Variable `AUTO_MIGRATE=true`),
deployt per `vercel deploy --prod` und bricht rot ab, wenn `/api/health` nach dem
Deploy nicht grün ist. Grund für den CLI-Weg: der Vercel-Git-Deploy steht auf
`BLOCKED` (`docs/CONTRIBUTING.md`).

**Vor dem Launch zurückdrehen** (`docs/OPEN_ITEMS.md` § Vor dem Launch): Auto-Migration
aus (`AUTO_MIGRATE` löschen), Migrationen wieder von Hand nach Sichtung.

---

## Konflikte

Widerspricht dieses Dokument `CLAUDE.md` (oder einer äquivalenten Config-Datei eines anderen Tools) in einer nicht-Doku-Frage, gilt `CLAUDE.md`. In Doku-Governance-Fragen gilt dieses Dokument.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
