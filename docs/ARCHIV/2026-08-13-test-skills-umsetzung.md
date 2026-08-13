# Test-Skills-Umsetzung — 2026-08-13

> Archiv-Snapshot, kein lebendes Dokument. Ergebnis der Session „Welche Test-Skills sind jetzt
> professionell umsetzbar?“ + Folgeauftrag „axe-core erklären + Specs konsolidieren“.
> Basis: `docs/ARCHIV/2026-08-13-test-audit.md` + der in dieser Session verifizierte Ist-Zustand.

## TL;DR

- **Vitest-Suite grün:** 89 Dateien, **1485 Tests bestanden, 10 skipped** (~123 s).
- **P0 (tote/tautologische/Platzhalter-Tests) war bereits erledigt** — vor dieser Session auf dem
  Branch umgesetzt und in `docs/ARCHIV/2026-08-13-änderungen-test-suite.md` dokumentiert. Hier nur
  verifiziert, nicht erneut angefasst.
- **Umgesetzt in dieser Session:**
  1. **Playwright-Matrix konsolidiert** — Standardlauf nur noch chromium + mobile-chrome,
     Vollmatrix über `pnpm test:e2e:full`.
  2. **Specs konsolidiert** — 32 → 21 Specs: 2 redundante Render-Specs + 9 tautologische
     `tutorial-*`-Screenshot-Specs gelöscht, 2 Role-Access-Specs gemergt.
  3. **A11y-Basis ergänzt + axe-core eingebaut** — struktureller WCAG-Smoke **plus**
     `@axe-core/playwright` auf 8 öffentlichen **und** 5 angemeldeten Kernseiten.

---

## 1. Verifikation P0 (Audit-Befunde 2.x) — bereits erledigt

| Audit-Befund                                                                                | Status auf `refactor/season-auth-helper-adoption`                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `expect(true).toBe(true)`-Platzhalter in `reminders.test.ts` + `reminder.use-cases.test.ts` | ✅ **Behoben** — beide Dateien sind jetzt echte Chain-Mock-/Fake-Tests (8 bzw. 9 Tests)     |
| Tautologische Tests (trainer-availability, clustering-engine, conflict-detector, billing)   | ✅ **Behoben** — Logik nach `lib/…` extrahiert; Tests importieren die echte Implementierung |
| `tests/infrastructure/repositories/*` (tote Tests, nie im `include`)                        | ✅ **Gelöscht**                                                                             |
| `src/__tests__/hooks/use-user-data.test.tsx` (nur Export-Existenz)                          | ✅ **Gelöscht**                                                                             |
| Doppelstruktur `tests/unit/` vs. `src/__tests__/`                                           | ✅ **Konsolidiert** — `tests/unit/` ist weg                                                 |

Der P0-Block ist damit geschlossen.

---

## 2. Playwright-Matrix konsolidiert (Audit 3.4 / P2)

| Script                | Projekte                 | Zweck                                                     |
| --------------------- | ------------------------ | --------------------------------------------------------- |
| `pnpm test:e2e`       | chromium + mobile-chrome | Standardlauf (CI-Hotpath) — **522 Tests**                 |
| `pnpm test:e2e:full`  | alle 6                   | Vollmatrix (Nightly/Weekly) — **1566 Tests**              |
| `pnpm test:e2e:audit` | chromium (audit-config)  | Produktions-QA-Audit gegen `swingz.vercel.app` (58 Tests) |
| `pnpm test:e2e:ui`    | (interaktiv)             | unverändert                                               |

Umsetzung: `package.json` (Default-Script mit `--project`-Filter) + Kommentar in
`playwright.config.ts`. Keine Spec gelöscht durch die Matrix-Änderung selbst — die
Vollmatrix bleibt über `test:e2e:full` erreichbar.

---

## 3. Specs konsolidiert (Audit 3.4, „redundante Specs“)

**32 → 20 Specs.** Begründung je Datei:

