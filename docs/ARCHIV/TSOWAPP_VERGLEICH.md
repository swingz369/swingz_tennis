# 🔄 TSOWAPP vs. SwingZ — Technischer Vergleich & Verbesserungsideen

**Datum:** 2026-06-03
**Referenz:** `/home/aeugeln/Entwicklun/TSOWAPP/Entwicklung/tsowapp/`
**Ziel:** Identifikation von bewährten Mustern aus TSOWAPP, die SwingZ verbessern können.

---

## 📊 Überblick

| Aspekt               | TSOWAPP                                       | SwingZ                           |
| -------------------- | --------------------------------------------- | -------------------------------- |
| **Framework**        | Next.js 16.2.4 (App Router)                   | Next.js 16 (App Router)          |
| **Monorepo**         | ✅ Turborepo (`apps/web`)                     | ❌ Single-App                    |
| **Backend**          | Supabase + Drizzle                            | Supabase + Drizzle               |
| **UI**               | Bootstrap + Tailwind (gemischt)               | Tailwind + shadcn/ui             |
| **i18n**             | ✅ next-intl                                  | ❌ Deutsch hardcoded             |
| **Auth**             | Supabase SSR + Cookies                        | Supabase SSR + Cookies           |
| **Caching**          | ✅ `unstable_cache` mit Tiers                 | ❌ Kein systematisches Caching   |
| **Env-Validierung**  | ✅ `@t3-oss/env-nextjs` + Zod                 | ❌ Manuell `process.env!`        |
| **Error Boundaries** | ✅ Pro Route-Segment                          | ❌ Fehlen größtenteils           |
| **Loading States**   | ✅ Skelette pro Segment                       | ⚠️ Teilweise (Loader-Spinner)    |
| **Rate Limiting**    | Upstash + In-Memory                           | Upstash + In-Memory              |
| **AI**               | Anthropic Claude (Singleton)                  | OpenAI + Gemini (Multi-Provider) |
| **Testing**          | Vitest + Playwright (unit + e2e)              | Vitest + Playwright (unit + e2e) |
| **Sentry**           | ✅ Monitoring                                 | ✅ Monitoring                    |
| **Codebase-Größe**   | ~126 Seiten (58 Admin, 39 Member, 29 Trainer) | ~55+ Seiten                      |

---

## 🏗️ 1. ARCHITEKTUR & PROJEKTSTRUKTUR

### TSOWAPP: Monorepo mit Turborepo

```
tsowapp/
├── apps/web/          ← Hauptanwendung
├── packages/          ← Shared Packages
├── turbo.json         ← Build-Pipeline
└── package.json       ← Workspaces
```

### SwingZ: Single-App

```
SwingZ/
├── app/               ← Next.js App Router
├── components/
├── lib/
├── src/
└── package.json
```

### 💡 Empfehlung für SwingZ

- **Kein Monorepo nötig** — SwingZ ist eine einzelne App, ein Monorepo wäre Overhead.
- **Aber:** Die `src/`-Struktur (Domain-Driven mit `domain/`, `application/`, `infrastructure/`) ist bereits sauberer als TSOWAPPs flache `lib/`-Struktur. **SwingZ hat hier die Nase vorn.**

---

## 🔐 2. AUTH & ROUTE PROTECTION

### TSOWAPP: `requireAdminClub()` Pattern

```typescript
// lib/admin-club.ts
export async function requireAdminClub() {
  const user = await getUserFromCookies();
  if (!user) redirect('/login');

  const memberships = await supabase
    .from('club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .in('role', ['admin', 'superadmin']);

  const clubId = resolveClubId(memberships);
  return { supabase, user, clubId, isSuperadmin };
}
```

**Vorteil:** Jede Admin-Seite ruft EINE Funktion auf und erhält Supabase-Client + Club-Kontext + Rollen-Check. **Einzeiler statt Boilerplate.**

### SwingZ: Wiederholter Pattern pro Seite

```typescript
// Jede Seite wiederholt:
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) redirect('/login');
const { data: memberships } = await supabase
  .from('user_club_memberships')
  .select('role, club_id')
  .eq('user_id', user.id)
  .eq('is_active', true);
const isSuperadmin = memberships?.some((m) => m.role === 'superadmin');
const clubId = memberships?.find((m) => m.role === 'admin')?.club_id;
```

### 💡 Empfehlung für SwingZ

