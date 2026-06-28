# ADR-007 — Schema-Migrations Composite-PK Trade-off

> **Status:** ✅ ACCEPTED (Maintainer-Signoff received) · _Decision-Date: 2026-06-28_ · _Maintainer: Mike Swinger <mike.swinger@gmx.de>_ · _zuletzt geprüft: 2026-06-28_

## Kontext

Die `supabase_migrations.schema_migrations`-Tabelle (Supabase-Standard)
verwendet aktuell `version` als Single-Column-PRIMARY-KEY. Der
`scripts/bulk-track-only-migrations.sh`-Run vom 2026-06-27 hat ergeben, dass
bei mehreren Migration-Files pro Tag (z. B. 5× `20260506_*.sql`) eine
logische Migration entsteht, der ON-CONFLICT-Skip-Mechanismus aber auf den
existierenden Schema-Stand dedupliziert. Result: 80 pending → 25 inserted,
ON-CONFLICT-Skip 55 (24 pre-existing-Keys + 31 in-batch-duplicate-Version-
Keys), Schema-State 49.

## Entscheidung

**Status-Quo belassen.** Der Single-Column-PK `(version)` bleibt unverändert.
Der Composite-PK `(version, name)` wird **nicht aktiviert**.

### Begründung (5 Punkte, Risiko-Asymmetrie)

1. **Risiko-Asymmetrie**: DROP+ADD PRIMARY-KEY ist ein DDL-Strukturbruch
   (breaking change für Supabase-managed Workflows). Der hypothetische
   Nutzen (Per-File-Granularität im Audit-Trail) rechtfertigt das Risiko
   nicht, solange der bestehende ON-CONFLICT-Skip-Mechanismus den
   Use-Case korrekt bedient.

2. **Supabase-managed-Tabelle**: Die Tabelle wird vom Supabase-Migration-
   Tool verwaltet. Eigene Schema-Modifikationen müssen mit zukünftigen
   Supabase-Updates kompatibel bleiben. Single-Column-PK ist das
   etablierte Supabase-Standardmuster; Composite-PK ist eine
   Spezialanfertigung mit Wartungslast.

3. **Naming-Convention-Disziplin**: Pro Tag wird idealerweise genau eine
   Migration erstellt (`YYYYMMDD_kurze_beschreibung.sql`). Multi-Files-per-
   Day sollten eher zusammengeführt werden. Der Composite-PK würde diese
   Konvention schwächen, statt sie zu erzwingen.

4. **ON-CONFLICT-und-Supabase-Migration-Pattern**: Supabase's Standard-
   Migration-Pfad funktioniert sauber mit dem Single-Column-PK. Ein
   Composite-PK würde Custom-Logic im `bulk-track-only-migrations.sh`
   erfordern (`ON CONFLICT (version, name) DO NOTHING`) — und die
   Pre-Edit-Verifikation müsste dann sicherstellen, dass keine
   in-batch-duplicate-(version, name)-Kombinationen existieren.

5. **Migration-Sketch bleibt ready-to-apply**: Falls zu einem späteren
   Zeitpunkt Audit-Trail-Spezifikationen die Per-File-Granularität
   erfordern, kann der PK-Wechsel mit dem unten dokumentierten
   Migration-Sketch in einem separaten Migrationsschritt nachgeholt
   werden. Die Aktivierung bleibt explizit als Forward-Only-Option
   erhalten — kein Verlust an Entscheidungsfreiheit.

## Konsequenzen nach Acceptance

- **Status-Quo bleibt**. PK `(version)` ist Single-Column.
- **bulk-track-only-migrations.sh** bleibt unverändert (`ON CONFLICT (version) DO NOTHING`).
- **Migration-Sketch bleibt als ADR-interner Referenz-Anker** für eine
  mögliche spätere Aktivierung erhalten (siehe unten).
- **Cross-References**: `q1/1.5.1.md` (`🟢 DECIDED` mit Body-Rewrite,
  Re-Evaluation-Trigger gelistet) + `docs/tickets/STATUS.md`
  (Heute-closed 2026-06-28 Audit-Log-Eintrag mit dieser Acceptance).

### Re-Evaluation-Trigger (jeder einzelne aktiviert Re-Assessment)

- **Audit-Trail-Spezifikation**: Wenn Stakeholder explizit verlangen,
  welche der `20260506_*`-Dateien welcher pre-existing-Version
  entsprechen, dann re-evaluate.
- **Migrations-Granularität > 1/Day systematisch**: Wenn mehrere
  addditive Migrationen pro Tag regelmäßig vorkommen (statt als
  1-File-pro-Day mit Sub-Steps), dann re-evaluate.
- **DB-Constraint-Conflict-Risiko**: Wenn zukünftige Supabase-Updates
  DROP+ADD PK auf managed-Tabelle beeinträchtigen, dann Re-Assessment
  der Risiko-Asymmetrie.
- **Maintenance-Last bei Composite-PK**: Wenn die Custom-Logic im
  `bulk-track-only-migrations.sh` problematisch wird (z. B.
  in-batch-duplicate-Detection), dann Re-Assessment.

## Migration-Sketch (Referenz-Anker für Re-Aktivierung)

Falls Aktivierung später nötig wird:

```sql
-- supabase/migrations/<YYYYMMDD>_schema_migrations_composite_pk.sql
ALTER TABLE supabase_migrations.schema_migrations
  DROP CONSTRAINT IF EXISTS schema_migrations_pkey;

ALTER TABLE supabase_migrations.schema_migrations
  ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version, name);
```

**Pre-Activation-Check** _(vor SQL-Run manuell zu verifizieren)_:

```sql
SELECT version, count(*) FROM supabase_migrations.schema_migrations
  GROUP BY version HAVING count(*) > 1;
-- Erwartung: 0 rows. Wenn > 0: vor DROP PK deduplizieren (siehe ADR-002
-- Pattern der manuellen Pre-Edit-Verifikation).
```

`scripts/bulk-track-only-migrations.sh` Diff (für Re-Aktivierung):

```diff
- sed -i '$ s/,$/ ON CONFLICT (version) DO NOTHING;/' "$SQL_FILE"
+ sed -i '$ s/,$/ ON CONFLICT (version, name) DO NOTHING;/' "$SQL_FILE"
```

## Verwandt

- ADR-001 (Next-Intl-Strategy)
- ADR-002 (LK-Sync-Deferral)
- ADR-003 (Tier-Features Cost-Passthrough)
- ADR-004 / ADR-005 / ADR-006 (siehe `docs/decisions/`)
- Forward-Ticket `docs/tickets/q2/q2.0.0-merge-pref-tables.md` (analog
  pattern für die ursprüngliche ON-CONFLICT-Logik in
  member-schedule-Preferences + user-training-Preferences)

## Changelog

- **2026-06-28 — Draft** (ursprünglich): Analysiert 5 Pro/Contra-Punkte,
  Trade-off-Doc mit Empfehlung Status-Quo belassen.
- **2026-06-28 — Review**: Begründung um Risiko-Asymmetrie +
  Supabase-managed-Tabelle + Naming-Convention-Disziplin erweitert.
- **2026-06-28 — Accepted**: Maintainer-Signoff erhalten. ADR finalisiert.
  Cross-References zu `q1/1.5.1.md` und `docs/tickets/STATUS.md` ergänzt.
  Re-Evaluation-Trigger explizit dokumentiert.
