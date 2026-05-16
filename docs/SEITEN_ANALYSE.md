# SwingZ – Umfassende Seiten-Analyse

> Stand: 2026-05-16 | Typ: Funktionalität, Design-Konsistenz, Optimierungspotential

---

## 1. Architektur-Übersicht

### Routing-Struktur

```
/                          → Landing Page (app/landing/page.tsx)
/login                     → Login Page (app/login/page.tsx)
/dashboard                 → Dispatch → Role-Based Redirect
/(protected)/member        → Member Dashboard
/(protected)/trainer       → Trainer Dashboard
/(protected)/admin         → Admin Dashboard
/(protected)/superadmin    → Superadmin Dashboard
/(protected)/bookings      → Buchungen & Kalender
/(protected)/scheduler     → Drag & Drop Stundenplan
/(protected)/profile       → Profil
/(protected)/notifications → Benachrichtigungen
/+ viele Unterseiten       → Trainer-Booking, Turniere, Billing, Analytics, etc.
```

### Layout-Struktur

- **ProtectedLayout** (`app/(protected)/layout.tsx`): Authentifizierung + `ProtectedClientLayout` mit Sidebar/Header
- **AdminLayout**: Rollen-Check (admin/superadmin), Club-Auswahl, Onboarding-Prüfung
- **MemberLayout**: Rollen-Check (keine höheren Rollen)
- **TrainerLayout**: Rollen-Check (trainer/admin/superadmin)

---

## 2. Seite-für-Seite Analyse

### 2.1 Landing Page (`app/landing/page.tsx`)

| Aspekt                | Status | Details                                                                                      |
| --------------------- | ------ | -------------------------------------------------------------------------------------------- |
| **Funktion**          | ✅     | Hero-Sektion, Stats, Features, CTA, Footer                                                   |
| **Design-Konsistenz** | 🟡     | Nutzt Design-Tokens, aber `rgba()` in inline-Styles (boxShadow, SVG floodColor)              |
| **Responsive**        | ✅     | Volle responsive-Klassen (sm:, md:, lg:)                                                     |
| **Button-Aktionen**   | ✅     | Login-Buttons, CTA-Button mit Analytics-Tracking                                             |
| **A11y**              | 🟡     | Touch-Targets ≥48px, aber keine aria-labels an SVG-Icons                                     |
| **Performance**       | 🟡     | `animate-aurora`, `animate-float`, `animate-float-slow` – Blur-Animationen sind GPU-intensiv |

**Zu behebende Issues:**

1. `rgba(64, 145, 108, 0.5)` → `hsl(var(--brand-primary-light) / 0.5)` in CTA boxShadow (Zeile 184-186)
2. `rgba(27, 67, 50, 0.5)` → `hsl(var(--brand-primary) / 0.5)` in SVG floodColor (Zeile 253)
3. `stopColor="#ffffff"` → `stopColor="hsl(0 0% 100% / 0.9)"` in SVG Gradient (Zeilen 255-258)

### 2.2 Login Page (`app/login/page.tsx`)

| Aspekt                | Status | Details                                                                                                 |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| **Funktion**          | ✅     | Email/Passwort-Login, Demo-Modus, Passwort-Toggle                                                       |
| **Design-Konsistenz** | ✅     | Nutzt Design-Tokens, alle Gradienten mit `bg-gradient-to-br from-brand-X to-brand-Y`                    |
| **Responsive**        | ✅     | `p-4 sm:p-8`, `hidden lg:flex` für Side-Panel                                                           |
| **Button-Aktionen**   | ✅     | Login-Submit, Demo-Button, Registrierung-Link (`/register`), Terms/Privacy-Links (`/terms`, `/privacy`) |
| **Error-Handling**    | ✅     | Fehler-State, Loading-State mit Spinner                                                                 |

**Keine offenen Issues** – vorherige Analyse war falsch-positiv: "Registrierung anfragen" ist ein `<a href="/register">`, nicht ein Button ohne Aktion.

### 2.3 Member Dashboard (`app/(protected)/member/page.tsx`)

