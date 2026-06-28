# README — Development & Forensic-Audit Helpers

> Entwickler-Guide für die zwei **forensischen Audit-Trail-Helper** unter
> `scripts/`. Beide sind read-only-default (DRY-RUN-Modus bzw. keine Writes)
> und liefern die zuletzt Zeile der `stdout` als single-line JSON für
> CI-Parsing. Exit-Codes folgen dem ADR-002 Forensic-Ground-Truth-Pattern.

---

## Übersicht

| Script                                                | Zweck                                                              | Default-Modus | Writes | Exit-Codes |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ------------- | ------ | ---------- |
| `scripts/bulk-track-only-migrations.sh`              | Tracked Migrations-Files (Disk) → `schema_migrations`-Rows (DB)   | **DRY-RUN**   | nur mit `--no-dry-run` | `0` ok / `1` setup-FAIL |
| `scripts/file-count-vs-claim-reconciliation.sh`        | Validiert Ticket-/Code-Claims gegen Disk-/DB-Ground-Truth          | READ-ONLY     | niemals | `0` PASS / `1` setup-FAIL / `2` ASPIRATIONAL-CLOSURE |

Beide Scripts sind **Defensive-By-Design**: sie können den Production-State
nicht beschädigen, auch wenn sie mit fehlerhaften Eingaben aufgerufen werden.

> ADR-002 verlangt die Inversion von "opt-in to dry-run": diese Scripts
> schreiben per Default NICHT in die Datenbank. Nur ein expliziter
> `--no-dry-run`-Flag aktiviert Writes. Begründung: ein Audit-Trail-Script
> darf **niemals** zur Aspirational-Closure beitragen, indem es Phantom-
> Tracks einfügt.

---

## Voraussetzungen

Beide Scripts benötigen:

1. **`psql`** im `$PATH` — Exit 1 mit FATAL-Log wenn nicht vorhanden.
2. **`$DATABASE_URL`** als Env-Variable — Format `postgres://user:pass@host:port/db`.
   Password wird in der Transcript-Masked dargestellt.
3. **CWD = Repository-Root** — `scripts/` und `supabase/migrations/` sind
   relativ verankert (no absolute paths).
4. **`supabase_migrations.schema_migrations`-Tabelle** mit `PRIMARY KEY (version)`
   (ADR-007-Status-Quo) — bei Composite-Key beendet das Script mit FATAL.

```bash
# Smoke-Check (alle 4 Voraussetzungen)
psql --version
echo "DATABASE_URL=${DATABASE_URL:-(unset)}"
ls supabase/migrations | head -3
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE contype='p' AND conrelid = 'supabase_migrations.schema_migrations'::regclass;"
```

---

## `scripts/bulk-track-only-migrations.sh`

### Was es tut

Bringt die `supabase_migrations.schema_migrations`-Tabelle in Einklang mit
den `supabase/migrations/*.sql`-Dateien auf Disk — **ohne DDL auszuführen**.
Es sendet ausschließlich `INSERT ... ON CONFLICT DO NOTHING`-Statements:

- Disk-File `supabase/migrations/20260801_x.sql` mit `version=20260801` → wenn
  `schema_migrations` diese Version noch nicht hat, wird sie als INSERT-CANDIDATE
  markiert.
- Disk-File-Sharing-Dates (z.B. 5 Files mit Prefix `20260506_`) collapsen auf
  **eine** Row (ADR-007 single-column PK) — die anderen 4 sind ON-CONFLICT-Skips.

### Was es NICHT tut

- Führt KEINE DDL aus (kein CREATE/ALTER/DROP)
- Führt `npx supabase db push` NICHT aus (separater Schritt)
- Modifiziert KEINE `.sql`-Files
- Schreibt NICHT ohne expliziten `--no-dry-run`-Flag

### Aufruf-Syntax

```bash
bash scripts/bulk-track-only-migrations.sh [--dry-run | --no-dry-run | --help]
```

**Default: `--dry-run`** (genau das Gegenteil von typischen Scripts — siehe ADR-002).

