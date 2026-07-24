# 🔍 SwingZ — Umfassender Projekt-Audit-Bericht

**Datum:** 9. Juli 2026  
**Branch:** `feat/sprint-3-plus-a11y-theme-fixes`  
**Projekt:** SwingZ — Tennis Club Management SaaS  
**Stack:** Next.js 16 · Supabase · Stripe · Vercel · shadcn/ui

---

## Executive Summary

| Kategorie         | Score    | Status                                                        |
| ----------------- | -------- | ------------------------------------------------------------- |
| **Build**         | ✅ 10/10 | TypeScript kompiliert fehlerfrei (`tsc --noEmit` = 0 Errors)  |
| **Security**      | ⚠️ 6/10  | Fundorte ohne Auth, `dangerouslySetInnerHTML`, `as any` Casts |
| **Code Quality**  | ⚠️ 5/10  | 333× `as any`, 182× `console.*`, 157× TODO/FIXME              |
| **Dependencies**  | ⚠️ 7/10  | 2 Medium-Vulnerabilities (esbuild, postcss)                   |
| **Architecture**  | ✅ 8/10  | Saubere DDD-Struktur, Auth-Patterns konsistent                |
| **Observability** | ✅ 8/10  | Sentry konfiguriert, strukturiertes Logging, ENV-Validation   |
| **DevOps**        | ⚠️ 6/10  | 8 stale worktrees, Rate-Limiting abschaltbar                  |

**Gesamtbewertung: 6.5/10** — Solide Architektur, aber technische Schulden in Code-Qualität und Security-Hygiene.

---

## 1. 🏗️ Build & TypeScript

### ✅ Ergebnis: FEHLERFREI

```
npx tsc --noEmit → 0 Errors
```

- Keine fehlenden Module
- Keine Typpfehler
- TypeScript Strict Mode aktiv (`tsconfig.strict.json` vorhanden)

### ✅ Architektur-Struktur

```
app/                          # Next.js 16 App Router
  (protected)/                # Geschützte Routen nach Rolle
    owner/ superadmin/ admin/ trainer/ member/
  (public)/                   # Probetraining (kein Login)
  api/                        # ~255 API-Routes
  landing/                    # Marketing Landing Page
components/                   # React Components (shared + layout)
lib/                          # Utilities, Services, Helpers
src/
  application/                # Use Cases (Business Logic)
  domain/                     # Domain Entities & Types
  infrastructure/             # DB Repos, External Services, Drizzle Schema
```

**Bewertung:** Architektur folgt Clean Architecture / DDD-Patterns konsequent. Klare Trennung zwischen Application, Domain und Infrastructure Layer.

---

## 2. 🔒 Security-Audit

### 🔴 KRITISCH: API-Routes ohne Auth-Check

**20 API-Routes** haben **keine sichtbare Authentifizierung** (`withApiAuth`, `verifyRole`, `requireAuth`, `requireAdminClub`):

