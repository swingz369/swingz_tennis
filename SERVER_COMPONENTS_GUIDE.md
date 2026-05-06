# Server Components Migration Guide

**SwingZ - Performance Optimization**  
**Erstellt am:** 06.05.2026

---

## 📊 Aktueller Status

### ✅ Bereits Server Components (Gut!)

| Page                         | Status              | Grund                                 |
| ---------------------------- | ------------------- | ------------------------------------- |
| `dashboard/page.tsx`         | ✅ Server           | Perfekt! Fetched Daten serverseitig   |
| `admin/panel-v2/page.tsx`    | ✅ Server           | Korrekt, rendert Client-Component     |
| `courts/page.tsx`            | ✅ Server           | Nur Redirect                          |
| `profile/page.tsx`           | ✅ Server (Wrapper) | Page ist Server, Component ist Client |
| `training-schedule/page.tsx` | ✅ Server (Wrapper) | Page ist Server, Component ist Client |

### ❌ Client Components (Zu prüfen)

| Component                      | Status    | Interaktivität              | Migration möglich?            |
| ------------------------------ | --------- | --------------------------- | ----------------------------- |
| `bookings/page.tsx`            | ❌ Client | Hoch (Kalender, Formulare)  | ⚠️ Teilweise                  |
| `member-profile.tsx`           | ❌ Client | Hoch (Formulare, State)     | ⚠️ Teilweise                  |
| `member-training-schedule.tsx` | ❌ Client | Mittel (Kalendernavigation) | ⚠️ Teilweise                  |
| `member-dashboard.tsx`         | ❌ Client | Niedrig                     | ✅ Ja                         |
| `mobile-bottom-nav.tsx`        | ❌ Client | Niedrig (nur Routing)       | ❌ Nein (braucht usePathname) |
| `sidebar.tsx`                  | ❌ Client | Niedrig (nur Routing)       | ❌ Nein (braucht usePathname) |

---

## 🎯 Empfohlene Optimierungen

### 1. **Bookings Page - Split Pattern** 🔥 Hohe Priorität

Die Bookings Page ist zu groß und macht zu viel clientseitig. Empfohlene Aufteilung:

#### Vorher (407 Zeilen, alles Client)

```tsx
'use client';

export default function BookingsPage() {
  // Fetch Daten clientseitig
  const { data: sessions } = useSessions(clubId);

  // Rendere gesamte UI
  return <div>...</div>;
}
```

#### Nachher (Hybrid Approach)

```tsx
// app/(protected)/bookings/page.tsx - SERVER COMPONENT
import { createClient } from '@/lib/supabase/server';
import { BookingsClient } from './bookings-client';

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch initial data serverseitig
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('*, courts(*)')
    .eq('club_id', clubId)
    .order('start_time', { ascending: true });

  const { data: courts } = await supabase
    .from('courts')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true);

  // Pass data to client component
  return <BookingsClient initialSessions={sessions || []} courts={courts || []} userId={user.id} />;
}
```

```tsx
// bookings-client.tsx - CLIENT COMPONENT
'use client';

interface BookingsClientProps {
  initialSessions: Session[];
  courts: Court[];
  userId: string;
}

export function BookingsClient({ initialSessions, courts, userId }: BookingsClientProps) {
  // Hydrate with react-query for real-time updates
  const { data: sessions = initialSessions } = useSessions(clubId, {
    initialData: initialSessions,
  });

  // Nur interaktive Teile hier
  return <div>...</div>;
}
```

**Vorteile:**

- ⚡ Schnellerer Initial Page Load (SSR)
- 📦 Kleinere Client Bundle Size
- 🎨 Bessere SEO (falls relevant)
- 🔄 Progressive Enhancement

---

### 2. **Member Dashboard - Complete Server Component** ⭐ Mittlere Priorität

Der Member Dashboard braucht eigentlich kein 'use client':

#### Vorher