### Run-Beispiel 1 (DRY-RUN, kein DB-Write)

```bash
$ bash scripts/bulk-track-only-migrations.sh

[2026-06-28T...] _audit_fix:ADR-002_ PRE-FLIGHT: psql-binary
[2026-06-28T...] psql binary: psql (PostgreSQL) 16.14
...

═══════ _audit_fix:ADR-002_ FINAL-STATS ═══════
  candidate-files (disk, future-dated)            : 38
  skipped-non-date-files (Fix #4)                 : 0
  would-submit (distinct INSERT-VERSIONS, Fix #1) : 17 (dry-run; no DB-writes)
  inserted (landing-rows)                         : 0
  on-conflict-skips (files with version in DB)     : 21
  errors                                          : 0

{"candidate_count": 38, "skipped_non_date": 0, "would_submit": 17, "inserted": 0, "on_conflict_skips": 21, "errors": 0, "dry_run": true, "transcript_stamp": "_audit_fix:ADR-002_"}
```

> **Ergebnis-Interpretation**: 38 Future-Dated-Files insgesamt auf Disk;
> 17 davon haben Versionen, die noch nicht in der DB getrackt sind
> (`would_submit` = 17); 21 haben Versionen, die bereits in der
> DB stehen (`on_conflict_skips` = 21). Distinct-Version-Count ist 17
> (Multi-Files-per-Date dedupliziert per ADR-007-PK).

### Run-Beispiel 2 (Apply — Vorsicht!)

```bash
$ bash scripts/bulk-track-only-migrations.sh --no-dry-run

[2026-06-28T...] _audit_fix:ADR-002_ EXECUTE: mode
[2026-06-28T...] MODE: --no-dry-run. Executing batch...
[2026-06-28T...] Post-execute supabase_migrations.schema_migrations row-count: 24 (was: 7)
[2026-06-28T...] Landing-rows (delta = post-count − baseline): 17

{"candidate_count": 38, "skipped_non_date": 0, "submitted": 17, "inserted": 17, "on_conflict_skips": 21, "errors": 0, "dry_run": false, "transcript_stamp": "_audit_fix:ADR-002_"}
```

> **Apply-Care**: bei `--no-dry-run` führt das Script einen
> `BEGIN ... COMMIT`-Block mit `ON_ERROR_STOP=1` aus. Bei Fehler
> (z. B. constraint-violation) wird ROLLBACK automatisch getriggert
> und Exit-Code = 1.

### CI-Integration

Siehe `.github/workflows/db-audit.yml`. Der Workflow triggert das Script
im DRY-RUN-Modus auf `workflow_dispatch` + weekly cron `0 3 * * 0`
(Sonntag 03:00 UTC) und prüft `errors == 0` aus der JSON-Last-Line.

---

## `scripts/file-count-vs-claim-reconciliation.sh`

### Was es tut

Re-validiert Claims (in Ticket-Texten oder anderen Scripts) gegen
ground-truth Disk-/DB-State. Deckt zwei Klassen von Discrepanzen auf:

- **IMAGINED**: Der User-Claim verweist auf eine Source-Datei, in der
  die zitierte Zahl gar nicht vorkommt (z. B. "1.5.1.md sagt 47" wenn
  das Ticket tatsächlich "Schema-State 49" sagt).
- **ASPIRATIONAL-CLOSURE**: Die zitierte Zahl existiert in der Source,
  widerspricht aber der Ground-Truth (z. B. Ticket sagt "Schema-State 49"
  aber DB-rowcount zeigt 48).

### Was es NICHT tut

- Modifiziert KEINE Source-File auf Disk
- Modifiziert NICHT die DB
- Promoted NICHT ❌ TODO → ✅ DONE
- Führt KEINE Migrations aus (read-only forensic)

### Aufruf-Syntax

```bash
bash scripts/file-count-vs-claim-reconciliation.sh [--help]
```

Keine Flags außer `--help` — das Script ist immer read-only-forensic.

### Claims-Index (was geprüft wird)

