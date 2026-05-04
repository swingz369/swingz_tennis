# Changelog

Alle Änderungen am SwingZ-Projekt werden in dieser Datei dokumentiert.

---

## [Unreleased]

### Added

- Email Value Object (`src/domain/value-objects/email.ts`) mit RFC-5322 Validierung
- Upstash Redis Rate Limiting Support (`lib/rate-limit.ts` mit fallback)
- Vercel KV/Upstash Integration dokumentiert in `.env.example`

### Changed

- **TypeScript** auf 5.9.3 aktualisiert (LTS)
- **Sentry Sampling**: `tracesSampleRate` 1.0 → 0.1, `profilesSampleRate` 1.0 → 0.2 (Kostenreduktion)
- **Database Query**: `countByClubAndDateRange` nutzt jetzt PostgreSQL FILTER (4 Queries → 1)
- **Code Splitting**: Neue cache group `large-libs` für große Dependencies (Supabase, OpenAI, Zod, etc.)
- **Image Caching**: `minimumCacheTTL` von 60s auf 1 Jahr erhöht für statische Assets
- **ESLint**: `no-unused-vars` auf `warn`, `no-console` deaktiviert (DevEx)
- **CI/CD**: Workflows vereinheitlicht (Node 20), E2E-Tests in PRs aktiviert, Codecov Integration hinzugefügt
- **Testing**: `@vitest/coverage-v8` installiert, Coverage Reports funktionsfähig

### Fixed

- Email Validierung fehlte (wurde als String behandelt)
- Rate Limiting war in-memory nur (SPOF, nicht skalierbar)
- Doppelte CI/CD Workflows entfernt (`ci-cd.yml` gelöscht)
- Drizzle Kit Config auf v0.31+ migriert (plain object)
- TypeScript Errors in `booking.use-cases.ts` (Decorator-Syntax)

### Removed

- Veralteter `lib/rate-limit-kv.ts` (deprecated Vercel KV)
- Seed-Skripte aus TypeScript-Excludes (`tsconfig.json`)

### Security

- CSP Headers bereits optimiert (X-Frame-Options: DENY, HSTS, etc.)

### Performance

- Bundle-Chunking verbessert (separate groups für UI, React, Analytics, Large Libs)
- DB Query-Optimierung spart 3/4 der Roundtrips bei Analytics

### DevOps

- Einheitlicher CI Workflow (`.github/workflows/ci.yml`) mit:
  - Lint & Format Check
  - TypeScript Check
  - Unit Tests mit Codecov
  - Build
  - E2E Tests (bei PRs)
  - Security Audit (npm audit, depcheck)
- Node.js 20 in allen Jobs
- Artefakt-Upload für Build und Playwright-Reports

---

## [2026-05-04] - Production-Ready Optimizations

### Added

- Sentry Performance Monitoring (initial)
- Audit Logging System
- Multi-Club Architecture

### Changed

- Next.js App Router Migration abgeschlossen
- Supabase SSR Client Integration

---

## [2026-05-01] - Initial Release

- MVP mit Booking, Member, Session Management
- Clean Architecture Implementierung
- DDD Patterns

---

**Hinweise:**

- commits folgen [Conventional Commits](https://www.conventionalcommits.org/)
- Breaking Changes sind mit `⚠️` markiert im Commit-Log
