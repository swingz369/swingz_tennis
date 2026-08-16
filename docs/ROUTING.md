# 🗺️ SwingZ Routing-Übersicht

> Zuletzt verifiziert: 13.08.2026 (Abschnitte 4 und 10 gegen `lib/navigation.ts` geprüft)

> **Next.js App Router** – Route Groups, Layout-Hierarchie & alle Seiten
>
> Stand: 2026-05-22 | **79 Pages** | **9 Layouts** | **170+ API Routes**

---

## 1. Layout-Hierarchie

```
app/layout.tsx                          ← Root Layout (DM Sans, QueryProvider, Toaster)
├── app/(public)/layout.tsx             ← Public Layout (auth-frei)
│   ├── /register
│   └── /api-docs
│
├── app/(protected)/layout.tsx          ← Protected Layout (requireAuth, Sidebar, BottomNav)
│   ├── app/(protected)/admin/layout.tsx        ← Admin Guard (role=admin|superadmin)
│   │   ├── /admin/*
│   │   └── app/(protected)/admin/clubs/layout.tsx
│   │   └── app/(protected)/admin/tenants/layout.tsx
│   │
│   ├── app/(protected)/superadmin/layout.tsx   ← Superadmin Guard (role=superadmin)
│   │   └── /superadmin/*
│   │
│   ├── app/(protected)/trainer/layout.tsx      ← Trainer Guard (role=trainer|admin|superadmin)
│   │   └── /trainer/*
│   │
│   └── app/(protected)/member/layout.tsx       ← Member Guard (redirects höhere Rollen)
│       └── /member/*
│
├── app/*                                ← Öffentliche/Shared Seiten (kein Route Group)
│
└── app/api/*                            ← API Routes
```

### Layout-Verantwortlichkeiten

| Layout                                  | Aufgabe                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `app/layout.tsx`                        | Root: Fonts, Metadata, Viewport, QueryProvider, Toaster, ServiceWorker             |
| `app/(public)/layout.tsx`               | Pass-Through (keine Auth-Prüfung)                                                  |
| `app/(protected)/layout.tsx`            | Auth+Sidebar+BottomNav: `requireAuth`, User-Profil, Clubs, `ProtectedClientLayout` |
| `app/(protected)/admin/layout.tsx`      | Admin-Guard: Rollen-Prüfung, Club-Cookie, Onboarding-Redirect                      |
| `app/(protected)/superadmin/layout.tsx` | Superadmin-Guard: Rollen-Prüfung, Setup-Redirect                                   |
| `app/(protected)/trainer/layout.tsx`    | Trainer-Guard: Trainer/Admin/Superadmin-Zugriff                                    |
| `app/(protected)/member/layout.tsx`     | Member-Guard: Höhere Rollen → Redirect                                             |

---

## 2. Öffentliche Seiten (Public)

```
/                               ← Landing/Startseite
/about                          ← Über uns
/contact                        ← Kontakt
/apply                          ← Bewerbung
/landing                        ← Marketing-Landing
/login                          ← Login
/offline                        ← Offline-Fallback
/sepa-mandate                   ← SEPA-Mandat
/debug                          ← Debug-Übersicht
/debug/auth-test                ← Auth-Test
/debug/admin-debug              ← Admin-Debug
```

### Route Group `(public)`

```
/(public)/register               ← Registrierung
/(public)/api-docs               ← API-Dokumentation
```

---

## 3. Protected Dashboard & Übergreifend

> Diese Seiten sind in `(protected)` aber _nicht_ in einer rollenspezifischen Sub-Route-Group.
> Die Sidebar entscheidet basierend auf der höchsten Rolle, was angezeigt wird.

```
/dashboard                       ← Dashboard (rollenübergreifend)
/dashboard/bookings/new          ← Neue Buchung
/bookings                        ← Buchungsübersicht (Member-Perspektive)
/bookings/payment-success        ← Zahlungserfolg
/bookings-unified                ← Unified Bookings
/my-bookings                     ← Meine Buchungen
/courts                          ← Platz-Übersicht
/courts/daily                    ← Tägliche Platz-Ansicht
/billing                         ← Abrechnung (Member)
/attendance-history              ← Anwesenheitshistorie
/gamification                    ← Gamification
/news                            ← News
/notifications                   ← Benachrichtigungen
/profile                         ← Profil
/scheduler                       ← Terminplaner
/search                          ← Suche
/shop                            ← Shop
/training-schedule               ← Trainingsplan
/trial-training                  ← Probetraining
/select-admin-club               ← Club-Auswahl (Admin)
```