| Claim-ID                     | Check | Comparator bei PASS                                                                                |
| ---------------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| CLAIM-A: future-dated-files  | Disk  | `ge1` — there must be SOME future-dated files (presence-of-some)                                   |
| CLAIM-B: schema-state-rowcount | DB    | `eq` — ticket's "Schema-State N" must equal `SELECT COUNT(*) FROM supabase_migrations.schema_migrations` |
| CLAIM-C: STATUS.md-TODO-section | Disk | `ge1` — TODO section has any items (presence-of-section)                                          |
| CLAIM-D: audit-fix-anchor-block | Disk | `ge1` — STATUS.md contains the audit-fix-commit-anchor (e30ac29 / 2026-06-28)                       |
| CLAIM-E: total-disk-truth    | Disk  | `eq` — `find supabase/migrations -maxdepth 1 -name '*.sql' | wc -l` MUST equal script's logged `disk-files total: N` |

### Run-Beispiel (mit echtem Audit-Trail-Output)

```bash
$ bash scripts/file-count-vs-claim-reconciliation.sh

[2026-06-28T...] _audit_fix:ADR-002_ PRE-FLIGHT: psql-binary
[2026-06-28T...] psql: psql (PostgreSQL) 16.14

[2026-06-28T...] _audit_fix:ADR-002_ PRE-FLIGHT: DATABASE_URL
[2026-06-28T...] DATABASE_URL (masked): postgresql://user:***@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

[2026-06-28T...] _audit_fix:ADR-002_ PRE-FLIGHT: db-connection
[2026-06-28T...] SELECT 1: OK

═══════ _audit_fix:ADR-002_ CLAIM-A: bulk-track-only future-dated-count ═══════
[2026-06-28T...]   ground-truth via user awk-pipe: 38 future-dated files on disk
[2026-06-28T...]   PASS: source-text is dynamic (TODAY_PREFIX-var); ground-truth 38 >= 1

═══════ _audit_fix:ADR-002_ CLAIM-B: 1.5.1.md schema-state-rowcount ═══════
[2026-06-28T...]   ground-truth DB-rowcount: 24
...

═══════ _audit_fix:ADR-002_ RESULTS-TABLE ═══════
CLAIM-ID                          | SOURCE-FILE                              | CLAIMED-N    | IN-SOURCE    | GROUND-TRUTH | STATUS
----------------------------------+------------------------------------------+--------------+--------------+--------------+----------
CLAIM-A: future-dated-files       | scripts/bulk-track-only-migrations.sh    | dynamic      | dynamic      | 38           | PASS
CLAIM-B: schema-state-rowcount    | docs/tickets/q1/1.5.1.md               | dynamic      | dynamic      | 24           | PASS
CLAIM-C: STATUS.md-TODO-section   | docs/tickets/STATUS.md                  | 48           | header=48    | 38           | PASS
CLAIM-D: audit-fix-anchor-block   | docs/tickets/STATUS.md                  | (presence)   | (anchor)     | 1            | PASS
CLAIM-E: total-disk-truth         | scripts/bulk-track-only-migrations.sh    | (missing)    | (missing)    | 121          | IMAGINED

═══════ _audit_fix:ADR-002_ FINAL-STATS ═══════
[2026-06-28T...] pass=4  fail=1
[2026-06-28T...] OVERALL: ASPIRATIONAL_FAILURE — paperwork-vs-reality gaps detected.
[2026-06-28T...]   Per ADR-002: forensic ground-truth; no fake-pass.

{"overall":"ASPIRATIONAL_FAILURE","pass":4,"fail":1,"exit_code":2,"transcript_stamp":"_audit_fix:ADR-002_","claims_checked":5,"checks":[…]}
```

### Exit-Code-Mapping

| Exit | Bedeutung     | Action Path                                                                                                            |
| ---- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `0`  | PASS          | Kein Action nötig — alle 5 Claims wurden validiert.                                                                   |
| `1`  | SETUP-FAIL    | psql oder DATABASE_URL fehlen → Script kann nicht laufen. Fix env-config, dann re-run.                                  |
| `2`  | ASPIRATIONAL-CLOSURE | Mindestens 1 Claim widerspricht Ground-Truth. ADR-002-Pfad: (a) IMAGINED → fix user-memory; (b) ASPIRATIONAL-CLOSURE → file new Q3 ticket. |

