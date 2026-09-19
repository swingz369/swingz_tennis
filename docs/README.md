# SwingZ — Tennis Club Management SaaS

> Zuletzt verifiziert: 17. September 2026
> Vollständiger Projektkontext für KI-Agenten: [`AGENTS.md`](../AGENTS.md) / [`CLAUDE.md`](../CLAUDE.md) im Repo-Root.

SwingZ ist eine Management-Lösung für Tennisvereine: Mitglieder, Buchungen, Trainingssessions, Plätze, Saisonplanung und Analytics in einer Weboberfläche. UI-Texte sind durchgängig Deutsch. Produktion: https://swingz.vercel.app

---

## Doku-Index

| Dokument                                                         | Inhalt                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`AGENTS.md`](../AGENTS.md)                                      | Regeln für KI-Agenten in diesem Repo (auch Doku-Governance)                                                                                                                                                                                                     |
| [`diagrams/swingz-overview.html`](diagrams/swingz-overview.html) | Zusammenspiel der Module (interaktiv): welches Modul welchem was liefert — Onboarding → Mitglieder/Trainer → Saison → Spielbetrieb → Anwesenheit → Finanzen, dazu Automatik und externe Dienste. Quelle: `diagrams/swingz-overview.architecture.json` (archify) |
| [`CLAUDE.md`](../CLAUDE.md)                                      | Architektur, Rollen, Konventionen, DO-NOT-Liste — Pflichtlektüre vor Code-Änderungen                                                                                                                                                                            |
| [`BUSINESS_RULES.md`](BUSINESS_RULES.md)                         | Verbindliche Produkt- und Rollenregeln                                                                                                                                                                                                                          |
| [`DATABASE.md`](DATABASE.md)                                     | DB-/RLS-Ist-Zustand, Migrations-Realität, bekannte Altlasten                                                                                                                                                                                                    |
| [`ENVIRONMENTS.md`](ENVIRONMENTS.md)                             | Umgebungen & Datenbanken: lokal vs. Produktion, Env-Dateien, **Weg einer Änderung (Commit → Merge → Migration → Deploy)**, lokale Migrationen, Tests, Dev-Server, Backups                                                                                       |
| [`SERVICES.md`](SERVICES.md)                                     | Alle Adressen und Dienste (lokal, Produktion, Drittanbieter) und wo die Zugangsdaten liegen                                                                                                                                                                     |
| [`OPEN_ITEMS.md`](OPEN_ITEMS.md)                                 | **Konsolidierte offene Punkte & nächste Schritte** (P0–P3 + Roadmap) — hier zuerst lesen                                                                                                                                                                        |
| [`PRODUKTIONSREIFE.md`](PRODUKTIONSREIFE.md)                     | **Der Plan**: Phasen, Reihenfolge, Gates und Abnahmekriterien bis zur Verkaufsreife                                                                                                                                                                             |
| [`HANDBOOK.md`](HANDBOOK.md)                                     | Nutzerhandbuch                                                                                                                                                                                                                                                  |
| [`handbook/`](handbook/)                                         | Ausführliches Dev-/User-Handbuch, inkl. auto-generierter Kapitel (siehe unten)                                                                                                                                                                                  |
| [`DESIGN.md`](DESIGN.md)                                         | Design-Konzept (Design-System, Component-Architektur, A11y-Audit)                                                                                                                                                                                               |
| [`ROUTING.md`](ROUTING.md)                                       | Route-Groups, Layout-Hierarchie, alle Seiten                                                                                                                                                                                                                    |
| [`SAISONPLANUNG-ALGORITHMUS.md`](SAISONPLANUNG-ALGORITHMUS.md)   | Wie der Clustering-Algorithmus plant: Ablauf, Trainingsfenster, Medenspiel-Sperren, Kapazitätsrechnung, Optimierungspfade                                                                                                                                       |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                             | Workflow für Beiträge                                                                                                                                                                                                                                           |
| [`STRIPE_SETUP.md`](STRIPE_SETUP.md)                             | Stripe-Konfiguration                                                                                                                                                                                                                                            |
| [`EMAIL_SETUP.md`](EMAIL_SETUP.md)                               | Resend-Konfiguration, Absenderdomain, Versandwege — **derzeit blockiert**                                                                                                                                                                                       |
| [`RUNBOOK-BACKUP-ROLLBACK.md`](RUNBOOK-BACKUP-ROLLBACK.md)       | Backup & Rollback                                                                                                                                                                                                                                               |
| `TEST-CREDENTIALS.md`                                            | Testvereine, Lanes & Zugangsdaten — **generiert** von `scripts/seed-testdata.ts`, nicht in Git                                                                                                                                                                  |
| [`decisions/`](decisions/)                                       | Architektur-Entscheidungen (ADRs) — einmal gemergt unveränderlich                                                                                                                                                                                               |
| [`ARCHIV/`](ARCHIV/)                                             | Abgeschlossene Audits/Analysen/Snapshots — historisch, nicht mehr aktuell                                                                                                                                                                                       |
| [`tickets/`](tickets/)                                           | Ticket-System — **eingefroren (Stand Juni 2026)**, siehe `OPEN_ITEMS.md`                                                                                                                                                                                        |

