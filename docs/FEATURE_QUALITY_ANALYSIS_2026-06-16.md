# SwingZ — Feature-Qualitätsanalyse für Produktionsreife

> **Datum:** 16. Juni 2026  
> **Ziel:** Zahlende Kunden — das Produkt muss perfekt sein.  
> **Analyseumfang:** Alle Features, UX, Error Handling, Accessibility, Performance, Security, Monetarisierung.

---

## 📊 Executive Summary

| Bereich                      | Reifegrad      | Bewertung                                                                          |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| **Landing Page & Marketing** | 🟡 Gut         | Visuell stark, aber "Early Access Beta"-Positionierung schreckt zahlende Kunden ab |
| **Mitglieder-Erfahrung**     | 🟢 Solid       | Kernfunktionen vollständig, Messages-System ausbaufähig                            |
| **Admin-Erfahrung**          | 🟢 Solid       | Umfangreich, Revenue-KPIs teilweise hardcoded auf 0                                |
| **Billing & Payments**       | 🟡 Gut         | Stripe-Integration vorhanden, aber PLACEHOLDER-Keys, kein Checkout-Flow            |
| **Analytics & KI**           | 🟡 Gut         | Grundgerüst steht, Revenue = 0, KI-Matchmaking nur Feature-Flag                    |
| **Kommunikation**            | 🟠 Ausbaufähig | Messages-Seite existiert, Push rudimentär, kein Echtzeit-Chat                      |
| **Monetarisierung**          | 🔴 Kritisch    | Nur 1 Pricing-Plan (kostenlos), kein Self-Service-Checkout                         |
| **i18n**                     | 🔴 Kritisch    | Hardcoded Deutsch, keine Mehrsprachigkeit möglich                                  |
| **Accessibility**            | 🟡 Gut         | aria-Labels in Kern-Komponenten, aber nicht flächendeckend                         |
| **Mobile**                   | 🟢 Solid       | Mobile Bottom Nav, Touch-Swipe, Responsive-Layouts                                 |

---

## 🔴 KRITISCH — Muss vor Launch behoben werden

### 1. Revenue-Dashboards zeigen immer 0 €

**Betroffene Dateien:**

- `app/(protected)/admin/dashboard/page.tsx` — `revenue: 0` hardcoded für alle Clubs
- `app/(protected)/admin/analytics/page.tsx` — `totalRevenue: 0`, `revenue: 0` hardcoded
- `app/(protected)/admin/tenants/page.tsx` — `revenue: 0` hardcoded

**Problem:** Der Superadmin-Dashboard-KPI "Umsatz" zeigt immer 0 €, obwohl es eine vollständige Billing-Pipeline gibt. Das wirkt auf zahlende Kunden wie ein unvollständiges Produkt.

**Fix:** Revenue aus `invoices`- oder `payments`-Tabelle aggregieren (die Query existiert bereits in `app/api/admin/tenants/route.ts`).

---

### 2. Nur 1 Pricing-Plan — "Early Access" (kostenlos)

**Betroffene Datei:** `app/landing/page.tsx`

```typescript
const PRICING_PLANS = [
  {
    name: 'Early Access',
    price: '0',
    period: '/6 Monate',
    cta: 'Early Access anfragen',
  },
];
```

**Problem:** Es gibt keinen bezahlbaren Plan. Die Landing Page sagt "Early Access Beta" und "kostenlos" — das schreckt Vereine ab, die ein professionelles Produkt suchen und bereit sind zu zahlen.

**Fix:**

- Mind. 2-3 Pricing-Pläne hinzufügen (Starter, Professional, Enterprise)
- "Early Access"-Badge durch "Jetzt starten" ersetzen
- Self-Service-Checkout via Stripe einbauen (nicht nur Kontaktformular)

---

### 3. Stripe PLACEHOLDER-Keys

**Betroffene Datei:** `lib/stripe/client.ts`

```typescript
const PLACEHOLDER_PREFIX = 'sk_test_51Qabc';
if (!key || key.startsWith(PLACEHOLDER_PREFIX)) {
  // ...
}
```

**Problem:** Die Stripe-Integration ist technisch vorhanden, aber mit Platzhalter-Keys konfiguriert. Kein realer Zahlungsfluss möglich.

**Fix:** Echte Stripe-Keys konfigurieren, Checkout-Session-Flow testen, Webhook-Handler validieren.

---

### 4. "Early Access Beta"-Positionierung auf der Landing Page

**Betroffene Dateien:**

- `app/landing/page.tsx` — "Early Access Beta" Badge, "Early Access anfragen" CTA
- `app/contact/page.tsx` — "Early Access Beta"

**Problem:** Die gesamte Marketing-Positionierung signalisiert "Beta-Software". Zahlende Kunden erwarten ein fertiges Produkt.

