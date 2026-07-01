# SWINGZ - Tennisclub Management System

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.6-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-15-black.svg)
![Supabase](https://img.shields.io/badge/supabase-postgres-green.svg)
![Tests](https://img.shields.io/badge/tests-vitest-brightgreen.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

SWINGZ ist eine moderne, vollständige Management-Lösung für Tennisclubs. Das System ermöglicht die Verwaltung von Mitgliedern, Buchungen, Trainingssessions, Plätzen und Analysen – alles in einer benutzerfreundlichen Weboberfläche.

---

## ✨ Features

- **Multi-Club-Support**: Verwalte mehrere Tennisclubs in einer Installation
- **Multi-Tenant mit Tennisschulen-Konzept**: Ein Superadmin (Tennisschulen-Chef) verwaltet übergeordnet alle zugehörigen Vereine. Vereins-Admins verwalten jeweils ihren eigenen Verein. Club-Isolation via `club_id` + RLS auf allen Tabellen.
- **Booking-Management**: dynamische Kapazitätsplanung, automatische Doppelbuchungs-Prüfung, Status-Maschine (Confirmed, Cancelled, Completed)
- **Member-Verwaltung**: Vollständige Member-Profile, Aktivierung/Deaktivierung, Club-Mitgliedschaften, Rollenverwaltung (Member/Trainer/Admin/Superadmin),成员 einladen
- **Session-Planung**: Trainer-Zuordnung, Capacity-Limits, wiederkehrende Sessions
- **Analytics Dashboard**: Kapazitätsauslastung, Buchungsstatistiken, Trainer-Performance
- **Responsive UI**: Mobile-first Design mit Tailwind CSS und shadcn/ui
- **Role-Based Access**: 4 Rollen (Superadmin > Admin > Trainer > Member) mit rollenspezifischen Dashboards, geschützten Routen und granularer Sidebar/Bottom-Nav pro Rolle
- **Email Notifications**: Automatische Benachrichtigungen für Buchungen, Stornierungen, Rollenänderungen und Einladungen
- **Audit Logging**: Vollständige Nachvollziehbarkeit aller kritischen Aktionen
- **Dark Mode**: Systemweiter Dark-Mode Support
- **Export**: CSV-Export für Mitglieder und Buchungen
- **Global Search**: Schnellsuche (Cmd/Ctrl+K) für Member und Sessions
- **Error Monitoring**: Sentry Integration für professionelles Error Tracking

---

## 🛠 Tech Stack

### Frontend

- **Next.js 15** (App Router, Server Components)
- **TypeScript 5.6** (strict mode)
- **React 18** mit Server Components
- **Tailwind CSS 3.4** + shadcn/ui Komponenten
- **TanStack Query** (React Query) für State Management
- **Zod** für Validierung
- **Recharts** für Analytics-Visualisierung

### Backend & Infrastruktur

- **Supabase** (PostgreSQL, Auth, Edge Functions)
- **Drizzle ORM** (type-safe Database Access)
- **Clean Architecture** (Domain, Application, Infrastructure, Presentation)
- **Domain-Driven Design** (Entities, Value Objects, Repository Pattern)
- **tsyringe** für Dependency Injection
- **Vitest** + Testing Library für Unit & Integration Tests
- **Playwright** für E2E Tests
- **ESLint** + **Prettier** für Codequalität
- **Sentry** für Error Monitoring

---

## 🚀 Quickstart

### Voraussetzungen

- Node.js 18+
- PostgreSQL (lokal oder Supabase Cloud)
- Git

### 1. Repository klonen

```bash
git clone https://github.com/dein-org/swingz.git
cd swingz
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variables konfigurieren

Kopiere `.env.example` nach `.env.local` und fülle die Variablen aus:

```bash
cp .env.example .env.local
```

**Erforderliche Variablen:**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=dein_supabase_projekt_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein_anon_key
SUPABASE_SERVICE_ROLE_KEY=dein_service_role_key

# Optional: AI Features
ANTHROPIC_API_KEY=dein_anthropic_key
# oder
OPENAI_API_KEY=dein_openai_key

# Sentry (Error Monitoring)
NEXT_PUBLIC_SENTRY_DSN=dein_sentry_dsn

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Production (Vercel)
# For production on Vercel, set:
# NEXT_PUBLIC_APP_URL=https://swingz.vercel.app
# VERCEL_URL is automatically set by Vercel
```

### 4. Datenbank initialisieren

```bash
# Drizzle Schema generieren
npm run db:generate

# Migrationen ausführen
npm run db:migrate

# Alternativ: Schema direkt pushen (nur Entwicklung)
npm run db:push
```

**ODER** verwende das bereitgestellte Supabase Migrationsskript:

1. Öffne Supabase Dashboard → SQL Editor
2. Führe `supabase/migrations/001_initial_schema.sql` aus

### 5. Development Server starten

```bash
npm run dev
```

Die App ist jetzt unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## 🧑‍💼 Demo-Zugangsdaten

Folgende Test-Benutzer sind nach dem Seeden verfügbar:

| E-Mail                  | Passwort          | Rolle      |
| ----------------------- | ----------------- | ---------- |
| `admin@swingz.com`      | `AdminPass123!`   | Admin      |
| `trainer@swingz.com`    | `TrainerPass123!` | Trainer    |
| `member@swingz.com`     | `MemberPass123!`  | Mitglied   |
| `superadmin@swingz.com` | `SuperPass123!`   | Superadmin |

**Hinweis:** Nach dem Login mit einem dieser Konten muss der `demo-mode` Cookie gelöscht werden, um die echten Supabase-Daten anzuzeigen.

### Test-Daten anlegen

```bash
# Erstellt die oben genannten Test-Benutzer in Supabase
npm run seed:users
```

Das Skript verwendet den `SUPABASE_SERVICE_ROLE_KEY` und legt echte Auth-Benutzer mit Club-Mitgliedschaften an.

---

## 📁 Projektstruktur

```
swingz/
├── app/                          # Next.js App Router
│   ├── api/                      # API-Routen (REST)
│   │   ├── bookings/             # Booking-Endpoints
│   │   ├── members/[id]/         # Member-Verwaltung
│   │   ├── sessions/             # Session-API
│   │   └── dashboard/kpis/       # Analytics-KPIs
│   ├── (protected)/              # Geschützte Seiten
│   │   ├── admin/                # Admin-Bereich
│   │   │   ├── members/          # Member-Listen & Toggle
│   │   │   └── analytics/        # Dashboard & Analytics
│   │   └── bookings/             # Buchungsübersicht
│   └── layout.tsx                # Root Layout mit Auth-Check
│
├── src/
│   ├── domain/                   # Domain Layer (Pure Business Logic)
│   │   ├── entities/             # Aggregates & Entities
│   │   │   ├── booking.ts        # Booking Aggregate Root
│   │   │   ├── club.ts           # Club Aggregate
│   │   │   ├── court.ts          # Court Entity
│   │   │   ├── member.ts         # Member Entity
│   │   │   ├── schedule.ts       # Schedule Entity
│   │   │   └── session.ts        # Session Entity
│   │   ├── repositories/         # Repository Interfaces
│   │   │   ├── booking-repository.interface.ts
│   │   │   ├── club-repository.interface.ts
│   │   │   ├── court-repository.interface.ts
│   │   │   ├── member-repository.interface.ts
│   │   │   ├── schedule-repository.interface.ts
│   │   │   └── session-repository.interface.ts
│   │   ├── services/             # Domain Services
│   │   │   ├── validation.service.ts
│   │   │   └── booking-status-machine.ts
│   │   └── value-objects/        # Value Objects
│   │       ├── booking-id.ts
│   │       ├── club-id.ts
│   │       ├── court-id.ts
│   │       ├── email.ts
│   │       ├── member-id.ts
│   │       ├── schedule-id.ts
│   │       ├── session-id.ts
│   │       └── time-slot.ts
│   │
│   ├── application/              # Application Layer (Use Cases)
│   │   ├── use-cases/            # Business Use Cases
│   │   │   ├── booking.use-cases.ts
│   │   │   ├── club-analytics.use-cases.ts
│   │   │   ├── club.use-cases.ts
│   │   │   ├── court.use-cases.ts
│   │   │   ├── member.use-cases.ts
│   │   │   ├── schedule.use-cases.ts
│   │   │   └── session.use-cases.ts
│   │   └── dtos/                 # Data Transfer Objects
│   │
│   ├── infrastructure/           # Infrastructure Layer (External Concerns)
│   │   ├── external/
│   │   │   └── supabase/         # Supabase Client & Helpers
│   │   │       └── server.ts
│   │   └── persistence/
│   │       ├── client.ts         # Drizzle DB Client
│   │       ├── schema/           # Drizzle Schema Definitions
│   │       └── repositories/     # Repository Implementations
│   │           ├── booking.repository.ts
│   │           ├── club.repository.ts
│   │           ├── court.repository.ts
│   │           ├── member.repository.ts
│   │           ├── schedule.repository.ts
│   │           └── session.repository.ts
│   │
│   └── presentation/             # Presentation Layer (UI Glue)
│       └── (components/)         # React Components (in /components)
│
├── components/                   # React-Komponenten (shadcn/ui)
│   ├── layout/                   # Header, Sidebar, ProtectedRoute
│   ├── ui/                       # Base UI Komponenten (shadcn)
│   └── ...                       # Feature-Komponenten
│
├── lib/                          # Utility Libraries
│   ├── logger.ts                 # Custom Logger
│   ├── sentry.ts                 # Sentry Initialization
│   ├── utils.ts                  # General Utilities
│   └── ...                      # Helper Functions
│
├── supabase/                     # Supabase Migrations
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── public/                       # Statische Assets
├── .env.example                  # Environment Variable Template
├── .env.local                    # Lokale Env Vars (nicht committet)
├── architecture.dbml             # DB-Modell (DBML)
├── AGENTS.md                     # Kilo Agent-Konfiguration
├── drizzle.config.ts             # Drizzle ORM Config
├── next.config.js                # Next.js Config
├── package.json                  # Dependencies & Scripts
├── tailwind.config.ts             # Tailwind CSS Config
├── tsconfig.json                 # TypeScript Config
└── README.md                     # Diese Datei
```

---

## 🔌 API-Routes Übersicht

### Bookings

| Methode | Endpoint                          | Beschreibung             | Body                      |
| ------- | --------------------------------- | ------------------------ | ------------------------- |
| POST    | `/api/bookings`                   | Booking erstellen        | `{ memberId, sessionId }` |
| PATCH   | `/api/bookings/[id]`              | Booking stornieren       | `{ reason, notes? }`      |
| GET     | `/api/bookings/member/[memberId]` | Member-Buchungen abrufen | -                         |

### Members (Admin)

| Methode | Endpoint              | Beschreibung                   | Body                                  |
| ------- | --------------------- | ------------------------------ | ------------------------------------- |
| GET     | `/api/members`        | Mitgliederliste (filterbar)    | Query: `clubId?, status?`             |
| PATCH   | `/api/members/[id]`   | Member aktivieren/deaktivieren | `{ active: boolean, role? }`          |
| POST    | `/api/members/invite` | Neues Mitglied einladen        | `{ email, full_name, role, club_id }` |

### Sessions

| Methode | Endpoint        | Beschreibung             | Body                          |
| ------- | --------------- | ------------------------ | ----------------------------- |
| GET     | `/api/sessions` | Sessions mit TrainerName | Query: `clubId?, scheduleId?` |

### Dashboard (KPIs)

| Methode | Endpoint              | Beschreibung                | Body            |
| ------- | --------------------- | --------------------------- | --------------- |
| GET     | `/api/dashboard/kpis` | Club KPIs (club-spezifisch) | Query: `clubId` |

---

## 🏗 Architecture & Design

### Clean Architecture

Das Projekt folgt strengen **Clean Architecture** Prinzipien:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                      │
│  (Next.js Pages, API Routes, React Components)            │
├─────────────────────────────────────────────────────────────┤
│                   Application Layer                        │
│        (Use Cases, Input/Output Boundaries)               │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                          │
│    (Entities, Value Objects, Repository Interfaces)       │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                     │
│  (Database Repositories, External APIs, Supabase Client)  │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**

- **Dependency Rule**: Äußere Schichten dürfen innere nicht kennen
- **Domain-Centric**: Business-Logik ist zentral in Domain & Application
- **Repository Pattern**: Alle External Dependencies abstrahiert über Interfaces
- **Use Case Interactor**: Jede Business-Operation ist ein Use Case
- **DTOs**: Klar getrennte Input/Output Models pro Use Case

### DDD (Domain-Driven Design)

- **Aggregates**: `Booking` (Root), `Club`, `Schedule`
- **Entities**: `Member`, `Court`, `Session`, `Trainer`
- **Value Objects**: `MemberId`, `SessionId`, `Email`, `TimeSlot` (immutable, validiert)
- **Domain Services**: `ValidationService`, `BookingStatusMachine`

### CQRS (Command Query Responsibility Segregation)

- **Commands**: `CreateBooking`, `CancelBooking`, `ToggleMemberActive`
- **Queries**: `GetMemberBookings`, `GetClubAnalytics`, `FindSessionsByClub`

---

## 🧪 Testing

### Test-Strategie

- **Unit Tests**: Use Cases, Domain Services, Validation (Ziel: >80% Coverage)
- **Integration Tests**: API Routes, Repository-Integration mit Test-DB
- **E2E Tests**: Kritische User Journeys (Booking Flow, Admin Toggle)

### Commands

```bash
# Unit Tests
npm run test

# Unit Tests (watch mode)
npm run test:watch

# Integration Tests
npm run test:e2e

# Test Coverage Report
npm run test -- --coverage
```

---

## 🗄 Caching Strategy

Next.js erzeugt beim Build und im Dev-Modus umfangreiche Caches (`.next/cache`, `.next/server`, `.next/static`, Turbopack-Cache, Drizzle-Migrations-Cache, Vitest-Cache). Diese Caches beschleunigen Rebuilds enorm, können aber bei Schema-Änderungen, Dependency-Updates oder inkompatiblen Cache-Versionen zu **stale-cache-Problemen** führen (z. B. „Cannot find module" obwohl die Datei existiert, oder TypeScript-Fehler aus einer alten Datei-Version, die längst gefixt ist).

### Hook-Reihenfolge

| Hook        | Wann läuft es?            | Befehl                                                                                                    | Zweck                                                                                                                          |
| ----------- | ------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `prebuild`  | Vor `npm run build`       | `rm -rf .next`                                                                                            | Vollständiger Wipe — garantiert reproduzierbare Production-Builds.                                                             |
| `build`     | `npm run build`           | `next build`                                                                                              | Production-Build mit TypeScript-Validierung + Bundle-Optimierung.                                                              |
| `postbuild` | Nach erfolgreichem Build  | `npx drizzle-kit migrate`                                                                                 | Drizzle-Migrationen werden automatisch ausgeführt.                                                                             |
| `predev`    | Vor `npm run dev`         | `rm -rf .next/cache`                                                                                      | Nur den Cache-Unterordner löschen — Build-Artefakte (`.next/server`, `.next/static`) bleiben für schnellen Dev-Start erhalten. |
| `clean`     | Manuell (`npm run clean`) | `rm -rf .next .turbo coverage .drizzle node_modules/.vitest .vitest-cache test-results playwright-report` | Komplettes Aufräumen — alle Build- und Test-Artefakte auf einmal.                                                              |

### Warum wird `.next/cache` separat gelöscht?

`.next/cache` enthält den **Turbopack-/Webpack-Cache** (kompilierte Module, HMR-State, TypeScript-Ausgabe). Bei kleineren Code-Änderungen ist dieser Cache extrem nützlich — Dev-Server-Restarts dauern statt 30s oft nur 2s.

**.next/server** und **.next/static** enthalten dagegen die **kompilierten Server-Components und statischen Assets** für den _letzten_ Production-Build. Diese beim Dev-Start zu löschen würde den Server zwingen, alles neu zu kompilieren.

**Trade-off:**

- `predev` löscht **nur** `.next/cache` → schneller Dev-Start, aber potentiell stale Module (selten).
- `prebuild` löscht **komplett** `.next/` → garantiert sauberer Build, aber ~30s längerer Build-Start.

Falls du einen stale-cache-Fehler im Dev-Modus bekommst (z. B. „Module not found", seltsame TypeScript-Fehler aus alter Datei-Version), reicht ein manueller Wipe:

```bash
npm run clean
# oder selektiv:
rm -rf .next/cache
```

### Wie verhindert `prebuild` stale-cache-Probleme?

Der `prebuild`-Hook in `package.json` löscht vor jedem `npm run build` automatisch den gesamten `.next/`-Ordner. Das stellt sicher:

1. **Reproduzierbarkeit** — zwei aufeinanderfolgende `npm run build`-Aufrufe produzieren identische Outputs.
2. **Keine Cache-Inkonsistenzen** — Dependency-Updates, Schema-Änderungen oder Refactorings beeinflussen den Build nicht durch alte, gecachte Module.
3. **CI/CD-Sicherheit** — Vercel-Deploys starten immer mit leerem Cache, egal was der vorherige Build hinterlassen hat.

Der Trade-off ist ~30 Sekunden längere Build-Zeit — in Anbetracht der dadurch vermiedenen Debugging-Stunden ein klarer Gewinn.

### Verifizierung

Das Skript [`scripts/verify-gitignore.ts`](../scripts/verify-gitignore.ts) prüft, ob alle Cache-/Build-Pfade korrekt in `.gitignore` stehen, und listet sie via `git status --ignored` auf:

```bash
npx tsx scripts/verify-gitignore.ts
# Erwartet: ✓ All 10 required patterns are in .gitignore
#          ✓ All 10 patterns are in the npm run clean script
```

So stellst du sicher, dass nie versehentlich `.next/`, `coverage/` oder `.drizzle/` ins Repository committed werden.

---

## 🚢 Deploy

### Vercel ( empfohlen)

1. Push zu GitHub
2. In Vercel importieren
3. Environment Variables setzen (siehe `.env.example`)
4. Deploy automatisch bei jedem Push zu `main`

### Docker (optional)

```bash
docker build -t swingz .
docker run -p 3000:3000 swingz
```

---

## 🐛 Fehler & Troubleshooting

### Stale Next.js Cache

**Symptom:** Build- oder TypeScript-Fehler aus einer Datei, die längst gefixt wurde, oder `Module not found` obwohl die Datei existiert. Tritt besonders nach Änderungen an `lib/`, `supabase/migrations/` oder `package.json` auf.

**Ursache:** Der `.next/cache` (Turbopack/Webpack-Cache) hält Module aus einer früheren Version fest.

**2-Step-Lösung:**

```bash
npm run clean   # löscht .next, .turbo, coverage, .drizzle, node_modules/.vitest, .vitest-cache
npm run dev     # startet Dev-Server mit leerem Cache
```

Falls das nicht reicht: `npm run clean:all` (löscht zusätzlich `node_modules/.cache`, `.cache/`, `.tmp/`, OS-Temp-Files).

Siehe [Caching Strategy](#-caching-strategy) für Details zu `predev`/`prebuild`/pre-commit-Hook und wann welche Cache ungültig wird.

### "Demo Mode" aktiv

Die App erkennt fehlende Supabase-Credentials und schaltet automatisch in den Demo-Modus. Stelle sicher, dass `.env.local` korrekt konfiguriert ist.

### DB Connection Fehler

- Prüfe `DATABASE_URL` in Supabase Dashboard
- Stelle sicher, dass Drizzle-Migrationen ausgeführt wurden: `npm run db:migrate`

### Typfehler beim Build

```bash
npm run typecheck
```

Sämtliche `any` Types sollten bereits entfernt sein. Falls dennoch Fehler auftreten, bitte Issues erstellen.

---

## 📝 Contributing

### Workflow

1. Fork erstellen
2. Feature-Branch erstellen (`git checkout -b feat/amazing-feature`)
3. Tests hinzufügen/aktualisieren
4. Lint & Typecheck durchführen:
   ```bash
   npm run lint
   npm run typecheck
   ```
5. Commit mit klarem Commit-Message:
   ```bash
   git commit -m "feat: add booking cancellation with reason"
   ```
6. Push zum Branch
7. Pull Request erstellen

### Code-Style

- **TypeScript strict mode** aktiviert
- **Prettier** für Formatierung (`npm run format`)
- **ESLint** für Linting (`npm run lint`)
- **Commits** folgen [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📄 License

MIT License – siehe [LICENSE](LICENSE) Datei für Details.

---

## 🙋 Support

Bei Fragen oder Issues:

- Erstelle ein [GitHub Issue](https://github.com/dein-org/swingz/issues)
- Kontaktiere das Team: **support@swingz.app**

---

**SWINGZ – Modern Tennis Club Management** 🎾
