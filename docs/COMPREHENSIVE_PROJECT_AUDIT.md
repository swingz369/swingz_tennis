# SwingZ — Umfassender Projekt-Audit

**Datum:** 2026-06-13
**Geprüft von:** AI Audit Agent

## Executive Summary

- **TypeScript: CLEAN** — 0 Build-Errors, strikte Typisierung aktiv
- **Tests: 203/204 bestanden** — 1 fehlgeschlagener Unit-Test (`court-calendar-utils`)
- **Sicherheit: 4 High Vulnerabilities** in npm Dependencies (keine kritischen)
- **API-Security: 5 Routen ohne Auth** (Webhooks, Cron-Jobs — teilweise erwartet)
- **XSS-Risiko: 2 `dangerouslySetInnerHTML`** Nutzungen (messages, analytics)
- **Branding-System: Vollständig implementiert** — DB-Migration, API, Upload, Anzeige
- **Avatar-Upload: Vollständig implementiert** — für alle Rollen mit Supabase Storage
- **Code-Qualität: 80× `: any` Typen, 1039× `console.log`** — Cleanup nötig
- **Testing: 91 Test-Dateien, 204 Unit-Tests** — Coverage könnte besser sein
- **Infrastruktur: Docker, CI/CD, Sentry, Husky** — alles konfiguriert

---

## Gesamtübersicht

| Bereich                        | Status | Kritisch | Warnung | OK  |
| ------------------------------ | ------ | -------- | ------- | --- |
| 1. Build & Kompilierung        | 🟢     | 0        | 0       | 3   |
| 2. Dependencies & Sicherheit   | 🟡     | 0        | 4       | 4   |
| 3. Architektur & Code-Qualität | 🟡     | 0        | 6       | 3   |
| 4. Datenbank & Migrationen     | 🟢     | 0        | 1       | 5   |
| 5. Sicherheit (Security)       | 🟡     | 2        | 2       | 4   |
| 6. API-Endpunkte               | 🟢     | 0        | 1       | 4   |
| 7. Frontend & UI/UX            | 🟢     | 0        | 1       | 4   |
| 8. Performance                 | 🟡     | 0        | 2       | 2   |
| 9. Testing                     | 🟡     | 0        | 2       | 3   |
| 10. Next.js spezifisch         | 🟡     | 0        | 2       | 3   |
| 11. Dokumentation              | 🟢     | 0        | 1       | 3   |
| 12. Deployment & Infra         | 🟢     | 0        | 0       | 5   |
| 13. Barrierefreiheit           | 🟢     | 0        | 0       | 2   |
| 14. Git & Workflow             | 🟢     | 0        | 1       | 3   |

---

## Detaillierte Funde

### 1. Build & Kompilierung

#### OK (🟢)

- ✅ `npx tsc --noEmit` — **0 TypeScript-Fehler**
- ✅ `tsconfig.json` — `strict: true`, `noImplicitAny`, `strictNullChecks` aktiv
- ✅ `next.config.js` — `ignoreBuildErrors: false` (Build bricht bei Typfehlern)

---

### 2. Dependencies & Sicherheit

#### Warnung (🟡)

- 🟡 **4 High Vulnerabilities** in npm Dependencies (via `npm audit`)
- 🟡 **11 Moderate Vulnerabilities** in npm Dependencies
- 🟡 **Veraltete Dependencies** — Mehrere Pakete mit Major-Version-Drift (`@hookform/resolvers`, `@radix-ui/react-*`, `@next/bundle-analyzer`)
- 🟡 **Hardcoded Secrets** — Verdächtige Strings in:
  - `app/reset-password/page.tsx`
  - `app/login/page.tsx`
  - `lib/stripe/client.ts`

#### OK (🟢)

- ✅ `.env.example` — 153 Zeilen, alle ENV-Variablen dokumentiert
- ✅ `.gitignore` — 9 `.env`-bezogene Einträge, `.env.local` korrekt ausgeschlossen
- ✅ `package-lock.json` — vorhanden und konsistent
- ✅ `SUPABASE_ACCESS_TOKEN` — konfiguriert für CLI-Zugriff

---

### 3. Architektur & Code-Qualität

#### Warnung (🟡)