### IMAGINED-Claim-Reading

CLAIM-E (total-disk-truth) wird typischerweise den Status **`IMAGINED`**
liefern, weil `bulk-track-only-migrations.sh` den Pattern `disk-files total: N`
aus dem Log-Zeile ausgibt, aber N im Script dynamisch pro Run ist.
Das ist **erwartetes Verhalten** (kein Bug). Es bedeutet: das Script
kann den Total-Disk-Truth nicht selbst verifizieren, ohne die Logs
aus dem vorherigen Run zu kennen. **Akzeptiert als Limitation.**

---

## Adoption-Flow für neue Devs

1. **Setup prüfen** — siehe Voraussetzungen oben. Alle 4 Checks
   müssen OK sein, bevor Scripts sinnvoll laufen.
2. **DRY-RUN zuerst** — `bash scripts/bulk-track-only-migrations.sh`
   ohne Flag zeigt, was passieren WÜRDE, ohne zu schreiben.
   Output ist single-line JSON-last-line-of-stdout → pipe-fähig.
3. **Reconciliation-Check** — `bash scripts/file-count-vs-claim-reconciliation.sh`
   zeigt, ob Tickets/Claims zur Realität passen. Exit `2` ist nicht
   "kaputt", sondern "audit-trail-gap gefunden, ADR-002 forward-ticket anlegen".
4. **Apply mit Vorsicht** — nur wenn ein menschlicher Reviewer den DRY-RUN-Output
   bestätigt hat: `bash scripts/bulk-track-only-migrations.sh --no-dry-run`.
5. **CI-Trigger** — `gh workflow run db-audit.yml` (oder wöchentlicher
   Sonntag-03:00-cron pusht automatisch den Stand ins Audit-Log).

### Adoption-Hygiene-Reminder

> **Wenn du neue SQL-Migrations hinzufügst** (Datei `supabase/migrations/*.sql`),
> lass `bulk-track-only-migrations.sh` einmal im DRY-RUN laufen, um zu sehen
> ob die Version bereits getrackt ist. Bei `would_submit > 0` muss manuell
> mit `--no-dry-run` getrackt werden — `npx supabase db push` macht das NICHT
> automatisch für Files, die per Drift (existierende Tables) "durchgewunken"
> wurden.

---

## Known-Limitations-Tabelle (per ADR-002 Forward-Placeholder-Convention)

| Limitation                                                                       | Workaround                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Multi-Files-per-Date collapsen auf 1 Row (ADR-007-PK-Inverse-Semantik)            | OK — Intentional. Composite-Key-Ticket `1.5.1.md` offen für V2.        |
| Script-Log-Line "disk-files total: N" ist dynamisch, nicht-pattern-extractable    | CLAIM-E wird immer `IMAGINED`. Realtime-Crosscheck nur via separater `find`. |
| `--no-dry-run` ohne `ON_ERROR_STOP=1`-Reviewer-Entscheidung ist gefährlich       | Erst DRY-RUN, dann zweites Terminal mit `--no-dry-run` öffnen.          |

---

## CI-Integration

Der `db-audit`-Workflow in `.github/workflows/db-audit.yml` triggert diese
Scripts weekly + on-demand. Er prüft:

- `bulk-track-only-migrations.sh` Exit `0` UND JSON-`errors: 0`.
- `file-count-vs-claim-reconciliation.sh` Exit `0` ODER `1`.
- Exit `2` von reconciliation.sh wird als Soft-Fail gemeldet (kein CI-Stop,
  nur ein Issue-Comment mit Transcript-Link zur manuellen ADR-002-Review).

CI-Output landet als Artifact `db-audit-transcript-<run-id>` (Retention 14 Tage).
Success-Path ist in <2 Minuten durch (PostgreSQL-Cold-Connect gecacht via
`actions/cache` auf `~/.psql_history` Layer).