| Aspekt                | Status | Details                                                                      |
| --------------------- | ------ | ---------------------------------------------------------------------------- |
| **Funktion**          | ✅     | Next Session, Stat-Cards (Buchungen/Rechnungen/Notifications), Quick Actions |
| **Design-Konsistenz** | ✅     | Nutzt Design-Tokens durchgehend, `text-[11px]` für Badges                    |
| **Server/Client**     | ✅     | Server Component – gut für SEO/Performance                                   |
| **Daten**             | 🟡     | 6 Supabase-Queries – könnte mit einem Batch-Endpoint optimiert werden        |

**Optimierungspotential:**

- **Stat-Card-Komponente**: Die 3 Stat-Cards (Buchungen, Rechnungen, Notifications) haben ähnliche Struktur → in eine `StatCard`-Komponente auslagern
- **Quick-Actions**: 8 Actions mit ähnlichem Markup → `QuickActionGrid`-Komponente

### 2.4 Trainer Dashboard (`app/(protected)/trainer/page.tsx`)

| Aspekt                | Status | Details                                                                         |
| --------------------- | ------ | ------------------------------------------------------------------------------- |
| **Funktion**          | ✅     | Stats (2×2 Grid), kommende Sessions, Quick-Access                               |
| **Design-Konsistenz** | ✅     | Nutzt Design-Tokens, konsistente Card-Struktur                                  |
| **Loading-State**     | ✅     | Skeleton-UI für alle Bereiche                                                   |
| **Error-State**       | ✅     | Fehler mit Retry-Button                                                         |
| **Client-Komponente** | 🟡     | `'use client'` – könnte als Server-Komponente mit API-Aufrufen optimiert werden |

**Optimierungspotential:**

- **Skeleton-DRY**: Die Skeleton-Struktur ist detailliert – könnte mit einem `TrainerSkeleton`-Wrapper vereinfacht werden
- **API-Fetch**: `fetch('/api/trainer/me')` – sollte mit `useQuery` von TanStack Query gecached werden (wenn vorhanden)

### 2.5 Admin Dashboard (`app/(protected)/admin/page.tsx`)

| Aspekt                  | Status | Details                                                                     |
| ----------------------- | ------ | --------------------------------------------------------------------------- |
| **Funktion**            | ✅     | KPIs, Heute-im-Verein, Aktivitäten, Quick-Actions, Verwaltungs-Links        |
| **Design-Konsistenz**   | ✅     | Gut strukturiert mit `max-w-[1400px]`, konsistente Cards                    |
| **Daten**               | ✅     | `Promise.all` für 8 parallele Queries – sauber                              |
| **Sidebar-Integration** | ✅     | 6-Sektionen Sidebar (Mitglieder, Training, Plätze, Finanzen, Einstellungen) |

**Gefundene Issues:**

- `group-hover:scale-105` in KPIs (Zeile 326) – akzeptabel als Micro-Interaction
- `text-[11px]` in Badges (Zeile 335, 358) – akzeptabel für kleine Labels

### 2.6 Buchungen & Kalender (`app/(protected)/bookings/page.tsx`)

| Aspekt          | Status | Details                                                        |
| --------------- | ------ | -------------------------------------------------------------- |
| **Funktion**    | ✅     | Monatskalender, Buchung CRUD, CSV-Export, Feedback-Modal       |
| **Komplexität** | 🟡     | Sehr große Client-Komponente (400+ Zeilen)                     |
| **Design**      | 🟡     | Kalender-Grid mit inline-Styling, `overflow-x-auto` für Mobile |

**Optimierungspotential:**

- **Komponenten-Aufteilung**: Kalender-Logik, Buchungs-Logik, Status-Änderungen in separate Hooks/Components
- **text-[11px]**: 3 Instanzen im Kalender – akzeptabel für Grid-Zellen

### 2.7 Drag & Drop Scheduler (`app/(protected)/scheduler/page.tsx`)

| Aspekt       | Status | Details                                                            |
| ------------ | ------ | ------------------------------------------------------------------ |
| **Funktion** | ✅     | Drag & Drop mit @dnd-kit, Wochen-Ansicht, KI-Optimierung           |
| **UX**       | ✅     | Drag-Overlay, visuelles Feedback, rollenbasierte Berechtigungen    |
| **Design**   | 🟡     | `text-[10px]` in SessionCard, `min-w-[900px]` für Scroll-Container |

