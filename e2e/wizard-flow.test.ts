/**
 * @vitest-environment node
 *
 * E2E Test: Saisonplanungs-Wizard Komplettdurchlauf
 *
 * Voraussetzungen:
 * - Dev-Server läuft auf http://localhost:3000
 * - `MIDSCENE_MODEL_NAME` ist gesetzt (z.B. "gpt-4o")
 * - `OPENAI_API_KEY` ist gesetzt
 * - Entweder `SEASON_ID` als env-Variable setzen ODER
 *   `SUPABASE_SESSION_TOKEN` + `SUPABASE_REFRESH_TOKEN` für Cookie-Auth
 *   (Cookie-Namen können je nach Supabase-Setup abweichen – prüfe die
 *    tatsächlichen Cookie-Namen in den Browser DevTools)
 *
 * Ablauf:
 * 1. Auth (Cookie-basiert via env tokens)
 * 2. Step 1 – Einstellungen (Präferenzen öffnen, Deadline setzen)
 * 3. Step 2 – Gruppen (Gruppen anlegen, konfigurieren)
 * 4. Step 3 – Plan (KI-Plan generieren mit Dry-Run, dann final)
 * 5. Step 4 – Billing (Rechnungsvorschau mit Summe prüfen)
 * 6. Step 5 – Veröffentlichen (Publish + Erfolgsmeldung)
 */

import { describe, it, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SEASON_ID = process.env.SEASON_ID ?? '';
const SESSION_TOKEN = process.env.SUPABASE_SESSION_TOKEN ?? '';
const REFRESH_TOKEN = process.env.SUPABASE_REFRESH_TOKEN ?? '';

const hasAuth = !!(SEASON_ID || SESSION_TOKEN);
const describeE2E = hasAuth ? describe : describe.skip;

// Berechne Deadline-Datum für den Test (4 Wochen ab jetzt)
const deadlineDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10); // YYYY-MM-DD

