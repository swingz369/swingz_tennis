# ADR-013: Source-of-Truth-Deklaration für Domain-Tabellen

> **Status:** 🟡 Proposed (zur Diskussion mit Maintainer — wird im PR für 3.7.4 auf Accepted gesetzt)  \
> **Datum:** 2026-07-01  \
> **Autor:** swingz-bot  \
> **Ticket:** 3.7.4 (erste Anwendung), Querverweise: 3.7.1, 3.7.2, 3.7.3, FK-Drift-Fix 2026-06-30  \
> **Audit-Basis:** Live-Row-Counts vom 2026-07-01 (siehe 3.7.3-Quellen)

## Context

In den letzten drei Wochen (2026-06-30 bis 2026-07-01) wurden **drei unabhängige Schwere Bugs** alle durch Schema-Drift zwischen parallelen Source-of-Truth-Texten verursacht:

### Bug 1 — FK-Drift 23503 auf `season_plan_entries.group_id`

- **Symptom**: `SeasonClusteringEngine.runClustering()` schreibt nach `groups`, aber FK zeigt(e) auf `training_groups` → INSERT scheitert mit SQLSTATE `23503` → Cluster-Engine blockiert.
- **Ursprung**: Diff zwischen Drizzle-Snapshot-Cache und expliziter Supabase-SQL-Migration. Trigger-Punkt: Migrations-Run im Commit `fdd1ce0` (2026-05-07, Autor `swingz369`, 149-TS-Error-Kill-Sprint).
- **Fix**: Migration `20260630_recorrect_season_plan_entries_group_fk.sql` (DONE).

### Bug 2 — CHECK-Constraint 23514 auf `season_planning_history.action_type`

- **Symptom**: AFTER-INSERT/UPDATE/DELETE-Trigger `log_season_plan_entry_changes()` emittiert `created`/`updated`/`deleted` → Live-CHECK lehnt alle 3 ab (23514). Wurde durch Bug 1 maskiert (FK-Fehler schlug vor Trigger-Eintritt auf).
- **Ursprung**: Drei Source-of-Truth-Texte für dieselbe Spalte — Spalten-Kommentar in `20260506_season_planning_system.sql:220-222` (9 dokumentierte Werte), Live-CHECK-Whitelist (11 Werte aus dem anderen Trigger), Trigger-Function-Source-Code (3 Werte). Kein Schnittpunkt.
- **Fix**: Ticket 3.7.3 (TODO).

### Bug 3 — `trainer_profiles` ↔ `trainers` 10 verwaiste Profile

- **Symptom**: Beide Tabellen aktiv genutzt, aber nicht 1:1 synchron. 10 `trainer_profiles` ohne `trainers`-Row.
- **Ursprung**: Tracking-Idiom-Wechsel ohne FK-Sync.
- **Fix**: separate Folge-Tickets (out-of-scope hier, aber ADR-013 trackt es als known-debt).

### Pattern über alle drei Bugs

Das Schema wurde über mehrere Source-of-Truth-Texte definiert (Drizzle-Snapshot, SQL-Migrationen, Spalten-Kommentare, ADR-Lücken), und sie sind **unabhängig voneinander** gedriftet. CI hat den Drift nicht gefangen, weil kein CI-Gate auf Schema-Cross-Reference existiert.

## Decision

Wir beschließen **vier Source-of-Truth-Prinzipien**:

### 1. Pro Domain-Konzept genau eine Tabelle.

Legacy-Tabellen, auch wenn sie leer sind (`training_groups`: 0 Rows, `memberships`: 0 Rows), werden **konsequent gedroppt**. Kein "harmloser Ghost" — er ist Material für FK-Drift, Drizzle-Generate-Fehler und Code-Confusion. Erste Anwendung: Ticket 3.7.4 für `training_groups`.

### 2. FK-Invariants explizit dokumentiert.

Jede FK-Definition in einer Drizzle-Table oder Supabase-Migration **muss** ein Inline-Kommentar enthalten, das die Source-of-Truth-Frage beantwortet:

