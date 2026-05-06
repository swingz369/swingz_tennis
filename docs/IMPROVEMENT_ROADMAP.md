# 🎾 SwingZ Improvement Roadmap

**Ziel:** SwingZ auf Production-Ready Level bringen

**Stand:** 6. Mai 2026  
**Version:** 1.0  
**Priorität:** 🔥 Kritisch | ⚠️ Hoch | 📌 Mittel | 💡 Nice-to-have

---

## 📋 Executive Summary

### Kernprobleme identifiziert:

1. ❌ Admin Dashboard lädt nicht zuverlässig
2. ❌ Saisonplanung-Feature fehlt komplett (Kernfunktion!)
3. ❌ Stunden-Logging-System unvollständig (Admin/Superadmin können nicht loggen)
4. ❌ Platz-Buchungssystem mit Bezahlung für Gäste fehlt
5. ❌ Viele Features funktionieren nicht oder sind unfertig
6. ❌ Code-Qualität und Architektur inkonsistent

### Geschäftsmodell (neu verstanden):

- **Saisonplanung als Hauptfeature**: Admin plant KOMPLETTE Saison im Voraus
  - Sommersaison: April - September
  - Wintersaison: Oktober - März
  - Basis: User-Präferenzen + Trainer-Verfügbarkeiten
  - Wöchentlicher fester Trainingsplan
- **Zusatzbuchungen**: Trainer können zusätzliche Slots bei freier Kapazität buchen
- **Platz-Buchung**: Mitglieder kostenlos, Gäste mit Bezahlung

---

## 🎯 Phase 1: Critical Bugfixes (Woche 1-2)

### 1.1 Admin Dashboard beheben 🔥

**Problem:** Dashboard lädt nicht / `document is not defined` SSR-Fehler  
**Status:** In Analyse  
**Priorität:** 🔥 KRITISCH

**Maßnahmen:**

- [ ] Root-Cause-Analyse: SSR/CSR-Probleme identifizieren
- [ ] `analytics-dashboard.tsx` auf SSR-Kompatibilität prüfen
- [ ] `audit-log-viewer.tsx` - `document.createElement()` in Client-Only Boundary
- [ ] Loading States und Error Boundaries ergänzen
- [ ] E2E-Test für Dashboard-Load erstellen

**Betroffene Dateien:**

- `app/(protected)/admin/dashboard/page.tsx`
- `app/(protected)/admin/dashboard/dashboard-client.tsx`
- `components/admin/analytics-dashboard.tsx`
- `components/admin/audit-log-viewer.tsx`

---

### 1.2 Stunden-Logging erweitern 🔥

**Problem:** Admin/Superadmin können keine Stunden loggen/einsehen  
**Aktuell:** Nur Trainer können loggen  
**Soll:** Admin/Superadmin = voller Zugriff auf alle Logs

**Maßnahmen:**

- [ ] API `/api/hours-logs` um Admin/Superadmin-Zugriff erweitern
- [ ] Permissions in `lib/api-auth.ts` anpassen
- [ ] UI: Admin-Ansicht für alle Stunden-Logs erstellen
- [ ] Umbenennung: "Hours Logging" → "Stundennachweis"
- [ ] Filter: Nach Trainer, Datum, Status filtern
- [ ] Export-Funktion für Abrechnungen (CSV/Excel)

**Neue Features:**

- Admin-Dashboard: Übersicht aller Stundennachweise
- Bulk-Approve/Reject für Admins
- Statistik: Stunden pro Trainer/Monat
- Abrechnung-Workflow verbessern

**Betroffene Dateien:**

- `app/api/hours-logs/route.ts`
- `lib/api-auth.ts` (verifyRole-Checks)
- `components/admin/hours-logs-overview.tsx` (neu)
- `app/(protected)/admin/hours-logs/page.tsx` (neu)

---

### 1.3 Kritische API-Endpoints fixen ⚠️

**Problem:** Viele API-Endpoints werfen Fehler oder returnen inkonsistente Daten

**Audit durchführen:**