**DRINGEND: `requireAdminClub()` Helper einführen.** Aktuell wird der gleiche 15-Zeilen-Block in jeder Admin-Seite wiederholt. Ein `lib/admin-context.ts` mit `requireAdminClub()`, `requireMemberContext()` und `requireTrainerContext()` würde:

- Code-Duplikation eliminieren (20+ Seiten × 15 Zeilen = ~300 Zeilen weniger)
- Konsistente Fehlerbehandlung garantieren
- Club-Kontext-Bugs (wie den courts/billing "Laden..."-Bug) von vornherein verhindern

---

## 📦 3. CACHING-STRATEGIE

### TSOWAPP: 4-Tier-Caching mit `unstable_cache`

```typescript
const cacheConfig = {
  static: { revalidate: 3600 }, // 1h — Clubs, Courts
  semistatic: { revalidate: 300 }, // 5m — Stats, Trainer
  dynamic: { revalidate: 60 }, // 1m — Bookings, Invoices
  realtime: { revalidate: 0 }, // 0s  — Messages
};

// Usage:
const courts = await getCachedData(
  `courts:${clubId}`,
  () => fetchCourts(clubId),
  cacheConfig.static
);

// Invalidation:
invalidateClubCache(clubId, 'courts');
```

### SwingZ: Kein systematisches Caching

Jeder Request geht direkt an Supabase — keine serverseitige Zwischenspeicherung.

### 💡 Empfehlung für SwingZ

**Mittelfristig: Caching-Tier einführen.** Besonders für:

- **Statisch:** Plätze, Vereinseinstellungen, Branding (seltene Änderungen)
- **Semi-statisch:** Trainer-Verfügbarkeit, Saison-Konfiguration
- **Dynamisch:** Buchungen, Rechnungen (kurze TTL)
- **Echtzeit:** Nachrichten, Benachrichtigungen (kein Cache)

Das würde die DB-Last erheblich reduzieren und die Ladezeiten verbessern.

---

## ⚠️ 4. ERROR BOUNDARIES & LOADING STATES

### TSOWAPP: Granulare Error-UX pro Segment

```
app/
├── admin/
│   ├── error.tsx        ← Admin-Fehlerboundary
│   ├── loading.tsx      ← Admin-Skelett
│   ├── members/
│   │   ├── loading.tsx  ← Mitglieder-Skelett
│   │   └── [id]/edit/
│   │       └── loading.tsx
│   ├── finances/
│   │   └── loading.tsx
│   ├── stats/
│   │   └── loading.tsx
│   └── ...
├── member/
│   ├── error.tsx
│   └── loading.tsx
├── trainer/
│   ├── error.tsx
│   └── loading.tsx
└── not-found.tsx
```

### SwingZ: Fehlende Error-Boundaries

Die meisten Seiten haben kein `error.tsx` oder `loading.tsx`. Bei Fehlern wird eine weiße Seite oder der Next.js-Default-Error angezeigt.

### 💡 Empfehlung für SwingZ

**DRINGEND: Error-Boundaries einführen.** Priorität:

1. `app/(protected)/error.tsx` — Globaler Protected-Error-Boundary
2. `app/(protected)/admin/error.tsx` — Admin-spezifisch
3. `app/(protected)/admin/*/loading.tsx` — Skelette für alle Admin-Sektionen
4. `app/(protected)/member/error.tsx` — Member-spezifisch
5. `app/(protected)/trainer/error.tsx` — Trainer-spezifisch

Das würde die UX dramatisch verbessern — statt weißer Seite sieht der User eine verständliche Fehlermeldung mit "Erneut versuchen"-Button.

---

## 🔧 5. ENV-VALIDIERUNG

### TSOWAPP: `@t3-oss/env-nextjs` + Zod

```typescript
// lib/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    ANTHROPIC_API_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // ...
  },
});
```

### SwingZ: Manuell `process.env!`

Überall wird `process.env.NEXT_PUBLIC_SUPABASE_URL!` verwendet — keine Validierung, kein Autocomplete, keine Typsicherheit.

### 💡 Empfehlung für SwingZ

**`@t3-oss/env-nextjs` einführen.** Vorteile:

- Typsichere Env-Variablen mit Autocomplete
- Fehlende Variablen werden beim Build erkannt (nicht erst in Production)
- Dokumentation aller benötigten Variablen in einer Datei
- `skipValidation` für Tests

---

## 📐 6. DATENABFRAGEN & PAGINATION

