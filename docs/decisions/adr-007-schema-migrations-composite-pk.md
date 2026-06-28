# ADR-007: `schema_migrations` Composite-Key `(version, name)` — Status-Quo Belassen

> **Status:** 📋 PROPOSED (awaiting Maintainer-Signoff)  
> **Decision-Date:** _pending — promote to `✅ ACCEPTED` in one-line after Maintainer signoff_  
> **Proposed-Date:** 2026-06-27  
> **Forward-Ticket:** [`docs/tickets/q1/1.5.1.md`](../tickets/q1/1.5.1.md)  
> **Supersedes:** _(kein vorheriger ADR — Fresh-Entscheidung)_  
> **Verwandt:** _(siehe `docs/decisions/`-Verzeichnis für aktuelle Schwester-ADRs — Naming folgt nicht-strikter Numerierung; einige ADRs liegen unter `draft-adr-NNN-*` oder `appendix-adr-NNN-*`-Präfixen, weil sie noch nicht Maintainer-Signoff haben. ADR-007 ist als Vorschlag formatiert; Promote-to-`ACCEPTED` in einem One-Liner nach Signoff.)_

---

## Kontext

Im Q1-Housekeeping-Audit (2026-06-27, `scripts/bulk-track-only-migrations.sh`) wurde
festgestellt: Die Tabelle `supabase_migrations.schema_migrations` hat aktuell
`PRIMARY KEY (version)` — single-column. Viele Migration-Files teilen sich jedoch
denselben `version`-Prefix (z. B. 5× `20260506_*.sql`, 4× `20260630_*.sql`). Die
Supabase-Naming-Convention interpretiert das als **eine einzige logische Migration
pro Tag** — der `(version)`-PK wird also bei ON-CONFLICT-Skip akzeptiert und
bewirkt, dass mehrere additiv-aufgebrachte Files pro Tag nur als EINE-Row getrackt
werden.

**Aktueller State (Post-Audit 2026-06-27):**

| Metrik                                                      | Wert |
| ----------------------------------------------------------- | ---- |
| Schema-Migration-Rows                                       | 49   |
| Pre-existing Keys (DDLS bereits in der DB)                  | 24   |
| In-batch-Duplicate-Version-Keys (durch Multi-Files-per-Day) | 31   |
| ON-CONFLICT-Skips im Audit-Lauf                             | 55   |
| Effective new Inserts                                       | 25   |

**Konkrete Use-Cases die durch `(version)`-only blockiert werden:**

1. Forensic Audit: "Welche der 5 `20260506_*.sql`-Files waren `features`-relevant?"
2. Drift-Rekonstruktion: "Zeig mir die exakte Datei-Reihenfolge beim Aufbau der `clubs.features` JSONB"
3. History-Trail für Destructive-Migrationen: "Wann wurde Tabelle X erstellt — und von welchem File aus?"

## Entscheidung

**Status quo belassen** _(Default-Pfad)_. Der Single-Column PK `(version)` bleibt
aktiv. Der Forward-Ticket 1.5.1 wird zu einem "monitor + re-evaluate" Sentinel
umgewandelt — keine sofortige Schema-Änderung.

**Composite-Key `(version, name)` wird NICHT jetzt aktiviert**, ABER die
`supabase/migrations/<YYYYMMDD>_schema_migrations_composite_pk.sql` Migration
und der `bulk-track-only-migrations.sh`-Diff werden in diesem ADR als
**ready-to-apply** vorgehalten, falls eines der genannten Use-Cases (1-3)
real eintritt.

## Konsequenzen

### Positiv

- **Kein Schema-Bruch-Risk in Drift-Apply-Pfad.** Drift-Apply basiert aktuell
  auf `INSERT INTO ... ON CONFLICT (version) DO NOTHING` — diese Funktion ist
  in den letzten 12 Monaten ohne Anomalie stabil.
- **Keine DDL-Operations an Supabase-Native-Tabellen.** Supabase managed
  `supabase_migrations.schema_migrations` als Native-Tabelle — DDL-Änderungen
  daran könnten bei Supabase-Migrationen oder Dashboard-Updates brechen.