**Fix:**

- "Early Access Beta" → "Jetzt starten" oder "Kostenlos testen"
- Messaging von "Wir bauen an der Zukunft" → "Die Lösung für Ihren Verein"
- Social Proof hinzufügen (Testimonials, Referenzen)

---

### 5. Kein Self-Service-Onboarding

**Problem:** Der aktuelle Flow ist: Landing Page → Kontaktformular → Manueller Kontakt → Onboarding. Das ist kein SaaS-Flow.

**Fix:**

- Registration → automatische Club-Erstellung → Onboarding-Wizard
- Die Onboarding-Komponenten existieren bereits (`components/onboarding/`)
- Sie müssen nur mit einem Self-Service-Registrierungsflow verbunden werden

---

## 🟠 HOCH — Sollte vor Launch behoben werden

### 6. KI-Matchmaking: Feature-Flag existiert, aber kein UI

**Betroffene Dateien:**

- `lib/features.ts` — `ai_matchmaking` als optional definiert
- `app/(protected)/admin/analytics/page.tsx` — "Matchmaking"-Card mit Beschreibungstext

**Problem:** Die Analytics-Seite zeigt eine KI-Insights-Card mit "Matchmaking: Finde Trainingspartner mit passendem Level" — aber es gibt keine funktionierende Implementierung.

**Fix:** Entweder Feature vollständig implementieren oder die Card-Platzhalter entfernen.

---

### 7. Messages-System: Grundgerüst ohne Echtzeit

**Betroffene Datei:** `app/(protected)/messages/page.tsx`

**Problem:** Die Messages-Seite existiert mit RichTextEditor, aber:

- Kein Echtzeit-Chat (kein WebSocket/Supabase Realtime)
- Kein Unread-Count im Sidebar
- Keine Push-Benachrichtigungen bei neuen Nachrichten

**Fix:** Supabase Realtime für Messages integrieren oder als "Community-Board" (ohne Chat-Erwartung) positionieren.

---

### 8. Notification-System: Polling statt Realtime

**Betroffene Datei:** `components/layout/notification-bell.tsx`

```typescript
// Polls every 30s for new notifications
```

**Problem:** Notifications werden alle 30s gepollt. Das ist für eine moderne SaaS-Plattform unzureichend.

**Fix:** Supabase Realtime-Subscriptions für Notifications implementieren.

---

### 9. Churn Prediction API: Ungewisse Verfügbarkeit

**Betroffene Datei:** `components/ai/churn-risk-panel.tsx`

**Problem:** Die Komponente fetched `/api/ai/churn-prediction`. Wenn dieser Endpoint nicht existiert oder keine echten Daten liefert, zeigt die Analytics-Seite einen Fehler.

**Fix:** Endpoint-Existenz und Datenqualität prüfen. Fallback für den Fall, dass keine KI-Daten verfügbar sind.

---

### 10. Admin Dashboard: Kein Error-Boundary

**Betroffene Dateien:**

- `app/(protected)/admin/dashboard/page.tsx` — kein `try/catch` um die gesamte Seite
- `app/(protected)/admin/analytics/page.tsx` — `fetchError` wird abgefangen, aber UI ist minimal

**Problem:** Bei unerwarteten Fehlern (z.B. fehlende DB-Tabellen) zeigt die Seite nur eine rote Fehlermeldung ohne Recovery-Option.

**Fix:** Professionelle Error-Boundary-Komponente mit "Erneut versuchen"-Button und Support-Kontakt.

---

## 🟡 MITTEL — Verbesserungen für bessere UX

### 11. Accessibility: Nicht flächendeckend

**Gut gelöst:** `aria-label` in Sidebar, Header, Pagination, Button, Modal, Theme-Toggle, Route-Progress-Bar.

**Fehlt in:**

- Viele Formulare ohne `<label>`-Verknüpfung (`htmlFor`)
- Tabellen ohne `scope`-Attribute auf `<th>`
- Einige interaktive Elemente ohne Keyboard-Navigation
- Kein Skip-to-Content-Link
- Kein Fokus-Management bei Modal-Öffnung

---

### 12. i18n: Hardcoded Deutsch

**Betroffene Datei:** `lib/locale.ts`

```typescript
export const activeLocale = 'de' as const;
```

**Problem:** Alle Strings sind hardcoded Deutsch. Keine Möglichkeit für Englisch oder andere Sprachen.

**Bewertung:** Für den deutschen Markt aktuell akzeptabel. Für internationale Expansion kritisch.

---

### 13. Landing Page Stats: Aspirational statt Real

**Betroffene Datei:** `app/landing/page.tsx`

