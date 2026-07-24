# B3 — Supabase RLS & Service-Client-Audit

## Service-Client-Inventur (Stand 2026-06-30)

`createServiceClient()` bypasses RLS. Alle Verwendungen müssen gerechtfertigt sein.

| Route / Datei                               | Grund                                                          |
| ------------------------------------------- | -------------------------------------------------------------- |
| `app/api/admin/newsletters/route.ts`        | Sendet an alle Club-Member, RLS würde eigene Daten beschränken |
| `app/api/admin/nuliga/import/route.ts`      | Upsert in teams/match_days ohne User-Session                   |
| `lib/services/last-minute-alert.service.ts` | Cron-Kontext, keine User-Session                               |
| `lib/services/reactivation.service.ts`      | Cron-Kontext                                                   |
| `lib/db/audit-logger.ts`                    | audit_logs brauchen service_role (kein RLS-Write für User)     |
| `app/(protected)/owner/` Server Components  | Owner hat keine club_id — RLS würde alle Clubs sperren         |

## RLS-Policy-Empfehlungen

- Alle User-Daten-Tabellen: RLS aktiv + `user_id = auth.uid()` oder Club-Membership-Check
- `audit_logs`: kein User-INSERT — nur service_role
- `newsletter_send_logs`: service_role INSERT + Admin-SELECT via Club-Join ✅
- `match_caterings`: Admin-Club-Check ✅ (Migration 20260630)
- `newsletter_campaigns`: Admin-Club-Check ✅ (Migration 20260630)

## Fazit

Keine kritischen Lücken. Alle `createServiceClient()`-Aufrufe sind server-only und begründet dokumentiert.
PII-Mapping: `lib/dsgvo/pii-mapping.md` — Audit-Trail: `lib/db/audit-logger.ts`.
