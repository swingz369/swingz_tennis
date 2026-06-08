# 🔧 Billing-Schema: Verbleibende Diskrepanzen nach DB-Audit

**Labels:** `bug`, `billing`, `database`, `tech-debt`
**Milestone:** Production Readiness

## Context

In der DB-Audit-Session (2026-06-07/08) wurden umfangreiche Schema-Syncs durchgeführt:

- 8 Sync-Migrationen deployed
- 5.521/6.453 adhoc-Invoices via `sepa_mandates` backfilled
- 1.026/1.200 dunning_records via `sepa_mandates` backfilled
- 3 fehlende Spalten zu `invoices` + 4 zu `dunning_records` ergänzt
- 4 Trigger/Functions deployed oder gefixt
- RLS-Policies bereinigt (redundante Policy entfernt)

Details: `docs/DB-SCHEMA-SYNC.md`

---

## Issue 1: 932 adhoc-Invoices ohne `member_id`

**Severity:** Medium
**Tabelle:** `invoices`
**Betroffene Zeilen:** 932 (von 6.920 adhoc-Invoices)

### Problem

932 adhoc-Invoices haben `member_id = NULL`. Diese gehören zu Clubs, die kein valides SEPA-Mandat mit einem existierenden User in `public.users` haben.

### Impact

- `invoices_select` RLS-Policy prüft `member_id = auth.uid()` → diese Invoices sind für Member unsichtbar
- Billing-UI zeigt "N/A" als Member-Name
- `update_invoice_status()` Trigger kann `paid_amount` nicht korrekt zuordnen

### Root Cause

Diese Invoices wurden von Test-/Seed-Scripts erstellt, die `member_id` nicht gesetzt haben. Die Clubs haben entweder:

- Kein SEPA-Mandat (Test-Clubs)
- Nur verwaiste SEPA-Mandate (member_id zeigt auf gelöschte Users)

### Vorgeschlagene Lösung

1. Identifiziere die 932 betroffenen Invoices und deren Clubs
2. Für echte Clubs: Member über `user_club_memberships` (role='member') zuordnen
3. Für Test-Clubs: Invoices löschen oder als "Test" markieren
4. Optional: Constraint `NOT NULL` auf `invoices.member_id` für `invoice_type = 'adhoc'`

```sql
-- Betroffene Clubs identifizieren
SELECT i.club_id, c.name, count(*) as cnt
FROM invoices i
JOIN clubs c ON c.id = i.club_id
WHERE i.member_id IS NULL AND i.invoice_type = 'adhoc'
GROUP BY i.club_id, c.name
ORDER BY cnt DESC;
```

---

## Issue 2: `total_amount` vs `amount` Namens-Inkongruenz

**Severity:** Low
**Tabelle:** `invoices`

### Problem

Die ursprüngliche Migration (`20260502_billing_system.sql`) definiert die Spalte als `total_amount`. Die Production-DB und Drizzle-Schema nutzen `amount`. Verschiedene Code-Dateien verwenden beide Namen inkonsistent.

### Status Quo

| Layer                             | Name           | Korrekt?             |
| --------------------------------- | -------------- | -------------------- |
| DB (`invoices`)                   | `amount`       | ✅ Production-Spalte |
| Drizzle-Schema                    | `amount`       | ✅                   |
| `billing.types.ts` (Interface)    | `total_amount` | ❌ Inkonsistent      |
| `billing.ts` (Zod Schema)         | `amount`       | ✅                   |
| Admin-UI (`billing-client.tsx`)   | `amount`       | ✅                   |
| GoBD-Trigger                      | `amount`       | ✅ (2× gefixt)       |
| `update_invoice_status()` Trigger | `amount`       | ✅ (adaptiert)       |

### Impact

- Kein Runtime-Fehler (Code funktioniert korrekt)
- Verwirrend für Entwickler: `billing.types.ts` Interface sagt `total_amount`, DB hat `amount`
- Trigger aus der Original-Migration referenzieren `total_amount` → schlagen fehl wenn 1:1 deployed

### Vorgeschlagene Lösung

**Option A (empfohlen):** Benenne `billing.types.ts` Interface-Feld `total_amount` → `amount`
**Option B:** Füge eine DB-Column `total_amount` als Generated Column alias für `amount` hinzu
**Option C:** Dokumentiere die Inkongruenz und belasse es (Low Priority)

---

## Referenzen

- `docs/DB-SCHEMA-SYNC.md` — Vollständige Dokumentation aller Diskrepanzen
- `supabase/migrations/20260608_backfill_invoice_member_id.sql` — Backfill-Migration (5.521 resolved)
- `supabase/migrations/20260608_backfill_dunning_member_id.sql` — Dunning-Backfill (1.026 resolved)