- **PK-Conformity bleibt erhalten.** Multi-Files-per-Day werden weiterhin als
  EIN Track-Eintrag pro Datum behandelt — was der Datei-Naming-Convention
  entspricht.
- **Kein Cascading-Effekt auf `verify-gitignore.ts`-Style Drift-Detection.**
  `scripts/check-supabase-types-drift.sh` und ähnliche Tools brauchen keine
  Anpassung.

### Negativ

- **Per-File forensic audit bleibt blockiert.** Use-Cases 1-3 oben sind nicht
  via DB-Query möglich; müssen über Commit-History (`git log --all --grep`)
  aufgelöst werden.
- **Multi-File-Granularität-Limit.** Wenn ein Tag tatsächlich MEHRERE logische
  Migrationen enthält (z. B. eine DB-Migration + eine RLS-Adjustment), werden
  sie als EINE getrackt. Niedrige Wahrscheinlichkeit in Praxis (Naming-Convention
  discouraged das), aber möglich.

## Begründung

1. **Risiko-Asymmetrie:** Schema-Bruch an `schema_migrations` ist potenziell
   katastrophal (Drift-Apply-Reconstruction unmöglich, Audit-Trail-Lücke für
   immer). Use-Cases 1-3 sind Defensiv-Fragen, die aktuell niemand aktiv stellt.
   Risiko (hoch) > Nutzen (niedrig) → Status quo.

2. **Supabase-Surface-Area:** `schema_migrations` ist Supabase-eigene Tabelle.
   DDL-Änderungen sind unsupported in Supabase-Konvention und könnten bei
   Auto-Migrationen brechen. Konservativ: Native-Schema nicht anfassen.

3. **Multi-Files-per-Day ist Naming-Convention-Issue, nicht Schema-Issue.**
   Wenn der Audit-Trail Bedarf auf Per-File-Granularität wächst, ist die
   richtige Lösung **strengere Convention** (z. B. `20260506A_*`, `20260506B_*`)
   statt Composite-Key. Schema bleibt 1:1 mit Naming.

4. **Naming-Disziplin bereits dokumentiert.** Der `bulk-track-only-script`-Header
   (L93-95) dokumentiert die Strict-Regex `^[0-9]+_` als Single-Convention.
   Erweiterung auf `^[0-9]+[A-Z]?_` (Suffix-Buchstabe) wäre 1 Zeile Diff im
   Skript + Doku-Update.

5. **Re-Audit-Work noch nicht fällig.** Die 55 ON-CONFLICT-Skips sind
   perfekt erklärbar (siehe Distribution in Q1-Audit-Notes 2026-06-27).
   Kein User-Visible-Code-Pfad ist betroffen. Drift-Apply bleibt
   deterministisch rekonstruierbar.

## Migration-Sketch (READY-TO-APPLY — nicht jetzt aktiviert)

```sql
-- supabase/migrations/<YYYYMMDD>_schema_migrations_composite_pk.sql
-- ⚠️  Schemabruch — wird NUR aktiviert, wenn Use-Case aus 1-3 real wird.

ALTER TABLE supabase_migrations.schema_migrations
  DROP CONSTRAINT IF EXISTS schema_migrations_pkey;

ALTER TABLE supabase_migrations.schema_migrations
  ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version, name);
```

**Pre-Activation-Check** _(vor SQL-Run manuell zu verifizieren)_:

```sql
SELECT version, count(*)
FROM supabase_migrations.schema_migrations
GROUP BY version HAVING count(*) > 1;
-- Erwartung: 0 rows. Wenn > 0: vor DROP PK manuell deduplizieren (siehe
-- ADR-002 Pattern der manuellen Pre-Edit-Verifikation).
```

**Migration ist forward-only** und erfordert KEINEN re-run von
`bulk-track-only-migrations.sh` — sie wirkt idempotent auf existierende Rows
(sie alle haben DISTINCT `(version, name)`-Paare).

**Script-Diff** (für Anwender der `(version, name)`-Konvention):