Architektur-Analyse Datenzugriff: [`ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md`](ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md) — drei DB-Wege (Supabase-Client, Service-Client, Drizzle), ~50 % der API ohne RLS, halb eingeführte Schichten-Architektur; Zielbild, Optionen A/B und Umsetzungsplan (Entscheidung → ADR-005).

Diagramm zum Zielbild: [`diagrams/adr-005-datenzugriff.html`](diagrams/adr-005-datenzugriff.html) — Route → Service → Repository → Postgres (RLS) vs. Altdomänen-Pfad über Drizzle; interaktiv (Pan/Zoom, Light/Dark), lokal im Browser öffnen.

Aktuellster Archiv-Snapshot: [`ARCHIV/2026-09-17-ux-analyse-und-sanierungsprompt.md`](ARCHIV/2026-09-17-ux-analyse-und-sanierungsprompt.md) — UX-/Kohäsions-Analyse am Code gemessen (79 % aller Textklassen `text-sm`/`text-xs`, fünf unabhängige Datums-Raster, kein URL-Zustand in Platzkalender und Saisonplanungs-Wizard, 3 Breadcrumbs auf 122 Seiten) plus daraus abgeleiteter Sanierungsprompt in 6 Phasen. Entscheidung zum Kalender → [ADR-006](decisions/adr-006-ein-kalender-fuer-alle-rollen.md).

Davor: [`ARCHIV/2026-09-16-adr-005-migrationsfortschritt-befund.md`](ARCHIV/2026-09-16-adr-005-migrationsfortschritt-befund.md) — Befund am Code zum ADR-005-Migrationsfortschritt: Architektur-Baseline seit 13.09. eingefroren, 14 migrierte Routen überspringen die Service-Schicht, `createServiceClient`-Bypass kaum reduziert (84 von ~86). Offene Punkte gebündelt in [`OPEN_ITEMS.md`](OPEN_ITEMS.md) (P0/P1).

Und davor: [`ARCHIV/2026-08-18-produktionsreife-audit.md`](ARCHIV/2026-08-18-produktionsreife-audit.md) — unabhängiges Produktionsreife-Audit am Code geprüft (13 Befunde: SECURITY-DEFINER-RPCs an `anon`, zwei tote Crons, keine Staging-Umgebung, fehlende Stripe-Idempotenz). Offene Punkte gebündelt in [`PRODUKTIONSREIFE.md`](PRODUKTIONSREIFE.md) Anhang D.

Älter: [`ARCHIV/2026-07-26-produktaudit-verkaufsreife.md`](ARCHIV/2026-07-26-produktaudit-verkaufsreife.md) — Produktaudit zur Verkaufsreife (RLS-Bypass über den Drizzle-Pfad, unverschlüsselter DB-Transport, fehlendes Abo-Enforcement, Wettbewerbs- und Positionierungsanalyse). Umsetzungsstand Phase 1: [`ARCHIV/2026-07-26-produktaudit-phase1-umsetzung.md`](ARCHIV/2026-07-26-produktaudit-phase1-umsetzung.md) — 2 reale Cross-Tenant-Lücken in Season-Routes gefixt, Testsuite grün, P2 (TLS) braucht VPS-Diagnose vor Umsetzung. Umsetzungsstand Phase 3: [`ARCHIV/2026-07-26-produktaudit-phase3-umsetzung.md`](ARCHIV/2026-07-26-produktaudit-phase3-umsetzung.md) — zentrales Abo-Gate jetzt auf API-Ebene für alle Routes, Superadmin-Dunning-Lücke geschlossen, Pflicht-Abo für Neukonten als Folge-Ticket zurückgestellt.