| Route                                         | Risiko                 | Bewertung                           |
| --------------------------------------------- | ---------------------- | ----------------------------------- |
| `app/api/webhooks/stripe/route.ts`            | Stripe-Signatur prüfen | ⚠️ Prüfen ob Stripe-Signatur reicht |
| `app/api/webhooks/booking-completed/route.ts` | Interner Webhook       | ⚠️ Secret-Bearer nötig?             |
| `app/api/webhooks/zapier/route.ts`            | Externer Webhook       | 🔴 **Kein Auth-Schutz sichtbar**    |
| `app/api/cron/backup/route.ts`                | Cron-Job               | ⚠️ CRON_SECRET vorhanden?           |
| `app/api/cron/billing-overdue/route.ts`       | Cron-Job               | ⚠️ CRON_SECRET vorhanden?           |
| `app/api/cron/check-absences/route.ts`        | Cron-Job               | ⚠️ CRON_SECRET vorhanden?           |
| `app/api/cron/nuliga-sync/route.ts`           | Cron-Job               | ⚠️ CRON_SECRET vorhanden?           |
| `app/api/cron/reactivation/route.ts`          | Cron-Job               | ⚠️ CRON_SECRET vorhanden?           |
| `app/api/debug/auth/route.ts`                 | Debug-Endpoint         | 🔴 **Nicht in Produktion erlaubt**  |
| `app/api/public/stats/route.ts`               | Public Stats           | ✅ Bewusst öffentlich               |
| `app/api/public/club/[id]/route.ts`           | Public Club Info       | ✅ Bewusst öffentlich               |
| `app/api/public/trial-training/route.ts`      | Probetraining          | ✅ Bewusst öffentlich               |
| `app/api/contact/route.ts`                    | Kontaktformular        | ⚠️ Rate-Limit nötig                 |
| `app/api/csrf-token/route.ts`                 | CSRF-Token             | ✅ Bewusst öffentlich               |
| `app/api/messages/[id]/read/route.ts`         | Nachricht lesen        | 🔴 **Sollte Auth haben**            |
| `app/api/push/vapid-key/route.ts`             | VAPID Key              | ✅ Bewusst öffentlich               |

### 🔴 KRITISCH: `dangerouslySetInnerHTML` ohne DOMPurify

3 Dateien verwenden `dangerouslySetInnerHTML`:

| Datei                                                | DOMPurify? | Risiko                                    |
| ---------------------------------------------------- | ---------- | ----------------------------------------- |
| `app/layout.tsx`                                     | ❌ Nein    | 🔴 XSS-Risiko wenn Daten injiziert werden |
| `components/analytics-provider.tsx`                  | ❌ Nein    | ⚠️ GA-Snippet — vertrauenswürdig, aber    |
| `app/(protected)/admin/(gated)/newsletters/page.tsx` | ❌ Nein    | 🔴 **User-Content wird direkt gerendert** |

> **Hinweis:** `app/(protected)/messages/page.tsx` verwendet korrekt `DOMPurify.sanitize()` — das sollte als Referenz dienen.

### ⚠️ Rate-Limiting kann global deaktiviert werden

```typescript
// lib/rate-limit.ts
if (process.env.DISABLE_RATE_LIMITING === 'true') { ... }
```

- **778 Referenzen** auf Rate-Limiting in API-Routes (bei 307 Routes)
- ⚠️ `DISABLE_RATE_LIMITING=true` umgeht **alle** Limits
- ⚠️ Muss in Produktion **niemals** gesetzt sein

### ⚠️ Stripe-Webhook: `as any` Casts

```typescript
// app/api/webhooks/stripe/route.ts
const { data: isNew } = await (supabase as any)
const items = (order.items as any[]) || [];
.from('shop_products' as any)
```

- Stripe-Webhook-Handler hat mehrere `as any` Casts
- Typ-Sicherheit geht verloren → erhöhtes Risiko für Laufzeitfehler

### ✅ Auth-Pattern: Konsistent & Solide

- `withApiAuth()` + `verifyRole()` in `lib/api-auth.ts`
- `requireAuth()` für Server Components in `lib/auth.ts`
- `requireAdminClub()` für Admin-Kontext in `lib/admin-context.ts`
- 5-Rollen-Hierarchie korrekt implementiert: `owner > superadmin > admin > trainer > member`
- `middleware.ts` korrekt nicht vorhanden (stattdessen `proxy.ts`)

### ✅ ENV-Validation

- `lib/env.ts` verwendet `@t3-oss/env-nextjs` + Zod
- Kritische Keys sind required, optionale Keys korrekt optional
- Keine hardcoded Passwörter in Produktionscode (nur in Seed-Scripts)

---

## 3. 🧹 Code-Qualität

### 🔴 `as any` Type Casts: **333 Vorkommen**

**Top-Problemzonen:**