---

## 4. Admin-Bereich (`/admin/*`)

> **Layout:** `app/(protected)/admin/layout.tsx`
> **Guard:** `admin` oder `superadmin` Rolle
> **Sidebar:** Dashboard + 6 Sektionen aus `lib/navigation.ts` — Mitglieder,
> Trainer, Saison & Plätze, Finanzen, Verein, Weitere Module. Die ersten vier
> entsprechen 1:1 den Kernmodulen aus `lib/features.ts` (`members`, `trainers`,
> `seasons`, `finance`) und stehen in der Reihenfolge des Vereinsjahres.
> Optionale Module sind gesammelt unter „Weitere Module", damit die Kernsektionen
> unabhängig von der Modulbuchung immer an derselben Stelle stehen.

### 4.1 Dashboard & Übersicht

```
/admin                           ← Admin-Dashboard
/admin/dashboard                 ← Admin-Dashboard (alternative Route)
```

### 4.2 Mitglieder

```
/admin/members                   ← Alle Mitglieder
/admin/members/[id]              ← Mitglied-Detail
/admin/approvals                 ← Genehmigungen (Beitrittsanfragen)
```

### 4.3 Training

```
/admin/seasons                   ← Saison-Übersicht
/admin/seasons/new               ← Neue Saison
/admin/seasons/[id]              ← Saison-Detail
/admin/seasons/[id]/edit         ← Saison bearbeiten
/admin/seasons/[id]/planning     ← Saison-Planungs-Wizard (5 Schritte)
/admin/seasons/[id]/preferences/new ← Neue Präferenz
/admin/season-plan               ← Saison-Stundenplan
/admin/season-plan/[seasonId]    ← Stundenplan-Detail
/admin/trainers                  ← Trainer & Stunden
/admin/hours-logs                ← Stundennachweise
/admin/events                   ← Veranstaltungen (Hub: Turniere + Sonderveranstaltungen)
/admin/tournaments               ← → /admin/events?tab=tournaments (Alt-Einstieg)
/admin/special-events            ← → /admin/events?tab=special-events (Alt-Einstieg)
/admin/tournaments/new           ← Neues Turnier
/admin/tournaments/[id]          ← Turnier-Detail
/admin/schedules                 ← Zeitpläne
```

### 4.4 Plätze & Buchungen

```
/admin/courts                    ← Platz-Kalender
/admin/courts/manage             ← Plätze verwalten
/admin/partner-finder            ← Spielpartner-Suche
/admin/season-plan               ← Saison-Stundenplan
```

### 4.5 Finanzen

```
/admin/billing                   ← Abrechnung
/admin/billing/categories        ← Abrechnungskategorien
/admin/analytics                 ← Analytics
/admin/reports                   ← Berichte
```

### 4.6 Verwaltung

```
/admin/settings                  ← Vereinseinstellungen
/admin/branding                  ← Branding
/admin/onboarding                ← Onboarding-Wizard
/admin/audit-logs                ← Audit-Logs
/admin/tenants                   ← Mandanten (nur superadmin-sichtbar)
```

### 4.7 Clubs

```
/admin/clubs                     ← Club-Übersicht
/admin/clubs/[clubId]/dashboard  ← Club-Dashboard
/admin/clubs/[clubId]/billing    ← Club-Abrechnung
```

---

## 5. Superadmin-Bereich (`/superadmin/*`)

> **Layout:** `app/(protected)/superadmin/layout.tsx`
> **Guard:** `superadmin` Rolle
> **Sidebar:** Superadmin-Links + Club-Switcher

```
/superadmin                      ← Plattform-Dashboard
/superadmin/dashboard            ← Plattform-Analyse
/superadmin/tenants              ← Vereinsübersicht (alle Clubs)
/superadmin/clubs                ← Club-Verwaltung (erstellen/bearbeiten)
/superadmin/onboarding           ← Setup-Wizard (erster Login)
```

---

## 6. Trainer-Bereich (`/trainer/*`)

> **Layout:** `app/(protected)/trainer/layout.tsx`
> **Guard:** `trainer`, `admin` oder `superadmin`
> **Navigation:** Bottom Nav (7 Tabs) + Sidebar (Fallback)

```
/trainer                          ← Trainer-Übersicht
/trainer/availability              ← Verfügbarkeit
```

---

## 7. Member-Bereich (`/member/*`)