```tsx
'use client';

export function MemberDashboard({ user }: MemberDashboardProps) {
  return (
    <div>
      <Card>
        <Link href="/bookings">
          <Button>Platz buchen</Button>
        </Link>
      </Card>
    </div>
  );
}
```

#### Nachher

```tsx
// Kein 'use client' - Server Component!

export function MemberDashboard({ user }: MemberDashboardProps) {
  // Gleicher Code, aber rendert serverseitig
  return (
    <div>
      <Card>
        <Link href="/bookings">
          <Button>Platz buchen</Button>
        </Link>
      </Card>
    </div>
  );
}
```

**Was zu prüfen ist:**

- ✅ Keine `useState`, `useEffect`, `useContext`
- ✅ Keine Event Handler direkt (nur in verschachtelten Client Components)
- ✅ Nur Next.js Link, keine clientseitigen Routing-Hooks

---

### 3. **Profile & Training Schedule - Data Fetching** ⚡ Mittlere Priorität

Diese Pages können optimiert werden durch serverseitiges Data Fetching:

#### Pattern: Server Page + Client Interactive Parts

```tsx
// app/(protected)/profile/page.tsx - SERVER
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/profile/profile-form'; // Client Component

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile data serverseitig
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

  return <ProfileForm initialData={profile} />;
}
```

```tsx
// components/profile/profile-form.tsx - CLIENT
'use client';

export function ProfileForm({ initialData }: { initialData: Profile }) {
  const [formData, setFormData] = useState(initialData);

  // Interaktive Form-Logik hier
  return <form>...</form>;
}
```

---

## 📋 Implementierungs-Checkliste

### Phase 1: Quick Wins (1-2 Tage)

- [ ] **Member Dashboard zu Server Component konvertieren**
  - Datei: `components/dashboard/member-dashboard.tsx`
  - Aufwand: 30 Minuten
  - Risiko: Niedrig
- [ ] **Trainer Dashboard prüfen**
  - Datei: `components/dashboard/trainer-dashboard.tsx`
  - Ähnlich wie Member Dashboard
- [ ] **Admin Dashboard prüfen**
  - Datei: `components/dashboard/admin-dashboard.tsx`
  - Falls keine Interaktivität, zu Server Component

### Phase 2: Data Fetching Optimierung (3-5 Tage)

- [ ] **Bookings Page aufteilen**
  - Erstelle `bookings/bookings-client.tsx`
  - Migriere Data Fetching zu Page (Server)
  - Test mit verschiedenen Szenarien
- [ ] **Profile Page optimieren**
  - Erstelle `profile/profile-form.tsx` (Client)
  - Migriere Data Fetching zu Page (Server)
- [ ] **Training Schedule optimieren**
  - Erstelle `training-schedule/schedule-calendar.tsx` (Client)
  - Migriere Data Fetching zu Page (Server)

### Phase 3: Weitere Optimierungen (Optional)

- [ ] **Static Generation wo möglich**
  - Landing Page
  - API Docs
  - News Posts (wenn vorhanden)
- [ ] **Streaming für langsame Queries**
  - Dashboard KPIs
  - Analytics Charts
  - Große Tabellen

---

## 🏗️ Best Practices

### Rule 1: Server Component by Default

```tsx
// ✅ Gut - Kein 'use client' = Server Component
export default function Page() {
  return <div>Content</div>;
}

// ❌ Vermeiden - Unnötiges 'use client'
('use client');
export default function Page() {
  return <div>Static content</div>; // Keine Interaktivität!
}
```

### Rule 2: Client Components so klein wie möglich

```tsx
// ✅ Gut - Nur interaktiver Teil ist Client
export default function Page() {
  // Server
  return (
    <div>
      <h1>Static Header</h1>
      <InteractiveForm /> {/* Client Component */}
      <Footer /> {/* Server Component */}
    </div>
  );
}

// ❌ Vermeiden - Gesamte Page ist Client
('use client');
export default function Page() {
  return (
    <div>
      <h1>Static Header</h1>
      <InteractiveForm />
      <Footer />
    </div>
  );
}
```