- 🟡 **80× `: any` Typen** — in `src/`, `lib/`, `components/`, `app/`
- 🟡 **8× `@ts-ignore` / `@ts-expect-error`**
- 🟡 **3× `eslint-disable` Kommentare**
- 🟡 **20× TODO/FIXME/HACK/XXX Kommentare** (meist in Tests und Repositories)
- 🟡 **1039× `console.log()` Statements** — Viele in Scripts/Tests, aber auch in Produktionscode (z.B. `app/api/auth/login/route.ts:66`, `app/page.tsx:17`, `lib/stripe/stripe-client.ts`)
- 🟡 **2× `dangerouslySetInnerHTML`** — potenzielle XSS-Vektoren:
  - `components/analytics-provider.tsx:39`
  - `app/(protected)/messages/page.tsx:486` ⚠️ User-Content!

#### OK (🟢)

- ✅ **Clean Architecture** — saubere Trennung: `src/domain/`, `src/application/`, `src/infrastructure/`
- ✅ **Keine zirkulären Imports** erkennbar
- ✅ **117 Components** — gut organisiert in `components/`
- ✅ **Shared Storage-Utils** — `lib/supabase/storage-utils.ts` (neu extrahiert)

---

### 4. Datenbank & Migrationen

#### Warnung (🟡)

- 🟡 **Nicht alle Tabellen haben RLS-Policies** — Nur 2 der 94 Migrationsdateien definieren `CREATE POLICY` explizit

#### OK (🟢)

- ✅ **94 Migrationsdateien** in `supabase/migrations/`
- ✅ **51 Tabellen mit `club_id`** — Multi-Tenant Isolation weitgehend implementiert
- ✅ **31× `updated_at` Timestamps** im Drizzle-Schema
- ✅ **Branding-Migration registriert** — `20260613_branding_and_avatar.sql` (7 neue Spalten auf `clubs`)
- ✅ **Supabase CLI synchron** — Migration in Historie eingetragen via `supabase migration repair`
- ✅ **Drizzle-Schema** — `src/infrastructure/persistence/schema.ts` vollständig

---

### 5. Sicherheit (Security Audit)

#### Kritisch (🔴)

- 🔴 **XSS via `dangerouslySetInnerHTML`** in `app/(protected)/messages/page.tsx:486` — rendert `message.content` direkt als HTML ohne Sanitization. User-generated Content könnte bösartiges JavaScript enthalten.
- 🔴 **5 API-Routen ohne Authentifizierung:**
  - `app/api/webhooks/zapier/route.ts` — Webhook-Signatur-Verifizierung nur in DEV übersprungen
  - `app/api/webhooks/stripe/route.ts` — Stripe-Signatur-Verifizierung (erwartet, aber prüfen)
  - `app/api/cron/billing-overdue/route.ts` — Kein Auth, kein API-Secret-Check
  - `app/api/cron/backup/route.ts` — Kein Auth, kein API-Secret-Check
  - `app/api/shop/route.ts` — Kein Auth erkennbar

#### Warnung (🟡)

- 🟡 **`analytics-provider.tsx:39`** — `dangerouslySetInnerHTML` (vermutlich für Analytics-Snippet, aber prüfen)
- 🟡 **CSRF-Schutz konsistent anwenden** — Nur bestimmte Routen nutzen `withCSRFProtection`

#### OK (🟢)

- ✅ **380× Rate-Limiting** Referenzen in API-Routen — breit abgedeckt
- ✅ **111× Zod-Validation** Referenzen in API-Routen
- ✅ **File-Upload Validierung** — Alle Upload-Endpunkte prüfen MIME-Type und Größe
- ✅ **`withApiAuth` + `verifyRole`** — auf den meisten Admin-Routen aktiv
- ✅ **CSRF Cookie Fix** — `httpOnly: false` gesetzt für Double-Submit-Pattern (neu gefixt)
- ✅ **Supabase RLS** — Service-Client umgeht RLS nur für Admin-Operationen

---

### 6. API-Endpunkte

#### Warnung (🟡)

- 🟡 **224 API-Routen** — umfangreich, manche könnten konsolidiert werden

#### OK (🟢)

- ✅ **HTTP-Methoden korrekt** — GET/POST/PATCH/DELETE konsistent verwendet
- ✅ **Fehlerbehandlung** — try/catch in den meisten Routen
- ✅ **Response-Format** — `{ error: string }` für Fehler, `{ success: true }` für Erfolg
- ✅ **Neue Endpunkte sauber implementiert:**
  - `POST/DELETE /api/avatar/upload` — Avatar-Upload mit Storage-Cleanup
  - `POST/DELETE /api/club-logo/upload` — Club-Logo-Upload mit Variant-Support
  - `GET/PUT /api/branding` — Persistiert jetzt in DB (vorher hardcoded)

