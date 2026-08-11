# Phase 3 (Geschäftsmodell durchsetzen) — Umsetzungsbericht

> Stand: 26. Juli 2026
> Bezug: [`2026-07-26-produktaudit-verkaufsreife.md`](2026-07-26-produktaudit-verkaufsreife.md) (Original-Audit, unverändert), [`2026-07-26-produktaudit-phase1-umsetzung.md`](2026-07-26-produktaudit-phase1-umsetzung.md) (Phase 1)
> Kategorie: Archiv-Snapshot (nach `AGENTS.md` §1) — dokumentiert, was in dieser Session tatsächlich umgesetzt wurde.

---

## Korrektur am Original-Audit

Das Original-Audit behauptete: „Ein Abo-Status-Check existiert an genau einer Stelle... Kein Self-Service-Kauf." Beides war bei genauerer Prüfung **falsch bzw. unvollständig**:

- Es gibt bereits einen vollständigen Self-Service-Checkout (`app/api/stripe/subscribe/route.ts`, `SubscribeButton`) inkl. Plan-Wechsel ohne Doppelbelastung, Stripe-Webhook mit Idempotenz-Schutz (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`), und einem funktionierenden Dunning-Flow (E-Mail + Notification bei fehlgeschlagener Zahlung).
- Ein Abo-Status-Check existierte tatsächlich, aber nur im Admin-Layout, **nicht** im Superadmin-Layout — obwohl gerade die Tennisschule-Pläne (79/99 €/Monat) an die Superadmin-Rolle gebunden sind.

Was am Original-Audit **zutraf**: kein Onboarding-Wizard und keine Registrierung verlinkt auf die Subscription-Seite; ein neues Konto bleibt mit `subscription_tier='free'`/`subscription_status='active'` dauerhaft ohne Zahlungspflicht (siehe Folge-Ticket unten).

---

## Was erledigt ist

### P3.1 — Zentrales Abo-Gate

**Bisher fehlende Lücke geschlossen:** `app/(protected)/superadmin/(gated)/layout.tsx` hatte keinerlei Dunning-Check — Fix per gemeinsamem Helfer `lib/subscription-gate.ts` (`isSubscriptionPastDue()`) und gemeinsamer UI-Komponente `components/billing/subscription-dunning-block.tsx`, jetzt in beiden `(gated)`-Layouts identisch verdrahtet.

**Neu gebaut, war komplett unvorhanden:** API-Ebene-Enforcement. Der bisherige Check griff nur bei Seiten-Navigation (Next.js-Layout), nie bei direkten API-Aufrufen. Jetzt zentral in `lib/api-auth.ts:withAuth` — dem von praktisch allen ~313 API-Routes genutzten Auth-Wrapper:

- Schreibende Requests (POST/PUT/PATCH/DELETE) von `admin`/`superadmin`-Rollen werden mit `402 Payment Required` abgelehnt, wenn `users.subscription_status` `past_due`/`unpaid` ist.
- Lesezugriff (GET) bleibt immer erlaubt — wie im Audit empfohlen.
- `owner`/`trainer`/`member` sind nie betroffen (keine individuelle Abrechnung für diese Rollen).
- Neuer Options-Parameter `{ allowWhilePastDue: true }` an `withAuth`, genutzt von `app/api/stripe/subscribe/route.ts` — sonst hätte sich ein gesperrter Admin genau von der Route ausgesperrt, die ihn retten würde (Zahlungsmethode aktualisieren/Plan wechseln).

**Dauerhafter Regressionsschutz:** `tests/unit/lib/api-auth.subscription-gate.test.ts` — 9 Tests gegen den echten `withAuth()` (Supabase-SSR-Client gemockt, keine Mock-Ersetzung von `withAuth` selbst): GET immer erlaubt, POST blockiert bei past_due/unpaid für admin/superadmin, POST erlaubt bei active, kein Einfluss auf owner/trainer/member, `allowWhilePastDue`-Ausnahme funktioniert.

### P3.3 — Preis-Inkonsistenz

`PLAN_MONTHLY_PRICE` in `lib/plans.ts` widersprach `PLANS` (`solo_l` = 49 € vs. legacy `professional` = 79 €, beide mit Label „Professional"). Geprüft: **0 Verwendungsstellen** im gesamten Code — toter Code ohne aktive Auswirkung. Komplett gelöscht statt nur korrigiert (die tatsächlich genutzte `PLAN_LABELS`-Map bleibt unverändert, sie hat 2 echte Aufrufer in `owner/clubs/`).

**Verifiziert:** `npx tsc --noEmit` → 0 Fehler. `npx vitest run` → 87/87 Dateien grün, 1443 Tests. `npx next build` → Exit 0.

---

## Was noch aussteht

### P3.2 — Self-Service-Kauf im Onboarding

**Bewusst nicht umgesetzt, mit Nutzer abgestimmt.** Neue Konten starten mit `subscription_tier='free'`, `subscription_status='active'` und haben damit dauerhaften, kostenlosen Schreibzugriff — das neue Dunning-Gate greift nur bei Zahlungsausfall eines _bestehenden_ Abos, nicht beim Fehlen eines Abos überhaupt. Der Nutzer hat entschieden: Abo soll zur Voraussetzung werden (kein dauerhaftes Freemium), aber **nicht blind implementiert** — offene fachliche Fragen (Trial-Zeitraum, Hard-Stop vs. Grace-Period, Ausnahme für Bestandskonten) zuerst klären, sonst sperrt ein blinder Rollout die eigenen Test-/Demo-Konten aus `CLAUDE.md`.

→ Ticket: `docs/tickets/roadmap/TICKET-mandatory-subscription-onboarding.md`

### Rest von P3

Unverändert offen: keine weiteren Punkte in P3 aus dem Original-Audit außer den oben genannten.