### TSOWAPP: Server-Side Pagination mit `searchParams`

```typescript
// admin/members/page.tsx
export default async function MembersPage({ searchParams }) {
  const { page, search, role } = await searchParams;
  const offset = (Number(page) || 0) * 50;

  const { data, count } = await supabase
    .from('club_memberships')
    .select('*, persons(*)', { count: 'exact' })
    .range(offset, offset + 49)
    .order('created_at', { ascending: false });

  // Pagination-Komponente mit count
}
```

### SwingZ: Meistens alle Daten auf einmal laden

Die meisten Seiten laden alle Datensätze ohne Pagination — das skaliert nicht.

### 💡 Empfehlung für SwingZ

**Server-Side Pagination einführen** für:

- Mitgliederliste (`/admin/members`)
- Rechnungen (`/admin/billing`)
- Buchungen (`/bookings`)
- Audit-Logs (`/admin/audit-logs`)
- Shop-Bestellungen (`/admin/shop`)

---

## 🎨 7. UI-KOMPONENTEN & PATTERNS

### TSOWAPP: `StatCard` & `EmptyState` als wiederverwendbare Patterns

```tsx
// StatCard — flexibel mit Icon, Trend, Farbe, Link
<StatCard
  icon={Users}
  label="Aktive Mitglieder"
  value={stats.active_members}
  trend={+12}
  color="blue"
  href="/admin/members"
/>

// EmptyState — konsistente leere Zustände
<EmptyState
  icon={Calendar}
  title="Keine Buchungen"
  description="Noch keine Buchungen vorhanden."
  action={{ label: "Jetzt buchen", href: "/bookings" }}
/>
```

### SwingZ: Hat `IconBox` und `EmptyState` bereits

SwingZ hat bereits gute UI-Primitives (`IconBox`, `EmptyState`-Pattern in einigen Komponenten). Allerdings werden sie nicht konsistent eingesetzt.

### 💡 Empfehlung für SwingZ

- **`StatCard`-Komponente erstellen** — wird aktuell inline in mehreren Dashboards gebaut
- **EmptyState-Pattern konsistent einsetzen** — alle Listen-Seiten sollten den gleichen EmptyState verwenden
- **Formatierungshelpers zentralisieren** — `lib/format.ts` mit `formatDate()`, `formatTime()`, `formatCurrency()` (einige existieren bereits, aber nicht zentral)

---

## 🌍 8. INTERNATIONALISIERUNG (i18n)

### TSOWAPP: `next-intl` für Mehrsprachigkeit

```typescript
// Root Layout
<NextIntlClientProvider>
  {children}
</NextIntlClientProvider>
```

### SwingZ: Deutsch hardcoded

Alle Strings sind direkt im Code — keine i18n-Infrastruktur.

### 💡 Empfehlung für SwingZ

- **Kurzfristig:** Kein Handlungsbedarf — die App ist nur für deutschsprachige Vereine.
- **Mittelfristig:** Falls Expansion geplant ist, `next-intl` einführen. Aktuell wäre es Overhead.

---

## 🤖 9. AI-INTEGRATION

### TSOWAPP: Zentralisierter AI-Client mit Personas

```typescript
// lib/ai.ts — Singleton + definierte System-Prompts
const CLUB_ANALYSIS_PROMPT = 'Du bist ein Experte für Tennisverein-Management...';
const SCHEDULING_PROMPT = 'Du bist ein Tennistrainer...';
```

### SwingZ: Multi-Provider (OpenAI + Gemini)

SwingZ unterstützt mehrere AI-Provider, was flexibler ist.

### 💡 Empfehlung für SwingZ

- **Die Multi-Provider-Strategie ist besser** als TSOWAPPs Single-Provider-Ansatz
- **Aber:** System-Prompts sollten zentralisiert werden (ähnlich wie TSOWAPPs `CLUB_ANALYSIS_PROMPT`) statt sie inline in API-Routen zu definieren

---

## 🧪 10. TESTING

### TSOWAPP: Strukturierte Tests

```
tests/
├── components.test.tsx      ← Komponenten-Tests
├── rate-limit.test.ts       ← Unit-Tests
├── scheduling.test.ts       ← Domain-Tests
├── onboarding.test.ts       ← Flow-Tests
├── utils.test.ts            ← Utility-Tests
└── e2e/
    ├── auth.spec.ts
    ├── admin.spec.ts
    ├── member.spec.ts
    └── trainer.spec.ts
```