> **Layout:** `app/(protected)/member/layout.tsx`
> **Guard:** `member` (höhere Rollen werden redirected)
> **Navigation:** Bottom Nav (6 Tabs)

```
/member                           ← Member-Home
/member/preferences               ← Spiel-Präferenzen
/member/tournaments               ← Turnieranmeldungen
/member/trainer-booking           ← Trainer buchen
```

---

## 8. Seiten ohne Page (weitergeleitet via Layout)

> Diese Routes existieren in der Sidebar/BottomNav, werden aber durch Layout-Logik aufgefangen oder sind dynamische Parameter ohne eigene page.tsx:

| Route                    | Verhalten                                                  |
| ------------------------ | ---------------------------------------------------------- |
| `/admin/onboarding`      | Layout redirect wenn `setup_completed_at` fehlt            |
| `/superadmin/onboarding` | Layout redirect wenn `superadmin_setup_completed_at` fehlt |
| `/select-admin-club`     | Superadmin ohne Club-Cookie wird hierher redirectet        |

---

## 9. API-Routen nach Domäne

> **Gesamt: 170+ Endpunkte**

### 9.1 Auth & User

| Methode | Route                         | Funktion            |
| ------- | ----------------------------- | ------------------- |
| POST    | `/api/auth/login`             | Login               |
| POST    | `/api/auth/logout`            | Logout              |
| GET     | `/api/user/me`                | Eigenes Profil      |
| GET     | `/api/user/member`            | Member-Daten        |
| GET     | `/api/user/club`              | Club-Info           |
| GET     | `/api/user/roles`             | Rollen              |
| GET     | `/api/me`                     | Current User        |
| GET     | `/api/csrf-token`             | CSRF-Token          |
| GET     | `/api/public/register`        | Public Registration |
| POST    | `/api/users/superadmin-setup` | Superadmin Setup    |

### 9.2 Mitglieder

| Methode          | Route                          |
| ---------------- | ------------------------------ |
| GET/POST         | `/api/members`                 |
| GET/PATCH/DELETE | `/api/members/[id]`            |
| POST             | `/api/members/invite`          |
| POST             | `/api/members/bulk-deactivate` |

### 9.3 Clubs

| Methode   | Route                                 |
| --------- | ------------------------------------- |
| GET/POST  | `/api/clubs`                          |
| GET/PATCH | `/api/clubs/[id]`                     |
| GET/PATCH | `/api/clubs/[id]/onboarding-settings` |
| GET       | `/api/clubs/[id]/planning-readiness`  |
| POST      | `/api/clubs/[id]/setup`               |
| GET/POST  | `/api/admin/tenants`                  |
| GET       | `/api/admin/memberships/[id]`         |
| POST      | `/api/admin/switch-club`              |
| GET       | `/api/admin/switch-club-redirect`     |
| GET/POST  | `/api/club/contact`                   |

### 9.4 Buchungen & Plätze

| Methode          | Route                           |
| ---------------- | ------------------------------- |
| GET/POST         | `/api/bookings`                 |
| POST             | `/api/bookings/[id]/cancel`     |
| PATCH            | `/api/bookings/[id]/status`     |
| POST             | `/api/bookings/series`          |
| POST             | `/api/bookings/validate-series` |
| GET/POST         | `/api/courts`                   |
| GET/PATCH/DELETE | `/api/courts/[id]`              |
| GET              | `/api/courts/[id]/schedule`     |
| GET/POST         | `/api/court-types`              |
| GET/PATCH/DELETE | `/api/court-types/[id]`         |
| GET/POST         | `/api/booking-rules`            |
| GET/POST         | `/api/pricing-rules`            |

### 9.5 Sessions & RSVP

| Methode          | Route                          |
| ---------------- | ------------------------------ |
| GET/POST         | `/api/sessions`                |
| GET/PATCH/DELETE | `/api/sessions/[id]`           |
| GET/POST         | `/api/sessions/[id]/rsvp`      |
| GET              | `/api/rsvps/my`                |
| POST             | `/api/sessions/bulk-delete`    |
| GET/POST         | `/api/qr-checkin`              |
| GET/POST         | `/api/attendance-records`      |
| GET/PATCH/DELETE | `/api/attendance-records/[id]` |

### 9.6 Saisonen & Planung