- [ ] Alle `/api/*` Endpoints mit Postman/Thunder Client testen
- [ ] Error-Handling vereinheitlichen
- [ ] Validation-Errors verbessern (Zod-Errors besser formatieren)
- [ ] Rate-Limiting prüfen (zu restriktiv?)
- [ ] Response-Format standardisieren

**Standard Response Format:**

```typescript
// Success
{ success: true, data: {...}, message?: string }

// Error
{ success: false, error: string, details?: any }
```

---

## 🚀 Phase 2: Kernfeatures implementieren (Woche 3-6)

### 2.1 Saisonplanung-System 🔥🔥🔥

**Wichtigstes fehlendes Feature!**

**Anforderungen:**

1. **Saisonplan-Erstellung:**
   - Admin erstellt Plan für Sommer- oder Wintersaison
   - Input: User-Präferenzen (bevorzugte Zeiten, Frequenz)
   - Input: Trainer-Verfügbarkeiten
   - Output: Wöchentlicher Trainingsplan (wiederholend)
   - Zeit: April-Sept (Sommer) / Okt-März (Winter)

2. **User-Präferenzen:**
   - Member-Profil: Bevorzugte Trainingszeiten angeben
   - Häufigkeit: 1x, 2x, 3x pro Woche
   - Level: Anfänger, Fortgeschritten, Elite
   - Altersgruppe: Junior, Senior

3. **KI-gestützte Optimierung:**
   - Auto-Assign: Trainer zu Mitgliedern
   - Konflikte erkennen (Überbuchung)
   - Optimierung: Auslastung maximieren
   - Fairness: Gleichverteilung

4. **Plan-Management:**
   - Vorschau vor Finalisierung
   - Manuelle Anpassungen möglich
   - Bulk-Operations (ganze Gruppen verschieben)
   - Notifications an alle Beteiligten

**Neue Module:**

```
app/(protected)/admin/season-planning/
├── page.tsx (Übersicht: Aktuelle/Vergangene Saisons)
├── [seasonId]/
│   ├── edit/page.tsx (Plan bearbeiten)
│   ├── preview/page.tsx (Vorschau)
│   └── finalize/page.tsx (Abschließen & versenden)
└── create/page.tsx (Neue Saison anlegen)

components/season-planning/
├── season-calendar.tsx (Kalenderansicht)
├── drag-drop-planner.tsx (Drag-and-drop für Zuweisung)
├── ai-optimizer.tsx (KI-Optimierung trigger)
├── conflict-resolver.tsx (Konflikt-Ansicht)
└── user-preferences-form.tsx (Member-Präferenzen)

lib/season-planning/
├── optimizer.ts (Algorithmus)
├── conflict-detection.ts
└── notification-sender.ts
```

**API Endpoints (neu):**

```
POST   /api/season-planning          # Neue Saison anlegen
GET    /api/season-planning          # Alle Saisons
GET    /api/season-planning/[id]     # Saison-Details
PUT    /api/season-planning/[id]     # Plan bearbeiten
POST   /api/season-planning/[id]/optimize  # KI-Optimierung
POST   /api/season-planning/[id]/finalize  # Abschließen
DELETE /api/season-planning/[id]     # Löschen

GET    /api/user-preferences         # Member-Präferenzen abrufen
PUT    /api/user-preferences         # Präferenzen speichern
```

**Database Schema (neu):**

