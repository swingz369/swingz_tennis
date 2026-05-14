# 🔍 Umfassende Fehleranalyse & Konkreter Fix-Plan für SwingZ

**Erstellt:** 2026-05-12  
**Basierend auf:** Codebase-Analyse, Phase-Dokumente, TSOWAPP-Vergleich  
**Ziel:** Production-Ready Status mit Security, Scalability, Business Readiness  
**Reifegrad aktuell:** 8.5/10 (technisch) → 4/10 (Business)

---

## ⚠️ KRITISCHE SICHERHEITSLÜCKEN (P0-P1)

### 🔴 P0: Klartext-Credentials im Repository

**Problem:** Datei `Zugansdaten_SwingZ.txt` enthält echte Zugangsdaten für Supabase, Stripe, etc.

```bash
# 🔍 Detection
git log --all --full-history -- Zugansdaten_SwingZ.txt
git show <commit-hash>:Zugansdaten_SwingZ.txt

# 🛠️ Fix: Datei aus History komplett entfernen
pip install git-filter-repo
git filter-repo --path Zugansdaten_SwingZ.txt --invert-paths

# 🔄 Rotation: Alle Credentials sofort rotieren
# 1. Supabase: Project Settings → API Keys → Regenerate
# 2. Stripe: Dashboard → Developers → API Keys → Regenerate Secret Key
# 3. GitHub: Settings → Secrets → Alle alten Secrets löschen + neu anlegen
# 4. Vercel: Project Settings → Environment Variables → neu setzen

# ✅ Validation
git grep -i "password\|secret\|key" -- '*.env*' '*.txt' '*.md' | grep -v ".env.example"
```

**Impact:** CVSS ~8.5 (High) – öffentliche Credentials, sofortige Account-Übernahme möglich  
**Aufwand:** 1 Stunde (Git History rewrite) + 30min Rotation

---

### 🔴 P1: `SUPABASE_SERVICE_ROLE_KEY` Client-Exposure

**Problem:** Service Role Key umgeht RLS komplett. Wenn in Client-Bundle gelangt → Vollzugriff auf DB.

**Code-Check:**

```typescript
// ✅ RICHTIG: .env.local (nicht committet)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

// ❌ FALSCH: NEXT_PUBLIC_ prefix → Bundle
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=...

// 🔍 Scan: Wo wird serviceRole importiert?
grep -r "serviceRole" app/ components/ lib/ --include="*.ts" --include="*.tsx"
```

**Fix-Pattern:**

```typescript
// lib/supabase/server.ts – NUR SERVER SEITIG
import { createClient } from '@supabase/ssr';

export const createClientServer = (cookies: Cookies) => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // ← Niemals NEXT_PUBLIC_
    { cookies }
  );
};

// app/api/bookings/route.ts – Korrekte Verwendung
export async function GET(request: Request) {
  const supabase = await createClientServer(cookies());
  // ... DB Queries mit Service Role
}

// ❌ components/BookingList.tsx – NIEMALS!
import { createClientServer } from '@/lib/supabase/server';
// → 'use client' + server function = service role im Browser!
```

**Audit Checkliste:**

- [ ] `.env.local` enthält `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`? → Löschen!
- [ ] `SUPABASE_SERVICE_ROLE_KEY` in `package.json`? → `.env.example` anpassen
- [ ] Alle Imports von `lib/supabase/server.ts` in `'use client'` Komponenten finden:
  ```bash
  grep -r "createClientServer\|serviceRole" app/ components/ --include="*.tsx" | grep "use client" -B5
  ```
- [ ] Nur Supabase `anon` key im Client verwenden (`lib/supabase/client.ts`)

**Aufwand:** 2h (Code-Audit + Refactoring)

---

### 🟡 P2: Fehlende Content Security Policy (CSP)

**Problem:** Next.js setzt keine Security Headers. XSS-Risiko bei User-Generated Content (News, Kommentare).

**Fix in `next.config.ts`:**

```typescript
import { defineConfig } from 'next/config';

export default defineConfig({
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // <- unsafe-inline für shadcn/ui Dialogs needed
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.supabase.co https://*.vercel.app",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.stripe.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
});
```

**Testing:**

```bash
# Nach Deploy: curl -I https://your-app.vercel.app | grep -i "content-security-policy"
# ODER lokal: npm run dev → Browser DevTools → Network → Response Headers
```

**Aufwand:** 30min (Config) + 1h Testing/Refinement

