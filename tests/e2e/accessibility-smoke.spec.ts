import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { runAxe } from './helpers/axe';

/**
 * WCAG-2.2-AA-Smoke über die öffentlichen Seiten — zwei komplementäre Ebenen:
 *
 *   1. Strukturell (page.evaluate): die maschinell triviat erfassbaren AA-Grundregeln
 *      (lang, Heading-Hierarchie, alt, zugängliche Namen, Form-Labels, main-Landmark,
 *      kein positiver tabindex). Günstig, läuft in Millisekunden, liefert gezielte Meldungen.
 *   2. axe-core (helpers/axe.ts): die tiefe Regel-Engine (~170 Regeln, gleiche Engine
 *      wie Lighthouse). Liest den Accessibility-Tree zur Laufzeit — Farbkontrast (1.4.3),
 *      ARIA-Missbrauch (4.1.2), doppelte IDs, Heading-Sprünge. Hart zählen nur
 *      serious+critical; minor/moderate werden toleriert.
 *
 * Motion (SC 2.3.3) ist separat in `prefers-reduced-motion.spec.ts` abgedeckt.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/** Öffentliche Kernseiten, die ohne Login und ohne Seed-Daten renderbar sind. */
const PUBLIC_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Landing' },
  { path: '/login', label: 'Login' },
  { path: '/about', label: 'Über uns' },
  { path: '/contact', label: 'Kontakt' },
  { path: '/impressum', label: 'Impressum' },
  { path: '/datenschutz', label: 'Datenschutz' },
  { path: '/terms', label: 'AGB' },
  { path: '/trial-training', label: 'Probetraining' },
];

interface A11yViolation {
  rule: string;
  target: string;
}

/** Sammelt alle maschinell erfassbaren AA-Verstöße einer Seite. */
async function collectA11yViolations(page: Page): Promise<A11yViolation[]> {
  return page.evaluate(() => {
    const violations: { rule: string; target: string }[] = [];
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
        el.className && typeof el.className === 'string'
          ? `.${el.className.toString().trim().slice(0, 40)}`
          : ''
      }`;

    // 1. lang-Attribut
    const html = document.documentElement;
    if (!html.getAttribute('lang')) {
      violations.push({ rule: 'html-lang', target: '<html>' });
    }

    // 2. Heading-Hierarchie: genau eine h1, keine übersprungene Ebene
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const h1Count = document.querySelectorAll('h1').length;
    if (h1Count !== 1) {
      violations.push({ rule: 'single-h1', target: `h1 × ${h1Count}` });
    }
    let lastLevel = 0;
    for (const h of headings) {
      const level = Number(h.tagName[1]);
      if (lastLevel > 0 && level > lastLevel + 1) {
        violations.push({
          rule: 'heading-order',
          target: `h${level} folgt auf h${lastLevel}: ${h.textContent?.trim().slice(0, 40)}`,
        });
        break; // nur der erste Sprung reicht als Befund
      }
      lastLevel = Math.max(lastLevel, level);
    }

    // 3. Bilder: alt oder aria-hidden
    document.querySelectorAll('img').forEach((img) => {
      const hidden = img.closest('[aria-hidden="true"]');
      if (!hidden && !img.hasAttribute('alt')) {
        violations.push({ rule: 'img-alt', target: describe(img) });
      }
    });

    // 4. Buttons/Links: zugänglicher Name
    const named = (el: Element) =>
      (el.textContent ?? '').trim() !== '' ||
      el.getAttribute('aria-label') != null ||
      el.getAttribute('aria-labelledby') != null;
    document.querySelectorAll('button, a').forEach((el) => {
      // Links ohne href und ohne Rolle sind oft Container (z. B. Dropdown-Trigger)
      const isLink = el.tagName === 'A';
      if (isLink && !el.hasAttribute('href')) return;
      if (!named(el)) {
        violations.push({ rule: 'accessible-name', target: describe(el) });
      }
    });

    // 5. Formularfelder: Label oder aria-label
    document.querySelectorAll('input, select, textarea').forEach((field) => {
      if (field.getAttribute('type') === 'hidden') return;
      const hasLabel =
        field.getAttribute('aria-label') != null ||
        field.getAttribute('aria-labelledby') != null ||
        field.closest('label') != null;
      if (!hasLabel) {
        violations.push({ rule: 'form-label', target: describe(field) });
      }
    });

    // 6. main-Landmark
    if (!document.querySelector('main, [role="main"]')) {
      violations.push({ rule: 'main-landmark', target: '<body>' });
    }

    // 7. positiver tabindex
    document.querySelectorAll('[tabindex]').forEach((el) => {
      const ti = Number(el.getAttribute('tabindex'));
      if (ti > 0) {
        violations.push({ rule: 'positive-tabindex', target: describe(el) });
      }
    });

    return violations;
  });
}

for (const { path, label } of PUBLIC_PAGES) {
  test(`WCAG-2.2-AA-Smoke: ${label} (${path})`, async ({ page }) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const violations = await collectA11yViolations(page);

    // Beim ersten Lauf meldet die Seite Fehler als Befund; im CI-Fall ist
    // eine leere Liste das Ziel. Die Meldung listet alle Verstöße auf.
    expect(
      violations.map((v) => `${v.rule}: ${v.target}`),
      `A11y-Verstöße auf ${label}`
    ).toEqual([]);
  });
}

for (const { path, label } of PUBLIC_PAGES) {
  test(`axe-core: ${label} (${path})`, async ({ page }) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const violations = await runAxe(page);

    expect(
      violations.map((v) => `${v.id} [${v.impact}] (${v.nodes}×): ${v.description}`),
      `axe-core serious+critical auf ${label}`
    ).toEqual([]);
  });
}
