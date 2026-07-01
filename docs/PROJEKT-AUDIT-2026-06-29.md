# SwingZ — Projekt-Audit

**Datum:** 2026-06-29
**Branch:** main
**Umfang:** Auth, Supabase-Clients, Rollen, Business-Rules, Stripe, Logger, UI-Sprache, Dead Code, Migrations, Konventionen
**Methode:** Statische Greps + Tooling (knip). Tiefere Logik nur stichprobenartig verifiziert.

---

## ⚠️ Vorbemerkung — Build-Gate NICHT verifizierbar

`node_modules` ist **leer (0 Pakete installiert)**. `npx tsc` griff auf das falsche
(fremde) `tsc`-Paket zu, `npm run typecheck` schlägt mit `tsc: not found` fehl.

➡️ **`npx tsc --noEmit` konnte nicht ausgeführt werden.** Vor jedem echten Build-Gate
muss zuerst `npm install` (bzw. `pnpm install` — es liegen beide Lockfiles vor:
`package-lock.json` UND `pnpm-lock.yaml`) laufen. Das doppelte Lockfile ist selbst
ein Konsistenz-Problem (siehe HINWEIS H3).

---

## 🔴 BLOCKER

### ~~B1~~ ✅ GEFIXT — Ungeschützte Service-Client-Route (RLS-Bypass ohne Auth)
**Datei:** `app/api/members/[id]/schedule-preferences/route.ts`
**Gefixt:** 2026-06-29

Die Route nutzte `createServiceClient()` (umgeht RLS) ohne jeglichen Auth-Check.
**Fix:** `withApiAuth()` + `canAccess()`-Guard (eigener User / admin global / trainer des Clubs)
für GET und PUT vorgeschaltet. 401 bei fehlender Auth, 403 bei fehlender Berechtigung.

---

## 🟠 WICHTIG

### W1 — 224 × `console.*` statt `createLogger`
CLAUDE.md verbietet `console.log/error/warn` projektweit. 224 Treffer in
`app/`, `components/`, `lib/`, `src/`, `hooks/`.
Beispiele:
- `app/(protected)/superadmin/tenants/page.tsx:44,83`
- `app/(protected)/search/page.tsx:48`
- `app/auth/callback/route.ts:34`
- `app/(protected)/select-admin-club/select-admin-club-client.tsx:51,55`

Die `error.tsx`-Boundaries (`app/global-error.tsx`, `app/landing/error.tsx` …) sind
Client-Error-Boundaries — dort ist `console.error` teils vertretbar, aber die Regel
kennt keine Ausnahme. Mindestens die Server-/API-Treffer auf `createLogger` umstellen.

### W2 — Auth-Helper-Inkonsistenz (`withAuth` vs. kanonisch `withApiAuth`)
245 Routes nutzen das kanonische `withApiAuth`, **5 nutzen das abweichende `withAuth(`**:
- `app/api/coupons/route.ts`
- `app/api/trainer-absences/route.ts`
- `app/api/admin/memberships/[id]/route.ts`
- `app/api/admin/tenants/route.ts`
- `app/api/gamification/route.ts`

Zusätzlich importiert `app/api/admin/tenants/route.ts` Supabase aus dem abweichenden
Pfad `@/infrastructure/external/supabase/client` statt der dokumentierten Clients.
Diese Routes sind **nicht ungeschützt** (Auth ist vorhanden), aber die Abweichung
erschwert Audits und sollte vereinheitlicht werden.

### W3 — Manuelle Auth statt zentralem Guard (Audit-Blindstellen)
Mehrere Routes prüfen Auth „von Hand" (`getUser()` + 401) statt über `withApiAuth`,
z.B. `app/api/family-accounts/route.ts`, `app/api/qr-checkin/route.ts`,
`app/api/backup/route.ts` (eigener `requireAdmin()`-Helper). Funktioniert, aber jede
Variante muss einzeln korrekt sein — genau so entstand B1. Empfehlung: auf
`withApiAuth`/`requireAdminClub` konsolidieren.

---

## 🟡 HINWEIS

### H1 — 190 ungenutzte Dateien (knip)
Darunter viele `components/ui/*` (dashboard-card, data-table, entity-card,
export-button, loading-spinner, mini-chart, skeleton-dashboard, status-badge),
mehrere `e2e/*`-Tests, `hooks/use-toast.ts`, `lib/server-cache.ts`,
`lib/jobs/runner.ts`, `lib/pdf/invoice-pdf.tsx`, `lib/notifications/sms.ts` u.a.
Vor dem Löschen prüfen, ob etwas dynamisch/lazy referenziert wird (knip erkennt das
nicht immer). Aufräum-Kandidat, kein Funktionsrisiko.

### H2 — 7 × nacktes `fetch()` in Client Components
Statt `apiFetch` aus `@/lib/api-fetch`:
`app/register/page.tsx`, `app/join/[clubId]/page.tsx`, `app/landing/page.tsx`,
`app/(protected)/shop/success/page.tsx`, `components/reports-dashboard.tsx`,
`components/customizable-dashboard.tsx`, `components/gamification-dashboard.tsx`.

### H3 — Doppeltes Lockfile
`package-lock.json` **und** `pnpm-lock.yaml` im Repo. Auf einen Paketmanager
festlegen und das andere Lockfile entfernen, sonst driften die Installs.

### H4 — Direkte `stripe`-Importe (nur Typen)
`lib/services/stripe-subscription-quantity-sync.service.ts:13` und
`app/api/webhooks/stripe/route.ts:3` importieren `import type Stripe from 'stripe'`.
Type-only, zur Laufzeit harmlos, aber formal gegen die „kein direkter stripe-Import"-Regel.
Niedrige Priorität.

### H5 — Migrations (121) vs. Drizzle-Schema (88 `pgTable`)
Nicht jede Migration legt eine Tabelle an (Policies, ALTERs, Funktionen), die Differenz
ist also nicht zwingend ein Fehler. Eine echte Abgleichprüfung Schema↔DB braucht
installierte Deps + DB-Zugriff und wurde **nicht** durchgeführt.

---

## ✅ Sauber

- **Service-Client in Client Components:** 0 Verstöße.
- **Englische UI-Texte:** nur 1 Treffer (`components/ui/dialog.tsx` `sr-only "Close"`,
  vendored shadcn, Screenreader-Text) — Deutsch-Konvention faktisch eingehalten.

---

## Nicht durchgeführt / offen
- `npx tsc --noEmit` (Deps fehlen) — **muss nachgeholt werden**, höchste Priorität.
- `npx vitest run` / `npx playwright test` (Deps fehlen).
- RLS-Policy-Review auf DB-Ebene (braucht Supabase-Zugriff).
- Vollständige Business-Rules-Verifikation der Membership-Writes (nur Routen-Liste
  erhoben, Logik nicht einzeln geprüft).

## Empfohlene Reihenfolge
1. `npm install` (oder pnpm) → `npx tsc --noEmit` grün bekommen.
2. **B1 fixen** (Auth auf schedule-preferences).
3. W3/W2 konsolidieren (Auth-Helper vereinheitlichen) — verhindert künftige B1-Fälle.
4. W1 (Logger) schrittweise, beginnend bei Server/API.
5. Aufräumen (H1/H2/H3) wenn Zeit.