---

## 🔐 AUTHENTIFIZIERUNG & AUTORISIERUNG

### 🟠 P1: Middleware Redirect-Loops

**Problem:** Wenn `matcher: ['/(.*)']` `/login` nicht excludiert → Endlos-Redirect.

**Code-Check (`middleware.ts`):**

```typescript
// ❌ FEHLER: Alle Routen inkl. Login werden geschützt
export const config = { matcher: ['/(.*)'] };

// ✅ FIX: Exclude statics + auth routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register|auth|api/auth|_next/.*).*)'],
};
```

**Test:** Manuell `/login` aufrufen → keine Redirect-Schleife.

**Aufwand:** 15min

---

### 🟠 P1: Client-Side Role Checks (Privilege Escalation)

**Problem:** Rollen nur im Frontend geprüft → User kann Role in DevTools ändern.

**Vulnerable Pattern:**

```tsx
// components/AdminDashboard.tsx
'use client';
export default function AdminDashboard() {
  const { user } = useUser();

  // ❌ FEHLER: Nur Client-Check
  if (user?.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  // Admin UI … // User kann role=admin in localStorage setzen!
}
```

**Sichere Pattern:**

```typescript
// app/admin/page.tsx – Server Component (oder Server Action)
export default async function AdminPage() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // ✅ Server-seitige Rollenprüfung
  if (profile.role !== 'admin') notFound(); // oder redirect('/')

  return <AdminDashboardUI user={user} />; // UI bleibt Client Component
}

// ODER: Server Action für Mutationen
'use server';
export async function deleteMember(memberId: string) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  // ... delete
}
```

**Audit:** Alle Admin/API-Routen auf Server-seitige Rollenprüfung prüfen.

**Aufwand:** 4h (alleRoutes auditieren + fixen)

---

### 🟠 P1: Fehlende RLS Policies (Row Level Security)

**Problem:** RLS aktiviert, aber keine Policies → entweder niemand oder jeder hat Zugriff.

**Check:**

```sql
-- In Supabase SQL Editor ausführen:
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'profiles', 'bookings', 'courts', 'club_memberships', 'persons'
);

-- Policies auflisten:
SELECT
  schemaname, tablename, policyname,
  permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

**Mindest-Policies (Beispiele):**

```sql
-- 1. profiles: User sieht eigenes Profil, Admin sieht alle
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );

