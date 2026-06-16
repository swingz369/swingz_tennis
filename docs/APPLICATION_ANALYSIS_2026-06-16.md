# SwingZ App — Komplette Analyse (16. Juni 2026)

> Automatisierte Gesamtanalyse der Anwendung auf Basis von TypeScript, ESLint, Tests, Build, Security, Dependencies und Code-Qualität.

---

## 📊 Executive Summary

| Bereich           | Status                | Details                                               |
| ----------------- | --------------------- | ----------------------------------------------------- |
| **Build**         | ❌ Fehlgeschlagen     | 17× TS2352 (SupabaseClient PostgrestVersion-Mismatch) |
| **ESLint**        | ✅ CLEAN              | 0 Errors, 0 Warnings                                  |
| **Tests**         | ⚠️ 21 fehlgeschlagen  | 1.109 bestanden, 21 fehlgeschlagen, 13 übersprungen   |
| **Dependencies**  | ⚠️ 28 Vulnerabilities | 10 High, 17 Moderate, 0 Critical                      |
| **Console-Logs**  | ⚠️ 573 Statements     | 7× log, 514× error, 52× warn in Production-Code       |
| **Dead Code**     | ✅ Kein TODO/FIXME    | 0 offene TODO/FIXME/HACK-Kommentare                   |
| **Fehlende Deps** | ⚠️ 2 fehlend          | `playwright`, `dompurify`                             |

---

## 1. TypeScript-Analyse

### Fehlertyp: TS2352 — SupabaseClient PostgrestVersion-Mismatch (17 Errors)

Alle 17 Fehler sind identisch: `SupabaseClient<Database, "public", Database["public"]>` hat `PostgrestVersion = "12"`, wird aber als Typ mit `PostgrestVersion = "14.5"` erwartet. Ursache: Inkonsistenz zwischen `@supabase/supabase-js` und den generierten Supabase-Types.

**Betroffene Dateien:**

| Datei                                  | Zeilen                        |
| -------------------------------------- | ----------------------------- |
| `app/api/admin/bookings/route.ts`      | 102, 383                      |
| `app/api/admin/shop/orders/route.ts`   | 21                            |
| `app/api/sessions/route.ts`            | 38, 253                       |
| `lib/services/billing.service.ts`      | 11, 45, 71, 92, 161, 168, 179 |
| `lib/services/group-change.service.ts` | 13, 22, 31, 52, 60            |

**Zusätzlich:** `.next/types/validator.ts` referenziert gelöschte Debug-Routen (`admin-debug`, `auth-test`, `rsvp-snapshot`) — Cache-Problem, `rm -rf .next` behebt dies.

**Fix-Empfehlung:**

1. `supabase gen types typescript` neu ausführen, um aktuelle DB-Types zu generieren
2. Oder `@supabase/supabase-js` auf die Version aktualisieren, die PostgREST v14.5 unterstützt
3. `.next/` Verzeichnis löschen nach Debug-Route-Entfernung

---

## 2. ESLint-Analyse

```
✅ 0 Errors, 0 Warnings
```

Die gesamte Codebase ist ESLint-konform. Keine Aktion nötig.

---

## 3. Test-Ergebnisse

### Gesamtübersicht

| Metric         | Wert             |
| -------------- | ---------------- |
| Bestanden      | 1.109            |
| Fehlgeschlagen | 21               |
| Übersprungen   | 13               |
| Test-Dateien   | 6 fehlgeschlagen |

### Fehlgeschlagene Tests

#### 3a. Unit Tests: `src/__tests__/api/generate-invoices.test.ts`

| Test                                            | Problem                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "returns 400 when no club context"              | Erwartet `'clubId required'`, bekommt `'No club context'`                                                                    |
| "returns No active members found"               | Erwartet `'No active members found'`, bekommt `'Keine Gebühr konfiguriert — Rechnungen für Juni 2026 wurden NICHT erstellt'` |
| "logs when all members are skipped"             | `console.log` wurde nie aufgerufen (0 Calls erwartet)                                                                        |
| "returns 500 on fee_configurations query error" | Erwartet Status 500, bekommt 200                                                                                             |

**Ursache:** Die API-Logik wurde geändert (Meldungen auf Deutsch umgestellt, Fehlerbehandlung angepasst), aber die Tests nicht aktualisiert.

#### 3b. E2E Tests (Playwright) — 5 Dateien fehlgeschlagen

| Test-Datei                                 | Problem                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `e2e/trainer-availability.test.ts`         | `net::ERR_CONNECTION_REFUSED` — Dev-Server nicht erreichbar |
| `e2e/season-planning-backtracking.test.ts` | `net::ERR_CONNECTION_REFUSED`                               |
| `e2e/member-lifecycle.test.ts`             | `net::ERR_CONNECTION_REFUSED`                               |
| `e2e/admin-season-wizard.test.ts`          | `net::ERR_CONNECTION_REFUSED`                               |

