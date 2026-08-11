# SwingZ — Tennis Club Management SaaS

> Zuletzt verifiziert: 24. Juli 2026
> Vollständiger Projektkontext für KI-Agenten: [`AGENTS.md`](../AGENTS.md) / [`CLAUDE.md`](../CLAUDE.md) im Repo-Root.

SwingZ ist eine Management-Lösung für Tennisvereine: Mitglieder, Buchungen, Trainingssessions, Plätze, Saisonplanung und Analytics in einer Weboberfläche. UI-Texte sind durchgängig Deutsch. Produktion: https://swingz.vercel.app

---

## Doku-Index

| Dokument                                                   | Inhalt                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`AGENTS.md`](../AGENTS.md)                                | Regeln für KI-Agenten in diesem Repo (auch Doku-Governance)                          |
| [`CLAUDE.md`](../CLAUDE.md)                                | Architektur, Rollen, Konventionen, DO-NOT-Liste — Pflichtlektüre vor Code-Änderungen |
| [`BUSINESS_RULES.md`](BUSINESS_RULES.md)                   | Verbindliche Produkt- und Rollenregeln                                               |
| [`DATABASE.md`](DATABASE.md)                               | DB-/RLS-Ist-Zustand, Migrations-Realität, bekannte Altlasten                         |
| [`HANDBOOK.md`](HANDBOOK.md)                               | Nutzerhandbuch                                                                       |
| [`handbook/`](handbook/)                                   | Ausführliches Dev-/User-Handbuch, inkl. auto-generierter Kapitel (siehe unten)       |
| [`DESIGN.md`](DESIGN.md)                                   | Design-Konzept (Design-System, Component-Architektur, A11y-Audit)                    |
| [`ROUTING.md`](ROUTING.md)                                 | Route-Groups, Layout-Hierarchie, alle Seiten                                         |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                       | Workflow für Beiträge                                                                |
| [`STRIPE_SETUP.md`](STRIPE_SETUP.md)                       | Stripe-Konfiguration                                                                 |
| [`RUNBOOK-BACKUP-ROLLBACK.md`](RUNBOOK-BACKUP-ROLLBACK.md) | Backup & Rollback                                                                    |
| [`ARCHIV/`](ARCHIV/)                                       | Abgeschlossene Audits/Analysen/Snapshots — historisch, nicht mehr aktuell            |
| [`tickets/`](tickets/)                                     | Offene Spikes/Tickets                                                                |

Aktuellster Archiv-Snapshot: [`ARCHIV/2026-07-26-produktaudit-verkaufsreife.md`](ARCHIV/2026-07-26-produktaudit-verkaufsreife.md) — Produktaudit zur Verkaufsreife (RLS-Bypass über den Drizzle-Pfad, unverschlüsselter DB-Transport, fehlendes Abo-Enforcement, Wettbewerbs- und Positionierungsanalyse). Umsetzungsstand Phase 1: [`ARCHIV/2026-07-26-produktaudit-phase1-umsetzung.md`](ARCHIV/2026-07-26-produktaudit-phase1-umsetzung.md) — 2 reale Cross-Tenant-Lücken in Season-Routes gefixt, Testsuite grün, P2 (TLS) braucht VPS-Diagnose vor Umsetzung. Umsetzungsstand Phase 3: [`ARCHIV/2026-07-26-produktaudit-phase3-umsetzung.md`](ARCHIV/2026-07-26-produktaudit-phase3-umsetzung.md) — zentrales Abo-Gate jetzt auf API-Ebene für alle Routes, Superadmin-Dunning-Lücke geschlossen, Pflicht-Abo für Neukonten als Folge-Ticket zurückgestellt.

Governance: Ein Thema = eine Datei, Ist-Zustand-Docs werden aktualisiert statt dupliziert. Details in [`AGENTS.md`](../AGENTS.md).

---

## Tech Stack

- **Next.js 16** (App Router, Server Components, Turbopack)
- **React 18.3**, **TypeScript 5.9** (strict mode)
- **Supabase** (PostgreSQL, Auth) — 3 Client-Varianten, siehe `CLAUDE.md`
- **Drizzle ORM** — Schema in `src/infrastructure/persistence/schema.ts`
- **Tailwind CSS** + **shadcn/ui**
- **Stripe** (Billing), **Resend** (E-Mail), **Google Gemini Flash** (KI-Features)
- **Vitest** (Unit/Integration), **Playwright** (E2E)

Architektur: Next.js App Router + Clean-Architecture-Layering (`src/domain`, `src/application`, `src/infrastructure`). Details in `CLAUDE.md` → Architektur.

---

## Quickstart

```bash
git clone <repo-url> swingz && cd swingz
npm install
cp .env.example .env.local   # ausfüllen: Supabase, Stripe, Resend — siehe .env.example
npm run db:migrate           # oder: npm run db:push (nur Entwicklung)
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

Vercel, automatisch bei Push zu `main`. Environment Variables siehe `.env.example`.

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