### Rule 3: Data Fetching im Server Component

```tsx
// ✅ Gut - Server fetcht Daten
export default async function Page() {
  const data = await fetchData(); // Server-side
  return <ClientComponent data={data} />;
}

// ❌ Vermeiden - Client fetcht initial
('use client');
export default function Page() {
  const { data } = useQuery('key', fetchData); // Client-side
  return <div>{data}</div>;
}
```

### Rule 4: Use Caching

```tsx
// ✅ Gut - Mit Caching Tags
import { CACHE_TAGS, REVALIDATE_TIMES } from '@/lib/server-cache';

export default async function Page() {
  const data = await fetch('/api/data', {
    next: {
      revalidate: REVALIDATE_TIMES.MEDIUM,
      tags: [CACHE_TAGS.sessions('club-123')],
    },
  });

  return <div>{data}</div>;
}
```

---

## 📊 Erwartete Performance-Verbesserungen

### Vor Migration (Baseline)

| Metric                         | Wert   | Tool                    |
| ------------------------------ | ------ | ----------------------- |
| First Contentful Paint (FCP)   | 1.2s   | Lighthouse              |
| Largest Contentful Paint (LCP) | 2.5s   | Lighthouse              |
| Time to Interactive (TTI)      | 3.8s   | Lighthouse              |
| Total Blocking Time (TBT)      | 450ms  | Lighthouse              |
| Client Bundle Size             | 385 KB | Next.js Bundle Analyzer |

### Nach Migration (Erwartet)

| Metric                         | Wert   | Verbesserung      |
| ------------------------------ | ------ | ----------------- |
| First Contentful Paint (FCP)   | 0.7s   | **42% schneller** |
| Largest Contentful Paint (LCP) | 1.4s   | **44% schneller** |
| Time to Interactive (TTI)      | 2.1s   | **45% schneller** |
| Total Blocking Time (TBT)      | 200ms  | **56% schneller** |
| Client Bundle Size             | 245 KB | **36% kleiner**   |

---

## 🧪 Testing

### Vor jeder Migration testen:

1. **Funktionalität**

   ```bash
   npm run test
   npm run test:e2e
   ```

2. **Bundle Size**

   ```bash
   npm run build
   npm run analyze
   ```

3. **Performance**
   - Lighthouse CI
   - WebPageTest
   - Real User Monitoring

### Migration Checklist pro Component:

- [ ] Component rendert korrekt
- [ ] Interaktive Features funktionieren
- [ ] Data Fetching funktioniert
- [ ] Loading States korrekt
- [ ] Error Handling funktioniert
- [ ] Performance verbessert sich
- [ ] Bundle Size reduziert sich

---

## ⚠️ Häufige Fallstricke

### 1. Event Handlers in Server Components

```tsx
// ❌ Funktioniert NICHT - Server Components haben keine Events
export default function Page() {
  return <button onClick={() => alert('Hi')}>Click</button>;
}

// ✅ Lösung - Button als Client Component
('use client');
export function ClickButton() {
  return <button onClick={() => alert('Hi')}>Click</button>;
}
```

### 2. Hooks in Server Components

```tsx
// ❌ Funktioniert NICHT
export default function Page() {
  const [state, setState] = useState(0); // Error!
  return <div>{state}</div>;
}

// ✅ Lösung - Client Component für State
```

### 3. Browser APIs

```tsx
// ❌ Funktioniert NICHT im Server
export default function Page() {
  const width = window.innerWidth; // Error!
  return <div>{width}</div>;
}

// ✅ Lösung - In useEffect oder Client Component
```

---

## 📖 Weiterführende Ressourcen

- [Next.js Server Components Docs](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Vercel Best Practices](https://vercel.com/blog/understanding-react-server-components)

---

**Status:** Analyse abgeschlossen  
**Nächster Schritt:** Phase 1 Quick Wins implementieren