-- 2. bookings: Member sieht eigene + Gruppen-Buchungen, Admin sieht alle
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (
    person_id IN (
      SELECT person_id FROM club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 3. courts: Alle lesen, nur Admin schreibt
CREATE POLICY "courts_select_public" ON courts FOR SELECT USING (true);
CREATE POLICY "courts_insert_admin" ON courts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. club_memberships: Nur Admin/Owner
CREATE POLICY "memberships_admin_all" ON club_memberships
  FOR ALL USING (
    role IN ('admin', 'superadmin') OR user_id = auth.uid()
  );
```

**Test-Pattern:**

```sql
-- Als Member testen (nicht eigene Buchungen?)
SET ROLE authenticated_user; -- Oder echten Member-Token verwenden
SELECT * FROM bookings WHERE club_id = 'other-club-id'; -- Sollte 0 rows zurückgeben
```

**Aufwand:** 4h (Policies definieren + testen)

---

## 🗄️ DATABASE & DRIZZLE

### 🟠 P1: Doppelbuchungs-Race Condition

**Problem:** Zwei Nutzer buchen gleichen Slot parallel → Race Condition → Doppelbuchung.

**Solution 1: DB-Level Exclusion Constraint (PostgreSQL)**

```sql
-- Erfordert btree_gist Extension (einmalig)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Tabelle bookings muss tstzrange Spalte haben (oder start_time, end_time)
ALTER TABLE bookings ADD CONSTRAINT no_double_booking_exclusion
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  );
```

**Migration-SQL (`supabase/migrations/001_add_exclusion_constraint.sql`):**

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  );

COMMIT;
```

**Test:**

```sql
-- Sollte FAILEN bei Doppelbuchung:
INSERT INTO bookings (court_id, start_time, end_time, person_id)
VALUES ('court-1', '2026-05-15 14:00', '2026-05-15 15:00', 'user-a');

INSERT INTO bookings (court_id, start_time, end_time, person_id)
VALUES ('court-1', '2026-05-15 14:00', '2026-05-15 15:00', 'user-b');
-- ERROR: conflicting key value violates exclusion constraint
```

**Solution 2: Advisory Lock (application-level)**

```typescript
// lib/services/booking.service.ts
async function createBooking(data: CreateBookingDTO): Promise<Booking> {
  const supabase = await createClientServer(cookies());

  // Advisory Lock für courtId (verhindert parallele Transaktionen)
  const { error: lockError } = await supabase.rpc('pg_advisory_xact_lock', {
    lockKey: `booking:${data.courtId}`,
  });
  if (lockError) throw new Error('Lock failed');

  try {
    // Check for conflicts (WITH lock held)
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('court_id', data.courtId)
      .gte('start_time', data.startTime)
      .lte('end_time', data.endTime)
      .eq('status', 'confirmed');

    if (conflicts.length > 0) {
      throw new Error('Court already booked');
    }

    // Insert
    const { data: booking, error } = await supabase.from('bookings').insert(data).select().single();

    if (error) throw error;
    return booking;
  } finally {
    // Lock wird automatisch am Transaktionsende released
  }
}
```

**PostgreSQL Function (optional, falls pg_advisory_xact_lock nicht direkt):**

```sql
CREATE OR REPLACE FUNCTION pg_advisory_xact_lock(key bigint)
RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;
```

**Aufwand:** 2h (Constraint + Testing)

---

### 🟡 P2: Drizzle Schema ↔ Migration Drift

**Problem:** Drizzle Schema geändert, aber Migration nicht generiert/angewendet → Runtime-Fehler.

**Standard-Workflow:**

```bash
# 1. Schema-Änderung in drizzle/schema/*.ts
# 2. Migration generieren:
npx drizzle-kit generate

# 3. Migration reviewen (SQL in drizzle/migrations/)
# 4. Migration anwenden:
npx drizzle-kit migrate

# 5. CI/CD prüft: migrations Ordner ist versioniert
```

**Fehler-Muster:**

- `drizzle-kit push` verwendet (nur Dev, nicht Prod) → kein Version-Control
- Manuelle SQL-Änderungen in Supabase UI → Drizzle out-of-sync

**Validierung:**

```bash
# Generierte SQL gegen aktuelles Schema vergleichen
npx drizzle-kit generate --dry-run | diff - <(pg_dump -s -h localhost -U postgres swingz)

# Alle Migrationen lokal testen:
npx drizzle-kit migrate --reset  # Auf frischer DB
```

**Aufwand:** 1h (Workflow etablieren + Team-Schulung)

---

### 🟡 P2: Fehlende Indizes für Performance

**Kritische Queries identifizieren (aus Code):**

1. Booking Verfügbarkeit: `WHERE court_id = $1 AND start_time < $2 AND end_time > $3`
2. Trainer Verfügbarkeit: `WHERE user_id = $1 AND weekday = $2`
3. Club Memberships: `WHERE user_id = $1 AND status = 'active'`
4. Personen-Suche (Admin): `WHERE club_id = $1 AND (name ILIKE $2)`

**Index-Check:**

```sql
-- Explainer für Top-5 Queries
EXPLAIN ANALYZE
SELECT * FROM bookings
WHERE court_id = '...' AND start_time >= '...' AND end_time <= '...';

-- Fehlende Indizes ergänzen:
CREATE INDEX idx_bookings_court_time_status ON bookings (court_id, start_time, status);
CREATE INDEX idx_trainer_availability_user_weekday ON trainer_availability (user_id, weekday);
CREATE INDEX idx_club_memberships_user_active ON club_memberships (user_id, status) INCLUDE (club_id, role);
```

**Aufwand:** 1h (Analyse + Index-Create)

---

## 🖥️ NEXT.JS / TYPESCRIPT

### 🟠 P1: Server/Client Component Boundary Violations

**Problem:** Server Components nutzen `useEffect`, `useState` oder importieren Client-only Supabase Client.

**Check:**

```bash
# Finde potentielle Server Components mit Hooks:
grep -r "useState\|useEffect" app/ --include="*.tsx" | grep -v "use client"

# Finde server.ts-Import in Client Components:
grep -r "from '@/lib/supabase/server'" components/ app/ --include="*.tsx" | head -20
```

**Fix-Pattern:**

```typescript
// ❌ FALSCH: Server Component mit Client-Hook
// app/dashboard/page.tsx (kein 'use client')
export default async function Dashboard() {
  const [data, setData] = useState(null); // Build-Error!
}

// ✅ RICHTIG: Entweder rein Server Component
export default async function Dashboard() {
  const bookings = await getBookings(); // async direkt im Component
  return <BookingList data={bookings} />; // BookingList ist Client Component
}

// ODER: Client Component explizit markieren
'use client';
export default function DashboardClient() {
  const [data, setData] = useState(null);
  // ...
}
```

**Aufwand:** 2h (Audit + Refactoring)

---

### 🟡 P2: TypeScript Strictness – `any`-Elimination

**Current:** 98 `any` occurrences (aus PHASE_3_UPDATES.md)

**Priorisierung:**

1. **Server Actions / API Routes** – Highest (Security)
2. **Drizzle Queries** – Response-Typen präzise
3. **Supabase Types** – Generierte Types verwenden

**Fix:**

```typescript
// ❌ BAD: any (fängt Type-Fehler nicht)
function processBooking(data: any): any {
  /* ... */
}

// ✅ GOOD: Explizite Types aus Drizzle
import { bookings } from '@/db/schema';
type Booking = typeof bookings.$inferSelect;

function processBooking(data: Booking): Booking {
  return { ...data, status: 'confirmed' as const };
}

// Für unbekannte JSON:
type Json = Record<string, unknown>;
function processPayload(payload: Json): Result<void> {
  /* ... */
}
```

**Tooling:**

```bash
# any-Zählung:
grep -r ":\s*any\b" src/ --include="*.ts" --include="*.tsx" | wc -l

# ESLint Rule aktivieren (falls nicht):
npx eslint . --rule '@typescript-eslint/no-explicit-any': 'error'
```

**Aufwand:** 1-2 Tage (je nach Umfang)

---

### 🟡 P2: Validierung – Zod auf Client + Server

**Problem:** Input-Validierung oft nur Client-seitig → Manipulation möglich.

**Shared Zod Schema:**

```typescript
// lib/validations/booking.ts
import { z } from 'zod';

export const bookingSchema = z
  .object({
    courtId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'Endzeit muss nach Startzeit liegen',
  });

export type BookingInput = z.infer<typeof bookingSchema>;
```

**Client:**

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function BookingForm() {
  const form = useForm({
    resolver: zodResolver(bookingSchema),
  });
  // ...
}
```

**Server Action:**

```typescript
'use server';
import { bookingSchema } from '@/lib/validations/booking';

export async function createBooking(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = bookingSchema.safeParse(raw);

  if (!result.success) {
    return { success: false, errors: result.error.format() };
  }

  // Validated data → DB
  await db.insert(bookings).values(result.data);
}
```

**Aufwand:** 4h (alle kritischen Formulare)

---

## 🏗️ CI/CD & BUILD PIPELINE

### 🟠 P1: GitHub Actions – Node Version Drift

**Problem:** CI nutzt Node 24, lokales Development Node 20 → unterschiedliche Builds.

**Fix:**

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc' # ← Zentrale Version
          cache: 'npm'
      - run: npm ci # NICHT npm install
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
```

**.nvmrc:**

```
24
```

**Aufwand:** 1h (CI-Fix + Node auf allen Dev-Machines updaten)

---

### 🟡 P2: Missing E2E Tests

**Current:** Playwright Config vorhanden, aber vermutlich keine/wenige Tests.

**Mindest-Tests:**

```
tests/e2e/
├── auth.spec.ts           # Login/Logout Flow
├── booking-flow.spec.ts   # Court buchen (Member)
├── admin-setup.spec.ts    # Club Setup (Admin)
└── trainer-availability.spec.ts
```

**Beispiel (`booking-flow.spec.ts`):**

```typescript
import { test, expect } from '@playwright/test';

test('Member can book a court', async ({ page }) => {
  // 1. Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'member@test.com');
  await page.fill('[name="password"]', 'testpass');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/member');

  // 2. Navigate to booking
  await page.click('text=Buchen');

  // 3. Select court and time
  await page.click('[data-testid="court-1"]');
  await page.click('[data-testid="time-slot-14:00"]');

  // 4. Confirm
  await page.click('button:has-text("Buchen")');
  await expect(page).toHaveURL('/member/bookings/confirmation');
});
```

**Aufwand:** 2-3 Tage (Test-Infra + 10 kritische User Journeys)

---

## 📱 UX / FRONTEND

### 🟡 P2: Missing Loading/Error States

**Problem:** Next.js 15 Server Components ohne `loading.tsx`/`error.tsx` → Weiße Seite bei Fehlern.

**Pattern:**

```
app/(protected)/bookings/
├── page.tsx          # Hauptseite (Server Component)
├── loading.tsx       # Skeleton UI
├── error.tsx         # Error Boundary mit Retry
└── layout.tsx        # Optional ( Breadcrumbs, etc.)
```

**`loading.tsx`:**

```tsx
export default function BookingsLoading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-200 h-20 rounded" />
      ))}
    </div>
  );
}
```

**`error.tsx`:**

```tsx
'use client';
export default function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <h2>Etwas ist schiefgelaufen</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>Neu laden</button>
    </div>
  );
}
```

**Aufwand:** 3h (alle Route-Segmente)

---

### 🟡 P2: Form-Validierung komplett (Client + Server)

**Current State:** Vermutlich React Hook Form ohne Zod oder nur Client.

**Shared Validation:**

```typescript
// lib/validations/index.ts (export alle Schemas)
export * from './booking';
export * from './member';
export * from './trainer';

// components/BookingForm.tsx
('use client');
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema } from '@/lib/validations';

export function BookingForm() {
  const form = useForm({
    resolver: zodResolver(bookingSchema),
  });
  // …
}

// app/api/bookings/route.ts (oder Server Action)
export async function POST(request: Request) {
  const supabase = await createClientServer(cookies());
  const body = await request.json();

  const validated = bookingSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  // ... Insert
}
```

**Aufwand:** 4h (alle Formulare)

---

## 🎯 ONBOARDING & DEMO MODE

### 🟡 P2: Demo-Modus-Trigger zu häufig (bekanntes Problem)

**Problem:** `ProtectedRoute` oder `useUserData` triggert Demo-Modus bei jedem Mount.

**Fix:**

```typescript
// lib/demo-mode.ts
const DEMO_MODE_COOKIE = 'demo-mode';

export async function isDemoModeEnabledAsync(): Promise<boolean> {
  const cookieStore = cookies();
  const demoCookie = cookieStore.get(DEMO_MODE_COOKIE);
  return demoCookie?.value === 'true' || false;
}

// components/layout/protected-route.tsx
export default async function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // DEMO MODE: NUR IN DEVELOPMENT
  const isDemo = process.env.NODE_ENV === 'development' && await isDemoModeEnabledAsync();

  // Demo-Daten NUR wenn .env.local fehlt (nicht wenn Staging/Production)
  if (isDemo && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <DemoModeBanner />;
  }

  // Normaler Flow
  const { data: profile } = await supabase.from('profiles').select('*').single();
  if (!profile) redirect('/onboarding');

  return <>{children}</>;
}
```

**Austria/Liechtenstein-Support:** Falls Demo-Modus komplett deaktiviert werden soll:

```typescript
// .env.local (Development)
NEXT_PUBLIC_DEMO_MODE_ENABLED = false;
```

**Aufwand:** 2h (Refactoring + Testing)

---

## 📊 MONITORING & LOGGING

### 🟡 P2: Structured Logging (statt console.log)

**Problem:** Zufällige `console.log`/`console.error` in Code → Logs nicht zentral.

**Solution:**

```typescript
// lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
  //Für Sentry korrelieren:
  // serializers: { req: pino.stdSerializers.req, err: pino.stdSerializers.err }
});

export { logger };

// Usage:
import { logger } from '@/lib/logger';
logger.info({ userId, clubId, bookingId }, 'Booking created');
logger.error({ error, stack }, 'Payment failed');
```

**Sentry Integration:**

```typescript
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

logger.error({ error, userId }, 'Critical error');
Sentry.captureException(error, { user: { id: userId } });
```

**Aufwand:** 2h (Logger einbauen + bestehende console.\* ersetzen)

---

### 🟢 P3: Custom Business Metrics

**Track mit Prometheus/Grafana ODER Amplitude/Mixpanel:**

```typescript
// Instrumentierung in Server Actions:
'use server';
export async function createBookingAction() {
  const start = Date.now();

  try {
    const result = await createBooking();
    const duration = Date.now() - start;

    // Custom metric
    metrics?.bookingCreated?.observe({
      success: true,
      duration,
      clubId: result.club_id,
    });

    return result;
  } catch (error) {
    metrics?.bookingCreated?.observe({ success: false, error: error.name });
    throw error;
  }
}
```

**Aufwand:** 3h (Metrics Setup + Dashboard)

---

## 🏗️ DATABASE MIGRATIONS – BEST PRACTICES

### 🔴 P1: Zero-Downtime Migrations für Production

**Fehler:** Direktes `ALTER TABLE … ADD COLUMN NOT NULL` → Downtime.

**Pattern:**

```sql
-- 1. Nullable Spalte hinzufügen (sofort)
ALTER TABLE bookings ADD COLUMN external_reference TEXT;

-- 2. Backfill Daten in Background-Job (Node.js Script)
-- scripts/backfill-external-reference.ts
const { data } = await supabase.from('bookings').select('id').is('external_reference', null);
for (const booking of data) {
  await supabase.from('bookings')
    .update({ external_reference: generateRef() })
    .eq('id', booking.id);
}

-- 3. NOT NULL Constraint + Default (nach Backfill)
ALTER TABLE bookings ALTER COLUMN external_reference SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN external_reference SET DEFAULT '';

-- 4. Index hinzufügen (wenn nötig)
CREATE INDEX idx_bookings_external_ref ON bookings(external_reference);
```

**Aufwand:** 2h pro komplexe Migration (Backfill-Skript)

---

## 📦 PACKAGE.JSON & METADATEN

### 🟢 P3: `package.json` Name Mismatch

```json
{
  "name": "swingz", // statt "tsow-app"
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=10.0.0"
  }
}
```

**Aufwand:** 5min

---

## 📋 ZUSAMMENFASSUNG – PRIORISIERTER 90-TAGE PLAN

### Week 1-2: KRITISCHE SICHERHEIT (40h)

| Tag | Task                                                                   | Aufwand |
| --- | ---------------------------------------------------------------------- | ------- |
| 1   | Git History bereinigen (Zugansdaten_SwingZ.txt) + Credentials rotieren | 4h      |
| 2   | SUPABASE_SERVICE_ROLE_KEY Client-Exposure Audit + Fix                  | 4h      |
| 3   | Middleware Redirect-Loops fixen + Testen                               | 2h      |
| 4   | RBAC Server-seitige Prüfung in allen API Routes implementieren         | 8h      |
| 5   | RLS Policies komplett prüfen/erstellen für alle Tabellen               | 8h      |
| 6   | CSP + Security Headers konfigurieren + Testen                          | 4h      |
| 7   | Doppelbuchungs-Constraint (Exclusion Constraint)                       | 4h      |
| 8   | Validation: Zod Schemas für alle kritischen Inputs                     | 6h      |

**Week 1-2 Deliverable:** Security-Hardened, keine kritischen CVEs mehr.

---

### Week 3-4: DATABASE & PERFORMANCE (32h)

| Tag | Task                                          | Aufwand |
| --- | --------------------------------------------- | ------- |
| 9   | Drizzle Schema ↔ Migration Sync herstellen    | 4h      |
| 10  | Index-Strategie: Top 10 Queries indizieren    | 4h      |
| 11  | Server/Client Component Boundary Audit + Fix  | 8h      |
| 12  | TypeScript any-Elimination (Top 10 Dateien)   | 8h      |
| 13  | PWA Manifest + Service Worker konfigurieren   | 4h      |
| 14  | Stripe Payment Integration starten (DB + API) | 4h      |

**Week 3-4 Deliverable:** Performance-Optimiert, PWA-fähig, Payment-API bereit.

---

### Week 5-6: MONETARISIERUNG & UX (32h)

| Tag | Task                                            | Aufwand |
| --- | ----------------------------------------------- | ------- |
| 15  | Stripe Checkout/Webhook implementieren + Testen | 8h      |
| 16  | Invoice PDF Generation (@react-pdf/renderer)    | 6h      |
| 17  | Onboarding-Flow optimieren (Demo-Modus fix)     | 4h      |
| 18  | Loading/Error States in allen Route-Segmenten   | 6h      |
| 19  | Mobile Bottom Navigation für Member/Trainer     | 4h      |
| 20  | Test: End-to-End Payment Flow (Playwright)      | 4h      |

**Week 5-6 Deliverable:** Payment MVP, Onboarding <30min, Mobile-optimiert.

---

### Week 7-8: TESTING & DEVOPS (32h)

| Tag | Task                                             | Aufwand |
| --- | ------------------------------------------------ | ------- |
| 21  | Playwright E2E Tests: 10 kritische User Journeys | 12h     |
| 22  | CI/CD Pipeline: Node 24 pin, npm ci, Caching     | 4h      |
| 23  | Sentry Error Monitoring + Custom Metrics         | 4h      |
| 24  | Structured Logging (Pino) + Integration          | 4h      |
| 25  | Load Testing (k6, 100 concurrent users)          | 4h      |
| 26  | Security Audit: npm audit, OWASP ZAP Scan        | 4h      |

**Week 7-8 Deliverable:** Vollautomatisierte Tests, Monitoring, Load-tested.

---

### Week 9-10: PILOT LAUNCH & MARKETING (40h)

| Tag | Task                                                | Aufwand |
| --- | --------------------------------------------------- | ------- |
| 27  | Stripe Live-Modus aktivieren, Webhook konfigurieren | 4h      |
| 28  | Pricing Page + FAQ/Support Knowledge Base           | 8h      |
| 29  | 5 Pilot-Clubs identifizieren + Onboarding-Calls     | 12h     |
| 30  | SEO: Landing Pages, Blog Posts (Content Marketing)  | 8h      |
| 31  | Analytics: Amplitude/Mixpanel Integration           | 4h      |
| 32  | Weekly Metrics Dashboard (Notion/Google Sheets)     | 4h      |

**Week 9-10 Deliverable:** 3-5 Pilot-Clubs live mit Payment, MRR startet.

---

### Week 11-12: ITERATE & SCALE (40h)

| Tag | Task                                                         | Aufwand |
| --- | ------------------------------------------------------------ | ------- |
| 33  | Pilot-Feedback auswerten + Priorisierung                     | 4h      |
| 34  | KI Trainingsplanung V2 (Algorithmus + Claude)                | 16h     |
| 35  | Internal Messaging System (Socket.io oder Supabase Realtime) | 12h     |
| 36  | Guest Booking Feature                                        | 8h      |
| 37  | QBR: Metrics Review, Roadmap Q3 anpassen                     | 4h      |

**Week 11-12 Deliverable:** MRR >3,000€, NPS >40, Roadmap für Q3-Q4.

---

## 📊 SUCCESS METRICS (90-Tage-Ziele)

| Metric            | Target | Current | Verantwortlich |
| ----------------- | ------ | ------- | -------------- |
| Active Clubs      | 25     | 0       | Sales/Founder  |
| MRR               | 3,000€ | 0€      | Finance        |
| CAC               | <50€   | -       | Marketing      |
| Churn Rate        | <5%    | -       | CS             |
| NPS               | >40    | -       | Product        |
| Week 1 Retention  | >50%   | -       | Onboarding     |
| LCP (Performance) | <1.5s  | ~3s     | Dev            |
| Error Rate        | <0.1%  | ~0.5%   | Dev            |
| Test Coverage     | >80%   | ~60%    | Dev            |

---

## 🚨 RISIKO-MONITORING

| Risk                | Status               | Owner   | Next Action                         |
| ------------------- | -------------------- | ------- | ----------------------------------- |
| Stripe Integration  | In Progress (Week 5) | Dev     | Sandbox testen, Live Go-Live Week 9 |
| Pilot Acquisition   | Not Started          | Founder | 5 Zusagen bis Week 9                |
| Technical Debt      | Medium               | Dev     | 20% Zeit für Refactoring            |
| TSOWAPP Competition | Monitoring           | Founder | Feature comparison weekly           |
| GDPR Compliance     | Partial (RLS ok)     | Legal   | DPA mit Stripe unterschreiben       |

---

## 📞 KONTAKT & VERANTWORTLICHKEITEN

- **Technical Lead:** [Name] – Verantwortlich für Code-Qualität, Security, Performance
- **Product Manager:** [Name] – Feature-Priorisierung, Roadmap, Pilot-Management
- **Founder:** [Name] – Business Development, Partnerships, Fundraising
- **Customer Success:** [Name] – Pilot-Betreuung, Onboarding, Support

---

**Dokument abgeschlossen:** 2026-05-12  
**Nächste Review:** Weekly Metrics Meeting (Montag 9:00)  
**Version:** 1.0 (Actionable Fix-Plan)

---

_Dieser Plan ist als konkrete Arbeitsanweisung für das Entwicklungsteam gedacht. Alle Tasks sind priorisiert, mit Aufwandsschätzung und Deliverables._