```typescript
<StatItem value={100} suffix="+" label="Vereine in Year 1" />
<StatItem value={50} suffix="%" label="Weniger Planungsaufwand" />
<StatItem value={10000} suffix="+" label="Trainings optimiert" />
```

**Problem:** Das sind keine echten Zahlen, sondern Vision-Statements. Für Early Adopter okay, für zahlende Kunden nicht überzeugend.

**Fix:** Echte Statistiken zeigen (aktive Vereine, gebuchte Trainings) oder die Section als "Unsere Ziele" kennzeichnen.

---

### 14. TODO-Kommentare in Test-Dateien

**Betroffene Dateien:**

- `tests/infrastructure/repositories/member.repository.test.ts` — 2× TODO
- `tests/infrastructure/repositories/billing.repository.test.ts` — 3× TODO

```typescript
// TODO: Implement test database setup
// TODO: Implement cleanup when DB connection is available
```

**Problem:** Unvollständige Test-Infrastruktur. Die Tests existieren, aber die DB-Setup/Teardown-Logik fehlt.

---

### 15. Experiment-System: Nur 1 aktives Experiment

**Betroffene Datei:** `lib/experiments.ts`

```typescript
export const experiments = {
  landing_hero_cta: {
    variants: ['demo_starten', 'kostenlos_testen'],
    enabled: true,
  },
};
```

**Problem:** Nur 1 A/B-Test aktiv. Für eine datengetriebene Produktentwicklung sollten mehr Experimente laufen.

---

### 16. Superadmin Tenants-Seite: Revenue hardcoded

**Betroffene Datei:** `app/(protected)/superadmin/tenants/page.tsx`

```typescript
revenue: 0,
```

**Problem:** Wie Admin-Dashboard — Revenue wird nicht aus der DB geladen.

---

### 17. Shop-Feature: total_revenue = 0

**Betroffene Datei:** `app/(protected)/admin/shop/page.tsx`

```typescript
total_revenue: 0,
```

**Problem:** Der Shop existiert als Feature, aber die Revenue-Statistik ist hardcoded auf 0.

---

## 🟢 GUT — Professionell umgesetzt

### ✅ Hybrid Server Components

Mehrere kritische Pages auf SC umgestellt (member, trainer, trial-training, clubs) — kein Loading-Spinner, SSR-Render.

### ✅ Loading Skeletons

15+ `loading.tsx` Dateien für alle Server Component Pages — professioneller Ladezustand.

### ✅ Feature-Flag-System

Solides System in `lib/features.ts` mit Core/Optional-Kategorien, Dependency-Enforcement und Sidebar-Integration.

### ✅ Role-Based Access Control

Konsistente Auth-Patterns: `requireAuth()` für Pages, `withApiAuth()` für API-Routen, `requireAdminClub()` für Admin-Bereiche.

### ✅ Mobile Responsiveness

- Mobile Bottom Navigation
- Touch-Swipe für Kalender-Navigation
- Responsive Grid-Layouts überall
- `useIsMobile()` Hook

### ✅ Accessibility (Partial)

- aria-labels in Kern-Komponenten (Sidebar, Header, Pagination, Modal)
- Keyboard-Navigation in vielen interaktiven Elementen
- `role`-Attribute auf semantischen Elementen
- `AnimatedCounter` mit `aria-label` für Screenreader

### ✅ Error Handling

- `error.tsx` an Root- und Protected-Ebene
- `global-error.tsx` für kritische Fehler
- `not-found.tsx` für 404
- Try/catch in den meisten Server Components

### ✅ Billing-System Architektur

- Invoice-Service, Payment-Service, SEPA-Service
- Stripe-Webhook-Handler
- Monatliche Rechnungsgenerierung (Cron)
- SEPA-PAIN.008-XML-Export

### ✅ Season Planning

Vollständiges Feature mit KI-Clustering, Konflikterkennung, Grid-View, und Präferenz-System.

### ✅ Test Coverage

1.109+ bestandene Tests über Unit, Integration und E2E.

---

## 📋 Priorisierte Action Items

### 🔴 Vor Launch (P0)

| #   | Aufwand | Aufgabe                                                             |
| --- | ------- | ------------------------------------------------------------------- |
| 1   | 2h      | Revenue-KPIs in Dashboards mit echten DB-Queries verbinden          |
| 2   | 4h      | Pricing-Pläne hinzufügen (mind. 2: Starter + Professional)          |
| 3   | 1d      | Self-Service-Registration + automatische Club-Erstellung            |
| 4   | 2h      | "Early Access Beta" durch professionelles Messaging ersetzen        |
| 5   | 4h      | Stripe-Integration mit echten Keys testen, Checkout-Flow validieren |

### 🟠 Bald nach Launch (P1)

