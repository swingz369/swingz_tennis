import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * axe-core-Analyse (WCAG 2.1/2.2 A + AA) der aktuell geladenen Seite.
 *
 * Ergänzt den strukturellen Smoke in `accessibility-smoke.spec.ts`: axe liest den
 * Accessibility-Tree zur Laufzeit und deckt damit Regeln ab, die eine
 * `page.evaluate`-Heuristik nie sieht (Farbkontrast, ARIA-Missbrauch, doppelte
 * IDs, Heading-Sprünge, Name/Role-Mismatch …).
 */

const IMPACT_ORDER = { minor: 0, moderate: 1, serious: 2, critical: 3 } as const;
type Impact = keyof typeof IMPACT_ORDER;

export interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  /** Anzahl betroffener DOM-Knoten. */
  nodes: number;
  /** Bis zu 5 CSS-Selector-Ziele zur schnellen Einordnung. */
  targets: string[];
}

/**
 * @param page    aktuelle Playwright-Seite (URL muss bereits geladen sein)
 * @param impact  Mindest-Schweregrad, ab dem ein Verstoß hart zählt.
 *                Standard `serious` — minor/moderate werden ignoriert, weil sie
 *                auf den schlanken öffentlichen Seiten meist kosmetisch sind und
 *                den Gate sonst instabil machen. Kontrast (1.4.3) und
 *                ARIA-Missbrauch (4.1.2) sind typischerweise `serious`.
 */
export async function runAxe(page: Page, impact: Impact = 'serious'): Promise<AxeViolation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const threshold = IMPACT_ORDER[impact];
  return results.violations
    .filter((v) => (IMPACT_ORDER[(v.impact as Impact) ?? 'minor'] ?? 0) >= threshold)
    .map((v) => ({
      id: v.id,
      impact: v.impact ?? 'unknown',
      description: v.description,
      nodes: v.nodes.length,
      targets: v.nodes
        .flatMap((n) => n.target)
        .map((t) => (Array.isArray(t) ? t.join(' > ') : t))
        .slice(0, 5),
    }));
}