| Methode          | Route                                            |
| ---------------- | ------------------------------------------------ |
| GET/POST         | `/api/seasons`                                   |
| GET/PATCH/DELETE | `/api/seasons/[id]`                              |
| GET/POST         | `/api/seasons/[id]/groups`                       |
| GET/POST/DELETE  | `/api/seasons/[id]/groups/[groupId]/members`     |
| GET/POST         | `/api/seasons/[id]/preferences`                  |
| GET/PATCH/DELETE | `/api/seasons/[id]/preferences/[userId]`         |
| GET/POST/PATCH   | `/api/seasons/[id]/plan-entries`                 |
| GET/PATCH/DELETE | `/api/seasons/[id]/plan-entries/[entryId]`       |
| GET              | `/api/seasons/[id]/plan-grid`                    |
| POST             | `/api/seasons/[id]/auto-plan`                    |
| GET/POST         | `/api/seasons/[id]/planning/cluster`             |
| GET              | `/api/seasons/[id]/planning/conflicts`           |
| GET              | `/api/seasons/[id]/planning/members`             |
| POST             | `/api/seasons/[id]/planning/confirm`             |
| GET              | `/api/seasons/[id]/planning/preferences-summary` |
| GET              | `/api/seasons/[id]/planning/trainers`            |
| POST             | `/api/seasons/[id]/planning/remind`              |
| POST             | `/api/seasons/[id]/planning/waitlist`            |
| POST             | `/api/seasons/planning/ai-analysis`              |

### 9.7 Trainer & Verfügbarkeit

| Methode          | Route                                                                |
| ---------------- | -------------------------------------------------------------------- |
| GET/POST         | `/api/trainers`                                                      |
| GET/POST         | `/api/trainer-availability`                                          |
| GET/PATCH/DELETE | `/api/trainer-availability/[id]`                                     |
| GET              | `/api/trainer-availability/conflicts`                                |
| GET/POST         | `/api/trainer-absences`                                              |
| GET/POST         | `/api/trainer-profiles`                                              |
| GET/PATCH/DELETE | `/api/trainer-profiles/[id]`                                         |
| GET/POST         | `/api/trainer-profiles/[id]/qualifications`                          |
| POST             | `/api/trainer-profiles/[id]/qualifications/[qualificationId]/verify` |
| GET              | `/api/trainer/me`                                                    |
| POST             | `/api/trainer/book`                                                  |
| GET/POST         | `/api/trainer/availability`                                          |
| GET/PATCH/DELETE | `/api/trainer/availability/[id]`                                     |
| GET              | `/api/trainers/[trainerId]/feedback`                                 |
| GET/POST         | `/api/training-groups`                                               |
| GET/PATCH/DELETE | `/api/training-groups/[id]`                                          |

### 9.8 Abwesenheiten & Stunden

| Methode          | Route                             |
| ---------------- | --------------------------------- |
| GET/POST         | `/api/absences`                   |
| GET/PATCH/DELETE | `/api/absences/[id]`              |
| POST             | `/api/absences/[id]/approve`      |
| POST             | `/api/absences/[id]/reject`       |
| GET/POST         | `/api/hours-logs`                 |
| GET/PATCH/DELETE | `/api/hours-logs/[id]`            |
| POST             | `/api/hours-logs/[id]/approve`    |
| POST             | `/api/hours-logs/[id]/reject`     |
| GET/POST         | `/api/hourly-rates/history`       |
| GET/POST/PATCH   | `/api/hourly-rates/tiers`         |
| GET/PATCH/DELETE | `/api/hourly-rates/tiers/[id]`    |
| GET/POST         | `/api/hourly-rates/trainers`      |
| GET/PATCH/DELETE | `/api/hourly-rates/trainers/[id]` |

### 9.9 Abrechnung & Zahlungen

