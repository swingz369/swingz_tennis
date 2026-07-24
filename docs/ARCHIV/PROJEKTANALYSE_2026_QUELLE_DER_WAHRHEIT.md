# SwingZ — Umfassende Projektanalyse

> **Datum:** 16. Juni 2026
> **Letzte Überprüfung:** 01. Juli 2026 (Session-Update: P2 #11 Dynamische Preisgestaltung implementiert, Trainer-Availability E2E auf Playwright umgeschrieben)
> **Ziel:** Perfekte App für den Kunden (Tennisverein)
> **Dieses Dokument ist die Quelle der Wahrheit** — alle anderen Analysen in `docs/` wurden archiviert.
>
> ⚠️ **Hinweis:** Die ursprüngliche Analyse hatte falsche Annahmen über fehlende Features. Eine Code-Verification am 16.06.2026 ergab, dass **4 von 5 P0-Items bereits implementiert waren**. Die folgende Tabelle zeigt den verifizierten Status.

---

## 1. Executive Summary

SwingZ ist eine **All-in-One-Vereinsplattform** für Tennisvereine mit einzigartiger Saisonplanung, Arbeitsdienst-Verwaltung und Multi-Tenant-Architektur. Die technische Basis ist solid, aber es gibt **kritische Produktlücken**, die vor einem Launch als zahlungsfähiges Produkt geschlossen werden müssen.

### Aktueller Reifegrad (verifiziert am 16.06.2026)

| Bereich                      | Status         | Bewertung                                                                         |
| ---------------------------- | -------------- | --------------------------------------------------------------------------------- |
| **Architektur & Code**       | 🟢 Gut         | Clean Architecture, TypeScript strict, 1.116 Tests, ESLint clean                  |
| **Admin-Erfahrung**          | 🟢 Gut         | Umfangreiches Dashboard, Saisonplanung, Billing, Shop                             |
| **Trainer-Erfahrung**        | 🟢 Gut         | Verfügbarkeit, Sessions, Profil, Anwesenheit                                      |
| **Member-Erfahrung**         | 🟢 Gut         | Platzbuchung + Trainer-Buchung + Open Matches + Messages + Rechnungen             |
| **Landing Page & Marketing** | 🟢 Gut         | Professionell, 2 Pricing-Pläne, echte Stats, SEO Metadata + Canonical URLs        |
| **Stripe & Payments**        | 🟢 Gut         | Live-Keys konfiguriert, Checkout-Flow im Buchungsflow integriert                  |
| **Mobile**                   | 🟢 Gut         | Responsive + Bottom Nav + PWA (manifest.json, Service Worker, Push-Notifications) |
| **Security**                 | 🟢 Gut         | RLS, Rate-Limiting, Zod-Validation, CSRF, Sentry, Shop-Auth, Cron-Auth            |
| **Accessibility**            | 🟡 Ausbaufähig | SkipToContent, ARIA in Kern-Komponenten, aber nicht flächendeckend                |
| **i18n**                     | 🟡 Grundgerüst | next-intl installiert, de/en Dictionaries, aber noch nicht aktiv                  |

---

## 2. Was SwingZ einzigartig macht

Diese Features hat **kein Konkurrent** in dieser Kombination:

| Feature                      | Beschreibung                                                                                             | Konkurrenz       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| **KI-Saisonplanung**         | Automatische Wochenplanung mit Conflict-Detection, Member-Preferences, Cluster-Algorithmus, Backtracking | ❌ Keiner        |
| **Arbeitsdienst-Verwaltung** | Zuweisung, Freiwilligen-Meldung, Nachverfolgung                                                          | ❌ Keiner        |
| **Multi-Tenant Superadmin**  | Plattform für Dachverbände/Tennisschulen mit Club-Switcher                                               | ❌ Keiner        |
| **Liga-Management**          | Spieltage, Ergebnisse, Mannschaftsaufstellung integriert                                                 | Nur CourtReserve |
| **Wetter-Integration**       | Automatische Platzsperren bei Regen/Schnee/Gewitter                                                      | ❌ Keiner        |
| **SEPA-Lastschrift**         | PAIN.008-XML-Export, Mandatsverwaltung                                                                   | Nur ClubDesk     |

---

## 3. Kritische Produktlücken (P0) — Status nach Code-Verification

### 3.1 ✅ Member-Platzbuchung — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ `components/bookings/court-bookings.tsx` — Volle UI: Kalender, Zeitslots, Dauer-Wahl (30/60/90 Min), Court-Auswahl mit Surface/Indoor-Badges
- ✅ `app/api/bookings/direct/route.ts` — API mit Auth, Booking Rules (max/week), Overlap-Detection (DB exclusion constraint), Stripe Checkout Redirect
- ✅ `components/member-court-bookings.tsx` — "Meine Buchungen" Übersicht mit Stats, Monatsansicht, Court-Nutzung
- ✅ `app/(protected)/my-bookings/page.tsx` — Route existiert
- ✅ Navigation: Mobile Bottom Nav "Buchen" → `/bookings`, Member Dashboard Quick Actions

---

### 3.2 ✅ Self-Service-Registrierung — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ `app/register/page.tsx` — 2-Step-Flow (Konto → Verein) mit professionellem UI, Step-Indicator
- ✅ `app/api/auth/register/route.ts` — Erstellt User + Club + Admin-Membership in einer Transaktion, Rate-Limiting, Cookie-Handling
- ✅ Auto-Redirect nach Success → `/admin/onboarding`
- ✅ `app/(protected)/admin/onboarding/page.tsx` — 12-Step Onboarding-Wizard: Start, Module, Vereinsdaten, Öffnungszeiten, Platz, Preise, Beiträge, Buchungsregeln, Einladungen, E-Mail, Saison, Fertig
- ✅ Probetraining: `app/(public)/trial-training/page.tsx` — Öffentliches Formular ohne Account

---

### 3.3 ✅ PWA / Push-Notifications — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ `lib/push-notification.service.ts` — Vollständiger Service: VAPID-Config, Subscribe/Unsubscribe, SendToUser, SendToClub, Cleanup stale Endpoints (404/410)
- ✅ `hooks/use-push-notifications.ts` — Client-Hook: Browser-Support-Detection, VAPID-Key-Fetch, Service Worker Subscription, Permission-Request
- ✅ `components/sw-registration.tsx` — Service Worker Registration (Dev: unregister, Prod: register)
- ✅ `app/offline/page.tsx` — Offline-Fallback-Seite
- ✅ `push_subscriptions` Tabelle in DB mit User-Agent-Tracking

---

### 3.4 ✅ Online-Bezahlung bei Buchung — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ In `components/bookings/court-bookings.tsx` integriert — nach erfolgreicher Buchung wird bei `requiresPayment` automatisch zu Stripe Checkout redirectiert
- ✅ `booking_rules.require_payment` steuert ob Zahlung erforderlich ist
- ✅ `app/api/stripe/checkout/route.ts` — Unterstützt `type: 'booking'` für Platzbuchungen

---

## 4. Wichtige Verbesserungen (P1)

### 4.1 ✅ Online-Bezahlung bei Buchung — IMPLEMENTIERT

Siehe P0 #3.4 oben.

### 4.2 ✅ Kalender-Sync (ICS Feed) — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ `lib/ical-export.ts` — RFC 5545 vollständig: `generateICal`, `downloadICal`, `googleCalendarUrl`
- ✅ `components/rsvp-section.tsx` — Nutzt ICS-Export für Session-Kalender-Sync

### 4.3 ✅ Messages-System: Echtzeit-Chat — IMPLEMENTIERT

**Implementiert am 16.06.2026:**

- ✅ `hooks/use-messages-realtime.ts` — Supabase Realtime Hook: Postgres Changes auf `messages`-Tabelle gefiltert nach `receiver_id=eq.${userId}`, Fallback-Polling alle 30s bei Verbindungsverlust
- ✅ `app/(protected)/messages/page.tsx` — Integration: `useMessagesRealtime` mit userId aus `auth.getUser()`, Auto-Refresh nur für Inbox/Sent-Ordner
- ✅ Compose-Dialog mit `initialReceiverId` Prop + `?compose={userId}` Query-Param für Matchmaking-Integration
- ✅ `<Suspense>` Boundary für `useSearchParams` Kompatibilität

### 4.4 ✅ Open Matches / Social Play — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ `app/(protected)/matches/page.tsx` + `components/open-matches.tsx` — Members können offene Spiele erstellen und beitreten
- ✅ In Sidebar-Navigation verlinkt für Member-Rolle

### 4.5 ✅ console.error → createLogger Migration — IMPLEMENTIERT

**Verifiziert am 16.06.2026:**

- ✅ ~500 `console.error/warn` → `log.error/warn` in `app/api/` Routen (168 Dateien)
- ✅ Core `lib/` Dateien ebenfalls migriert (auth, api-error, safe-booking, stripe-client, auto-planning)
- ✅ TypeScript CLEAN, ESLint CLEAN nach Migration

---

## 5. Technischer Zustand

### 5.1 Build & Qualität

| Check            | Status          | Details                                                                     |
| ---------------- | --------------- | --------------------------------------------------------------------------- |
| TypeScript       | ✅ CLEAN        | 0 Errors (strict mode)                                                      |
| ESLint           | ✅ CLEAN        | 0 Errors, 0 Warnings                                                        |
| Tests            | ✅ 1.116 passed | 17 E2E failures (pre-existing, Dev-Server-Setup)                            |
| Security Headers | ✅              | HSTS, CSP, X-Frame-Options in `next.config.js`                              |
| ENV-Validierung  | ✅              | Zod-basiert in `lib/env.ts`                                                 |
| Sentry           | ✅              | Client + Server konfiguriert                                                |
| Stripe           | ✅              | Live-Keys in Vercel, Webhook-Handler funktional                             |
| i18n             | 🟡              | next-intl installiert, NextIntlClientProvider im Layout, de/en Dictionaries |

### 5.2 Architektur

```
app/                          # Next.js 16 App Router (79 Pages, 170+ API Routes)
  (protected)/                # Auth-required (admin/, member/, trainer/, superadmin/)
  api/                        # API Routes
  landing/                    # Marketing Landing Page
components/                   # React Components (~120)
lib/                          # Shared Utilities, Services (~85 Dateien)
src/
  application/                # Use Cases
  domain/                     # Domain Entities
  infrastructure/             # DB Repos, External Services, Drizzle Schema
```

### 5.3 Datenbank

- **94 Migrationsdateien** in `supabase/migrations/`
- **51 Tabellen** mit `club_id` für Multi-Tenant-Isolation
- **Drizzle ORM** — Schema in `src/infrastructure/persistence/schema.ts`
- **Supabase RLS** — Row-Level Security auf den meisten Tabellen

### 5.4 Dependencies

| Metrik              | Wert                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| Dependencies        | 64 (nach @midscene-Entfernung)                                                |
| DevDependencies     | 32                                                                            |
| npm Vulnerabilities | 2 Moderate (postcss via next — unfixbar)                                      |
| Overrides           | esbuild >=0.25.0 <1.0.0, js-yaml >=4.1.2                                      |
| Neu                 | `qrcode.react` (QR-Check-in)                                                  |
| Entfernt            | `@midscene/web`, `@midscene/shared`, `@midscene/core`, `@midscene/playground` |

### 5.5 Technische Schulden

| Kategorie                         | Anzahl               | Priorität                                         |
| --------------------------------- | -------------------- | ------------------------------------------------- |
| console.error/warn in API-Routen  | ~0 (migriert)        | ✅ Erledigt                                       |
| `: any` Typen                     | ~14 (in lib/)        | 🟡 Mittel                                         |
| npm Vulnerabilities               | 2 Moderate (postcss) | ✅ Akzeptiert — transitive dep von next, unfixbar |
| Fehlende Dependencies             | 2                    | 🟠 Hoch                                           |
| Ungenutzte Dependencies           | 6                    | 🟢 Niedrig                                        |
| Next.js 16 Middleware-Deprecation | 1                    | 🟡 Mittel                                         |

---

## 6. Rollen-Übersicht

### 6.1 Superadmin (Tennisschulen-Chef)

- Plattform-Dashboard über alle Vereine
- Club-Switcher für Admin-Kontext
- Club-Erstellung
- Plattform-Analytics & Billing
- Onboarding-Wizard bei Erstnutzung

### 6.2 Admin (Vereinsverwaltung)

- **Dashboard:** KPIs, Schnellaktionen, Tagesübersicht
- **Mitglieder:** Liste, Einladung, Bulk-Import, Genehmigungen
- **Training:** Saisonplanung (KI), Trainer-Verwaltung, Stundenlogs
- **Plätze:** Kalender (Wochen-/Tages-/Listenansicht), Drag & Drop, Platzsperren, Wetter
- **Finanzen:** Rechnungen, SEPA, Analytics, Mahnwesen
- **Einstellungen:** Branding, Audit-Logs, Shop

### 6.3 Trainer

- Dashboard mit Sessions, Statistiken, RSVP
- Verfügbarkeits-Management (Wochen-Kalender)
- Profil & Qualifikationen
- Anwesenheit erfassen
- Stunden-Abrechnung

### 6.4 Member

- Dashboard mit Buchungen, Stats, Quick Actions
- Trainer-Buchung (Wochen-Kalender)
- Turnier-Anmeldung
- Arbeitsdienst (Volunteer)
- Rechnungen & Stripe-Checkout
- Präferenzen für Saisonplanung
- Nachrichten

---

## 7. Feature-Checkliste

| Feature                 | Implementiert | Professionell | Bewertung                                                                                               |
| ----------------------- | :-----------: | :-----------: | ------------------------------------------------------------------------------------------------------- |
| Login / Registration    |      ✅       |      ✅       | 2-Step-Registrierung, professionelles UI                                                                |
| Landing Page            |      ✅       |      ✅       | Professionell, 2 Pricing-Pläne, echte Stats                                                             |
| Admin Dashboard         |      ✅       |      ✅       | KPIs aus DB-Queries                                                                                     |
| Member Dashboard        |      ✅       |      ✅       | Hybrid SC, Loading Skeleton                                                                             |
| **Member-Platzbuchung** |      ✅       |      ✅       | **IMPLEMENTIERT — Kalender, Zeitslots, Stripe-Checkout, "Meine Buchungen"**                             |
| Trainer-Buchung         |      ✅       |      ✅       | Wochen-Kalender, Slots                                                                                  |
| Saisonplanung           |      ✅       |      ✅       | KI-Clustering, Grid, Präferenzen, Backtracking                                                          |
| Mitgliederverwaltung    |      ✅       |      ✅       | Suche, Filter, Bulk-Actions, CSV-Export                                                                 |
| Trainer-Verwaltung      |      ✅       |      ✅       | Profile, Verfügbarkeiten, Stundenbuchung                                                                |
| Billing / Rechnungen    |      ✅       |      ✅       | Stripe Live-Keys, SEPA, Mahnwesen                                                                       |
| Shop                    |      ✅       |      ✅       | Produkte, Bestellungen, Stripe-Checkout                                                                 |
| Turniere                |      ✅       |      ✅       | Feature-Flag, UI funktioniert                                                                           |
| Probetrainings          |      ✅       |      ✅       | Öffentliches Formular + Admin-Genehmigung                                                               |
| Arbeitsdienst           |      ✅       |      ✅       | Zuweisung + Nachverfolgung                                                                              |
| Liga & Mannschaft       |      ✅       |      ✅       | Spieltage, Ergebnisse, Aufstellung                                                                      |
| Analytics               |      ✅       |      ✅       | Charts, KPIs, Revenue aus DB                                                                            |
| Wetter-Integration      |      ✅       |      ✅       | OpenWeatherMap, Auto-Close                                                                              |
| Notifications           |      ✅       |      ✅       | Supabase Realtime (nicht mehr Polling)                                                                  |
| Messages                |      ✅       |      ✅       | RichTextEditor, DOMPurify, Supabase Realtime, Compose-Auto-Open via Query-Param                         |
| Push-Notifications      |      ✅       |      ✅       | VAPID, SendToUser/SendToClub, Cleanup stale Endpoints                                                   |
| KI-Matchmaking          |      ✅       |      ✅       | Admin-Dashboard mit KPI-Karten, MatchmakingPanel mit Herausfordern/Nachricht-Aktionen, Level-Verteilung |
| i18n                    |      🟡       |      🟡       | next-intl installiert, de/en Dictionaries, Provider aktiv                                               |
| Error Handling          |      ✅       |      ✅       | Error-Boundary mit Sentry, Support-Link, Copy-Details                                                   |
| Accessibility           |      ✅       |      ✅       | SkipToContent, ARIA in Kern-Komponenten                                                                 |
| Mobile                  |      ✅       |      ✅       | Bottom Nav, Touch-Swipe, Responsive                                                                     |
| Dark Mode               |      ✅       |      ✅       | Theme-Toggle, system-preference                                                                         |
| Keyboard Shortcuts      |      ✅       |      ✅       | Dialog + Command Palette                                                                                |
| Loading States          |      ✅       |      ✅       | Skeletons für alle SC Pages                                                                             |

---

## 8. Wettbewerbsvergleich

| Feature                   | SwingZ | Playtomic | CourtReserve | ClubDesk | 360Player |
| ------------------------- | :----: | :-------: | :----------: | :------: | :-------: |
| **Platzbuchung (Member)** |   ✅   |    ✅     |      ✅      |    ❌    |    ❌     |
| **Trainer-Buchung**       |   ✅   |    ✅     |      ✅      |    ❌    |    ✅     |
| **Saisonplanung**         |  ✅⭐  |    ❌     |      ❌      |    ❌    |    ❌     |
| **Liga-Management**       |   ✅   |    ❌     |      ✅      |    ❌    |    ❌     |
| **Arbeitsdienst**         |   ✅   |    ❌     |      ❌      |    ❌    |    ❌     |
| **Rechnungswesen**        |   ✅   |    ⚠️     |      ✅      |   ✅⭐   |    ❌     |
| **SEPA/Lastschrift**      |   ✅   |    ❌     |      ❌      |    ✅    |    ❌     |
| **Mobile App**            | ✅ PWA |    ✅     |      ✅      |    ⚠️    |    ✅     |
| **Push-Notifications**    |   ✅   |    ✅     |      ✅      |    ❌    |    ✅     |
| **Multi-Tenant**          |  ✅⭐  |    ❌     |      ❌      |    ❌    |    ❌     |
| **KI-Features**           |   ✅   |    ⚠️     |      ❌      |    ❌    |    ❌     |
| **Wetter-Integration**    |   ✅   |    ❌     |      ❌      |    ❌    |    ❌     |

---

## 9. Priorisierte Roadmap

### 🔴 Q3 2026 — Launch-Voraussetzung (P0)

| #   | Aufgabe                          | Aufwand | Status                                                             |
| --- | -------------------------------- | ------- | ------------------------------------------------------------------ |
| 1   | **Member-Platzbuchung**          | 3–5d    | ✅ IMPLEMENTIERT                                                   |
| 2   | **Self-Service-Registrierung**   | 1–2d    | ✅ IMPLEMENTIERT                                                   |
| 3   | **PWA + Push-Notifications**     | 2–3d    | ✅ IMPLEMENTIERT                                                   |
| 4   | **Online-Bezahlung bei Buchung** | 1–2d    | ✅ IMPLEMENTIERT                                                   |
| 5   | **npm Vulnerabilities fixen**    | 0.5d    | ✅ GEFIXT — 2 moderate postcss remaining (transitive dep von next) |

### 🟡 Q4 2026 — Engagement (P1)

| #   | Aufgabe                                     | Aufwand | Status                                                  |
| --- | ------------------------------------------- | ------- | ------------------------------------------------------- |
| 6   | Messages Echtzeit-Chat                      | 1–2d    | ✅ IMPLEMENTIERT — Supabase Realtime + Fallback-Polling |
| 7   | Open Matches / Social Play                  | 2–3d    | ✅ IMPLEMENTIERT                                        |
| 8   | Kalender-Sync (ICS Feed)                    | 1d      | ✅ IMPLEMENTIERT                                        |
| 9   | QR-Check-in am Platz                        | 1d      | ✅ IMPLEMENTIERT — QrCodeDisplay + QrCheckinForm + API  |
| 10  | console→createLogger Migration (API-Routen) | 1d      | ✅ IMPLEMENTIERT                                        |

### 🟢 Q1 2027 — Monetarisierung (P2)

| #   | Aufgabe                       | Aufwand | Status                                                                                     |
| --- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| 11  | Dynamische Preisgestaltung    | 2d      | ✅ IMPLEMENTIERT — Peak/Off-Peak, Tagespreise, Saison-Aufschläge. Opt-in per Feature-Flag. |
| 12  | Marketplace (Externe Spieler) | 3d      | ❌ OFFEN                                                                                   |
| 13  | WhatsApp-Integration          | 2d      | ❌ OFFEN                                                                                   |
| 14  | KI-Matchmaking vollständig    | 3d      | ✅ IMPLEMENTIERT — Admin-Dashboard, Herausfordern, Nachricht                               |

### ✅ Zusätzlich implementiert (nicht in Roadmap)

| Aufgabe                                   | Status               |
| ----------------------------------------- | -------------------- |
| SEO Metadata + Canonical URLs (13 Seiten) | ✅ 16.06.2026        |
| Shop-Route Authentifizierung              | ✅ 16.06.2026        |
| A/B-Experimente (3 neue)                  | ✅ 16.06.2026        |
| Cron-Endpoints Sicherheit                 | ✅ Bereits vorhanden |

---

## 10. Technische Architektur-Empfehlungen

### 10.1 Booking-Engine als eigenes Modul

Die aktuelle `sessions`-Tabelle ist trainer-zentriert. Für Member-Platzbuchung braucht es eine separate `court_bookings`-Tabelle mit:

- `member_id`, `court_id`, `start_time`, `end_time`
- `booking_type`: `recurring` | `single` | `tournament` | `training`
- `payment_status`: `pending` | `paid` | `refunded`
- `check_in_status`: `pending` | `checked_in` | `no_show`

### 10.2 Payment-Flow ändern

Aktuell: Admin erstellt Rechnung → Member bezahlt später.
Empfohlen: Buchung → Stripe Checkout → automatische Rechnung.
Die Stripe-Integration existiert bereits, muss aber in den Buchungsflow eingebettet werden.

### 10.3 Notification-Pipeline erweitern

Aktuell: In-App + E-Mail.
Empfohlen: In-App + E-Mail + Web Push + (später) WhatsApp.
Web Push API erfordert keinen Drittanbieter — `web-push` Package ist bereits installiert.

### 10.4 Supabase-Types konsistent halten

Die generierten Supabase-Types müssen bei jedem Schema-Change neu generiert werden:

```bash
npx supabase gen types typescript --local > supabase-types.ts
```

---

## 11. Design-System

- **Farben:** Deep Forest (#1B4332), Midnight Navy (#1e3a5f), Sunrise Orange (#FF6B35)
- **Typografie:** Clash Display (Headlines), DM Sans (Body), JetBrains Mono (Code)
- **Komponenten:** shadcn/ui + Tailwind CSS
- **Dark Mode:** Vollständig implementiert (CSS Custom Properties)
- **Animation:** 16 Keyframes, Easing-Variablen, Hover-Lift/Glow/Tap
- **Glass-Morphism:** 4 Varianten für Premium-UI
- **Score:** 66/100 (Design Audit) — Verbesserungspotenzial in Spacing-Konsistenz und Component-Konsistenz

---

## 12. Sicherheit

| Maßnahme                | Status                                                          |
| ----------------------- | --------------------------------------------------------------- |
| Supabase RLS            | ✅ Auf den meisten Tabellen                                     |
| Rate-Limiting           | ✅ 380 Referenzen in API-Routen                                 |
| Zod-Validation          | ✅ 111 Referenzen                                               |
| CSRF-Schutz             | ✅ Double-Submit-Pattern                                        |
| File-Upload Validierung | ✅ MIME-Type + Größe                                            |
| XSS-Schutz              | ✅ DOMPurify für User-Content                                   |
| Sentry Monitoring       | ✅ Client + Server                                              |
| Security Headers        | ✅ HSTS, CSP, X-Frame-Options                                   |
| Stripe Webhook Signatur | ✅ Verifiziert                                                  |
| Cron-Endpoint Auth      | ⚠️ Fehlt bei `/api/cron/billing-overdue` und `/api/cron/backup` |

---

## 13. Zusammenfassung

### Was sofort passieren muss (P0)

~~1. **Member-Platzbuchung**~~ ✅ Implementiert
~~2. **Self-Service-Registrierung**~~ ✅ Implementiert
~~3. **PWA + Push**~~ ✅ Implementiert

### Verbleibende offene Items (nach Code-Verification)

1. ~~**Messages Echtzeit-Chat** (P1 #6)~~ ✅ Implementiert am 16.06.2026
2. ~~**QR-Check-in am Platz** (P1 #9)~~ ✅ Implementiert am 16.06.2026
3. ~~**npm Vulnerabilities** (P0 #5)~~ ✅ Gefixt am 16.06.2026 (2 moderate postcss akzeptiert)
4. ~~**Dynamische Preisgestaltung** (P2 #11)~~ ✅ Implementiert am 01.07.2026 — Zeitbasierte Preise (Peak/Off-Peak), Tagespreise, Saison-Aufschläge. Opt-in per Feature-Flag `dynamic_pricing`.
5. ~~**KI-Matchmaking UI** (P2 #14)~~ ✅ Implementiert am 16.06.2026

### Verbleibende offene Items

1. ~~**Dynamische Preisgestaltung** (P2 #11)~~ ✅ Implementiert am 01.07.2026
2. **3 E2E-Tests** — müssen noch auf reines Playwright umgeschrieben werden (1 von 4 erledigt: trainer-availability).

### Was SwingZ einzigartig macht

1. KI-Saisonplanung mit Conflict-Detection
2. Arbeitsdienst-Verwaltung
3. Multi-Tenant Superadmin für Dachverbände
4. Liga-Management integriert
5. Wetter-Integration für Außenplätze

### Strategische Positionierung

> SwingZ ist nicht "Playtomic für Vereine", sondern **"Das Vereins-Betriebssystem"** mit einzigartiger Saisonplanung. Die Platzbuchung wird als Grundfunktion hinzugefügt, aber der USP bleibt die Verwaltungstiefe, die kein Booking-Tool bietet.

---

> **Dieses Dokument wird bei jeder größeren Änderung aktualisiert.**
> **Nächste Überprüfung:** Nach Abschluss der P0-Items (Q3 2026).
