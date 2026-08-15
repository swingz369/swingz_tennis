# Best-Practice-Analyse — SwingZ (App-weit)

> Snapshot vom 15. August 2026. Einmalige Analyse, kein lebendes Dokument.
> Methode: statische Durchsicht von Konfiguration, Auth-/Fehler-/Fetch-Schicht, API-Routen, Repositories, Hooks und Komponenten. Keine Änderungen vorgenommen.

---

## Zusammenfassung

**Verdikt: solide, reif — mit drei strukturellen Reibungspunkten, die sich lohnen.**

Die Code-Basis ist diszipliniert: strenge TypeScript-Flags, zentralisierte Auth, ein einziges Logging-Modul, type-sichere Env-Variablen, Qualitäts-Gates (Lint, `tsc --noEmit`, knip, docs:check, contrast:check, audit:ci). Die zentralen Abstraktionen (`withApiAuth`, `lib/logger`, `apiFetch`) existieren und werden großflächig genutzt.

Die drei größten Baustellen:

1. **Zwei inkompatible API-Fehler-Verträge** — `lib/api-error.ts` (strukturiert, praktisch tot) vs. `lib/api-auth.ts` (flach, überall im Einsatz).
2. **Roher `fetch()` statt `apiFetch`** in Client-Hooks/Komponenten — umgeht die zentrale CSRF-Header-Injektion.
3. **Gemischte Fehlermeldungen Deutsch/Englisch** und wieder zunehmende `as any`-Casts im eigenen Code.

---

## Was gut läuft

| Bereich              | Befund                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**             | `lib/api-auth.ts` zentralisiert Rolle + Club-Scoping + Dunning-Gate (402) + Auto-Cookie für ~190+ Routen. Kein Route-Code dupliziert die Rolle-Logik. |
| **Logging**          | `lib/logger.ts` ist einziger `console.*`-Aufrufer. Produktionscode (`app/`, `lib/`, `src/`) ist de facto frei von rohem `console.log/error/warn`.     |
| **Env**              | `lib/env.ts` validiert alle Variablen via `@t3-oss/env-nextjs` + Zod zur Build-Zeit.                                                                  |
| **TypeScript**       | `strict`, `noUnusedLocals/Parameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` aktiv; `tsc --noEmit` als Pre-Commit-Gate.                   |
| **Client-Fetch**     | `lib/api-fetch.ts` (`apiFetch`) existiert als zentrale Fetch-Hülle mit automatischer CSRF-Header-Injektion für Mutationen.                            |
| **Sicherheit**       | CSRF (`lib/csrf.ts`), Rate-Limiting (Upstash), Abo-/Dunning-Gate zentral, `pnpm.overrides` mit Sicherheits-Pins (js-yaml v4, esbuild, sharp, undici). |
| **Governance**       | Custom-ESLint-Regel, knip (Dead-Code), `docs:check`, `contrast:check`, `check:design` — Regeln werden maschinell geprüft, nicht nur beschrieben.      |
| **Client-Varianten** | Drei Supabase-Clients (server/service/browser) klar getrennt und dokumentiert; `createServiceClient()` nur Server-seitig.                             |

---

## Befunde (nach Schweregrad)

### 1. Zwei parallele, inkompatible API-Fehler-Verträge — HOCH

`lib/api-error.ts` definiert einen strukturierten Fehlervertrag:

```ts
{ error: { code: ErrorCode, message: string, details?, timestamp, requestId? } }
```

plus `ApiException`, `withErrorHandler()` und `ErrorResponses.*`-Helfer.

`lib/api-auth.ts` (die tatsächlich genutzte Schicht) liefert dagegen einen **flachen** Vertrag:

```ts
NextResponse.json({ error: 'Member access required' }, { status: 403 });
```

**Evidenz:** `from '@/lib/api-error'` hat **0 Importe** in `app/api/**/route.ts`. Nur `lib/fetch-utils.ts` importiert `isApiError`. Die strukturierte Fehler-Maschinerie (`withErrorHandler`, `ApiException`, `ErrorResponses`, `createErrorResponse`) ist damit **tote Infrastruktur** — während `withApiAuth` + `forbiddenResponse` (flach) in fast jeder Route stecken.

**Folge:** Client-Code muss beide Shapes behandeln (`err.error` mal `string`, mal Objekt); strukturierte Codes (`VALIDATION_ERROR` etc.) sind fürs Frontend nicht konsistent auswertbar.

**Empfehlung:** Einen Vertrag festlegen. Entweder `api-error.ts` zurückbauen (tote Abstraktion entfernen) oder `withAuth`/`forbiddenResponse` auf das strukturierte Format umstellen. Bei letzterem muss das Frontend (alle `err.error`-Reader) angepasst werden.

### 2. Roher `fetch()` statt `apiFetch` in Client-Code — HOCH

`apiFetch` injiziert CSRF-Header für `POST/PUT/PATCH/DELETE`. Mehrere Hooks/Komponenten umgehen es mit nacktem `fetch()`:

- `hooks/use-sessions.ts` — `POST /api/bookings`, `PATCH /api/bookings/[id]/cancel`, `PATCH /api/bookings/[id]/status`, `POST/DELETE /api/sessions/[id]/waitlist`, `POST /api/stripe/checkout`
- `hooks/use-member-groups.ts`, `hooks/use-courts.ts`, `hooks/use-schedule.ts`, `hooks/use-rsvp.ts`, `hooks/use-current-user.ts`, `hooks/use-season-plan-entries.ts`
- `components/member-profile.tsx` — `fetch('/api/user/delete', { method: 'DELETE' })`

