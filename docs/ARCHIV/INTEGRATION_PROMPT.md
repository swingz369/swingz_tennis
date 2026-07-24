# SwingZ Integrations-Prompt

> Dieser Prompt ist das Arbeitsdokument für die Aufgabe „alle Bausteine zu einer
> funktionierenden App verbinden". Er wurde aus einer frischen Code-Analyse am
> 2026-07-14 generiert (nicht aus alten Analysedokumenten) und wird von Claude
> ausgeführt. Ergebnisse: `docs/INTEGRATION_REPORT.md`.

---

## Der Prompt

**Rolle:** Du bist Integrations-Engineer für SwingZ (Next.js 16, Supabase, Stripe).
Alle Features existieren bereits — deine Aufgabe ist ausschließlich **Verdrahtung**:
Seiten erreichbar machen, APIs an UIs anschließen, tote Aufrufe reparieren.
Keine neuen Features, keine Redesigns, kein Refactoring.

**Kontext (verifizierter Ist-Zustand, Stand 2026-07-14):**

- `npx tsc --noEmit`: 0 Fehler. Vitest: 1388 Tests grün
  (5 rote Testdateien brauchen eine live erreichbare Postgres — Umgebungsproblem, kein Code-Bug).
- 307 API-Routen, davon **48 ohne einen einzigen Client-Aufruf** (verwaist).
- 124 Seiten, davon **17 ohne jegliche Verlinkung** (verwaist).
- 1 kaputter API-Call: `components/bookings/my-bookings.tsx` ruft `DELETE /api/bookings/[id]`
  auf — die Route existiert nicht (nur `POST /api/bookings/[id]/cancel`).
- Die Sidebar (`components/layout/sidebar.tsx`) hat **keine Trainer-Navigation**:
  `/trainer/availability`, `/trainer/hours-logs`, `/trainer/planning-preferences`,
  `/trainer/profile` sind vom Desktop aus praktisch unerreichbar.
- Sidebar-Dashboard-Link zeigt für Trainer und Member fälschlich auf `/admin`.

**Aufgaben in Prioritätsreihenfolge:**

### Phase 1 — Kaputte Verbindungen reparieren (sofort)

1. `my-bookings.tsx`: Storno-Call auf `POST /api/bookings/${id}/cancel` umstellen.
2. Sidebar-`dashboardHref` rollenkorrekt machen (trainer → `/trainer`, member → `/member`).

### Phase 2 — Existierende Seiten erreichbar machen (sofort)

3. Trainer-Sektion in der Sidebar: Verfügbarkeit, Trainingspräferenzen,
   Stundennachweise, Trainer-Profil.
4. Admin-Sidebar ergänzen um existierende, aber unverlinkte Seiten:
   - Training → „Stundennachweise" (`/admin/hours-logs`)
   - Spielbetrieb → „Platzarten" (`/admin/court-types`)
   - Finanzen → „Preisregeln" (`/admin/pricing`)
   - Mitglieder → „Arbeitsdienst-Zuweisungen" (`/admin/work-duties/assignments`, Feature-Flag `work_duty`)
5. Member-Sidebar: „Meine Bestellungen" (`/meine-bestellungen`, Feature-Flag `shop`).

### Phase 3 — Verwaiste APIs an UIs anschließen (Backlog, je ~0,5–2 Tage)

Cluster ohne jegliche UI, absteigend nach Business-Wert:

1. **Trainer-Abrechnung**: `/api/billing/trainers/*`, `/api/hourly-rates/*` — Admin-Billing-Seite um Trainer-Tab erweitern.
2. **Abwesenheiten**: `/api/absences/*` (CRUD + approve/reject) — Trainer-Dashboard + Admin-Ansicht.
3. **Probetraining-Konversion**: `/api/trial-trainings/[id]/convert`, `/reminder`, `/stats` — Buttons in `/admin/trial-training`.
4. **Zahlungen**: `/api/payments`, `/api/payments/[id]/status`, `/api/payment-settings/*` — Admin-Billing.
5. **Statistiken**: `/api/statistics/*`, `/api/dashboard/kpis`, `/api/analytics/insights` — prüfen ob durch `/admin/analytics` ersetzt; wenn ja **löschen** statt anschließen.
6. **System**: `/api/system-settings/*`, `/api/admin/tenants`, `/api/admin/fee-categories`, `/api/schedule/*`, `/api/sessions/bulk-delete`, `/api/members/bulk-deactivate`, `/api/audit-logs/summary`, `/api/emails/onboarding`, `/api/trainer-availability/[id]|conflicts`, `/api/billing/{open-items,line-items,installments,monthly-overview,balance}`, `/api/seasons/[id]/groups/[groupId]/members` — je einzeln entscheiden: anschließen oder löschen.
   (Legitim ohne Client-Aufruf: `/api/webhooks/*`, `/api/cron/*`, `/api/health`.)

### Phase 4 — Duplikate konsolidieren (Backlog)

- Buchungs-UX ist fragmentiert: `/bookings`, `/bookings-unified`, `/my-bookings`, `/dashboard/bookings/new`, `/courts`, `/courts/daily` — auf EINEN Flow konsolidieren.
- `/profile` (im Header verlinkt) vs. `/member/profile` (verwaist) — eines löschen.
- `/matchmaking` (in Sidebar) vs. `/admin/ai/matchmaking` (verwaist) — eines löschen.
- `/member/trial-training` widerspricht Business-Regel „Probetraining nur öffentlich" — löschen prüfen.
- Nicht anfassen (absichtlich unverlinkt): `/offline` (PWA), `/join/[clubId]` (E-Mail-Link),
  `/bookings/payment-success`, `/shop/success` (Stripe-Redirects), `/design-preview`, `/api-docs` (dev).

**Regeln:**

- UI-Texte deutsch, `apiFetch` statt `fetch`, `createLogger` statt `console`,
  shadcn/ui-Komponenten, beide Themes testen.
- Nach jeder Phase: `npx tsc --noEmit` muss 0 Fehler geben.
- Keine Route/Seite löschen ohne vorher zu prüfen, ob sie von Webhooks, Cron oder E-Mails referenziert wird.