### SwingZ: Ähnlich, aber weniger Coverage

```
src/__tests__/               ← Unit-Tests
e2e/                         ← E2E-Tests (Midscene)
tests/                       ← Playwright-Tests
```

### 💡 Empfehlung für SwingZ

- **Rollenbasierte E2E-Tests** von TSOWAPP übernehmen: Separate Spec-Dateien für `admin`, `member`, `trainer`, `superadmin`
- **Domain-Tests** für Scheduling, Billing, Bookings ergänzen

---

## 📋 PRIORISIERTE ACTION-LISTE

### 🔴 Sofort umsetzen (hoher Impact, wenig Aufwand)

| #   | Verbesserung                                  | Aufwand | Impact                                                                     |
| --- | --------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| 1   | **`requireAdminClub()` Helper** einführen     | 2h      | 🔴 Hoch — eliminiert 300+ Zeilen Duplikation, verhindert Club-Kontext-Bugs |
| 2   | **Error-Boundaries** für alle Route-Segmente  | 3h      | 🔴 Hoch — verhindert weiße Fehlerseiten                                    |
| 3   | **Loading-Skelette** für Admin/Member/Trainer | 4h      | 🟡 Mittel — verbessert gefühlte Performance                                |

### 🟡 Mittelfristig (moderater Aufwand)

| #   | Verbesserung                                 | Aufwand | Impact                               |
| --- | -------------------------------------------- | ------- | ------------------------------------ |
| 4   | **`@t3-oss/env-nextjs`** einführen           | 2h      | 🟡 Mittel — Typsichere Env-Variablen |
| 5   | **Server-Side Pagination** für Listen-Seiten | 6h      | 🟡 Mittel — skaliert besser          |
| 6   | **`StatCard`-Komponente** extrahieren        | 2h      | 🟢 Niedrig — konsistenteres UI       |
| 7   | **`lib/format.ts`** zentralisieren           | 1h      | 🟢 Niedrig — weniger Duplikation     |

### 🟢 Langfristig (größerer Aufwand)

| #   | Verbesserung                         | Aufwand | Impact                            |
| --- | ------------------------------------ | ------- | --------------------------------- |
| 8   | **Caching-Tier** einführen           | 8h      | 🟡 Mittel — reduziert DB-Last     |
| 9   | **Rollenbasierte E2E-Tests**         | 12h     | 🟡 Mittel — bessere Test-Coverage |
| 10  | **AI-System-Prompts** zentralisieren | 2h      | 🟢 Niedrig — bessere Wartbarkeit  |

---

## ✅ WAS SWINGZ BESSER MACHT

Nicht alles bei TSOWAPP ist besser. SwingZ hat several Vorteile:

1. **Clean Architecture** (`domain/`, `application/`, `infrastructure/`) — TSOWAPP hat nur flache `lib/`
2. **shadcn/ui + Tailwind** statt Bootstrap-Mix — konsistenteres Designsystem
3. **Multi-Provider AI** (OpenAI + Gemini) — flexibler als Single-Provider
4. **CSRF-Schutz** im Proxy — TSOWAPP hat keinen solchen Schutz
5. **Drizzle ORM** mit Schema-Definitionen — sauberere DB-Schichten als reines Supabase-Client
6. **Feature-Flags** (`lib/features/feature-flags.ts`) — TSOWAPP hat keine
7. **Design-Tokens** (`design-tokens.json`) — TSOWAPP hat keine Designsystem-Dokumentation

---

## 🎯 FAZIT

Die **Top-3 Quick Wins** für SwingZ aus dem TSOWAPP-Vergleich:

1. **`requireAdminClub()` Auth-Guard-Helper** — Eliminiert massiven Code-Duplikat und verhindert die häufigsten Bugs (Club-Kontext null → "Laden...")
2. **Granulare Error-Boundaries + Loading-Skelette** — Transformiert die Fehler-UX von "weiße Seite" zu "professionelle Fehlerbehandlung"
3. **`@t3-oss/env-nextjs`** — Verhindert Production-Ausfälle durch fehlende Env-Variablen

Die anderen Verbesserungen sind sinnvoll, aber mit geringerer Priorität. SwingZ hat bereits eine bessere Architektur als TSOWAPP — die fehlenden Stücken sind vor allem UX- und DX-Verbesserungen.

---

_Erstellt: 2026-06-03 | Analyse basiert auf Codebase-Vergleich beider Projekte_