**Folge:** Mutationen ohne CSRF-Header. Falls `proxy.ts` CSRF für diese Routen erzwingt, sind das potenzielle Lücken; mindestens ist es eine Inkonsistenz zur dokumentierten Konvention („nie nacktes `fetch()` im Client").

**Empfehlung:** Alle Client-Mutationen auf `apiFetch` umstellen (mechanisch, niedriges Risiko). Danach `apiFetch`-Nutzung per Lint/knip absichern.

### 3. Fehlermeldungen gemischt Deutsch/Englisch — MITTEL

Konvention (CLAUDE.md): „Fehlerbehandlung … deutsche Fehlermeldungen", „Englische Texte in der UI ❌".

Realität — Englische Strings in `forbiddenResponse`/`throw`:

- `'Member access required'`, `'Admin access required'`, `'Trainer or admin access required'` (dutzendfach in `app/api/**`)
- `'Insufficient permissions to create SEPA mandates'` (`app/api/sepa-mandates/route.ts`)
- `'Access denied - you can only view your own invoices'` (`app/api/invoices/[id]/pdf/route.ts`)
- `lib/api-error.ts`: `'Validation failed'`, `'An unexpected error occurred'`
- `hooks/use-sessions.ts`: `throw new Error('Failed to fetch sessions' | 'Booking failed' | 'Cancellation failed' | 'Status update failed')`

Daneben korrekt deutsch: `'Admin erforderlich'`, `'Kein Zugriff auf diesen Verein'`, `'Nur Admins können den Stundensatz ändern'`.

**Empfehlung:** Eine Sprach-Regel für **API-Fehlermeldungen** treffen (Nutzer sieht diese in Toasts). Entweder konsequent deutsch oder API-englisch + Übersetzung im Client — aber nicht gemischt. Die Client-`throw new Error('...')`-Fallbacks sind ohnehin meist unsichtbar, weil der Server-`err.error` zuerst gelesen wird.

### 4. `as any` / `: any` wieder im eigenen Produktionscode — MITTEL

Ein früherer Audit (ARCHIV 2026-07-02) zählte 2 Funde; inzwischen sind es wieder mehr:

- Repositories (eigener Code-Smell): `src/infrastructure/persistence/repositories/pricing-rule.repository.ts` (`.set(values as any)`), `hourly-rate.repository.ts`, `trainer-profile.repository.ts`, `trainer-availability.repository.ts` (`conditions: any[]`, `(error as any)?.cause`)
- `app/(protected)/layout.tsx` — mehrere `(m: any)` auf Memberships
- `lib/services/group-change.service.ts` (`supabase as any`), `lib/services/reactivation.service.ts` (`(m: any)`, `as any[]`)
- `hooks/use-club-features.ts` (`catch (err: any)`), `components/ui/loading-button.tsx` (`onError?: (error: any)`)
- `app/(protected)/trainer/planning-preferences/page.tsx` (`(data as any)`)

**Akzeptabel (bewusst/berechtigt):** `globalThis as any` in `lib/rate-limit.ts` / `lib/utils/cache.ts` (Singleton-Guard), cheerio-Typen in `lib/services/nuliga-scraper.ts` (externer HTML-Parser, untypisierte DOM-API).

**Empfehlung:** Repositories zuerst (typte `.set()`/`.values()` korrekt oder `Parameters<typeof db.update>`), Layout-Memberships typisieren, `catch (err: any)` → `unknown`. Die `any`-Schwelle ist in CONTRIBUTING.md dokumentiert (`grep ' as any'`), wird aber nicht maschinell erzwungen.

### 5. TypeScript-Strictness-Lücken — NIEDRIG

- `exactOptionalPropertyTypes: false` (Default) — optionale Props nicht exakt geprüft.
- `noUncheckedIndexedAccess` fehlt — Array-Zugriff nicht `T | undefined`.
- `tsconfig.json` **exkludiert** `services/*`, `src/infrastructure/cqrs`, `src/infrastructure/cache`, `src/domain/aggregates`, `scripts/*` vom Typpecheck. Es existiert `tsconfig.strict.json` (`npm run tsc:strict`) als separater, breiterer Check — aber der Haupt-Gate (`tsc --noEmit`) sieht diese Pfade nicht.

**Empfehlung:** `noUncheckedIndexedAccess` und `exactOptionalPropertyTypes` schrittweise aktivieren; klären, ob die Excludes noch berechtigt sind oder tote Pfade markiert werden können.

### 6. Riesen-Dateien ohne klare Grenze — NIEDRIG (Beobachtung)

- `components/unified-court-calendar.tsx` > 2.400 Zeilen
- `lib/season-planning/conflict-detector.ts` > 1.000 Zeilen
- `lib/season-planning/clustering-engine.ts` > 1.300 Zeilen

Single-Responsibility verletzt; schwer zu testen und zu reviewen.

**Empfehlung:** Bei nächster Berührung in fachliche Module zerlegen (Parser / Engine / UI getrennt).

---

## Empfohlene nächste Schritte (priorisiert)

1. **Fehler-Vertrag konsolidieren** (Befund 1) — `api-error.ts` entweder aktivieren oder entfernen. Größter struktureller Hebel.
2. **`apiFetch` überall im Client durchsetzen** (Befund 2) — mechanisch, sicherheitsrelevant.
3. **Sprach-Regel für API-Fehlermeldungen** (Befund 3) — einmal festlegen, dann Codemod.
4. **`as any` in Repositories + Layout entfernen** (Befund 4) — klein, je Datei 15–30 min.
5. **Strictness-Flags** (Befund 5) als separaten Track.

> Einordnung: Archiv-Snapshot, nicht als lebendes Dokument pflegen. Aktueller Ist-Zustand wird in `docs/OPEN_ITEMS.md` bzw. den jeweiligen lebenden Dokumenten geführt.
