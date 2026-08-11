# TICKET-mandatory-subscription-onboarding — Abo zur Voraussetzung machen statt Freemium-Default

> **Epic:** Produktaudit 2026-07-26, Phase P3 (Geschäftsmodell durchsetzen) · **Quartal:** Roadmap · **Aufwand:** 2-4 Tage
> **Status:** ❌ TODO · _zuletzt geprüft: 2026-07-26_

## Ausgangslage

Im Zuge von P3.1 (`docs/ARCHIV/2026-07-26-produktaudit-verkaufsreife.md`, `docs/ARCHIV/2026-07-26-produktaudit-phase1-umsetzung.md`) wurde ein zentrales Dunning-Gate gebaut (`lib/subscription-gate.ts`, verdrahtet in `lib/api-auth.ts:withAuth` + beiden `(gated)`-Layouts): Admin/Superadmin-Konten mit `subscription_status IN ('past_due','unpaid')` werden bei schreibenden Requests blockiert.

**Das deckt nur Zahlungsausfälle nach einem bestehenden Abo ab.** Ein neues Konto hat standardmäßig `subscription_tier = 'free'`, `subscription_status = 'active'` (Spalten-Default in `src/infrastructure/persistence/schema.ts`) — und damit **dauerhaft vollen Schreibzugriff, ohne je zu zahlen**. Weder `app/(protected)/admin/onboarding/page.tsx` noch `app/(protected)/superadmin/onboarding/page.tsx` noch `app/register/page.tsx` verlinken auf `/admin/subscription` bzw. `/superadmin/subscription` — der bereits fertige Self-Service-Checkout (`app/api/stripe/subscribe/route.ts`, `SubscribeButton`) wird nie proaktiv angeboten.

Vom Nutzer bestätigt (26.07.2026): Ein Abo soll **zur Voraussetzung werden**, kein dauerhaftes Freemium-Modell. Bewusst **nicht blind umgesetzt**, weil es echte Bestandskonten (siehe `CLAUDE.md`-Testaccount-Tabelle) sofort sperren könnte, ohne vorherige fachliche Klärung.

## Offene fachliche Entscheidungen (vor Implementierung klären)

- [ ] **Trial-Zeitraum:** Gibt es eine kostenlose Testphase (z. B. 14 Tage) vor Zahlungspflicht, oder muss die Zahlungsmethode sofort bei Registrierung hinterlegt werden?
- [ ] **Hard-Stop vs. Grace-Period:** Läuft die Testphase ab — sofortige Sperre oder Übergangsfrist mit Erinnerungen (analog zum bestehenden `invoice.payment_failed`-Dunning-Flow im Stripe-Webhook)?
- [ ] **Bestandskonten:** Die vier `TEST_*`-Accounts aus `.env.local` (admin/superadmin/trainer/member, siehe `CLAUDE.md`) und alle produktiven `subscription_tier='free'`-Konten müssen von der neuen Pflicht ausgenommen oder gezielt migriert werden — sonst sperrt dieses Ticket beim Ausrollen sofort die eigene Test- und Demo-Umgebung.
- [ ] **Wo greift die Pflicht:** Nur beim Abschluss des Onboarding-Wizards (Redirect zu Stripe Checkout), oder zusätzlich als eigenes Gate in `lib/subscription-gate.ts` (z. B. `subscription_tier === 'free'` blockiert Schreibzugriff genauso wie `past_due`)?

## Geänderte / neue Dateien

- _(noch keine — Ticket beschreibt offenen Zustand, siehe „Offene fachliche Entscheidungen")_

## Voraussichtlich betroffen

- `app/(protected)/admin/onboarding/page.tsx`, `app/(protected)/superadmin/onboarding/page.tsx` — Redirect/CTA zu Checkout nach Abschluss
- `lib/subscription-gate.ts` — ggf. `isSubscriptionPastDue` um einen `free`-ohne-Trial-Fall erweitern (neue Funktion, nicht die bestehende umbenennen — die wird bereits von `withAuth` und beiden Layouts genutzt)
- `src/infrastructure/persistence/schema.ts` — falls Trial-Zeitraum nötig: neue Spalte `trial_ends_at` auf `users`
- Migration für Bestandskonten-Ausnahme (z. B. `subscription_tier` auf einen expliziten `grandfathered`-Wert setzen statt stillschweigend `free` zu belassen)

## Akzeptanzkriterien

- [ ] Fachliche Entscheidungen oben geklärt und hier dokumentiert
- [ ] Neues Konto wird nach Onboarding-Abschluss zu Stripe Checkout geführt (oder Trial-Zähler startet)
- [ ] Bestehende Test-/Demo-Konten laufen nach dem Rollout ungestört weiter
- [ ] Test analog zu `tests/unit/lib/api-auth.subscription-gate.test.ts` für den neuen „nie abonniert"-Fall

## Nächste Aktion

Fachliche Klärung der drei offenen Punkte oben mit dem Produktverantwortlichen, dann Umsetzung analog zum bereits gebauten Dunning-Gate.