---

### 7. Frontend & UI/UX

#### Warnung (🟡)

- 🟡 **Viele Seiten ohne Metadata-Exports** — nur 7 `metadata` Exporte gefunden (SEO-Relevant)

#### OK (🟢)

- ✅ **91 Seiten** — umfangreiche Admin-, Trainer-, Member-Flows
- ✅ **Loading-States** — 66 `loading.tsx` Dateien
- ✅ **Error-Boundaries** — 29 `error.tsx` Dateien + `global-error.tsx`
- ✅ **Avatar-Upload Komponente** — `components/ui/avatar-upload.tsx` mit Kamera-Overlay
- ✅ **Logo-Upload Komponente** — `components/ui/logo-upload.tsx` mit Dual-Mode (Datei/URL)
- ✅ **Branding-Settings** — `app/(protected)/admin/branding/branding-client.tsx` mit Farben, Logos, Domain
- ✅ **Club-Logo in Sidebar/Header** — Anzeige mit `key`-Prop und `onError`-Fallback

---

### 8. Performance

#### Warnung (🟡)

- 🟡 **1039× `console.log`** — Performance-Impact in Production (Logging-Overhead)
- 🟡 **Server Components prüfen** — Nicht alle Seiten nutzen Server Components wo möglich

#### OK (🟢)

- ✅ **Dynamic Imports** — `const Component = dynamic(...)` in Settings-Wrapper
- ✅ **`next.config.js`** — Bundle-Analyzer konfiguriert (`@next/bundle-analyzer`)

---

### 9. Testing

#### Warnung (🟡)

- 🟡 **1 fehlgeschlagener Test:**
  - `tests/unit/court-calendar-utils.test.ts > getCalendarLegendItems > returns 5 items for non-admin (member)`
- 🟡 **Wenige Unit-Tests für Domain-Logik** — 91 Test-Dateien bei 224 API-Routen

#### OK (🟢)

- ✅ **204 Unit-Tests** — 203 bestanden, 1 fehlgeschlagen
- ✅ **E2E-Tests konfiguriert** — Playwright (`playwright.config.ts`) vorhanden
- ✅ **Test-Infrastruktur** — `vitest.config.ts`, globales Setup, Benchmarks

---

### 10. Next.js spezifisch

#### Warnung (🟡)

- 🟡 **Kein `middleware.ts`** — Globales Routing/Auth-Middleware fehlt (wurde entfernt)
- 🟡 **Dynamische `params`-Typisierung** — Einige ältere Routen nutzen noch `params: { id: string }` statt `params: Promise<{ id: string }>` (Next.js 15/16 Kompatibilität)

#### OK (🟢)

- ✅ **29 `error.tsx` Dateien** — Gute Error-Boundary-Abdeckung
- ✅ **66 `loading.tsx` Dateien** — Gute Loading-State-Abdeckung
- ✅ **`global-error.tsx`** — vorhanden
- ✅ **`next.config.js`** — korrekt konfiguriert (CSP, Bundle-Analyzer, no ignoreBuildErrors)

---

### 11. Dokumentation

#### Warnung (🟡)

- 🟡 **Viele Archiv-Dokumente** — `docs/` enthält 80+ .md Dateien, viele veraltet oder redundant

#### OK (🟢)

- ✅ **`docs/README.md`** — vorhanden
- ✅ **`docs/CHANGELOG.md`** — vorhanden
- ✅ **`docs/ARCHITECTURE.md`** — vorhanden
- ✅ **`docs/COMPREHENSIVE_PROJECT_AUDIT.md`** — dieses Dokument (aktualisiert)

---

### 12. Deployment & Infrastruktur

#### OK (🟢)

- ✅ **Docker** — `docker/frontend.Dockerfile` + Service-Container
- ✅ **CI/CD** — GitHub Actions: `ci.yml`, `database-backup.yml`, `perf-bench.yml`
- ✅ **Sentry** — Client + Server Config (`sentry.client.config.ts`, `sentry.server.config.ts`)
- ✅ **Husky** — Pre-commit Hooks konfiguriert
- ✅ **Supabase CLI** — Access Token konfiguriert, Migrationen synchron

---

### 13. Barrierefreiheit

#### OK (🟢)