```ts
// ADR-013: FK-Target ist <Tabelle X>, weil Konzept Y.
export const seasonPlanEntries = pgTable('season_plan_entries', {
  // ...
  group_id: uuid('group_id').notNull().references(() => groups.id), // ADR-013: groups ist Single-Source-of-Truth für Training-Cluster ab 2026-06-30.
  // ...
});
```

Kommentar-Pflicht ist CI-verifiziert (siehe §Compliance).

### 3. Eine Trigger-Funktion pro Audit-Tabelle.

`season_planning_history` hat aktuell zwei parallel-evolvierende Trigger: `log_season_plan_entry_changes` (für Plan-Entry-DML) und `log_season_planning_action` (für Season-State-Machine). Sie werden in **einer** zentralen `log_season_planning_event()` zusammengeführt. Erstes Anwendung: 3.7.3-Folge B (separates Ticket).

### 4. Drizzle-Schema ist generativ (Cache), nicht autoritativ.

Bei Konflikten zwischen Drizzle-Snapshot-Cache, SQL-Migrations und Live-DB gilt eine klare Hierarchie:

- **ADR + Live-DB** ist autoritativ.
- Drizzle-Snapshot ist nur ein Cache der generierten Migration.
- Schema-Drift-Detection-Tool (`scripts/_audit-shadow-tables.ts`-Pattern als CI-Standalone) ist Pflicht-Bestandteil jedes PR mit `drizzle/00X_*.sql`-Diff.

## Consequences

### Pro

- Keine 23503/23514-Re-Trigger analog zu den letzten 3 Wochen.
- Onboarding: neue Engineer sehen 1 Tabelle pro Konzept, keine Mehrdeutigkeit.
- Maintenance: weniger Migrations = klarerer Git-History.
- ADR-013 selbst wird zur lebenden Doku der Konsolidierungs-Philosophie.

### Contra

- Konsistenz-Aufwand: pro Beseitigung eines Schatten-Paares ~30 min Migrations-Arbeit.
- ADR-Wartungs-Disziplin: FK-Invariants-Kommentare müssen gepflegt werden.
- CI-Tooling-Aufbau (siehe §Compliance).
- Drizzle-Generate-Pipeline muss aktualisiert werden, wenn Legacy-Tabellen gedroppt werden (klein, aber regelmäßig).

## Status Quo zum Audit-Zeitpunkt 2026-07-01

| Schatten-Paar | Live-Rows | Risiko | Status nach 3.7.4 |
|---|---|---|---|
| `groups` ↔ `training_groups` | 31 / **0** | 🔴 AKTIV (Ursprung des 23503-Bugs) | ✅ gelöst: `training_groups` gedroppt |
| `trainers` ↔ `trainer_profiles` | 48 / 58 | 🟠 HIGH | Folge-Ticket |
| `user_club_memberships` ↔ `memberships` | 439 / **0** | 🟢 LOW (Legacy leer) | Folge-Ticket |
| `bookings` ↔ `training_sessions` | unklar | 🟡 MEDIUM | Architektur-Klärung nötig |

## Compliance

Jedes PR, der eine Drizzle-Schema-Änderung (`src/infrastructure/persistence/schema.ts`) oder eine SQL-Migration mit FK-/Trigger-/CHECK-Constraint einführt, muss folgende Checks bestehen:

### 1. Schatten-Tabellen-Check

Tool: `scripts/ci-check-shadow-tables.ts` (separates Ticket zur Erstellung). Paar-Liste (siehe §Status Quo) wird gegen `pg_class` in CI-Postgres geprüft. Erkanntes Schatten-Paar → PR-Block + Verweis auf ADR-013.

### 2. FK-Invariant-Kommentar-Check

Lint-Regel im `eslint.config.mjs`:

