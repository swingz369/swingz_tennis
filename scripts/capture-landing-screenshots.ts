/**
 * Landing Page Screenshot Capture
 *
 * Nimmt 4 annotierte Produkt-Screenshots der SwingZ Landing Page auf.
 * Ausführung: npx tsx scripts/capture-landing-screenshots.ts
 *
 * Ticket: Sprint 3+ #13
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';

const PROJECT_ROOT = resolve(process.cwd());
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public', 'screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Die 4 Schlüssel-Sektionen der Landing Page
const SECTIONS = [
  {
    id: 'hero',
    selector: 'section[aria-labelledby="hero-heading"]',
    name: '01-hero',
    description: 'Hero-Sektion mit Gradient-Background, Claim und CTA-Buttons',
  },
  {
    id: 'features',
    selector: 'section[aria-labelledby="features-heading"]',
    name: '02-features',
    description: 'Feature-Grid mit 6 KI-gestützten Funktionen',
  },
  {
    id: 'pricing',
    selector: 'section:has(h2:has-text("richtige Lösung"))',
    name: '03-pricing',
    description: 'Preisübersicht Starter vs. Professional',
  },
  {
    id: 'cta',
    selector: 'section:has(h2:has-text("Zukunft"))',
    name: '04-cta',
    description: 'Call-to-Action mit Registrierungs-Button',
  },
] as const;

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`🌐 Starte Browser, navigiere zu ${BASE_URL} …`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retina-Qualität
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // Warte bis die letzte Hero-Animation sichtbar ist (statt blindem Timeout)
  await page.locator('.animate-in-delay-5').first().waitFor({ state: 'visible', timeout: 5_000 });

  console.log(`📸 Erstelle ${SECTIONS.length} Screenshots in ${OUTPUT_DIR} …\n`);

  let failures = 0;
  for (const section of SECTIONS) {
    const el = page.locator(section.selector).first();

    try {
      await el.scrollIntoViewIfNeeded();
      // Warte auf das erste sichtbare Kind-Element statt blindem Timeout
      await el.locator('> *').first().waitFor({ state: 'visible', timeout: 5_000 });

      const filePath = resolve(OUTPUT_DIR, `${section.name}.png`);
      await el.screenshot({ path: filePath, type: 'png' });
      console.log(`   ✅ ${section.name}.png — ${section.description}`);
    } catch (err) {
      failures++;
      console.error(`   ❌ ${section.name}.png — Fehler:`, (err as Error).message);
    }
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\n❌ ${failures}/${SECTIONS.length} Screenshots fehlgeschlagen.`);
    process.exit(1);
  }

  console.log(`\n🎾 Fertig! ${SECTIONS.length} Screenshots gespeichert.`);
}

main().catch((err) => {
  console.error('❌ Fataler Fehler:', err);
  process.exit(1);
});