**Optimierungspotential:**

- `text-[10px]` → `text-[11px]` in DraggableSessionCard (Zeile 99) – WCAG-Mindestgröße
- `min-w-[900px]` → `min-w-[768px]` für bessere Tablet-Unterstützung

### 2.8 Turniere (`app/(protected)/member/tournaments/page.tsx`)

| Aspekt                | Status | Details                                                |
| --------------------- | ------ | ------------------------------------------------------ |
| **Funktion**          | ✅     | Turnierliste, Anmeldung, Status-Badges, Anmelde-Dialog |
| **Design-Konsistenz** | ✅     | Konsistente Card-Struktur, Status-Farben gemappt       |
| **Error-Handling**    | ✅     | Fehler-State, Loading-State, Leerzustand               |

**Optimierungspotential:**

- **STATUS_LABELS/COLORS**: Könnten in eine Shared-Constants-Datei
- **Dialog**: Separate Komponente für den Anmelde-Dialog auslagern

### 2.9 Trainer-Booking (`app/(protected)/member/trainer-booking/page.tsx`)

| Aspekt       | Status | Details                                            |
| ------------ | ------ | -------------------------------------------------- |
| **Funktion** | ✅     | Trainer-Liste → Kalender-Ansicht → Buchungs-Dialog |
| **UX**       | ✅     | 3-Step Flow (Auswahl → Slot → Bestätigung)         |
| **Design**   | 🟡     | `text-[11px]` in Kalender-Zellen – akzeptabel      |

### 2.10 Admin Members (`app/(protected)/admin/members/page.tsx`)

| Aspekt          | Status | Details                                             |
| --------------- | ------ | --------------------------------------------------- |
| **Architektur** | ✅     | Server Component + Client Component sauber getrennt |
| **Funktion**    | ✅     | Mitgliederliste mit Rollen/Status                   |

### 2.11 Admin Analytics (`app/(protected)/admin/analytics/page.tsx`)

| Aspekt            | Status | Details                                                        |
| ----------------- | ------ | -------------------------------------------------------------- |
| **Funktion**      | ✅     | KPIs, Buchungen über Zeit, Trainer-Auslastung, Platz-Kapazität |
| **Daten**         | ✅     | Parallele Supabase-Queries mit `Promise.all`                   |
| **Club-Selector** | ✅     | Multi-Club-Support für Superadmin                              |

### 2.12 Admin Billing (`app/(protected)/admin/billing/page.tsx`)

| Aspekt       | Status | Details                                                |
| ------------ | ------ | ------------------------------------------------------ |
| **Funktion** | ✅     | Abonnements & Rechnungen, Demo-Fallback                |
| **Design**   | ✅     | Tabs (Subscriptions/Invoices), Tabellen, Status-Badges |

---

## 3. Design-Konsistenz – Gesamtbewertung

### 3.1 Was funktioniert gut ✅

| Bereich           | Details                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Design-Tokens** | `text-brand-primary`, `bg-brand-light/X`, `bg-gradient-primary` etc. durchgängig genutzt |
| **Dark Mode**     | `dark:` Varianten in fast allen Komponenten vorhanden                                    |
| **Responsive**    | `sm:`, `md:`, `lg:` Breakpoints konsequent eingesetzt                                    |
| **Ladezustände**  | Skeletons, Spinner, Error-States flächendeckend                                          |
| **Leerzustände**  | Icons + Text + Action-Buttons für Null-Daten                                             |

### 3.2 Verbesserungspotential 🟡

| Issue                             | Betroffene Seiten             | Lösung                                                                     |
| --------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| **Inline-`rgba()` in Styles**     | Landing Page (boxShadow, SVG) | Auf CSS-Variablen umstellen                                                |
| **Hardcoded Gradient-Richtungen** | Login Page (Zeile 102)        | `text-gradient-primary` Utility nutzen                                     |
| **Inkonsistente Heading-Farben**  | ~20 Seiten                    | Standardisieren: `text-brand-primary` oder `text-gray-900 dark:text-white` |
| **`text-[10px]`**                 | Scheduler (1×)                | → `text-[11px]` (WCAG)                                                     |
| **`min-h-[80px]` in Kalender**    | Bookings                      | Auf `min-h-[5rem]` umstellen (relativer)                                   |
| **Doppelte Icon-Container**       | ~50+ Stellen                  | `IconBox`-Komponente extrahieren                                           |