```sql
-- Saison-Definition
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  name VARCHAR(100) NOT NULL, -- "Sommersaison 2026"
  season_type VARCHAR(20) NOT NULL CHECK (season_type IN ('summer', 'winter')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'active', 'archived')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  CONSTRAINT unique_season_per_club UNIQUE (club_id, season_type, start_date)
);

-- User-Präferenzen
CREATE TABLE user_training_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  club_id UUID NOT NULL REFERENCES clubs(id),
  preferred_days JSONB, -- ["monday", "wednesday"]
  preferred_times JSONB, -- [{"start": "18:00", "end": "20:00"}]
  frequency_per_week INT DEFAULT 1 CHECK (frequency_per_week BETWEEN 1 AND 7),
  skill_level VARCHAR(20) CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'elite')),
  age_group VARCHAR(20) CHECK (age_group IN ('junior', 'senior')),
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_prefs_per_user_club UNIQUE (user_id, club_id)
);

-- Saisonplan-Einträge (wöchentlich wiederholend)
CREATE TABLE season_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id), -- Link zu existierendem Schedule
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Montag
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  trainer_id UUID REFERENCES users(id),
  court_id UUID REFERENCES courts(id),
  max_participants INT DEFAULT 10,
  assigned_members JSONB, -- Array of user_ids
  group_id UUID REFERENCES groups(id),
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Konflikte/Issues
CREATE TABLE season_planning_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  conflict_type VARCHAR(50) NOT NULL, -- 'trainer_overlap', 'court_overlap', 'capacity_exceeded'
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  description TEXT NOT NULL,
  affected_entries JSONB, -- Array of plan_entry_ids
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Timeline:**

- Woche 3: Database Schema + Basic CRUD APIs
- Woche 4: UI (Kalenderansicht, Drag-Drop)
- Woche 5: KI-Optimierung + Konfliktlösung
- Woche 6: Testing + Refinement

---

### 2.2 Platz-Buchungssystem mit Bezahlung ⚠️

**Aktueller Stand:**

- Court-Booking existiert rudimentär
- Bezahlung für Gäste fehlt

**Anforderungen:**

1. **Mitglieder (kostenlos):**
   - Plätze bis zu 7 Tage im Voraus buchen
   - Max. 2h Buchungsdauer
   - Limit: 3 Buchungen/Woche

2. **Gäste (kostenpflichtig):**
   - Nur 3 Tage im Voraus
   - Sofortbezahlung via Stripe
   - Preise: Admin konfigurierbar (€/Stunde, Platztyp)
   - Rechnung automatisch generieren

**Neue Features:**

- [ ] Guest-Checkout-Flow mit Stripe
- [ ] Preiskonfiguration pro Platztyp
- [ ] Dynamische Preise (Peak/Off-Peak)
- [ ] Availability-Calendar für Gäste
- [ ] Rabatt-Codes für Gäste
- [ ] Guest-Buchungsübersicht (ohne Login)

**Betroffene Module:**

```
app/(public)/court-booking/
└── [courtId]/checkout/page.tsx (neu)

app/api/courts/booking/
├── guest-checkout/route.ts (neu)
└── pricing/route.ts (neu)

components/courts/
├── guest-booking-calendar.tsx (neu)
├── pricing-configurator.tsx (neu - Admin)
└── checkout-form.tsx (neu)
```

---

### 2.3 Zusatzbuchungen (Trainer) 📌

**Anforderung:** Trainer können bei freien Kapazitäten zusätzliche Sessions buchen

**Features:**

- [ ] Trainer-Ansicht: Freie Slots anzeigen
- [ ] Quick-Booking für Trainer (1-Click)
- [ ] Notifications an verfügbare Members
- [ ] Warteliste-System
- [ ] Last-Minute-Buchungen (24h vorher)

**Betroffene Dateien:**

```
app/(protected)/trainer/quick-booking/page.tsx (neu)
components/trainer/available-slots.tsx (neu)
lib/booking/trainer-booking.ts (neu)
```

---

## 🔧 Phase 3: Code-Qualität & Stabilität (Woche 7-8)

### 3.1 Architektur aufräumen

**Probleme:**

- Inkonsistente Ordnerstruktur
- Business-Logic in UI-Komponenten
- Duplizierter Code
- Fehlende Abstraktionen

**Maßnahmen:**

- [ ] **Domain-Driven Design** einführen:

```
lib/
├── domain/
│   ├── bookings/
│   │   ├── booking.service.ts
│   │   ├── booking.repository.ts
│   │   └── booking.validator.ts
│   ├── users/
│   ├── courts/
│   └── season-planning/
├── infrastructure/
│   ├── external/supabase/
│   ├── payment/stripe/
│   └── email/
└── shared/
    ├── utils/
    ├── types/
    └── constants/
