# SwingZ — Master-Handbuch

> Zuletzt aktualisiert: 21.07.2026 (Stand der letzten Code-Änderung an diesem Dokument)

> **Zentrale Doku für alle Rollen, alle Features, alle Schichten.** Lies hier, wenn du nicht weißt wo anfangen.

Willkommen im SwingZ-Handbuch. Dieses Dokument ist **single entry point** für End-User, Product Owner und Entwickler. Es verlinkt auf themenspezifische Kapitel, in denen Tiefe und Code-Referenzen liegen.

---

## 🎾 Was ist SwingZ?

SwingZ ist eine **SaaS für Tennisclub-Management** mit fünf Benutzerrollen und 13 aktivierbaren Modulen pro Verein. Stand 2026-07-01:

| Kennzahl               | Wert                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| API-Routes             | 306                                                                   |
| Pages                  | 104 geschützt + 3 öffentlich + 15 weitere                             |
| React-Components       | 139                                                                   |
| DB-Migrations          | 137                                                                   |
| SQL-Tabellen (Drizzle) | 88                                                                    |
| Module (toggleable)    | 13 (4 core + 9 optional)                                              |
| Externe Services       | Supabase, Stripe, Resend, Sentry, Open-Meteo, Gemini Flash, Vercel    |
| Hosting                | Vercel (EU-Central)                                                   |
| Codebase-Sprache       | TypeScript strict, Next.js 16 App Router, React 18, Server Components |

**Produktion:** https://swingz.vercel.app
**Stack:** Next.js 16 (App Router + RSC) · TypeScript 5.6 strict · Supabase (Postgres + RLS + Auth) · Drizzle ORM · Stripe (Checkout + Webhooks + Customer Portal) · Tailwind + shadcn/ui · TanStack Query · Vitest + Playwright.

---

## 👥 Rollen-Index

Das Handbuch ist nach Rollen und Themen organisiert. Wähle deinen Einstieg:

| Rolle            | Reichweite                                            | Dashboard         | Handbuch-Kapitel                                                                                                                                     |
| ---------------- | ----------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**        | Plattformbetreiber (SwingZ GmbH) — sieht ALLE Vereine | `/owner`          | [`user/owner.md`](./handbook/user/owner.md)                                                                                                          |
| **Superadmin**   | Tennisschulen-Chef, verwaltet mehrere Vereine         | `/superadmin`     | [`user/superadmin.md`](./handbook/user/superadmin.md)                                                                                                |
| **Admin**        | Genau 1 Verein — der "klassische Vereins-Verwalter"   | `/admin/members`  | [`user/admin.md`](./handbook/user/admin.md)                                                                                                          |
| **Trainer**      | In einem/mehreren Vereinen, Availability + Sessions   | `/trainer`        | [`user/trainer.md`](./handbook/user/trainer.md)                                                                                                      |
| **Member**       | In einem/mehreren Vereinen, Buchungen + RSVP          | `/member`         | [`user/member.md`](./handbook/user/member.md)                                                                                                        |
| **Public Trial** | KEIN Login — Probetraining-Anfrage                    | `/trial-training` | [`user/public-trial.md`](./handbook/user/public-trial.md) + [`tutorials/public-trial-booking.md`](./handbook/user/tutorials/public-trial-booking.md) |

**Rollenhierarchie:** `owner(5) > superadmin(4) > admin(3) > trainer(2) > member(1)` — implementiert als Zahlenvergleich in [`lib/auth-common.ts`](./handbook/dev/auth-rbac.md).