**Ursache:** E2E-Tests erfordern einen laufenden Dev-Server (`npm run dev`). Die Tests konnten sich nicht zu `http://localhost:3000` verbinden. Die nachfolgenden `TypeError`-Fehler (z.B. `reading 'agent'`) sind Kettenfehler.

---

## 4. Build-Analyse

### Status: ❌ Fehlgeschlagen

**Fehler:**

```
./app/api/admin/bookings/route.ts (102:21)
Type error: Conversion of type 'SupabaseClient<Database, "public", ...>'
to type 'SupabaseClient<Database, "public", ...>' may be a mistake.
PostgrestVersion '12' is not comparable to '14.5'.
```

**Zusätzliche Warnung:**

```
The "middleware" file convention is deprecated. Please use "proxy" instead.
```

→ Next.js 16.2.9 deprecated `middleware.ts` zugunsten von `proxy.ts`.

**Fix:** Supabase-Types regenerieren oder Supabase-Client-Paket aktualisieren.

---

## 5. Dependencies-Analyse

### Übersicht

| Metric          | Wert |
| --------------- | ---- |
| Dependencies    | 67   |
| DevDependencies | 32   |
| Gesamt          | 99   |

### Sicherheitslücken (npm audit)

| Schweregrad | Anzahl |
| ----------- | ------ |
| Critical    | 0      |
| High        | 10     |
| Moderate    | 17     |
| Low         | 1      |
| **Gesamt**  | **28** |

**Empfehlung:** `npm audit fix` ausführen für automatisch behebbare Vulnerabilities.

### Fehlende Dependencies

| Package      | Referenziert in                     |
| ------------ | ----------------------------------- |
| `playwright` | `e2e/helpers/auth.ts`               |
| `dompurify`  | `app/(protected)/messages/page.tsx` |

**Empfehlung:**

- `playwright` als DevDependency installieren (nur für E2E-Tests)
- `dompurify` als Dependency installieren (XSS-Schutz für Messages)

### Ungenutzte Dependencies

| Package                  | Typ           |
| ------------------------ | ------------- |
| `@types/express`         | dependency    |
| `critters`               | dependency    |
| `autoprefixer`           | devDependency |
| `eslint-plugin-jsx-a11y` | devDependency |
| `lint-staged`            | devDependency |
| `postcss`                | devDependency |

**Empfehlung:** Entfernen wenn nicht anderweitig verwendet.

---

## 6. Code-Qualität: Console-Statements

### Gesamt: 573 Statements in Production-Code

| Typ             | Anzahl | Bewertung                      |
| --------------- | ------ | ------------------------------ |
| `console.log`   | 7      | ⚠️ Sollte entfernt werden      |
| `console.error` | 514    | ✅ Akzeptabel (Error-Handling) |
| `console.warn`  | 52     | ⚠️ Prüfen ob nötig             |

### Top 10 Dateien mit meisten Console-Statements

| Anzahl | Datei                                                                       |
| ------ | --------------------------------------------------------------------------- |
| 18     | `src/infrastructure/persistence/repositories/hourly-rate.repository.ts`     |
| 17     | `src/infrastructure/persistence/repositories/trainer-profile.repository.ts` |
| 9      | `lib/billing/season-billing.service.ts`                                     |
| 9      | `app/api/webhooks/stripe/route.ts`                                          |
| 8      | `app/api/webhooks/zapier/route.ts`                                          |
| 7      | `src/infrastructure/persistence/repositories/sepa-mandate.repository.ts`    |
| 7      | `app/api/trainer-profiles/route.ts`                                         |
| 6      | `src/application/use-cases/booking.use-cases.ts`                            |
| 6      | `lib/season-planning/dry-run.service.ts`                                    |
| 6      | `app/api/members/[id]/route.ts`                                             |

**Empfehlung:** `console.log` (7 Stück) entfernen. `console.error`/`console.warn` durch projektweites `createLogger()` ersetzen (ist in vielen Dateien bereits der Fall).

---

## 7. TODO/FIXME/HACK-Kommentare

```
✅ 0 offene TODO/FIXME/HACK/XXX-Kommentare im Production-Code
```

---

## 8. Projektstruktur

### API-Routen (42 Endpunkte)

```
app/api/admin/bookings/route.ts
app/api/admin/memberships/[id]/route.ts
app/api/admin/shop/orders/route.ts
app/api/admin/shop/products/route.ts
app/api/attendance-records/route.ts
app/api/audit-logs/route.ts
app/api/bookings/route.ts
app/api/clubs/route.ts
app/api/clubs/[id]/route.ts
app/api/court-types/route.ts
app/api/courts/route.ts
app/api/health/route.ts
app/api/members/[id]/route.ts
app/api/open-matches/route.ts
app/api/public/trial-training/route.ts
app/api/seasons/route.ts
app/api/seasons/[id]/plan-grid/route.ts
app/api/sessions/route.ts
app/api/trainer-profiles/route.ts
app/api/trainer/availability/route.ts
app/api/trainer/book/route.ts
app/api/trainer/me/route.ts
app/api/trial-trainings/route.ts
app/api/trial-trainings/[id]/route.ts
app/api/trial-trainings/[id]/convert/route.ts
app/api/trial-trainings/[id]/reminder/route.ts
app/api/trial-trainings/stats/route.ts
app/api/webhooks/stripe/route.ts
app/api/webhooks/zapier/route.ts
... (weitere)
```