| Methode               | Route                                   |
| --------------------- | --------------------------------------- |
| GET/POST              | `/api/billing/invoices`                 |
| GET/PATCH/DELETE      | `/api/billing/invoices/[id]`            |
| POST                  | `/api/billing/invoices/create`          |
| GET                   | `/api/billing/invoices/overview`        |
| GET                   | `/api/billing/invoices/[id]/checkout`   |
| GET                   | `/api/billing/balance`                  |
| POST                  | `/api/billing/generate-invoices`        |
| POST                  | `/api/billing/generate-season-invoices` |
| POST                  | `/api/billing/group-change`             |
| GET/PATCH/DELETE      | `/api/billing/installments/[id]`        |
| GET/POST              | `/api/billing/line-items`               |
| GET                   | `/api/billing/monthly-overview`         |
| GET                   | `/api/billing/open-items`               |
| POST                  | `/api/billing/payments/import`          |
| POST                  | `/api/billing/sepa/pain008`             |
| GET                   | `/api/billing/trainers`                 |
| GET/PATCH/DELETE      | `/api/billing/trainers/[id]`            |
| GET                   | `/api/billing/trainers/[id]/overdue`    |
| POST                  | `/api/billing/trainers/[id]/pay`        |
| GET/POST/PATCH        | `/api/admin/billing/invoices`           |
| GET/POST/PATCH        | `/api/admin/billing/subscriptions`      |
| GET/POST              | `/api/admin/fee-categories`             |
| GET/POST              | `/api/fee-configurations`               |
| GET/PATCH/DELETE      | `/api/fee-configurations/[id]`          |
| POST                  | `/api/payments`                         |
| PATCH                 | `/api/payments/[id]/status`             |
| GET/POST              | `/api/payment-settings`                 |
| GET/PATCH/DELETE      | `/api/payment-settings/[id]`            |
| POST                  | `/api/payment-settings/[id]/test`       |
| POST                  | `/api/stripe/checkout`                  |
| GET/POST/PATCH/DELETE | `/api/sepa-mandates`                    |
| GET/POST              | `/api/coupons`                          |

### 9.10 Benachrichtigungen & Kommunikation

| Methode          | Route                                   |
| ---------------- | --------------------------------------- |
| GET/POST         | `/api/notifications`                    |
| GET/PATCH/DELETE | `/api/user/notifications/[id]`          |
| GET              | `/api/user/notifications/count`         |
| POST             | `/api/user/notifications/mark-all-read` |
| GET/POST         | `/api/messages`                         |
| POST             | `/api/messages/[id]/read`               |
| GET/POST         | `/api/news`                             |
| GET/PATCH/DELETE | `/api/news/[id]`                        |
| POST             | `/api/email-campaigns`                  |
| POST             | `/api/emails/onboarding`                |

### 9.11 Gamification & Feedback

| Methode          | Route                        |
| ---------------- | ---------------------------- |
| GET/POST         | `/api/gamification`          |
| GET/POST         | `/api/feedback`              |
| GET/PATCH/DELETE | `/api/feedback/[feedbackId]` |
| POST             | `/api/feedback/ratings`      |

### 9.12 Analytics & Statistiken

| Methode  | Route                            |
| -------- | -------------------------------- |
| GET/POST | `/api/analytics`                 |
| GET      | `/api/analytics/bookings/export` |
| GET      | `/api/analytics/insights`        |
| GET      | `/api/analytics/members/export`  |
| GET      | `/api/analytics/revenue/export`  |
| GET      | `/api/statistics`                |
| GET      | `/api/statistics/dashboard`      |
| GET      | `/api/statistics/export`         |
| GET      | `/api/dashboard/kpis`            |

### 9.13 KI & Automatisierung

| Methode | Route                      |
| ------- | -------------------------- |
| GET     | `/api/partner-finder`      |
| POST    | `/api/ai/churn-prediction` |
| POST    | `/api/schedule/optimize`   |

### 9.14 System & Audit

| Methode          | Route                        |
| ---------------- | ---------------------------- |
| GET              | `/api/health`                |
| GET/POST         | `/api/audit-logs`            |
| GET/PATCH/DELETE | `/api/audit-logs/[id]`       |
| GET              | `/api/audit-logs/export`     |
| GET              | `/api/audit-logs/summary`    |
| GET/POST/PATCH   | `/api/admin/system/settings` |
| GET/POST         | `/api/system-settings`       |
| GET/PATCH/DELETE | `/api/system-settings/[id]`  |
| GET/POST         | `/api/branding`              |
| GET/POST         | `/api/applications`          |

### 9.15 Shop

| Methode  | Route       |
| -------- | ----------- |
| GET/POST | `/api/shop` |

### 9.16 Turniere

| Methode          | Route                               |
| ---------------- | ----------------------------------- |
| GET/POST         | `/api/tournaments`                  |
| GET/PATCH/DELETE | `/api/tournaments/[id]`             |
| POST             | `/api/tournaments/[id]/register`    |
| GET              | `/api/tournaments/my-registrations` |

### 9.17 Probetraining

