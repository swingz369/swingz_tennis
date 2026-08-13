# Rollenbasierte Navigation - Sidebar

Die Sidebar zeigt unterschiedliche Menüpunkte basierend auf der Benutzerrolle.

## Rollen-Hierarchie

1. **Member** (Basiszugriff)
2. **Trainer** (Member + Trainer-Funktionen)
3. **Admin** (Trainer + Admin-Funktionen)
4. **Superadmin** (Admin + Plattform-weite Funktionen)

## Navigation nach Rolle

### 🔵 MEMBER (Alle Benutzer)

**Hauptmenü:**

- Dashboard
- Trainingszeiten
- Anwesenheit
- News
- Benachrichtigungen
- Buchungen
- Platz-Kalender
- Abo & Rechnung
- Mein Profil

### 🟢 TRAINER (Zusätzlich zu Member)

**Trainer-Bereich:**

- Trainer Dashboard (`/trainer`)
  - Eigene Sessions-Übersicht
  - Teilnehmer-Management
  - Feedback-Tab (erhaltene Bewertungen)
- Scheduler (`/scheduler`)
  - Session-Planung
  - Verfügbarkeiten

### 🔴 ADMIN (Zusätzlich zu Trainer)

**Administration:**

- **Admin Panel v2** (`/admin/panel-v2`) ⭐ NEU
  - Analytics Dashboard mit KPIs
  - Feedback-Moderation
  - Audit-Log-Viewer
  - Export-Funktionen
- Analytics (`/admin/analytics`)
- Onboarding (`/admin/onboarding`)
- Clubs (`/admin/clubs`)
- Mitglieder (`/admin/members`)
- Trainer (`/admin/trainers`)
- Schedules (`/admin/schedules`)
- Platzverwaltung (`/admin/courts/manage`)
- Genehmigungen (`/admin/approvals`)
- Einstellungen (`/admin/settings`)
- Billing Admin (`/admin/billing`)

### 🟣 SUPERADMIN (Zusätzlich zu Admin)

**Plattform-Verwaltung:**

- Vereinsübersicht (`/admin/tenants`)
  - Alle Clubs auf der Plattform
  - Club-übergreifende Statistiken
- Kein "Abo & Rechnung" (da plattform-weit)

## Visuelle Unterscheidung

Die Navigation verwendet verschiedene Farbschemas für unterschiedliche Bereiche:

- **Hauptmenü**: Grüner Gradient (`#1B4332` → `#2D6A4F`)
- **Trainer-Bereich**: Grüner Gradient (`#22c55e` → `#15803d`)
- **Admin-Bereich**: Oranger Gradient (`#FF6B35` → `#FF8C5A`)

## Implementierung

Die rollenbasierte Logik ist in `/components/layout/sidebar.tsx` implementiert:

```typescript
const isAdmin = roles?.some((r) => r === 'admin' || r === 'superadmin');
const isSuperAdmin = roles?.includes('superadmin');
const isTrainer = roles?.includes('trainer') || isAdmin;
const isMember = roles?.includes('member');
```

### Filter-Mechanismus

Menüpunkte mit `showIf: false` werden automatisch herausgefiltert:

```typescript
const mainNav = [
  // ...
  { name: 'Abo & Rechnung', href: '/billing', icon: CreditCard, showIf: !isSuperAdmin },
].filter((item) => item.showIf !== false);
```

## Mobile Optimierung

- Swipe-to-close Geste auf mobilen Geräten
- Overlay mit Close-Button
- Responsive Breakpoints (md: ab 768px)

## Accessibility

- ARIA-Labels für Screen Reader
- Keyboard-Navigation
- Focus-States mit Ring-Indicator
- Semantic HTML (`<nav>`, `role="navigation"`)

## Neue Features in Phase 4

### Admin Panel v2

Zentraler Hub für Admins mit:

- **Analytics Tab**: Umfassende Metriken und 6-Monats-Trends
- **Feedback Tab**: Moderation mit Bulk-Operationen
- **Audit Logs Tab**: Vollständige Aktivitäts-Historie mit Export
- **Members/Sessions/Settings Tabs**: Geplant für zukünftige Erweiterungen

### Feedback-System

- Post-Session-Feedback für Members (nach bestätigten Sessions)
- Feedback-Übersicht für Trainer (eigener Tab im Trainer Dashboard)
- Feedback-Moderation für Admins (Admin Panel v2)

## Zugriffskontrolle

Die Navigation zeigt nur an, was der Benutzer sehen darf. Die tatsächliche Zugriffskontrolle erfolgt zusätzlich auf:

1. **API-Ebene**: `withApiAuth` + `verifyRole` in allen Endpoints
2. **Page-Ebene**: Server-side Checks in `page.tsx`
3. **RLS-Ebene**: Row Level Security in Supabase

## Testing

Um verschiedene Rollen zu testen:

1. Als **Member** anmelden → Nur Hauptmenü sichtbar
2. Als **Trainer** anmelden → Hauptmenü + Trainer-Bereich
3. Als **Admin** anmelden → Hauptmenü + Trainer + Administration
4. Als **Superadmin** anmelden → Alle Bereiche + Vereinsübersicht