### Page-Routen

| Bereich                | Anzahl | Bemerkung                                        |
| ---------------------- | ------ | ------------------------------------------------ |
| `(protected)/admin/`   | ~25    | Admin-Dashboard, Vereine, Saisons, Trainer, etc. |
| `(protected)/member/`  | ~8     | Mitglieder-Bereich                               |
| `(protected)/trainer/` | 2      | Trainer-Dashboard + Profil                       |
| `(public)/`            | ~5     | Login, Onboarding, Trial-Booking                 |
| Root                   | ~3     | Landing, Datenschutz, NotFound                   |

### Error Handling

| Component               | Vorhanden                                  |
| ----------------------- | ------------------------------------------ |
| `error.tsx` (Root)      | ✅ `app/error.tsx`, `app/global-error.tsx` |
| `error.tsx` (Protected) | ✅ `app/(protected)/error.tsx`             |
| `not-found.tsx`         | ✅ `app/not-found.tsx`                     |
| Loading-Skeletons       | ✅ 15+ `loading.tsx` Dateien               |

---

## 9. Architektur-Beobachtungen

### ✅ Positiv

- **Clean Architecture:** Saubere Trennung in `src/domain/`, `src/application/`, `src/infrastructure/`
- **Hybrid Server Components:** Mehrere Pages auf SC umgestellt (member, trainer, trial-training, clubs)
- **Consistent Auth Pattern:** `requireAuth()` für Pages, `withApiAuth()` für API-Routen
- **Keine TODOs:** Codebase ist frei von offenen TODO-Kommentaren
- **ESLint-konform:** 0 Verstöße
- **Umfassendes Test-Suite:** 1.109+ bestandene Tests
- **Loading Skeletons:** Alle Server Component Pages haben `loading.tsx`

### ⚠️ Verbesserungspotenzial

- **TypeScript Build bricht:** SupabaseClient-Typ-Inkonsistenz blockiert `next build`
- **21 fehlgeschlagene Tests:** 4 Unit (veraltete Erwartungen) + 17 E2E (kein Dev-Server)
- **28 npm Vulnerabilities:** 10 High-Priority
- **573 Console-Statements:** 7× `console.log` sollten entfernt werden
- **2 fehlende Dependencies:** `playwright`, `dompurify`
- **6 ungenutzte Dependencies:** Können entfernt werden
- **Middleware Deprecation:** `middleware.ts` → `proxy.ts` (Next.js 16)

---

## 10. Priorisierte Action Items

### 🔴 Kritisch (Build-Blocker)

1. **Supabase-Types regenerieren** — Behebt alle 17 TS2352-Fehler und ermöglicht `next build`
2. **`.next/` Cache löschen** — Entfernt Referenzen auf gelöschte Debug-Routen

### 🟠 Hoch (Security & Dependencies)

3. **`npm audit fix` ausführen** — Behebt automatisch behebbare Vulnerabilities
4. **`dompurify` installieren** — XSS-Schutz für Messages-Feature
5. **`playwright` als DevDependency installieren** — Ermöglicht E2E-Tests

### 🟡 Mittel (Code-Qualität)

6. **Fehlgeschlagene Unit-Tests fixen** — 4 Tests in `generate-invoices.test.ts` an neue API-Meldungen anpassen
7. **`console.log` entfernen** — 7 Statements in Production-Code
8. **Ungenutzte Dependencies entfernen** — 6 Packages (`@types/express`, `critters`, `autoprefixer`, etc.)

### 🟢 Niedrig (Verbesserungen)

9. **Middleware → Proxy Migration** — Next.js 16 Deprecation
10. **Console-Statements vereinheitlichen** — `console.error`/`console.warn` durch `createLogger()` ersetzen
11. **Fehlgeschlagene E2E-Tests** — Dev-Server-Setup für CI/CD prüfen

---

## Anhang: Test-Statistiken

```
Test Files:  6 failed | ~50 passed (1.109 tests)
     Tests:  21 failed | 1.109 passed | 13 skipped
  Duration:  ~45s
```

## Anhang: Dependency-Übersicht

```
Dependencies:      67
DevDependencies:   32
Vulnerabilities:   28 (0 critical, 10 high, 17 moderate, 1 low)
Missing:            2 (playwright, dompurify)
Unused:             6 (@types/express, critters, autoprefixer,
                      eslint-plugin-jsx-a11y, lint-staged, postcss)
```
