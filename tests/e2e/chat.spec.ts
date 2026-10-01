import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

const MITGLIED2_ID = '341752f5-27c7-4477-b238-9d6821fe6989';
const PASSWORD = process.env.SEED_PASSWORD ?? 'SwingZ-Test-2026!';

/** Nachrichtenblase im Verlauf (nicht die Vorschau in der Chatliste). */
const bubble = (page: Page, text: string) => page.locator('[id^="msg-"]', { hasText: text }).last();

/** Aktionen einer Nachricht öffnen: Desktop per Hover-Leiste, Handy per Gedrückthalten. */
async function openActions(page: Page, msg: Locator, text: string, mobile: boolean) {
  if (!mobile) return msg.hover();
  const el = msg.getByText(text).first();
  await el.dispatchEvent('touchstart');
  await page.waitForTimeout(700);
  await el.dispatchEvent('touchend');
}

/**
 * Chat Ende-zu-Ende: Nachricht von Mitglied 1 erscheint bei Mitglied 2 live
 * (Broadcast, ohne Reload), die Antwort kommt ebenso zurück; Reaktion und Zitat
 * ebenso. Auf dem Handy laufen die Aktionen über Gedrückthalten statt Hover.
 * Läuft in der Agent-Lane (Claude Sandbox Gamma).
 */
test('Direktchat: senden, live empfangen, reagieren, zitieren', async ({ browser, isMobile }) => {
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
  await a.getByRole('textbox', { name: 'Nachricht schreiben' }).fill(`Hallo ${stamp}`);
  await a.getByRole('button', { name: 'Senden' }).click();
  await expect(bubble(a, `Hallo ${stamp}`)).toBeVisible();

  // Mitglied 2 hat nicht neu geladen: Chat taucht per Realtime in der Liste auf.
  await expect(b.getByText(`Hallo ${stamp}`).first()).toBeVisible({ timeout: 15000 });
  await b.getByRole('button', { name: /Lukas Müller/ }).click();
  await b.getByRole('textbox', { name: 'Nachricht schreiben' }).fill(`Antwort ${stamp}`);
  await b.keyboard.press('Enter');

  await expect(bubble(a, `Antwort ${stamp}`)).toBeVisible({ timeout: 15000 });

  // Reaktion: Mitglied 1 reagiert, Mitglied 2 sieht sie live.
  const answer = bubble(a, `Antwort ${stamp}`);
  await openActions(a, answer, `Antwort ${stamp}`, isMobile);
  if (isMobile) {
    await a.getByRole('button', { name: 'Mit 👍 reagieren' }).click();
  } else {
    await answer.getByRole('button', { name: 'Reagieren' }).click();
    await a.getByRole('menuitem', { name: 'Mit 👍 reagieren' }).click();
  }
  await expect(bubble(b, `Antwort ${stamp}`).getByRole('button', { name: '👍' })).toBeVisible({
    timeout: 15000,
  });

  // Antworten mit Zitat.
  await openActions(a, answer, `Antwort ${stamp}`, isMobile);
  if (isMobile) await a.getByRole('dialog').getByRole('button', { name: 'Antworten' }).click();
  else await answer.getByRole('button', { name: 'Antworten' }).click();
  await a.getByRole('textbox', { name: 'Nachricht schreiben' }).fill(`Zitat ${stamp}`);
  await a.keyboard.press('Enter');
  await expect(bubble(b, `Zitat ${stamp}`).getByText(`Antwort ${stamp}`)).toBeVisible({
    timeout: 15000,
  });
  await ctx1.close();
  await ctx2.close();
});