**Dashboard-Dispatch:** `/dashboard` leitet die höchste aktive Rolle weiter — siehe [`user/admin.md`](./handbook/user/admin.md#dashboard-dispatch).

---

## 🧩 Modul-Index (13 Features pro Verein)

Vereine aktivieren Module auf zwei Ebenen: beim **Onboarding-Wizard** und später in **Settings → Module**. Die JSON-`clubs.features`-Spalte speichert den Toggle-State.

| #   | Feature                     | Kategorie | Sidebar-Section     | Details                                          |
| --- | --------------------------- | --------- | ------------------- | ------------------------------------------------ |
| 1   | Mitgliederverwaltung        | **core**  | members             | immer an, nicht deaktivierbar                    |
| 2   | Trainer                     | **core**  | trainers            | immer an                                         |
| 3   | Saisonplanung               | **core**  | seasons             | inkl. KI-Clustering                              |
| 4   | Finanzen                    | **core**  | finance             | Abrechnung, Mahnwesen (inkl. Stufen 0/1/2/3)     |
| 5   | Shop                        | optional  | shop                | Vereinsartikel                                   |
| 6   | Turniere                    | optional  | tournaments         | Anmeldung, Spielpläne                            |
| 7   | Probetrainings              | optional  | trial_training      | Öffentliches Anmeldeformular                     |
| 8   | KI-Matchmaking              | optional  | ai_matchmaking      | Spielpartner-Matching                            |
| 9   | Wetter-Integration          | optional  | weather_integration | Open-Meteo, automatische Platzsperre             |
| 10  | Liga & Mannschaft           | optional  | league_lineup       | nuLiga-Sync                                      |
| 11  | Arbeitsdienst               | optional  | work_duty           | Gemeinschaftsstunden                             |
| 12  | Smart Court (Add-On €79/M.) | optional  | smart_court         | Hardware-Vendor-Integration (Nuki/Shelly/Loxone) |
| 13  | Dynamische Preisgestaltung  | optional  | pricing             | Peak/Off-Peak Pricing                            |

Details: [`dev/feature-flags.md`](./handbook/dev/feature-flags.md). Master-Registry: [`lib/features.ts`](../lib/features.ts).

---

## 📚 Themen-Index (Entwickler-Sicht)

### Architektur & Code-Organisation

- [`dev/architecture.md`](./handbook/dev/architecture.md) — Clean Architecture, DDD, CQRS
- [`dev/themen-interplay.md`](./handbook/dev/themen-interplay.md) — Sequenzdiagramme pro Schlüssel-Flow

### Daten & API

- [`dev/data-model.md`](./handbook/dev/data-model.md) — alle 90 DB-Tabellen (auto-gen, Drizzle-Schema)
- [`dev/api-reference.md`](./handbook/dev/api-reference.md) — alle 306 API-Routes (auto-gen, grouped)
- [`dev/drizzle-orm.md`](./handbook/dev/drizzle-orm.md) — Schema-Layer, Repositories, Migrations

### Security & Auth

- [`dev/auth-rbac.md`](./handbook/dev/auth-rbac.md) — Rollenhierarchie, Guards, Cookie
- [`dev/supabase-setup.md`](./handbook/dev/supabase-setup.md) — Auth, RLS, Service-Client-Discipline
- [`dev/api-conventions.md`](./handbook/dev/api-conventions.md) — `withApiAuth`, `verifyRole`, Errors, Pagination

### Externe Services

- [`dev/stripe-integration.md`](./handbook/dev/stripe-integration.md) — Checkout, Webhooks, Idempotenz, Dunning
- [`dev/notifications.md`](./handbook/dev/notifications.md) — Service-Client-Pattern, E-Mail-Templates
- [`dev/feature-flags.md`](./handbook/dev/feature-flags.md) — `clubs.features` JSONB

### UX & Operations

- [`dev/theming-design-tokens.md`](./handbook/dev/theming-design-tokens.md) — Tokens, shadcn, Dark Mode
- [`dev/deployment-vercel.md`](./handbook/dev/deployment-vercel.md) — Build, Env-Vars, Caching
- [`dev/infrastructure-accounts.md`](./handbook/dev/infrastructure-accounts.md) — VPS, self-hosted Supabase, Vercel-Team, Account-Trennung
- [`dev/testing-strategy.md`](./handbook/dev/testing-strategy.md) — Vitest + Playwright + E2E
- [`dev/background-jobs.md`](./handbook/dev/background-jobs.md) — Jobs-Runner, Cron, Race-Conditions

---

## 🧰 Glossar

[`handbook/glossary.md`](./handbook/glossary.md) — Begriffswörterbuch. Mindestens diese Begriffe kommen in Meetings/Audits immer wieder vor: **RBAC, RLS, ICS, CSAT, SEPA, Dunning, GoBD, DSGVO, Chargeback, Idempotenz, Race Condition, Feature Flag, Audit Trail, Office Flag, nuLiga, DTB-ID, QStash, SSRF, Idempotency-Key**.

---

## 🔄 Wie dieses Handbuch lebt

[`handbook/README.md`](./handbook/README.md) erklärt Pflege, Update-Disziplin und das Auto-Gen-Skript (`scripts/docs-autogen.ts`).

**TL;DR:**

- **Stabile Teile** (DB-Schema, API-Liste): werden automatisch aus dem Code regeneriert.
- **Inhaltliche Teile** (Walkthroughs, Conventions): werden manuell gepflegt.
- **PR-Reminder:** Wer eine Route hinzufügt, eine Page erstellt oder eine Spalte in `clubs.features` togglet, MUSS das jeweilige Handbuch-Kapitel aktualisieren.

---

## 🚦 Schneller Einstieg pro Aufgabe

| Ich will …                              | Geh zu                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| als neuer Admin den Verein verstehen    | [`user/admin.md`](./handbook/user/admin.md)                                                                       |
| eine neue API-Route anlegen (Pattern)   | [`dev/api-conventions.md`](./handbook/dev/api-conventions.md) + [`dev/auth-rbac.md`](./handbook/dev/auth-rbac.md) |
| eine neue DB-Tabelle hinzufügen         | [`dev/drizzle-orm.md`](./handbook/dev/drizzle-orm.md) + [`dev/data-model.md`](./handbook/dev/data-model.md)       |
| ein Modul toggelbar machen              | [`dev/feature-flags.md`](./handbook/dev/feature-flags.md)                                                         |
| einen Stripe-Webhook debuggen           | [`dev/stripe-integration.md`](./handbook/dev/stripe-integration.md)                                               |
| verstehen, warum eine RLS-Policy greift | [`dev/supabase-setup.md`](./handbook/dev/supabase-setup.md)                                                       |
| eine Migrations-Chronologie durchgehen  | [`dev/data-model.md`](./handbook/dev/data-model.md)                                                               |
| einen Cron-Job anlegen                  | [`dev/background-jobs.md`](./handbook/dev/background-jobs.md)                                                     |

---

## 📖 Schritt-für-Schritt-Tutorials (End-User / Operator-Walkthroughs)

> **Für wen?** Jede Rolle, die **konkret etwas in der App tun** will — nicht nur _welche Funktionen gibt es_, sondern **was klicken, was ausfüllen, was passiert dann**. Jede Anleitung ist 1:1 aus den echten Client-Komponenten abgeleitet (Code-grounded).

| Tutorial                                                                                                       | Wer                                    | Wann                                                                |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| [`tutorials/public-trial-booking.md`](./handbook/user/tutorials/public-trial-booking.md)                       | Probetraining-Interessent (kein Login) | Formular ausfüllen auf `/trial-training`                            |
| [`tutorials/member-getting-started.md`](./handbook/user/tutorials/member-getting-started.md)                   | Mitglied                               | Erstes Login, Dashboard-Anatomie, Navigation                        |
| [`tutorials/member-bookings-and-attendance.md`](./handbook/user/tutorials/member-bookings-and-attendance.md)   | Mitglied                               | Court-Buchungen einsehen, Anwesenheitshistorie pflegen              |
| [`tutorials/member-profile-security-billing.md`](./handbook/user/tutorials/member-profile-security-billing.md) | Mitglied                               | Profil editieren, 2FA-Setup, E-Mail-Wechsel, SEPA-Status            |
| [`tutorials/trainer-availability.md`](./handbook/user/tutorials/trainer-availability.md)                       | Trainer                                | Wochen-Slots pflegen (Presets + Custom + Bulk auf Monat)            |
| [`tutorials/trainer-sessions-and-checkin.md`](./handbook/user/tutorials/trainer-sessions-and-checkin.md)       | Trainer                                | Dashboard lesen, Teilnehmer-Check-in pro Session                    |
| [`tutorials/admin-trial-approvals.md`](./handbook/user/tutorials/admin-trial-approvals.md)                     | Admin                                  | Probetraining annehmen/ablehnen → zu Mitglied konvertieren          |
| [`tutorials/admin-members-and-courts.md`](./handbook/user/tutorials/admin-members-and-courts.md)               | Admin                                  | Mitgliederliste mit Suche + Court-Verwaltung                        |
| [`tutorials/admin-billing.md`](./handbook/user/tutorials/admin-billing.md)                                     | Admin                                  | Rechnungen + Gebührenkategorien + Mahnwesen                         |
| [`tutorials/admin-mahnwesen.md`](./handbook/user/tutorials/admin-mahnwesen.md)                                 | Admin                                  | Dunning-Stufen 0/1/2/3 verwalten, Cron-Dashboard, Fee-Konfiguration |

Index + Quelldatei-Map: [`tutorials/README.md`](./handbook/user/tutorials/README.md).

---

## 📊 Big-Picture: Plattform-End-to-End-View

> **Wofür?** Verstehen, **wie die 15 Schlüssel-Flows der Plattform zusammenhängen** und welche **verbindlichen Regeln** greifen — als Big-Picture-Sprungbrett zwischen konkreten Tutorials (📖 oben) und detail-tiefer Tech-Architektur (📚 Themen-Index oben).

Zwei Anker-Files bündeln das Big-Picture:

- **🎯 Schlüssel-Flow-Atlas** — [`handbook/dev/themen-interplay.md`](./handbook/dev/themen-interplay.md): 15 Sequenzdiagramme, gegliedert in **§1–8 · End-to-End-Patterns** (Big-Picture-Architektur: Buchen, Saison-Planung, Zahlung, Public-Trial, Mahnwesen, Smart Court, Decisions, Admin-Onboarding) und **§9–15 · Tutorial-konkrete Mikro-Flows** (konkrete User-Pfade: Trainer-Verfügbarkeit, Trainer-Bulk, Trainer-Check-in, 2FA-Enrollment, Account-löschen, Trial→Mitglied-Konvertierung, Rechnung-Fee-Gate). Zeigt, **wer mit wem über welche API spricht** — ohne Code-Detail.
- **📏 Verbindliche Regeln** — [`BUSINESS_RULES.md`](./BUSINESS_RULES.md): 7 Kapitel Rollen-/Auth-/Probetraining-/Club-/Billing-/E-Mail-Regeln. Verbindlich **vor** Code-Konflikten (Quelle der Wahrheit, wenn Code widerspricht).

### 🧭 Wie sie zusammenhängen (Cross-Ref-Matrix)

| Schlüssel-Flow (`themen-interplay.md`)         | Verbindliche Regel (`BUSINESS_RULES.md`)                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| §1 Buchen (Member)                             | [§1 Rollen — Member darf mehreren Vereinen angehören](./BUSINESS_RULES.md#1-rollen--berechtigungen)                 |
| §4 Public-Trial (kein Login)                   | [§3 Probetraining — öffentlich, kein Login-Pfad danach](./BUSINESS_RULES.md#3-probetraining)                        |
| §3 Zahlung / Stripe-Checkout                   | [§6 Billing & Stripe — €29/€79, SEPA via PAIN.008](./BUSINESS_RULES.md#6-billing--stripe)                           |
| §5 Mahnwesen (L0–L3) + §15 Rechnung (Fee-Gate) | [§6 Billing & Stripe — Subscription-Tiers als Gate](./BUSINESS_RULES.md#6-billing--stripe)                          |
| §9/§10 Trainer-Verfügbarkeit + Bulk auf Monat  | [§1 Rollen — Trainer darf mehreren Vereinen angehören](./BUSINESS_RULES.md#1-rollen--berechtigungen)                |
| §12 2FA-Enrollment (TOTP)                      | [§2 Auth & Dashboard-Dispatch (höchste Rolle gewinnt)](./BUSINESS_RULES.md#2-authentifizierung--dashboard-dispatch) |

**Lese-Pfad:** Flow im Atlas lesen → Regel nachschlagen bei _Warum-Frage_ (z. B. „Warum geht Public-Trial NICHT nach Login?"). Regel lesen → passenden Flow im Atlas finden für _Wie-Frage_ (z. B. „Wie spielt die Subscription-Tier-Regel in der Rechnungs-Erstellung mit?").

---

## 📜 Verbindliche Quellen (Source of Truth)

Nicht widersprechen — diese Dateien haben Vorrang vor dem Handbuch bei Konflikten:

1. [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) — verbindliche Produkt- und Rollenregeln
2. [`CLAUDE.md`](./../CLAUDE.md) — Projekt-Konventionen für AI-Agents und neue Devs
3. [`AGENTS.md`](./../AGENTS.md) — Doku-Governance, Migrations- und Testdaten-Regeln
4. [`lib/features.ts`](../lib/features.ts) — Feature-Registry (Master)
5. [`lib/auth-common.ts`](../lib/auth-common.ts) — Rollen-Hierarchie (Master)

Das Handbuch selbst ist eine **externe Sicht** — bei Code-Konflikten gewinnt der Code, das Handbuch wird nachgezogen.