```

- [ ] Business Logic aus Komponenten extrahieren
- [ ] Shared Utilities in `lib/shared/utils`
- [ ] Type Definitions zentralisieren
- [ ] API-Client-Layer einführen (kein fetch in Komponenten)

### 3.2 Error Handling verbessern

**Aktuell:** Inkonsistentes Error-Handling, viele unhandled exceptions

**Maßnahmen:**

- [ ] Globale Error-Boundary ergänzen
- [ ] Custom Error-Classes:

```typescript
class BookingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}
```

- [ ] Error-Logging-Service (Sentry?)
- [ ] User-friendly Error-Messages
- [ ] Retry-Logic für transiente Fehler

### 3.3 Testing-Strategie

**Aktuell:** Minimal Tests vorhanden

**Ziel:**

- Unit Tests: 60% Coverage (kritische Business-Logic)
- Integration Tests: API-Endpoints
- E2E Tests: Happy Paths + Critical Flows

**Priorität:**

1. Saisonplanung (neu) → 80% Coverage
2. Booking-System → 70% Coverage
3. Payment-Flow → 90% Coverage
4. Auth & Permissions → 80% Coverage

**Setup:**

- [ ] Jest Config optimieren
- [ ] Vitest für Unit-Tests erwägen (schneller)
- [ ] Playwright E2E-Tests erweitern
- [ ] Test-Daten-Factories erstellen
- [ ] CI/CD: Tests vor Deploy

### 3.4 Performance-Optimierung

**Probleme:**

- Langsame API-Responses
- N+1 Queries
- Unnötige Re-Renders

**Maßnahmen:**

- [ ] Database-Queries optimieren (EXPLAIN ANALYZE)
- [ ] Indexes prüfen und ergänzen
- [ ] React Query Cache-Strategie verbessern
- [ ] Server Components wo möglich nutzen
- [ ] Image-Optimization (Next/Image)
- [ ] Bundle-Size analysieren (next-bundle-analyzer)

---

## 📊 Phase 4: UX/UI Polish (Woche 9-10)

### 4.1 Design-System vervollständigen

**Aktuell:** Inkonsistente UI-Komponenten

**Maßnahmen:**

- [ ] shadcn/ui Komponenten-Audit
- [ ] Fehlende Komponenten ergänzen
- [ ] Design-Tokens dokumentieren
- [ ] Storybook für Komponenten-Library
- [ ] Dark-Mode komplett supporten

### 4.2 Mobile Experience

**Probleme:**

- Viele Ansichten nicht mobile-optimiert
- Bottom-Navigation inkonsistent

**Maßnahmen:**

- [ ] Mobile-First Audit aller Pages
- [ ] Touch-Gesten optimieren (Swipe, Drag)
- [ ] Bottom-Navigation vereinheitlichen
- [ ] PWA-Features (Offline, Push-Notifications)

### 4.3 Accessibility

**Ziel:** WCAG 2.1 Level AA

**Maßnahmen:**

- [ ] Keyboard-Navigation testen
- [ ] Screen-Reader-Kompatibilität
- [ ] Color-Contrast prüfen
- [ ] ARIA-Labels ergänzen
- [ ] Focus-Management verbessern

---

## 🔐 Phase 5: Security & Compliance (Woche 11)

### 5.1 Security-Audit

**Maßnahmen:**

- [ ] OWASP Top 10 Check
- [ ] SQL-Injection Prevention (Drizzle bereits sicher, aber prüfen)
- [ ] XSS Prevention (CSP-Header bereits gesetzt)
- [ ] CSRF-Tokens in allen Forms
- [ ] Rate-Limiting überprüfen
- [ ] Secrets-Management (Env-Vars niemals committen)
- [ ] Dependency-Audit (`npm audit fix`)

### 5.2 DSGVO/GDPR

**Maßnahmen:**

- [ ] Datenschutzerklärung
- [ ] Cookie-Banner
- [ ] Datenexport-Funktion (Member-Profil)
- [ ] Löschantrag-Workflow
- [ ] Audit-Logs für Datenzugriffe
- [ ] Encryption at rest (Supabase bereits encrypted)

---

## 📈 Phase 6: Analytics & Monitoring (Woche 12)

### 6.1 Observability

**Ziel:** Produktions-Probleme schnell erkennen

**Maßnahmen:**

- [ ] Application Monitoring (Vercel Analytics bereits vorhanden)
- [ ] Error-Tracking: Sentry einrichten
- [ ] Logging: Structured Logging (Winston/Pino)
- [ ] Uptime-Monitoring (Better Uptime, Pingdom)
- [ ] Performance-Monitoring (Core Web Vitals)

### 6.2 Business-Analytics

**Maßnahmen:**

- [ ] Admin-Dashboard: Realtime KPIs
- [ ] Conversion-Tracking (Guest → Member)
- [ ] Revenue-Tracking verbessern
- [ ] Retention-Metriken
- [ ] Cohort-Analysis

---

## 🎯 Success Metrics

### Technical KPIs

- ✅ Build Success Rate: 100%
- ✅ Test Coverage: >60%
- 🎯 API Response Time: <500ms (P95)
- 🎯 Lighthouse Score: >90
- 🎯 Zero Critical Bugs in Production

### Business KPIs

- 🎯 Admin-Dashboard: <2s Load-Time
- 🎯 Booking-Conversion: >80%
- 🎯 Guest-to-Member: >30%
- 🎯 User-Retention (30d): >70%
- 🎯 Trainer-Satisfaction: >4.5/5

---

## 🚨 Quick Wins (Diese Woche!)

1. **Admin Dashboard fixen** (4-8h)
   - SSR-Errors beheben
   - Loading-States ergänzen
2. **Stunden-Logging erweitern** (4h)
   - Admin-Zugriff freischalten
   - UI für Admin-Übersicht

3. **API Error-Handling** (4h)
   - Standard-Response-Format
   - Bessere Error-Messages

4. **Critical Bug List** (2h)
   - Alle bekannten Bugs dokumentieren
   - Priorisieren nach Impact

---

## 📝 Nächste Schritte

### Jetzt sofort:

1. ✅ Roadmap erstellt (dieses Dokument)
2. ⏳ Admin Dashboard debuggen
3. ⏳ Critical Bugs Liste erstellen
4. ⏳ Team-Meeting: Roadmap Review

### Diese Woche:

- [ ] Quick Wins abarbeiten
- [ ] Saisonplanung: Requirements finalisieren
- [ ] Database-Schema für Saisonplanung designen
- [ ] Wireframes für Saisonplanung-UI

### Nächste Woche:

- [ ] Phase 2.1 starten (Saisonplanung)
- [ ] Entwickler-Onboarding (falls Team-Erweiterung)
- [ ] Stakeholder-Demo: Roadmap präsentieren

---

## 👥 Team & Resources

**Benötigte Rollen:**

- 1x Full-Stack Developer (Saisonplanung)
- 1x Frontend Developer (UI/UX Polish)
- 1x QA Engineer (Testing)
- 0.5x DevOps (Monitoring, CI/CD)

**Externe Tools (optional):**

- Sentry (Error-Tracking): $26/mo
- Better Uptime (Monitoring): $10/mo
- Storybook Cloud (optional): Free
- Figma (Design): Free/Team

---

## 📚 Dokumentation

**Zu erstellen:**

- [ ] `docs/ARCHITECTURE.md` - System-Architektur
- [ ] `docs/API.md` - API-Dokumentation
- [ ] `docs/DEPLOYMENT.md` - Deployment-Guide
- [ ] `docs/TESTING.md` - Testing-Strategy
- [ ] `docs/SEASON_PLANNING.md` - Saisonplanung-Feature-Spec
- [ ] `docs/CONTRIBUTING.md` - Contribution Guidelines

---

**Letzte Aktualisierung:** 6. Mai 2026  
**Verantwortlich:** Development Team  
**Review:** Wöchentlich jeden Montag