Governance: Ein Thema = eine Datei, Ist-Zustand-Docs werden aktualisiert statt dupliziert. Details in [`AGENTS.md`](../AGENTS.md).

---

## Tech Stack

- **Next.js 16** (App Router, Server Components, Turbopack)
- **React 18.3**, **TypeScript 5.9** (strict mode)
- **Supabase** (PostgreSQL, Auth) — 3 Client-Varianten, siehe `CLAUDE.md`
- **Drizzle ORM** — Schema in `src/infrastructure/persistence/schema.ts`
- **Tailwind CSS** + **shadcn/ui**
- **Stripe** (Billing), **Resend** (E-Mail) — **keine KI im Produktivpfad**: Gemini wurde am
  17.09.2026 entfernt, die Saisonplanung clustert regelbasiert. Details: `CLAUDE.md` → KI
- **Vitest** (Unit/Integration), **Playwright** (E2E)

Architektur: Next.js App Router + Clean-Architecture-Layering (`src/domain`, `src/application`, `src/infrastructure`). Details in `CLAUDE.md` → Architektur.

---

## Quickstart

```bash
git clone <repo-url> swingz && cd swingz
npm install
cp .env.example .env.local   # ausfüllen: Supabase, Stripe, Resend — siehe .env.example
npm run db:migrate:prod      # nur Produktion — lokale Migrationen: ENVIRONMENTS.md § 5a
npm run dev                  # http://localhost:3000
```

Test-Accounts (Rollen owner/superadmin/admin/trainer/member): siehe `CLAUDE.md` → Test-Accounts. Passwörter in `.env.local` (`TEST_*_PASSWORD`, nicht in Git).

```bash
npm run seed          # Test-User anlegen (scripts/seed-users.ts)
```

---

## Tests & Qualitätssicherung

```bash
npx tsc --noEmit       # Vor jedem Commit — 0 Errors
npm run lint
npm run test           # Vitest (Unit/Integration)
npm run test:e2e       # Playwright (E2E)
```

---

## API- & Datenmodell-Referenz

Wird **automatisch generiert**, nicht von Hand pflegen:

```bash
npm run docs:autogen   # regeneriert docs/handbook/dev/data-model.md + api-reference.md aus dem Code
npm run docs:check     # CI-Check: sind die generierten Kapitel noch aktuell?
```

Quelle: `scripts/docs-autogen.ts`, liest `src/infrastructure/persistence/schema.ts` (Datenmodell) und `app/api/**/route.ts` (API-Referenz).

---

## Deploy

Push nach `main` → CI → `deploy.yml` (Migrationen falls `AUTO_MIGRATE`, `vercel deploy --prod` per CLI, Health-Check). Kein Vercel-Git-Deploy. Der vollständige Ablauf — Commit, Merge, Migrationen (lokal und Produktion), Tests je Änderungsart, Dev-Server-Regeln — steht in [`ENVIRONMENTS.md`](ENVIRONMENTS.md) § 5. Environment Variables siehe `.env.example`.

---

## Troubleshooting

**Stale Next.js Cache** (Build-/TS-Fehler aus längst gefixten Dateien, „Module not found" trotz existierender Datei):

```bash
npm run clean   # löscht .next, .turbo, coverage, .drizzle, Vitest-Caches
npm run dev
```

Reicht das nicht: `npm run clean:all`. Details zur Hook-Reihenfolge (`predev`/`prebuild`/`postbuild`) in `package.json`.

**Demo-Mode aktiv:** App erkennt fehlende Supabase-Credentials und schaltet automatisch um — `.env.local` prüfen.

---

## Contributing

Siehe [`CONTRIBUTING.md`](CONTRIBUTING.md). Kurzfassung: Feature-Branch → Tests → `npx tsc --noEmit` + `npm run lint` → Conventional-Commits-Message → PR.

## License

MIT — siehe `LICENSE`.