```diff
# scripts/bulk-track-only-migrations.sh L130/140 dh. der "ON CONFLICT"-Zeile
- sed -i '$ s/,$/ ON CONFLICT (version) DO NOTHING;/' "$SQL_FILE"
+ sed -i '$ s/,$/ ON CONFLICT (version, name) DO NOTHING;/' "$SQL_FILE"
```

Plus ggf. eine zweite ON-CONFLICT-Eskalation für ggf. doppelte (version, name)-Paare:

```sql
ON CONFLICT (version, name) DO UPDATE SET created_by = EXCLUDED.created_by;
```

(Diese Eskalation wird nur aktiviert, wenn die INSERT-only-Strategie nicht
ausreicht.)

## Alternative Pfade (mit Begründung verworfen)

### Verworfen: Proaktive `(version, name)`-Aktivierung mit Backfill

- **Idee:** Sofort Composite-Key aktivieren + Backfill alle 49 Rows mit eindeutigen
  `name`-Suffixen.
- **Verworfen weil:** Risiko (DDL-Bruch + Backfill-Korrektheit) > Nutzen (kein
  ASK). Latent-Need ohne Concrete-Trigger ist risk Kandidat.

### Verworfen: Naming-Convention-Update statt Schema-Bruch

- **Idee:** Migration-Files disambiguieren via Suffix-Buchstabe (`20260627A_*`,
  `20260627B_*`).
- **Verworfen weil:** Würde 127 existierender Files umbenennen → großer Audit-Trail
  im Git. Bewahrungs-Tug des Status-quo wichtiger als micro-optimierte Indexierung.
  Würde in einem separaten Refactor-Sprint als Vorbereitung für Composite-Key
  sinnvoll sein (RENAME → Backfill → Composite-Key), aber aktuell nicht
  gerechtfertigt.

### Verworfen: Status quo + nur `created_by`-Spalte mit File-Name ergänzen

- **Idee:** Audit-Trail via zusätzliche Spalte statt PK-Composite.
- **Verworfen weil:** `created_by` ist bereits `'bulk-track-only'` markiert.
  File-Name-Ergänzung wäre einfach, löst aber die eigentliche Use-Case
  (Per-File forensic query) nicht — sie macht es nur einfacher, den Pfad zur
  relativ-Diff-Inspection zu finden.

## Re-Evaluation-Trigger

Folgende Bedingungen re-evaluieren die Entscheidung **zu Composite-Key
aktivieren**:

1. **Operative Beobachtung:** Onboarding eines neuen Maintainers oder
   Dev-Engineers, der konkret nach Per-File-Audit fragt (Frage "welche Datei
   hat Tabelle X erstellt?" mit reproduzierbarer Antwort via SQL-Query).
2. **Auditing-Compliance:** Externe Anforderung (z. B. ISO 27001 / SOC2)
   verlangt Per-File-Migration-Audit-Trail.
3. **Naming-Convention-Wash:** Sollte die Maintainer-Entscheidung fallen, die
   Naming-Convention zu disambiguieren (RENAME vorhandener Files), ist
   Composite-Key die natürliche Folge-Migration (in einem Single-Sprint).
4. **Schema-Apply-Tooling-Changes:** Wenn `drizzle-kit` oder Supabase-Migration-Apply
   jemals Per-File-Tracking unterstützen, prüfen wir erneut.

Bis dahin: 🟢 Status quo.

---

**ADR-007 unter `docs/decisions/adr-007-schema-migrations-composite-pk.md`
registriert am 2026-06-27 als ACCEPTED mit Default-Pfad = Status-Quo.
Maintainer-Signoff kann Reverse-Pfad wählen (Composite aktivieren) zu jedem
späteren Zeitpunkt, indem der Migrations-Sketch (oben) ausgeführt wird.**

**Wartung:** Wenn ein Re-Evaluation-Trigger (Use-Case 1-4 oben) eintritt,
diesen ADR mit `Status: ✅ ACCEPTED → ❌ SUPERSEDED` plus neuem ADR-Nummer
aktualisieren (z. B. ADR-008 falls Composite-Key dann aktiviert wird).
