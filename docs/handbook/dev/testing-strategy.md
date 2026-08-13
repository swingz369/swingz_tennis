# Testing-Strategie — Vitest, Playwright, E2E

> Zuletzt verifiziert: 13. August 2026
> Welcher Test wo, Coverage-Ziele, Multi-Tenant-Tests. Quelle: `vitest.config.ts`, `playwright.config.ts`, `package.json`.

## 🧪 Test-Pyramide

```
           ┌──────────────────────────┐
          ╱         E2E (Playwright)     ╲       ← 20-30 Tests (User Journeys)
         ╱     ─────────────────────────     ╲
        ╱         Integration (Vitest)       ╲     ← 100-200 Tests (Routes + Repos)
       ╱     ───────────────────────────────     ╲
      ╱           Unit (Vitest)                    ╲   ← 300-500 Tests (Logic + Entities)
     ╱──────────────────────────────────────────────────╲
```

**Aktueller Stand** (verifiziert 13.08.2026): 89 Vitest-Dateien, 1485 Tests bestanden, 10 skipped.
Coverage unklar (`--coverage` wirft `ERR_LOAD_URL`-Error).

## 🎯 Was teste ich WO?

| Schicht          | Test-Typ    | Datei-Pattern                                  | Ziel                                |
| ---------------- | ----------- | ---------------------------------------------- | ----------------------------------- |
| Pure Functions   | Unit        | `src/__tests__/**/*.test.ts`                   | Edge-Cases, Pure Logic              |
| Domain Entities  | Unit        | `src/__tests__/domain/**`                      | Validation, Status-Machine          |
| Use-Cases        | Unit        | `src/__tests__/application/use-cases/**`       | Business-Logik                      |
| Repositories     | Integration | `src/__tests__/infrastructure/repositories/**` | DB-Queries, RLS-Bypass, Joins       |
| API Routes       | Integration | `src/__tests__/api/**`                         | Auth + Validation + Response-Shape  |
| React Components | Unit (RTL)  | `src/__tests__/components/**`                  | Rendering, Interactions             |
| **Pages**        | E2E         | `tests/browser/**.test.ts`                     | User-Flow (Login → Aktion → Result) |

## ✅ Multi-Tenant-Tests (P0-Finding 15)

**Vorbedingung** für Marktreife: diese Tests MÜSSEN grün sein.

Pattern:

```ts
// src/__tests__/api/club-isolation.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/sessions/route';

describe('Multi-Tenant-Isolation für /api/sessions', () => {
  it('Trainer aus Club A kann KEINE Sessions aus Club B lesen', async () => {
    const req = new Request('http://localhost/api/sessions?clubId=club-b');
    const res = await POST(
      req as any,
      { params: Promise.resolve({}) },
      mockAuth({ role: 'trainer', clubId: 'club-a' })
    );
    expect(res.status).toBe(403);
  });

  it('Admin aus Club A kann Sessions nur im eigenen Club sehen', async () => {
    const req = new Request('http://localhost/api/sessions?clubId=club-a');
    const res = await GET(
      req as any,
      { params: Promise.resolve({}) },
      mockAuth({ role: 'admin', clubId: 'club-a' })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions.every((s) => s.club_id === 'club-a')).toBe(true);
  });
});
```

## 🎨 Visuelle Tests (Playwright Snapshots)

Theme-konform testen: Light + Dark, mit unterschiedlichen Viewports (mobile, tablet, desktop).

```ts
// tests/browser/design-preview-buttons.test.ts
import { test, expect } from '@playwright/test';

test('Button hover-state', async ({ page }) => {
  await page.goto('/admin/members');
  await page.getByRole('button', { name: 'Mitglied einladen' }).hover();
  await expect(page).toHaveScreenshot('button-hover.png', { maxDiffPixelRatio: 0.02 });
});
```

## 🔧 Vitest-Mocks für Supabase

```ts
// src/__tests__/helpers/mockSupabase.ts
export function mockSupabaseClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      // …
    })),
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'test' } } })) },
    rpc: vi.fn(),
  };
}
```

Oder komplexer Mock für Repos:

```ts
// src/__tests__/helpers/mockBookingRepository.ts
export class MockBookingRepository implements IBookingRepository {
  bookings: Booking[] = [];
  async findById(id: string) { return this.bookings.find(b => b.id === id) ?? null; }
  async createNew(...) { const b = { id: '...', ...input }; this.bookings.push(b); return b; }
  // …
}
```

## 📊 Coverage-Goals

| Schicht                | Ziel                              |
| ---------------------- | --------------------------------- |
| Domain (Entities, VOs) | ≥90%                              |
| Use-Cases              | ≥80%                              |
| Repositories           | ≥60% (Mock-reiche Tests OK)       |
| API Routes             | ≥70% (alle Permission-Pfade)      |
| Components             | ≥50% (Critical Interactions only) |
| Pages (E2E)            | Alle Core User-Flows              |

Coverage-Report: `npm run test -- --coverage` (aktuelle Tooling-Bug: `--coverage` Reporter lädt nicht → P1-Finding).

## 🏃 E2E-Lokale-Entwicklung