describeE2E(
  'Wizard Komplettdurchlauf',
  { timeout: 420000 }, // 7 Minuten Gesamt-Timeout für die Suite
  () => {
    let ctx: WebTestContext;

    beforeAll(async () => {
      ctx = await WebTest.start(BASE_URL, {
        aiActionContext:
          'Du bist ein deutschsprachiger E2E-Test-Experte für eine Tennis-Club-Admin-Oberfläche. ' +
          'Die UI ist auf Deutsch beschriftet. Interagiere präzise mit den beschriebenen Elementen.',
      });

      // Auth per Cookie-Injection vor dem ersten Wizard-Aufruf
      if (SESSION_TOKEN) {
        await ctx.page.context().addCookies([
          {
            name: 'sb-access-token',
            value: SESSION_TOKEN,
            domain: new URL(BASE_URL).hostname,
            path: '/',
          },
          {
            name: 'sb-refresh-token',
            value: REFRESH_TOKEN,
            domain: new URL(BASE_URL).hostname,
            path: '/',
          },
        ]);
        // Refresh, damit Cookies im aktuellen Kontext greifen
        await ctx.page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
      }

      // Navigiere zum Wizard
      if (SEASON_ID) {
        await ctx.page.goto(`${BASE_URL}/admin/seasons/${SEASON_ID}/wizard`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
      }
    }, 30000);

    afterAll(async () => {
      if (ctx) {
        await WebTest.close(ctx);
      }
    });

    it('Step 1 – Einstellungen: Deadline setzen, Präferenzen öffnen, Speichern & Weiter', async () => {
      // Falls keine Season-ID, navigiere über die Seasons-Liste
      if (!SEASON_ID) {
        await ctx.page.goto(`${BASE_URL}/admin/seasons`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        await ctx.agent.aiAct(
          'click on the first season in the list to open its detail page, then find and click a button labeled "Saisonplanung starten" or "Planung"'
        );
        await ctx.page.waitForURL(/wizard/, { timeout: 10000 });
      }

      await ctx.agent.aiAct(
        'verify the page shows "Planungs-Einstellungen" or "Einstellungen"'
      );

      // Deadline setzen (berechnetes Datum)
      await ctx.agent.aiAct(
        `find the date input labeled "Präferenz-Deadline" and set its value to "${deadlineDate}"`
      );

      // Präferenzen öffnen
      await ctx.agent.aiAct(
        'find the toggle switch labeled "Präferenzen für Mitglieder öffnen" and turn it on if it is off'
      );

      // Speichern & Weiter
      await ctx.agent.aiAct(
        'click the button labeled "Speichern & Weiter"'
      );

      // Verifiziere Weiterleitung zu Step 2 (Groups)
      await ctx.agent.aiAct(
        'verify the page URL now contains "groups" or the heading references "Gruppen"'
      );
    }, 60000);

    it('Step 2 – Gruppen: Gruppen anlegen und weiter zu Plan', async () => {
      // Prüfe ob Gruppen existieren und lege ggf. neue an
      await ctx.agent.aiAct(
        'check if the page shows existing groups. If no groups exist, click the "Gruppe hinzufügen" button, fill in a group name like "Anfänger Montag", select a level like "Anfänger", and click "Speichern". Repeat to create a second group like "Fortgeschrittene Mittwoch".'
      );

      // Weiter zu Plan
      await ctx.agent.aiAct(
        'click the button labeled "Weiter zu Plan" at the bottom of the page'
      );
    }, 45000);

    it('Step 3 – Plan: KI-Plan generieren (Dry-Run + final) und weiter zu Billing', async () => {
      await ctx.agent.aiAct(
        'verify the page shows a Kanban board with group columns and member cards, or at minimum shows groups and a button labeled "KI-Plan generieren"'
      );

      // Dry-Run-Toggle einschalten
      await ctx.agent.aiAct(
        'find the toggle switch labeled "Nur Vorschau" and turn it on'
      );

      // KI-Plan als Vorschau generieren
      await ctx.agent.aiAct(
        'click the button with the sparkles icon labeled "KI-Plan generieren"'
      );

      // Warten bis Vorschau fertig
      await ctx.agent.aiAct(
        'wait for a success toast message to appear (e.g. "KI-Plan als Vorschau generiert"), or wait until the "KI-Plan generieren" button becomes enabled again'
      );

      // Dry-Run ausschalten und final generieren
      await ctx.agent.aiAct(
        'turn off the "Nur Vorschau" toggle, then click "KI-Plan generieren" again to run the final plan generation'
      );

      // Warten bis finaler Plan fertig
      await ctx.agent.aiAct(
        'wait for a success toast confirming "KI-Plan generiert & gespeichert", then click the "Weiter zu Billing" button'
      );
    }, 300000);

    it('Step 4 – Billing: Rechnungsvorschau prüfen und weiter zu Veröffentlichen', async () => {
      await ctx.agent.aiAct(
        'verify the page heading shows "Billing" and there is a table or a list showing billing preview items with member names and amounts'
      );

      // Prüfe ob die Summe sichtbar ist
      await ctx.agent.aiAct(
        'look for a total sum or summary value on the billing page'
      );

      // Weiter zu Publish
      await ctx.agent.aiAct(
        'find and click the button to advance to the next step — look for "Weiter", "Rechnungen generieren", or a button at the bottom of the page that navigates to the publish step'
      );
    }, 45000);

    it('Step 5 – Veröffentlichen: Saison publizieren und Erfolg prüfen', async () => {
      await ctx.agent.aiAct(
        'verify the page shows a summary or warnings section before publishing, and a "Saison veröffentlichen" button is visible'
      );

      // Saison veröffentlichen
      await ctx.agent.aiAct(
        'click the button labeled "Saison veröffentlichen"'
      );

      // Erfolgsmeldung prüfen
      await ctx.agent.aiAct(
        'wait for and verify a green success box appears with the text "Saison erfolgreich veröffentlicht!"'
      );

      // Verifiziere den Link zurück zur Saison-Übersicht
      await ctx.agent.aiAct(
        'verify there is a link "Zur Saison-Übersicht →" visible inside the green success box'
      );
    }, 60000);
  }
);
