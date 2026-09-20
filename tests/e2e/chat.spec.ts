import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

const MITGLIED2_ID = '341752f5-27c7-4477-b238-9d6821fe6989';
const PASSWORD = process.env.SEED_PASSWORD ?? 'SwingZ-Test-2026!';

/**
 * Chat Ende-zu-Ende: Nachricht von Mitglied 1 erscheint bei Mitglied 2 live
 * (Broadcast, ohne Reload), die Antwort kommt ebenso zurück.
 * Läuft in der Agent-Lane (Claude Sandbox Gamma).
 */
test('Direktchat: senden, live empfangen, antworten', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const a = await ctx1.newPage();
  const b = await ctx2.newPage();
  await loginAs(a, 'mitglied1@gamma.claude.test', PASSWORD);
  await loginAs(b, 'mitglied2@gamma.claude.test', PASSWORD);

  await b.goto('/messages', { waitUntil: 'networkidle' });
  // Namen sind im Seed nicht eindeutig; Einstieg deshalb über den ?compose=<userId>-Link.
  await a.goto(`/messages?compose=${MITGLIED2_ID}`, { waitUntil: 'networkidle' });

  const stamp = Date.now();
  await a.getByPlaceholder('Nachricht schreiben…').fill(`Hallo ${stamp}`);
  await a.getByRole('button', { name: 'Senden' }).click();
  await expect(a.getByText(`Hallo ${stamp}`).first()).toBeVisible();

  // Mitglied 2 hat nicht neu geladen: Chat taucht per Realtime in der Liste auf.
  await expect(b.getByText(`Hallo ${stamp}`).first()).toBeVisible({ timeout: 15000 });
  await b.getByRole('button', { name: /Lukas Müller/ }).click();
  await b.getByPlaceholder('Nachricht schreiben…').fill(`Antwort ${stamp}`);
  await b.keyboard.press('Enter');

  await expect(a.getByText(`Antwort ${stamp}`).first()).toBeVisible({ timeout: 15000 });
  await ctx1.close();
  await ctx2.close();
});