| Methode          | Route                                 |
| ---------------- | ------------------------------------- |
| GET/POST         | `/api/trial-trainings`                |
| GET/PATCH/DELETE | `/api/trial-trainings/[id]`           |
| POST             | `/api/trial-trainings/[id]/convert`   |
| POST             | `/api/trial-trainings/[id]/reminder`  |
| GET              | `/api/trial-trainings/stats`          |
| POST             | `/api/public/trial-training/feedback` |
| POST             | `/api/public/trial-training/signup`   |

### 9.18 Sonstige

| Methode          | Route                                 |
| ---------------- | ------------------------------------- |
| GET              | `/api/schedule`                       |
| GET/POST         | `/api/search`                         |
| POST             | `/api/docs`                           |
| GET/POST         | `/api/groups`                         |
| GET/PATCH/DELETE | `/api/groups/[id]`                    |
| GET/POST/DELETE  | `/api/groups/[id]/members`            |
| GET/DELETE       | `/api/groups/[id]/members/[memberId]` |
| GET/POST         | `/api/family-accounts`                |

### 9.19 Webhooks & Cron

| Methode | Route                             | Funktion                       |
| ------- | --------------------------------- | ------------------------------ |
| POST    | `/api/webhooks/stripe`            | Stripe-Webhook                 |
| POST    | `/api/webhooks/zapier`            | Zapier-Webhook                 |
| POST    | `/api/cron/billing-overdue`       | Cron: Mahnungen                |
| GET     | `/api/cron/trial-followup`        | Cron: Trial-Nurture-Follow-ups |
| POST    | `/api/reminders/booking-tomorrow` | Cron: Buchungs-Erinnerungen    |

---

## 10. Sidebar-Navigation vs. Bottom-Nav

Beide Oberflächen stammen aus `lib/navigation.ts`. Die Bottom-Nav ist ein
kuratiertes Subset — `src/__tests__/lib/navigation.test.ts` erzwingt, dass jedes
mobile Ziel auch in der Sidebar derselben Rolle vorkommt und dass ein Ziel
rollenübergreifend nur einen Namen trägt.

> ⚠️ **Trainer und Member bekommen keine Sidebar gerendert.**
> `app/(protected)/protected-client-layout.tsx` zeigt die Sidebar nur für
> `owner`/`superadmin`/`admin`; Trainer und Member erhalten stattdessen die
> permanente Bottom-Tab-Bar. Ihre Sektionen in `lib/navigation.ts` versorgen
> also nur die Bottom-Nav-Prüfung und die Command-Palette. Der reale
> Navigations-Surface dieser beiden Rollen ist **Bottom-Nav + die
> Schnellzugriff-Kacheln des jeweiligen Dashboards** — ein Ziel, das dort
> fehlt, ist für sie faktisch nicht erreichbar.

| Rolle          | Sidebar-Sektionen                                                                       | Bottom Nav                                           |
| -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Owner**      | Plattform-Konsole, Monetarisierung                                                      | Dashboard, Vereine, Audit, Admins, Umsatz            |
| **Superadmin** | Meine Vereine, Verwaltung                                                               | Dashboard, Vereine, Statistiken, Profil              |
| **Admin**      | Mitglieder, Trainer, Saison & Plätze, Finanzen, Verein, Weitere Module                  | Dashboard, Mitglieder, Saison, Finanzen, Profil      |
| **Trainer**    | Mein Training, Meine Leistung (+ „Spielen"/„Mein Verein" bei zusätzlicher Member-Rolle) | Übersicht, Kalender, Verfügbarkeit, Stunden, Honorar |
| **Member**     | Spielen, Training, Mein Verein                                                          | Start, Training, Buchen, Rechnungen                  |

---

## 11. Seiten-Statistiken

| Kategorie                |       Seiten |      API-Endpunkte |
| ------------------------ | -----------: | -----------------: |
| Öffentlich               |           10 |                  0 |
| Dashboard (übergreifend) |           12 |                  3 |
| Admin                    |           30 |                ~50 |
| Superadmin               |            5 |                ~10 |
| Trainer                  |            2 |                ~20 |
| Member                   |            4 |                 ~3 |
| **Gesamt UI**            |       **63** |                  — |
| **Gesamt API**           |            — |          **~170+** |
| **Gesamt Projekt**       | **79 Pages** | **170+ Endpunkte** |

---

> **Anmerkung:** Einige API-Routen enthalten mehrere HTTP-Methoden (GET/POST/PATCH/DELETE) in einer einzigen `route.ts`-Datei. Die tatsächliche Anzahl an Endpunkten liegt daher höher als die Anzahl der Dateien.