| #   | Aufwand | Aufgabe                                                          |
| --- | ------- | ---------------------------------------------------------------- |
| 6   | 1d      | Supabase Realtime für Notifications + Messages                   |
| 7   | 4h      | KI-Matchmaking Feature implementieren oder Platzhalter entfernen |
| 8   | 2h      | Error-Boundary-Komponente mit Recovery-UI                        |
| 9   | 1d      | Accessibility-Audit + Fixes (Labels, Keyboard-Nav, Skip-Link)    |
| 10  | 2h      | TODO-Kommentare in Tests auflösen                                |

### 🟢 Optimierung (P2)

| #   | Aufwand | Aufgabe                                       |
| --- | ------- | --------------------------------------------- |
| 11  | 2d      | i18n-System einführen (next-intl)             |
| 12  | 4h      | Landing-Page Stats durch echte Daten ersetzen |
| 13  | 1d      | Weitere A/B-Experimente für Key-Flows         |
| 14  | 4h      | Shop-Feature Revenue-Anbindung                |
| 15  | 2h      | Lighthouse-Audit + Performance-Optimierung    |

---

## Anhang: Feature-Checkliste

| Feature              | Implementiert | Professionell | Bewertung                                 |
| -------------------- | :-----------: | :-----------: | ----------------------------------------- |
| Login / Registration |      ✅       |      🟡       | Kein Self-Service-Signup                  |
| Landing Page         |      ✅       |      🟡       | "Beta"-Positionierung                     |
| Member Dashboard     |      ✅       |      ✅       | Hybrid SC, Loading Skeleton               |
| Admin Dashboard      |      ✅       |      🟡       | Revenue = 0                               |
| Mitgliederverwaltung |      ✅       |      ✅       | Suche, Filter, Bulk-Actions, CSV-Export   |
| Trainer-Verwaltung   |      ✅       |      ✅       | Profile, Verfügbarkeiten, Stundenbuchung  |
| Saisonplanung        |      ✅       |      ✅       | KI-Clustering, Grid, Präferenzen          |
| Buchungssystem       |      ✅       |      ✅       | Sessions + Platzreservierung              |
| Billing / Rechnungen |      ✅       |      🟡       | Stripe PLACEHOLDER, SEPA vorhanden        |
| Shop                 |      ✅       |      🟡       | Grundgerüst, Revenue hardcoded            |
| Turniere             |      🟡       |      🟠       | Feature-Flag, UI-Status unklar            |
| Probetrainings       |      ✅       |      ✅       | Öffentliches Formular + Admin-Genehmigung |
| Analytics            |      ✅       |      🟡       | Charts gut, Revenue = 0                   |
| KI-Churn-Prediction  |      ✅       |      🟡       | API-Endpoint unklar                       |
| KI-Matchmaking       |      ❌       |      ❌       | Nur Feature-Flag                          |
| Messages             |      🟡       |      🟠       | Grundgerüst, kein Echtzeit-Chat           |
| Notifications        |      ✅       |      🟡       | Polling statt Realtime                    |
| Push-Notifications   |      🟡       |      🟠       | Toggle vorhanden, Umsetzung unklar        |
| Weather-Integration  |      🟡       |      🟠       | Feature-Flag, Umsetzung unklar            |
| Liga & Mannschaft    |      🟡       |      🟠       | Feature-Flag, Umsetzung unklar            |
| Arbeitsdienst        |      ✅       |      ✅       | Zuweisung + Nachverfolgung                |
| Work Duty            |      ✅       |      ✅       | Member + Admin Sicht                      |
| Accessibility        |      🟡       |      🟡       | Teilweise, nicht flächendeckend           |
| Mobile               |      ✅       |      ✅       | Bottom Nav, Touch, Responsive             |
| Dark Mode            |      ✅       |      ✅       | Theme-Toggle, system-preference           |
| Error Handling       |      ✅       |      🟡       | Error-Boundaries, aber minimal UI         |
| Loading States       |      ✅       |      ✅       | Skeletons für alle SC Pages               |
| Keyboard Shortcuts   |      ✅       |      ✅       | Dialog + Command Palette                  |

---

## Anhang: Technische Schulden

| Kategorie               | Anzahl    | Bemerkung                           |
| ----------------------- | --------- | ----------------------------------- |
| Hardcoded Revenue       | 4 Stellen | Dashboard, Analytics, Tenants, Shop |
| TODO-Kommentare         | 5         | In Test-Dateien                     |
| PLACEHOLDER-Keys        | 1         | Stripe                              |
| Console-Statements      | 573       | 7× log, 514× error, 52× warn        |
| npm Vulnerabilities     | 28        | 10 High, 17 Moderate                |
| Fehlende Dependencies   | 2         | playwright, dompurify               |
| Ungenutzte Dependencies | 6         | @types/express, critters, etc.      |