| Bereich                    | Anzahl | Bemerkung                      |
| -------------------------- | ------ | ------------------------------ |
| `app/api/webhooks/stripe/` | ~10    | Stripe-Typen unvollständig     |
| `app/api/coupons/`         | ~2     | Supabase-Typen fehlen          |
| `app/api/email-campaigns/` | ~3     | `createServiceClient() as any` |
| `app/api/training-groups/` | ~5     | Supabase-Query-Typen           |
| `app/api/sessions/`        | ~5     | Fehlende Spalten-Typen         |

**Empfehlung:** Supabase-Typen neu generieren (`supabase gen types typescript --local`) und die `as any`-Casts systematisch durch korrekte Typen ersetzen.

### 🔴 `console.log/error/warn` in Produktion: **182 Vorkommen**

- Projektkonvention sagt: `createLogger()` aus `@/lib/logger` verwenden
- Trotzdem 182 `console.*`-Aufrufe in Produktionscode
- Hauptsächlich in `error.tsx`-Dateien und API-Routes

### ⚠️ TODO/FIXME/HACK Marker: **157 Vorkommen**

Viele davon sind legitim (Repository-Patterns, `mapToDomain`), aber einige sind echte offene Aufgaben:

```typescript
// types/supabase.ts:2026
// TODO(@owner: backend, regenerate via `supabase gen types typescript --local`):

// lib/billing/dunning.service.ts:30
// TODO: perspektivisch pro Verein in system_settings konfigurierbar.
```

### ⚠️ Stale Agent-Worktrees: **8 Verzeichnisse**

`.claude/worktrees/` enthält 8 alte Worktree-Verzeichnisse, die aufgeräumt werden sollten.

### ⚠️ Dead Code Marker: **3 Vorkommen**

3× `@deprecated` oder `@codebuff delete` Marker gefunden.

---

## 4. 📦 Dependencies

### ⚠️ Bekannte Schwachstellen: 2 Medium

| Paket     | Schwachstelle                            | Severity   | Fix                   |
| --------- | ---------------------------------------- | ---------- | --------------------- |
| `esbuild` | CORS unauthorized access (GHSA-67mh)     | **Medium** | Upgrade auf `≥0.25.0` |
| `postcss` | XSS via `</style>` tags (CVE-2026-41305) | **Medium** | Upgrade auf `≥8.5.10` |
| `esbuild` | Additional advisory (GHSA-g7r4)          | **Medium** | Upgrade auf `≥0.25.0` |

**Aktion:** `pnpm update esbuild postcss` ausführen.

---

## 5. 🏛️ Architektur & Patterns

### ✅ Stärken

| Pattern                | Status | Details                                                        |
| ---------------------- | ------ | -------------------------------------------------------------- |
| **Clean Architecture** | ✅     | Saubere Trennung: `application/`, `domain/`, `infrastructure/` |
| **Repository Pattern** | ✅     | Alle Repositories mit `mapToDomain()` — konsistent             |
| **Auth Middleware**    | ✅     | `proxy.ts` statt `middleware.ts` (Next.js 16 kompatibel)       |
| **3 Supabase Clients** | ✅     | Server/Service/Browser korrekt getrennt                        |
| **Error Handling**     | ✅     | Deutsche Fehlermeldungen, kein Stack-Trace in UI               |
| **Logging**            | ✅     | `createLogger()` — strukturiert, keine `console.*` (Soll)      |
| **Caching**            | ✅     | `lib/server-cache.ts` + `lib/cache.ts` sauber getrennt         |
| **Sentry**             | ✅     | Client + Server konfiguriert, Sampling korrekt                 |
| **ENV Validation**     | ✅     | Zod-basierte Validierung in `lib/env.ts`                       |
| **CSRF Protection**    | ✅     | Über `proxy.ts` implementiert                                  |
| **RLS Policies**       | ✅     | 102 Migrationen, RLS-Audit in `docs/supabase-rls-audit.md`     |

