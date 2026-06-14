# SwingZ – Projektstatus (Live-Inspektion: 9. Juni 2026)

> **Diese Datei ist die einzige aktuelle Quelle der Wahrheit.**
> Alle anderen Doku-Dateien wurden nach [`ARCHIV/`](./ARCHIV/) verschoben (90 Dateien) und sind veraltet.

---

## Zahlen (live gemessen am 9.6.2026)

| Metrik                            | Wert                       |
| --------------------------------- | -------------------------- |
| **TypeScript/TSX Dateien gesamt** | 899                        |
| **API-Routes (`route.ts`)**       | 205                        |
| **Pages (`page.tsx`)**            | 79                         |
| **Components**                    | 98                         |
| **Hooks**                         | 10                         |
| **Lib-Files**                     | 84                         |
| **Domain-Layer**                  | 55 Dateien                 |
| **Application-Layer**             | 38 Dateien                 |
| **Infrastructure-Layer**          | 33 Dateien                 |
| **Test-Dateien**                  | 71                         |
| **`loading.tsx`**                 | 65 (sehr gute UX-Coverage) |
| **`error.tsx`**                   | 28                         |
| **Commits ahead of origin/main**  | 30                         |

## Qualität

| Check                              | Status                               |
| ---------------------------------- | ------------------------------------ |
| `tsc --noEmit`                     | ✅ **PASS** (0 Fehler)               |
| `tsconfig strict`                  | ✅ **true**                          |
| `noImplicitAny`                    | ✅ **true**                          |
| `any`-Typen im Code                | 🟡 314 (primär Drizzle-Update-Logic) |
| `eslint`                           | ✅ Konfiguriert                      |
| Security Headers (HSTS, CSP, etc.) | ✅ Aktiv in `next.config.js`         |
| Env-Validierung (t3-env)           | ✅ Aktiv in `lib/env.ts`             |
| Sentry Monitoring                  | ✅ DSN-basiert konfiguriert          |

## Production (https://swingz.vercel.app)

| URL-Gruppe                | Status                                |
| ------------------------- | ------------------------------------- |
| Öffentliche Seiten (10)   | ✅ Alle 200                           |
| Geschützte Seiten (22)    | ✅ Korrekter 307-Redirect zu `/login` |
| PWA-Manifest              | ✅ Vorhanden                          |
| Service Worker (`/sw.js`) | ✅ Vorhanden                          |

### Bekanntes Issue

- **`/api/health` redirected (307)** — Route-Handler gibt 200/503 zurück, vermutlich **Vercel Deployment Protection**. Fix: In Vercel-Dashboard für `/api/health` deaktivieren oder auf Self-Hosted Uptime-Monitoring umstellen.

## Architektur

- **Clean Architecture** mit 4 Schichten (`domain`, `application`, `infrastructure`, `presentation`)
- **Drizzle-Schema** konsolidiert in `src/infrastructure/persistence/schema.ts`
- **Multi-Tenant** via `club_id` + RLS auf allen Tabellen
- **Tenant-Hierarchie**: Superadmin (Tennisschulen-Chef) → Vereine (Admins) → Mitglieder/Trainer. Superadmin ist keinem Club zugeordnet, sondern überblickt alle Vereine und kann via Club-Switcher in einzelne Vereine wechseln.
- **Auth**: `lib/api-auth.ts` (API) + `lib/auth/guards.ts` (Pages) — keine `middleware.ts`
- **DI**: tsyringe 4.10 installiert

## CI/CD (neu hinzugefügt 9.6.2026)

- `.github/workflows/ci.yml` — Lint + Typecheck + Tests + Build + Lighthouse
- `.lighthouserc.json` — Performance ≥0.7, A11y ≥0.9, Best Practices ≥0.85, SEO ≥0.85, PWA ≥0.6

## Veraltete Doku

Alle 90 historischen Reports/Audits in [`docs/ARCHIV/`](./ARCHIV/). Diese wurden **am 9.6.2026 archiviert** da sie substanziell veraltet und teilweise faktisch falsch waren (z.B. behaupteten sie `strict: false` obwohl es `true` ist, oder 98 any-Typen obwohl es 314 sind).