| Datei                         | Aktion                          | Begründung                                                                                                                                                          |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase2-5-pages.spec.ts`      | gelöscht                        | Routen bereits in `all-pages-render.spec.ts`; enthielt Test auf tote Route `/admin/reports` (nur `/admin/analytics` existiert)                                      |
| `admin-workflows.spec.ts`     | gelöscht                        | Render/Sidebar/Cross-Role dupliziert durch `all-pages-render` + `role-access` + `navigation-flows`                                                                  |
| `role-access-sidebar.spec.ts` | gemergt → `role-access.spec.ts` | beide prüften dieselben Nav-Items pro Rolle + dieselben Redirects; Bottom-Nav-Tests waren wortgleich                                                                |
| 9 × `tutorial-*.spec.ts`      | gelöscht                        | Screenshot-Walkthroughs mit tautologischen Assertions (`expect(warn \|\| true).toBe(true)`); Flows decken die echten Flow-Specs ab; Screenshots waren `.gitignore`t |

`tests/e2e/helpers/screenshots.ts` + `tests/e2e/screenshots/` mit entfernt (nur von den
tutorial-Specs genutzt).

**`qa-audit-full.spec.ts` entkoppelt (nicht gelöscht):** der Produktions-QA-Audit hat bereits
seine eigene `playwright.audit.config.ts` (`testMatch` nur diese Datei, baseURL Produktion,
kein webServer), aber **kein npm-Script** rief sie auf, und die Haupt-`playwright.config.ts`
zählte die 58 immer-geskippten Tests mit. Fix: `testIgnore: '**/qa-audit-full.spec.ts'` in der
Haupt-Config + neues Script `test:e2e:audit` (`QA_AUDIT=1 … --config=playwright.audit.config.ts`).
Die echte Laufzeit-Zahl sinkt damit von 628 auf 512 — ohne dass ein Audit verloren geht.

---

## 4. A11y: struktureller Smoke + axe-core

**Zwei Ebenen, zwei Specs:**

- `accessibility-smoke.spec.ts` (öffentlich, kein Login):
  1. **Strukturell** (`page.evaluate`): lang, genau eine `<h1>`, keine Heading-Sprünge, `alt`,
     zugängliche Namen, Form-Labels, `<main>`-Landmark, kein positiver `tabindex` — über
     8 öffentliche Seiten (`/`, `/login`, `/about`, `/contact`, `/impressum`, `/datenschutz`,
     `/terms`, `/trial-training`).
  2. **axe-core** auf denselben 8 Seiten.
- `accessibility-authenticated.spec.ts` (echte Logins): **axe-core** auf 5 Kernseiten
  (Member-Dashboard, Buchungen, Admin-Dashboard, Mitgliederverwaltung, Trainer-Dashboard).
  Bewusst ohne den strukturellen Smoke — dessen „genau eine `<h1>`"-Regel ist für komplexe
  App-Seiten zu streng.

`runAxe` (`tests/e2e/helpers/axe.ts`, `@axe-core/playwright@4.13.0`): ~170 Regeln
(WCAG 2.1/2.2 A+AA), gleiche Engine wie Lighthouse. Hart zählen nur `serious`+`critical`;
minor/moderate werden toleriert, um das Gate nicht an kosmetischen Befunden instabil zu
machen. Deckt damit auch Farbkontrast (1.4.3) und ARIA-Missbrauch (4.1.2) ab.
Motion (SC 2.3.3) bleibt in `prefers-reduced-motion.spec.ts`.

---

## 5. Verifikation dieser Session

| Check                                                                   | Ergebnis                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npx vitest run`                                                        | ✅ 89 Dateien, 1485 passed, 10 skipped                                                                             |
| `npx tsc --noEmit`                                                      | ✅ fehlerfrei                                                                                                      |
| `npx playwright test --list` (voll)                                     | ✅ 1566 Tests, 21 Dateien                                                                                          |
| `npx playwright test --project=chromium --project=mobile-chrome --list` | ✅ 522 Tests, inkl. 8 A11y-Smoke + 8 axe-core + 5 axe-authentifiziert (je × 2 Projekte)                            |
| `npx playwright test --list --config=playwright.audit.config.ts`        | ✅ 58 Tests, 1 Datei (qa-audit isoliert)                                                                           |
| E2E live ausgeführt                                                     | ⚠️ nicht in dieser Session (braucht laufenden Dev-Server + `.env.local`); `--list` + `tsc` bestätigen Kompilierung |

---

## 6. Offen / bewusst nicht umgesetzt

- **P1 `global-setup.ts`-DB-Guard** — wurde vom Nutzer nicht gewählt; bleibt offen
  (`docs/OPEN_ITEMS.md` P1 „`global-setup.ts` mutiert die DB aus `.env.local`“).
- **„Breite" Specs sind bewusst drei Ebenen, kein Duplikat** (geprüft, nicht gelöscht):
  `all-pages-render` (jede Route lädt + Rollen-Sperre), `admin-features-flow` (tiefe
  Arbeitsdienste/Ligen/Spieltage-Interaktionen), `qa-audit-full` (gegateter Produktions-Audit).
  Einzige Korrektur: `qa-audit-full` aus der Haupt-Suite entkoppelt (siehe §3).