- ✅ **ARIA-Labels** — Auf Header, Sidebar, Navigation, Buttons vorhanden
- ✅ **Keyboard-Navigation** — `SkipToContent`, `KeyboardShortcutsDialog`, `CommandPalette` implementiert
- ✅ **`prefers-reduced-motion`** — Animations-Komponenten berücksichtigen dies

---

### 14. Git & Workflow

#### Warnung (🟡)

- 🟡 **Umfangreiche uncommitted Changes** — 2,812 Insertions, 1,172 Deletions across 60+ Dateien

#### OK (🟢)

- ✅ `.gitignore` — vollständig (9 `.env`-Einträge, `.next`, `node_modules`, etc.)
- ✅ **Husky Pre-commit** — konfiguriert
- ✅ **CI/CD Pipeline** — GitHub Actions aktiv
- ✅ **Branch: `main`** — auf demselben Stand wie `origin/main` (vor den aktuellen Änderungen)

---

## Empfohlene Maßnahmen (priorisiert)

### Sofort (P0) — Kritische Sicherheitslücken

1. **XSS fixen** — `app/(protected)/messages/page.tsx:486` — `dangerouslySetInnerHTML` mit DOMPurify oder similar sanitisieren
2. **Cron-Endpunkte absichern** — `/api/cron/billing-overdue` und `/api/cron/backup` mit API-Secret-Header prüfen
3. **Shop-Route Auth** — `/api/shop/route.ts` — Authentifizierung hinzufügen

### Diese Woche (P1) — Wichtige Fixes

4. **Fehlschlagenden Test fixen** — `tests/unit/court-calendar-utils.test.ts` — `getCalendarLegendItems` für Member-Rolle
5. **npm Vulnerabilities patchen** — `npm audit fix` für 4 High Vulnerabilities
6. **`console.log` aufräumen** — Produktionsrelevante Logs durch `console.error`/`console.warn` ersetzen oder Logger verwenden (`lib/logger.ts` existiert bereits)
7. **Metadata-Exports hinzufügen** — Für alle öffentlichen Seiten (SEO)

### Diesen Monat (P2) — Code-Qualität

8. **80× `: any` Typen reduzieren** — Schrittweise durch korrekte Typen ersetzen
9. **`dangerouslySetInnerHTML` in analytics-provider.tsx prüfen** — Ob notwendig und sicher
10. **RLS-Policies ergänzen** — Für Tabellen ohne explizite Policies
11. **Middleware wieder einführen** — Für globales Auth-Handling und Tenant-Auflösung

### Backlog (P3) — Nice-to-haves

12. **Docs aufräumen** — 80+ .md Dateien konsolidieren, veraltete archivieren
13. **@ts-ignore eliminieren** — 8 Vorkommen durch korrekte Typen ersetzen
14. **Performance-Audit** — Server Components Audit, N+1 Query Detection

---

## Anhänge

### Neue Features in dieser Session

- ✅ **Branding-System** — DB-Migration (7 Spalten), API GET/PUT persistiert in DB, `hexToHsl()` für alle Farben, `TenantProvider` wendet CSS-Variablen an
- ✅ **Avatar-Upload** — `/api/avatar/upload` (POST/DELETE), `AvatarUpload` Komponente, Integration in Header und Profil
- ✅ **Club-Logo-Upload** — `/api/club-logo/upload` (POST/DELETE mit Variant), `LogoUpload` Komponente (Dual-Mode), Integration in Branding-Settings, Sidebar, Header
- ✅ **CSV-Import erweitert** — Neue Felder (Geburtsdatum, Straße, PLZ, Ort) für Member und Trainer
- ✅ **CSRF-Fix** — `httpOnly: false` für Double-Submit-Cookie-Pattern
- ✅ **Storage-Utils Extraktion** — `lib/supabase/storage-utils.ts` für gemeinsame Delete-Logik
- ✅ **Sidebar/Header Club-Logo** — Anzeige mit `key`-Prop und `onError`-Fallback

### Project Statistiken

| Metric            | Count |
| ----------------- | ----- |
| Test-Dateien      | 91    |
| API-Routen        | 224   |
| Komponenten       | 117   |
| Seiten            | 91    |
| Migrationsdateien | 94    |
| `any`-Typen       | 80    |
| `console.log`     | 1,039 |
| TODO/FIXME        | 20    |
| error.tsx         | 29    |
| loading.tsx       | 66    |