### 3.3 Komponenten-Extraktion – DRY

| Wiederholtes Pattern                         | Vorkommen | Vorschlag                    |
| -------------------------------------------- | --------- | ---------------------------- |
| Icon + Titel + Untertitel in Card            | ~40×      | `InfoCard`-Komponente        |
| Farbiges Icon-Quadrat (h-10 w-10 rounded-xl) | ~35×      | `IconBox`-Komponente         |
| Stat-Karte (Icon, Wert, Label)               | ~20×      | `StatCard`-Komponente        |
| Quick-Action-Grid (3×3 Icons)                | 3×        | `QuickActionGrid`-Komponente |
| Leerzustand (Icon + Text)                    | ~15×      | `EmptyState`-Komponente      |
| Bestätigungs-Dialog                          | 4×        | `ConfirmDialog`-Komponente   |

---

## 4. Button-Aktionen – Analyse

### 4.1 Button-Typen und ihre Verwendung

| Typ          | Klasse/Name                              | Verwendung                | Status                           |
| ------------ | ---------------------------------------- | ------------------------- | -------------------------------- |
| Primary CTA  | `bg-gradient-primary`                    | Login, Landing CTA        | ✅                               |
| Accent CTA   | `bg-gradient-accent`                     | Landing Bottom CTA        | ✅                               |
| Outline      | `variant="outline"`                      | Demo-Modus, Abbrechen     | ✅                               |
| Ghost        | `variant="ghost"`                        | Header-Buttons            | ✅                               |
| Direct Style | `bg-brand-light hover:bg-brand-light/80` | Trainer-Booking, Turniere | 🟡 Sollte Button-Variante nutzen |

### 4.2 Button-Action-Validierung

| Seite     | Button                   | Aktion                              | Funktioniert?         |
| --------- | ------------------------ | ----------------------------------- | --------------------- |
| Landing   | "Kostenlos starten"      | → `/login`                          | ✅                    |
| Landing   | "Anmelden"               | → `/login`                          | ✅                    |
| Landing   | "Demo starten"           | → `/login` + Analytics              | ✅                    |
| Landing   | "Mehr erfahren"          | → `/login` + Analytics              | ✅                    |
| Login     | "Anmelden"               | POST `/api/auth/login`              | ✅                    |
| Login     | "Demo-Modus starten"     | Cookie `demo-mode=true`             | ✅                    |
| Login     | "Registrierung anfragen" | **Kein href**                       | 🔴 Button ohne Aktion |
| Login     | "Nutzungsbedingungen"    | **Kein href**                       | 🔴 Button ohne Aktion |
| Member    | "Alle" (Buchungen)       | → `/bookings`                       | ✅                    |
| Member    | Quick-Actions (8×)       | → jeweilige Seiten                  | ✅                    |
| Trainer   | "Anwesenheit" (Session)  | → `/attendance-history?session=...` | ✅                    |
| Admin     | KPIs (4×)                | → jeweilige Admin-Seiten            | ✅                    |
| Admin     | Quick-Actions (4×)       | → jeweilige Admin-Seiten            | ✅                    |
| Bookings  | "Neue Platzbuchung"      | → `/dashboard/bookings/new`         | 🟡 Route existiert?   |
| Scheduler | "KI-Optimierung"         | Mutation `useOptimizeSchedule`      | ✅                    |

### 4.3 Gefundene Button-Issues 🔴

1. **Bookings: "Neue Platzbuchung"** – Route `/dashboard/bookings/new` existiert möglicherweise nicht (die Bookings-Page ist unter `/bookings`, nicht `/dashboard/bookings`)

---

## 5. Feature-Merging & Optimierung

### 5.1 Ähnliche Seiten – Zusammenführung möglich?