```bash
# Browser installieren (einmalig)
npx playwright install

# E2E-Tests laufen (Standard: chromium + mobile-chrome — 522 Tests)
npm run test:e2e
# Vollmatrix (alle 6 Browser-Projekte — 1566 Tests):
npm run test:e2e:full
# Produktions-QA-Audit (gegatet, gegen swingz.vercel.app):
npm run test:e2e:audit
# oder interaktiv:
npx playwright test --ui

# Test-User siehe CLAUDE.md
# admin@tc-rheinland.de / Trainer-Account / Member-Account
```

Die Playwright-Matrix ist seit 13.08.2026 zweistufig: der CI-Hotpath läuft nur chromium +
mobile-chrome; firefox/webkit/mobile-safari/ipad gehören in den `test:e2e:full`-Lauf
(Audit-Befund 3.4, siehe `docs/ARCHIV/2026-08-13-test-skills-umsetzung.md`).

**Konsolidierung (13.08.2026):** 32 → 21 Specs (20 nach Löschung + `accessibility-authenticated.spec.ts` neu).

- `phase2-5-pages.spec.ts` (Routen bereits in `all-pages-render.spec.ts` + tote
  `/admin/reports`-Route) und `admin-workflows.spec.ts` (Render/Sidebar/Cross-Role
  dupliziert) gelöscht.
- `role-access-sidebar.spec.ts` in `role-access.spec.ts` gemergt.
- 9 `tutorial-*.spec.ts` gelöscht: Screenshot-Walkthroughs mit tautologischen
  Assertions (`expect(warn || true).toBe(true)`); die Flows decken die echten
  Flow-Specs (`billing-flow`, `members-crud-flow`, `all-pages-render` …) ab.
- `qa-audit-full.spec.ts` aus der Haupt-Suite entkoppelt (`testIgnore` in
  `playwright.config.ts`): es ist ein Produktions-QA-Runbook mit eigener
  `playwright.audit.config.ts`, kein CI-Regressionstest — die 58 immer-geskippten
  Tests verfälschten sonst die Laufzeit-Zahl. Neuer Einstiegspunkt `test:e2e:audit`.
  Ergebnis: 522 Default-Tests (statt 734).

Die verbleibenden drei „breiten" Specs sind bewusst **drei Ebenen, kein Duplikat**:
`all-pages-render` (jede Route lädt + Rollen-Sperre), `admin-features-flow` (tiefe
Arbeitsdienste/Ligen/Spieltage-Interaktionen) und `qa-audit-full` (gegateter
Produktions-Audit mit Seed-Daten).

## ♿ A11y-Tests

Drei komplementäre Ebenen:

1. **Statisch (Lint):** `eslint` mit `eslint-plugin-jsx-a11y` (Regeln sind `warn`, siehe
   `eslint.config.mjs`). `npm run lint:a11y` filtert die Treffer.
2. **E2E strukturell (DOM):** `tests/e2e/accessibility-smoke.spec.ts` — WCAG-2.2-AA-Smoke über 8
   öffentliche Seiten (lang, Heading-Hierarchie, `alt`, zugängliche Namen, Form-Labels,
   `main`-Landmark, kein positiver `tabindex`).
3. **E2E tief (axe-core):** `@axe-core/playwright` (`tests/e2e/helpers/axe.ts`) — dieselbe
   Regel-Engine wie Lighthouse (~170 Regeln, WCAG 2.1/2.2 A+AA). Läuft (a) auf denselben 8
   öffentlichen Seiten (`accessibility-smoke.spec.ts`) und (b) auf 5 angemeldeten Kernseiten
   (`accessibility-authenticated.spec.ts`: Member-Dashboard, Buchungen, Admin-Dashboard,
   Mitgliederverwaltung, Trainer-Dashboard). Hart zählen nur `serious`+`critical`, minor/moderate
   werden toleriert. Damit sind auch Farbkontrast (1.4.3) und ARIA-Missbrauch (4.1.2) maschinell
   geprüft. Motion (SC 2.3.3) bleibt in `prefers-reduced-motion.spec.ts`.

## 🧹 Test-Patterns

### TestProviders

```tsx
// src/__tests__/test-utils.tsx
import { TestProviders } from '@/src/__tests__/test-utils';

it('renders without crashing', () => {
  render(
    <TestProviders>
      <MyComponent />
    </TestProviders>
  );
});
```

### Mock-Dates

```ts
import { vi } from 'vitest';
vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
```

### Mock MatchMedia (für Dark-Mode-Tests)

```ts
window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  // …
}));
```

## ⚠️ Bekannte Test-Lücken

| Problem                                       | Severity | Finding |
| --------------------------------------------- | -------- | ------- |
| Multi-Tenant-Tests rot                        | 🔴 P0    | P0-15   |
| `--coverage` Reporter lädt nicht              | 🟡 P1    | –       |
| Admin-Onboarding praktisch ungetestet         | 🟡 P2    | –       |
| Stripe-Webhook-Idempotenz nur Pseudo-getestet | 🟡 P2    | –       |

## 📚 Verwandte Kapitel

- [`api-conventions.md`](./api-conventions.md) — Test-Pattern für Routes
- [`auth-rbac.md`](./auth-rbac.md) — Mock-Auth für Tests
- [`ci-cd-audit.md`](./../../TODO) — CI-Gates (P1-Finding)