### ⚠️ Schwachstellen

| Bereich                    | Problem                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Supabase-Typen**         | `types/supabase.ts` hat TODO zur Regenerierung                                    |
| **Service Client Overuse** | Viele API-Routes nutzen `createServiceClient()` (bypasses RLS) statt User-Kontext |
| **Stale Worktrees**        | 8 `.claude/worktrees/` Verzeichnisse aufzuräumen                                  |

---

## 6. 🔭 Observability & Monitoring

### ✅ Sentry

- `sentry.client.config.ts` — Browser-Error-Tracking
- `sentry.server.config.ts` — Server-Error-Tracking
- `tracesSampleRate`: 1.0 (Dev) / 0.1 (Prod) — korrekt
- `profilesSampleRate`: 1.0 (Dev) / 0.1 (Prod) — korrekt

### ✅ Strukturiertes Logging

- `createLogger()` aus `@/lib/logger` — Projekt-Standard
- Konsistente Nutzung erwartet (182 Verstöße siehe oben)

### ✅ Health Check

- `app/api/health/route.ts` vorhanden

---

## 7. 📊 Zusammenfassung & Priorisierte Maßnahmen

### 🔴 P0 — Sofort (kritisch)

1. **`dangerouslySetInnerHTML` in `newsletters/page.tsx`** — XSS-Risiko bei User-Content. DOMPurify hinzufügen.
2. **`app/api/messages/[id]/read/route.ts`** — Fehlende Auth. `withApiAuth()` ergänzen.
3. **`app/api/webhooks/zapier/route.ts`** — Prüfen ob Auth oder Secret-Bearer nötig.
4. **`app/api/debug/auth/route.ts`** — In Produktion deaktivieren oder entfernen.

### 🟡 P1 — Diese Woche (wichtig)

5. **Dependencies updaten** — `pnpm update esbuild postcss`
6. **`dangerouslySetInnerHTML` in `app/layout.tsx`** — DOMPurify hinzufügen oder auf sicheres Pattern umstellen
7. **Supabase-Typen regenerieren** — `supabase gen types typescript --local`
8. **Cron-Routes absichern** — CRON_SECRET-Validierung in allen `app/api/cron/*/route.ts` prüfen

### 🟢 P2 — Nächste Sprint (Verbesserung)

9. **`as any` Casts reduzieren** — 333 Vorkommen systematisch durch korrekte Typen ersetzen
10. **`console.*` entfernen** — 182 Vorkommen durch `createLogger()` ersetzen
11. **Stale Worktrees aufräumen** — 8 `.claude/worktrees/` Verzeichnisse löschen
12. **TODO/FIXME Review** — 157 Marker sichten und schließen oder als Issues tracken
13. **`DISABLE_RATE_LIMITING` Guard** — Sicherstellen dass ENV in Produktion nicht gesetzt ist

---

## 8. 📈 Metriken

| Metrik                     | Wert                                 |
| -------------------------- | ------------------------------------ |
| TypeScript Errors          | **0**                                |
| API-Routes gesamt          | **~307**                             |
| API-Routes ohne Auth       | **20** (davon 4 🔴 kritisch)         |
| `as any` Casts             | **333**                              |
| `console.*` in Prod        | **182**                              |
| TODO/FIXME Marker          | **157**                              |
| `dangerouslySetInnerHTML`  | **3** (davon 1 🔴 ohne Sanitization) |
| Dependency Vulnerabilities | **2 Medium**                         |
| Stale Worktrees            | **8**                                |
| Auth-geschützte Routes     | **~287** (93%)                       |
| Rate-Limited Routes        | **~778 Referenzen**                  |
| DB-Migrationen             | **102**                              |
| Sentry Monitoring          | ✅ Konfiguriert                      |
| ENV Validation             | ✅ Zod-basiert                       |

---

_Generiert am 9. Juli 2026 von Buffy (Codebuff) — Automatisierter Projekt-Audit_