```js
// .eslintrc.js (Auszug)
{
  files: ['src/infrastructure/persistence/schema.ts'],
  rules: {
    'no-irrelevant-comments': 'off',
    'local/require-adr-013-fk-invariant': 'error', // custom rule
  },
}
```

### 3. Trigger-Funktions-Konsolidierungs-Check

Vor jedem neuen `CREATE TRIGGER` auf einer Audit-Tabelle wie `season_planning_history` etc.: ESLint-Check (oder grep-CI) warnt "ADR-013: nutze stattdessen die zentrale Funktion `log_season_planning_event()`".

### 4. Migration-Apply-Check

`scripts/_audit-duplicates.ts`-Pattern (das der User zur Vorbereitung der 23514-Analyse ad-hoc geschrieben hat) als dauerhafter CI-Bestandteil laufen lassen — nicht als throwaway.

## Out-of-Scope

- Andere Schatten-Paare (`trainers`↔`trainer_profiles`, `bookings`↔`training_sessions`, `memberships` Legacy): separate Folge-Tickets.
- Domain-Event-Layer (eigene `domain_events`-Tabelle mit `domain_object`/`event_type`-Spalten statt audit-spezifischer `action_type`-Whitelist): Q4+ Architektur-Initiative.
- DSGVO-Audit-Trail-Hardening: separater Track (siehe B8-Workstream).
- Aufbau der ESLint-Custom-Rules: separates Ticket für `eslint-plugin-adr-013` (oder analoges Plugin).

## Alternatives Considered

### A: Status quo lassen, ad-hoc Firefighting. — ❌ Verworfen.

Die letzten 3 Wochen zeigen: Cost-per-Bug inkrementell wächst. Bei jedem neuen Migrations-Run ist das Risiko eines neuen FK-/CHECK-/Trigger-Drift-Bugs latent vorhanden.

### B: Big-Bang-Migration, alles in einem Rutsch konsolidieren. — ❌ Verworfen.

Zu großes Diff-Volumen für eine einzige PR. Würde andere Q3-Tickets (3.7.3) blockieren und das Reviewer-Limit sprengen. Risk: Migration bricht mittendrin, halbkonsolidiertes Schema ist schlimmer als jetzt.

### C: Inkrementell, ein Schatten-Paar pro Sprint konsolidieren. — ✅ Angenommen.

Dieser Frame mit 3.7.4 als erstem Anwendungsfall. Pro Sprint 1 Schatten-Paar + 1 ADR-Update. Reviewer-freundlich, git-history-klar.

## References

- **3.7.3** — `season_planning_history.action_type` CHECK-Whitelist-Mismatch 23514
- **3.7.1, 3.7.2** — Smart-Court-Type-Regen / Activation
- **FK-Drift-Fix** Migration `20260630_recorrect_..._group_fk.sql`
- **Audit 2026-07-01** (siehe 3.7.3-Quellen) — Live-Row-Counts aller Schatten-Paar-Kandidaten
- **Drizzle-Snapshots** — `drizzle/meta/0002_snapshot.json` … `drizzle/meta/0009_snapshot.json`
- **Supabase-Migrations** — `supabase/migrations/20260507000000_schema_consolidation.sql`, `20260506_*.sql`, `20260519_*.sql`
- **`scripts/_audit-duplicates.ts`** — ad-hoc-Audit-Script als Vorlage für künftiges CI-Tool
- **`docs/ARCHIV/SAISONPLANUNG_ANALYSE.md`** — historische Doku der `groups`/`training_groups`-Verwirrung

## Decision-Log

| Datum | Status | Wer | Notiz |
|---|---|---|---|
| 2026-07-01 | 🟡 Proposed | swingz-bot | Initial entworfen im Kontext von 3.7.4 |
| (pending) | 🟢 Accepted | TBD | Im selben PR für 3.7.4 wenn Maintainer-Approve |
| (pending) | 🏛️ Superseded | TBD | Falls eine zukünftige ADR (z.B. ADR-NNN Domain-Event-Layer) dieses ADR ablöst |