| Seiten                                                          | Gemeinsamkeit      | Merging-Vorschlag                                                    |
| --------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `member/page.tsx` + `member-dashboard.tsx`                      | Member-Übersicht   | Bereits teilweise gemerged – `member-dashboard.tsx` scheint veraltet |
| `dashboard-client.tsx` + `trainer-dashboard-client.tsx`         | Dashboard-Displays | In `DashboardClient` mit Rollen-Props zusammenführen                 |
| `court-calendar.tsx` + `admin-court-calendar.tsx`               | Kalender-Ansicht   | Zu einer Komponente mit `isAdmin`-Prop mergen                        |
| `trainer-weekly-view.tsx` + `trainer-availability-calendar.tsx` | Trainer-Kalender   | Prüfen auf Überschneidungen                                          |

### 5.2 Veraltete/ungenutzte Seiten?

| Verdacht | Datei                                            | Begründung                                                      |
| -------- | ------------------------------------------------ | --------------------------------------------------------------- |
| 🟡       | `app/(protected)/dashboard/dashboard-client.tsx` | Rolle-basierte Weiterleitung macht Client-Dashboard überflüssig |
| 🟡       | `app/(protected)/bookings-unified/page.tsx`      | Name deutet auf geplantes Merging mit `/bookings`               |
| 🟡       | `app/(protected)/courts/daily/page.tsx`          | Tagesansicht könnte in `/bookings` Tab integriert sein          |
| 🟡       | `app/(protected)/admin/panel-v2/`                | "v2" deutet auf Übergangs-Datei                                 |

---

## 6. Zusammenfassung & Prioritäten

### Kritisch 🔴 (sofort beheben)

| #   | Issue                                                     | Datei                                   |
| --- | --------------------------------------------------------- | --------------------------------------- |
| 1   | "Registrierung anfragen" Button ohne Aktion               | `app/login/page.tsx:268`                |
| 2   | "Nutzungsbedingungen" / "Datenschutz" Buttons ohne Aktion | `app/login/page.tsx:273-276`            |
| 3   | `text-[10px]` in Scheduler                                | `app/(protected)/scheduler/page.tsx:99` |

### Wichtig 🟠 (diese Woche)

| #   | Issue                                            | Dateien                                            |
| --- | ------------------------------------------------ | -------------------------------------------------- |
| 4   | `rgba()` in inline-Styles → CSS-Variablen        | `app/landing/page.tsx`                             |
| 5   | `from-green-400 to-brand-light` → Utility        | `app/login/page.tsx:102`                           |
| 6   | Button-Varianten statt direkter `bg-brand-light` | `trainer-booking/page.tsx`, `tournaments/page.tsx` |
| 7   | `/dashboard/bookings/new` Route prüfen           | `app/(protected)/bookings/page.tsx:218`            |

### Nice-to-Have 🟢 (später)

| #   | Issue                                  | Dateien       |
| --- | -------------------------------------- | ------------- |
| 8   | `IconBox`-Komponente extrahieren       | ~35 Stellen   |
| 9   | `StatCard`-Komponente extrahieren      | ~20 Stellen   |
| 10  | `EmptyState`-Komponente extrahieren    | ~15 Stellen   |
| 11  | `ConfirmDialog`-Komponente extrahieren | 4 Stellen     |
| 12  | Heading-Farben standardisieren         | ~20 Seiten    |
| 13  | Skeleton-DRY für Trainer/Admin         | 2 Komponenten |

---

## 7. Design-Token-Nutzung (Zusammenfassung)

| Token                  | Definiert? | Nutzung                                                 |
| ---------------------- | ---------- | ------------------------------------------------------- |
| `text-brand-primary`   | ✅         | 124× (Seiten-Überschriften)                             |
| `text-brand-light`     | ✅         | 68× (Icons, Links)                                      |
| `bg-brand-primary`     | ✅         | 63× (Badges, Switches)                                  |
| `bg-brand-light/X`     | ✅         | 55× (Hintergründe)                                      |
| `bg-gradient-primary`  | ✅         | 12× (CTA-Buttons, Cards)                                |
| `bg-gradient-accent`   | ✅         | 8× (Accent-Buttons, Sidebar)                            |
| `border-brand-primary` | ✅         | 45× (Spinner, Tabs)                                     |
| `shadow-glow-accent`   | ✅         | 1× (Landing CTA)                                        |
| `shadow-glow-primary`  | ✅         | 1× (Trainer Profile)                                    |
| `glass-dark`           | 🟡         | 4× (Definiert in tailwind.config, nicht in globals.css) |
