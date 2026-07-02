# Testing-Strategie — Vitest, Playwright, E2E

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

**Aktueller Stand** (geschätzt): ~46 Test-Dateien. Coverage unklar (`--coverage` wirft `ERR_LOAD_URL`-Error in CODEBUFF-Audit).

## 🎯 Was teste ich WO?

| Schicht          | Test-Typ    | Datei-Pattern                                  | Ziel                                |
| ---------------- | ----------- | ---------------------------------------------- | ----------------------------------- |
| Pure Functions   | Unit        | `src/__tests__/**/*.test.ts`                   | Edge-Cases, Pure Logic              |
| Domain Entities  | Unit        | `src/__tests__/domain/**`                      | Validation, Status-Machine          |
| Use-Cases        | Unit        | `src/__tests__/application/use-cases/**`       | Business-Logik                      |
| Repositories     | Integration | `src/__tests__/infrastructure/repositories/**` | DB-Queries, RLS-Bypass, Joins       |
| API Routes       | Integration | `src/__tests__/api/**`                         | Auth + Validation + Response-Shape  |
| React Components | Unit (RTL)  | `src/__tests__/components/**`                  | Rendering, Interactions             |
| **Pages**        | E2E         | `e2e/**.test.ts`                               | User-Flow (Login → Aktion → Result) |

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
// e2e/design-preview-buttons.test.ts
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

# E2E-Tests laufen
npm run test:e2e
# oder explizit:
npx playwright test --ui

# Test-User siehe CLAUDE.md
# admin@tc-rheinland.de / Trainer-Account / Member-Account
```

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
