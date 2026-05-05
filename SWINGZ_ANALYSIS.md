# SWINGZ Tennis Club Management – Umfassende Analyse

**Datum:** 2026-05-05  
**Autor:** Kilo (AI Agent)  
**Version:** 1.0

---

## Exec Summary

**SWINGZ** positioniert sich als moderne, DDD-basierte Management-Lösung für Tennisclubs mit Fokus auf Multi-Tenant-Architektur, sauberem Code und KI-gestützter Optimierung. Die App bietet eine vollständige Verwaltung von Mitgliedern, Buchungen, Sessions und Abrechnung auf Basis von Next.js 15, Supabase und Drizzle ORM.

**Stärken:** Atemberaubend saubere Architektur (Clean Architecture + DDD), exzellente Type-Safety, moderne UI (shadcn/ui), durchdachte Sicherheitsheaders, integrierte Zahlungsabwicklung (Stripe + SEPA), Audit-Logging, und eine solide Test-Pipeline.

**Kritische Schwachstellen:**

1. **In-Memory Member Service** – existierende Member-Daten sind nicht persistent (kritische Datenintegritätslücke)
2. **CSRF-Schutz lückenhaft** – nur 2 von 70+ State-changing-Endpoints geschützt
3. **Autorisierungs-Bypass** – Trainer können Member anderer Clubs auslesen (IDOR)
4. **Strikte CSRF & Rate-Limiting Coverage** – viele Admin-Endpoints ungeschützt
5. **CSP Schwachstelle** – `'unsafe-eval'` und `'unsafe-inline'` erlaubt
6. **PII in Logs** – umfangreiche Error-Logging ohne Maskierung
7. **Fehlende Court/Trainer CRUD UI** – Admin kann Courts nicht verwalten

**Gesamtbewertung Architektur:** A-  
**Gesamtbewertung Sicherheit:** D+  
**Marktreife für kritische Produktion:** ❌ Nicht geeignet ohne kritische Fixes (innerhalb 2 Wochen)

---

## 1. Marktpositionierung & Differenzierung

**Positionierung:** B2B-SaaS für Tennisclubs (Freizeit-/Vereinsmanagement), primär DACH-Region.

**Zielmarktgröße:** Deutschland ~9.000 Tennisvereine, EU ~50.000 Clubs, plus Fitnesstudios mit Tennisangeboten.

### Wettbewerbslandschaft

| Anbieter             | USPs                                            | Unterschied zu SWINGZ                                  |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| **TennisPoint**      | Mobile-first, Payment-Integration, Club-Website | Weniger Architektur-Purismus, aber stärker im Branding |
| **Club-Software.de** | All-in-One mit EHR, Mitgliederverwaltung        | Legacy-Stack (PHP), keine Clean Architecture           |
| **Square Punkt**     | Buchungssystem mit Payment                      | Eingeschränkt auf Buchungslogik, kein Scheduling‑AI    |
| **Fitnesscloud**     | Studio-Management, Billing                      | Branchenübergreifend, aber weniger spezialisiert       |
| **SportEngine**      | Großclubs, komplexe Liga‑Planung                | Überdimensioniert für kleine Clubs                     |

### SWINGZ-Differenzierung

- ✅ KI-gestützte Schedule-Optimierung via OpenAI (Stand: `src/application/use-cases/optimize-schedule.use-case.ts`)
- ✅ Multi-Club-Management für Super-Admins
- ✅ Stripe + SEPA für automatische Mitglieder-Rechnungen
- ✅ Clean Architecture & DDD (Markenwert für Entwickler-Teams)
- ✅ Drag‑&‑Drop Scheduler (Admin‑Kalender) – noch nicht produktiv (Prio‑1)

**Marktlücke:** Vereinzelte Vereine mit >100 Mitgliedern benötigen komplexe Planung (Trainer, Gruppen, Platzbelegung) und zuverlässige Abrechnung. SWINGZ spricht diese mit Enterprise‑Pattern an.

**Empfehlung:** Positionierung als "Enterprise‑Grade Club Management für ambitionierte Tennisvereine". Vertrieb über Tennis‑Verbände und Partner‑Ökosystem (Equipment‑Lieferanten, Versicherungen).

---

## 2. Kernfunktionen & Mehrwert

### Value‑Stream Mapping

```
Mitglieder-Acquisition
  ↓ (Trial Training → Conversion zu Vollmitglied)
Buchungs-Workflow
  ↓ (Session-Buchung → Check‑in → Abrechnung)
Trainer‑Planung
  ↓ (Weekly Schedule → Self‑Service Verfügbarkeit)
Abrechnung & Reporting
  ↓ (Invoice → Stripe Payment → Handelsregister‑Export)
```

### Feature‑Matrix pro User‑Type

| Funktion                         | Member      | Trainer                  | Admin                | Superadmin      |
| -------------------------------- | ----------- | ------------------------ | -------------------- | --------------- |
| Profil ansehen/bearbeiten        | ✅          | ✅                       | ✅                   | ✅              |
| Buchungen (Erstellen/Stornieren) | ✅          | ✅ (eigene)              | ✅ (alle)            | ✅              |
| Scheduler (Drag‑&‑Drop)          | ❌          | ✅ (Blocked – API fehlt) | ✅ (Beta)            | ✅              |
| Mitglieder‑Verwaltung            | ❌          | ❌                       | ✅                   | ✅              |
| Trainer‑Verwaltung               | ❌          | ❌                       | ❌ (CRUD UI leer)    | ✅              |
| Court‑Verwaltung                 | ❌          | ❌                       | ❌ (nur Kalender)    | ✅              |
| Abrechnung (Invoices)            | ✅ (eigene) | ✅ (Stunden‑Lohn)        | ✅ (Club‑Abrechnung) | ✅              |
| Analytics Dashboards             | ❌          | ❌                       | ✅ (single‑Club)     | ✅ (multi‑Club) |
| Audit Log Viewer                 | ❌          | ❌                       | ✅                   | ✅              |
| email notifications              | ✅          | ✅                       | ✅                   | ✅              |

### Feature‑Lücken aus NAVIGATION_AUDIT

1. Court‑Verwaltung (CRUD) + Court‑Types (Dropdown‑Werte)
2. Trainer‑Verwaltung (Profile, Verfügbarkeit, Qualification‑Upload)
3. Seasons/Schedules‑Master‑Data (Start/Ende der Saison)
4. Pricing‑Rules pro Court/Club (aktuell hard‑coded €15/Session)
5. Groups Management (zentrale Gruppen‑IDs statt String‑Array)
6. News / Announcements CMS
7. Attendance Check‑In/Out (statt nur History)
8. Onboarding‑Wizard (aktuell nur Infoseite)
9. Club‑übergreifende Analytics für Super‑Admin
10. Trial‑Training Conversion Reporting

---

## 3. Benutzerführung & Nutzererlebnis (UX/UI)

### UI‑Framework

- Tailwind CSS + shadcn/ui + Radix‑UI
- Custom Theme mit Brand‑Farben (Grün/Orange)
- Persistente Dark‑Mode‑Unterstützung

### Positive Aspekte

- ✅ Klare visuelle Hierarchie – Admin‑Items mit Gradient‑Hervorhebung
- ✅ Konsistente Icons (Lucide) und responsives Layout
- ✅ `@dnd-kit` für Drag & Drop implementiert (Admin‑Kalender)
- ✅ Mobile‑Sidebar (Drawer) für kleine Bildschirme
- ✅ Toast‑Notifications (`sonner`) für Feedback

### Kritische UX‑Probleme

1. **Doppelte "Plätze" Navigation** – Hauptmenü (Member‑Kalender) vs. Admin‑Menü (Admin‑Kalender)
2. **Fehlende CRUD‑UI für Courts/Trainer** – Admin kann keine Courts anlegen/editieren/löschen
3. **Inkonsistente Kalender‑Ansichten** – Member: Monatskalender `/bookings`; Admin/Trainer: Wochen‑Kalender
4. **Scheduler Drag & Drop nicht produktiv** – Drag & Drop im Scheduler nur visuell, kein PATCH‑Call
5. **Onboarding ist passiv** – Listet Schritte auf, keine interaktive Checkliste
6. **Kein direkter Link zum Profil** – `/profile` existiert, aber nicht in Nav

### Accessibility

- ✅ Radix‑UI bringt a11y‑Features
- ❌ Farbkontraste prüfen (z.B. `#FF6B35` auf Weiß = 3.2:1)
- ❌ Skip‑Link, Reduced‑Motion, Cookie‑Consent fehlen

---

## 4. Technische Qualität & Stabilität

### Code‑Qualität

- ✅ TypeScript strict mode (`strict: true`, `noImplicitAny`)
- ✅ ESLint + Prettier + Husky + lint‑staged – CI enforced
- ✅ Modularisierung in Domain‑, Application‑, Infrastructure‑, Presentation‑Layer
- ✅ Fehler‑Boundary: `components/sentry-error-boundary.tsx`

### Testing‑Strategie

```
CI Pipeline:
  lint → typecheck → unit‑tests (Vitest) → build → e2e‑tests (Playwright) → security‑audit
```

- Unit‑Tests: 20 Test‑Dateien gefunden (ca. 20–30% Coverage geschätzt)
- E2E‑Tests: Playwright Tests oberflächlich

### Build‑Performance

- ✅ Turbopack enabled (`next build --turbo`)
- ✅ Code‑Splitting (Vendors, UI‑Libs, React‑Core, Analytics)
- ✅ Image‑Optimierung (AVIF/WebP, 1 Jahr Cache‑TTL)

### Code‑Smells

- ⚠️ `MemberService` komplett in‑Memory – existierende Implementierung widerspricht Architekturprinzip
- ⚠️ Rote/graue Code‑Bereiche (`src/infrastructure/cqrs`) – nicht implementiert/verwaist
- ⚠️ `src/presentation/` im tsconfig‑Pfad, aber Verzeichnis existiert nicht

---

## 5. Sicherheits‑ und Datenschutzmaßnahmen

### Sicherheits‑Posture (Übersicht)

| Kategorie            | Status | Details                                                |
| -------------------- | ------ | ------------------------------------------------------ |
| Authentifizierung    | ✅     | Supabase SSR (Cookies)                                 |
| Autorisierung (RBAC) | ⚠️     | Rollen‑Hierarchie korrekt, aber IDOR in `members/[id]` |
| CSRF                 | ❌     | Nur 2/70+ Endpoints geschützt                          |
| Rate‑Limiting        | ⚠️     | Selektiv, fehlt auf Admin‑APIs                         |
| CSP                  | ⚠️     | `unsafe-eval` + `inline` entfernen                     |
| Sicherheits‑Headers  | ✅     | HSTS, X‑Frame‑Options, Referrer‑Policy                 |
| Input‑Validation     | ✅     | Zod‑Schemas                                            |
| Audit‑Logging        | ⚠️     | IP/User‑Agent aus Client‑Header (spoofbar)             |
| Verschlüsselung      | ✅     | Supabase default (TLS, AES)                            |
| Geheimnis‑Management | ✅     | `.env.local` in `.gitignore`                           |

### Kritische Schwachstellen

#### 5.1 In-Memory Member Storage (Critical)

**Datei:** `src/application/services/member.service.ts`  
**Problem:** Statisches Array, keine DB‑Persistence, umgeht RLS komplett.

```typescript
static async createMember(input: CreateMemberInput): Promise<Member> {
  const member: Member = { id: this.generateId(), ... };
  this.members.push(member); // Nur in Memory
  return member;
}
```

**Impact:** Datenverlust, keine Transaktionen, kein Backup.

#### 5.2 CSRF Protection Gaps (High)

CSRF-Schutz nur auf:

- `POST /api/members` (mitglieder) |
- `POST /api/sepa-mandates`

**Fehlt auf:**

- `POST /api/bookings`
- `PATCH /api/clubs/[id]`
- `DELETE /api/clubs/[id]`
- `POST /api/billing/invoices/create`
- `POST /api/members/invite`

#### 5.3 IDOR in members/[id] (High)

**Datei:** `app/api/members/[id]/route.ts`  
**Problem:** Trainer können jedes Membership auslesen, ohne Club‑Scope zu prüfen.

#### 5.4 CSP Schwachstelle (Medium)

**Datei:** `next.config.js` (Zeilen 53‑65)

```javascript
"script-src 'self' 'unsafe-eval' 'unsafe-inline' ...";
```

**Impact:** Erweitert XSS‑Attack‑Surface erheblich.

#### 5.5 PII in Error Logs (High)

`console.error` mit vollen Error‑Objekten in API‑Routes (157+ Vorkommen) – leakt E‑Mails, IDs, Stack‑Traces.

#### 5.6 Rate Limiting Inconsistent (High)

`/api/admin/tenants` hat keinen Rate‑Limit.

---

## 6. Leistung & Skalierbarkeit

### Performance‑Optimizations

| Maßnahme                                | Implementiert | Impact                   |
| --------------------------------------- | ------------- | ------------------------ |
| Code‑Splitting                          | ✅            | FCP ↓                    |
| Image‑Optimierung                       | ✅            | LCP ↓                    |
| Database‑Indexe (10+)                   | ✅            | DB‑Query‑Latency ↓       |
| Batch‑Loading in `/api/bookings`        | ✅            | N+1 vermieden            |
| Query‑Caching (`@tanstack/react-query`) | ✅            | Client‑Seitig            |
| Redis (Upstash) geplant                 | ⏳            | Rate‑Limit/Session‑Store |
| CDN (Vercel Edge)                       | ✅            | Global Latenz ↓          |

### Skalierbarkeit

- **Database:** Supabase PostgreSQL – Read‑Replicas möglich
- **Backend:** Supabase Edge Functions skalierbar
- **Frontend:** Vercel Edge CDN
- **Multi‑Tenant:** Tenant‑Isolation über RLS (muss geprüft werden)

### Monitoring

- ✅ Sentry (Performance Traces, 100 % Transaktionen)
- ✅ Custom Logs via `lib/logger.ts`
- ❌ Health‑Check‑Endpoint für Load‑Balancer
- ❌ APM (New Relic, Datadog)

---

## 7. Monetarisierungsansatz & Businessmodell

**Aktueller Status:** Kein integriertes Subscription‑Modell.

**Mögliche Modelle:**

1. **Club‑Subscription:**
   - Freemium: bis 100 Mitglieder kostenlos
   - Pro Club: ab €99/Monat (inkl. 5 Trainer)
   - Enterprise: ab €299/Monat (Multi‑Club, API‑Access)

2. **Transaktionsgebühren:**
   - Stripe‑Gebühren (2,9 % + 0,30 €) weiterberechnen

3. **Value‑Added Services:**
   - KI‑Credits, Newsletter‑Integration, Equipment‑Shop

**Preis‑Logik:** `members-billing/member-billing.tsx:89` hard‑coded `price = 15` – **muss konfigurierbar pro Club werden**.

**Empfehlung:** Stripe Products & Prices in DB anlegen, Billing‑UI für Plan‑Selection.

---

## 8. Regulatorische Konformität

**Relevante Regulierungen:** DSGVO, BDSG, GoBD.

| Anforderung                          | Umsetzung | Offene Punkte                               |
| ------------------------------------ | --------- | ------------------------------------------- |
| Datenschutz‑Folgenabschätzung (DSFA) | ❌        | Für KI‑Profile erforderlich                 |
| Einwilligung‑Management              | ⚠️        | Newsletter‑Einwilligungen fehlen            |
| Daten‑Export (Art. 15)               | ✅        | CSV‑Export vorhanden                        |
| Löschrecht (Art. 17)                 | ⚠️        | Soft‑Delete → Anonymisierung automatisieren |
| Cookie‑Consent                       | ❌        | Kein Banner                                 |
| Aufbewahrungsfristen                 | ✅        | Rechnungen als PDF exportierbar             |

**Empfehlung:** DSFA, AVV‑Verträge mit Sub‑Processors, Cookie‑Banner, automatische Anonymisierung.

---

## 9. Barrierefreiheit & Inklusion

**WCAG 2.2 Level AA Ziel**

**Implementiert:**

- ✅ Radix‑UI Komponenten (a11y‑auditiert)
- ✅ Fokus‑Management in Modals

**Fehlend:**

- ❌ Skip‑Link
- ❌ Hoch‑Kontrast‑Modus
- ❌ Reduced‑Motion‑Media‑Query
- ❌ Form‑Labels prüfen
- ❌ Error‑Messages als `role="alert"`

**Test‑Empfehlung:** Lighthouse‑CI in CI‑Pipeline, manuelle Tastatur‑Navigation, Screen‑Reader‑Test.

---

## 10. Kundenservice & Onboarding

**Aktuelle Kanäle:**

- ❌ Live‑Chat, Ticket‑System fehlen
- ✅ E‑Mail (`support@swingz.app`) – kein Frontend‑Formular
- ❌ Knowledge Base, Video‑Tutorials

**Onboarding‑Flow (Admin):**Club anlegen → Courts konfigurieren (UI fehlt!) → Trainer einladen (UI fehlt) → Schedules erstellen → Mitglieder einladen.

**Empfehlung:** Onboarding‑Wizard, In‑App‑Tours (`react-joyride`), Help‑Center, Support‑Ticket‑Formular.

---

## 11. Datenintegrität & Reporting

### Daten‑Qualität

| Tabelle                                    | Integritäts‑Checks               | Fehlende Constraints |
| ------------------------------------------ | -------------------------------- | -------------------- |
| `bookings`                                 | `UNIQUE (session_id, member_id)` | ✅                   |
| `sessions.timeslot_end` > `timeslot_start` | ❌                               | nur Domain‑Service   |
| `user_club_memberships` UNIQUE             | ✅                               |                      |

### Export‑Funktionen

- ✅ CSV‑Export für Members & Bookings
- ❌ PDF‑Rechnungen (dependency vorhanden, Implementation unklar)
- ❌ Finanz‑Reports (Umsätze pro Trainer/Club)

**Empfehlung:** Materialized Views für Aggregationen, Event‑Sourcing für Audit.

---

## 12. Feedback‑Schleifen & Update‑Roadmap

**Fehlend:**

- ❌ In‑App Feedback‑Button, NPS/CSAT‑Umfragen
- ❌ Feature‑Requests Portal
- ❌ CHANGELOG.md
- ❌ Release‑Strategy (Canary/Blue‑Green)

**Geplant (aus Code lesbar):**

- Mailchimp‑Webhook (`.env.example`)
- White‑Label‑Settings (`components/admin/branding-settings.tsx`)
- Community‑Forum (`components/community/`)

---

## 13. Wettbewerbsbenchmarking

| Feature               | SWINGZ | TennisPoint | Club‑Software | Fitnesscloud  |
| --------------------- | ------ | ----------- | ------------- | ------------- |
| Multi‑Club‑Support    | ✅     | ❌          | ⚠️ (teuer)    | ⚠️ Enterprise |
| KI‑Optimierung        | ✅     | ❌          | ❌            | ❌            |
| SEPA‑Lastschrift      | ✅     | ✅          | ✅            | ✅            |
| Drag & Drop‑Scheduler | ⚠️     | ✅          | ✅            | ✅            |
| Mobile‑App            | ❌     | ✅          | ✅            | ✅            |
| Custom‑Reporting      | ⚠️     | ✅          | ✅            | ✅            |
| Audit‑Logging         | ✅     | ❌          | ⚠️            | ⚠️            |
| Open‑Source           | ✅     | ❌          | ❌            | ❌            |

**SWINGZ‑Stärken:** Clean Architecture, Open‑Source‑Ansatz, DACH‑Lokalisierung.

---

## 14. Konkrete Handlungsempfehlungen (Priorisiert)

### Priorität 0 (Kritisch – sofort)

1. **Member‑Persistenz reparieren** – `MemberService` auf `DrizzleMemberRepository` umstellen
2. **CSRF‑Coverage** – `withCSRFProtection` auf alle state‑changing Endpunkte anwenden
3. **IDOR in `members/[id]` beheben** – Club‑Scope für Trainer prüfen
4. **CSP‑Lockdown** – `'unsafe-eval'` und `'unsafe-inline'` entfernen
5. **PII‑Maskierung** – Error‑Logs vor `console.error` maskieren

### Priorität 1 (Hoch – innerhalb 2 Wochen)

6. **Court/Trainer‑CRUD UI** – `/admin/courts/manage` und `/admin/trainers` implementieren
7. **PATCH `/api/sessions/:id`** – Drag & Drop aus `admin-court-calendar.tsx:handleDragEnd` vollenden
8. **Rate‑Limiting harmonisieren** – alle Admin‑APIs mit `rateLimitStrict`
9. **Health‑Check + DB‑Liveness** – `/api/health` mit `SELECT 1`
10. **Audit‑Context sichern** – IP aus vertrautem Proxy nur

### Priorität 2 (Mittel – innerhalb 1 Monats)

11. Onboarding‑Wizard
12. Preis‑Config (`clubs.default_hourly_rate`)
13. Groups‑Management
14. News‑CMS
15. Attendance‑Check‑In
16. Club‑übergreifende Analytics für Super‑Admin
17. GDPR‑Compliance (AVV, Cookie‑Banner, Lösch‑Workflow)
18. a11y‑Audit (Lighthouse CI)
19. Dependabot & npm audit in CI
20. CHANGELOG.md

### Roadmap‑Meilensteine

| Milestone                              | Umfang                           | Dauer    |
| -------------------------------------- | -------------------------------- | -------- |
| M1 – Security‑Hardening                | Priorität 0+1                    | 2 Wochen |
| M2 – Feature‑Completion Courts/Trainer | Priorität 1                      | 3 Wochen |
| M3 – Monetarisierung v1                | Subscription‑UI, Stripe Products | 4 Wochen |
| M4 – Compliance v1                     | DSFA, AVV, GDPR‑Features         | 3 Wochen |
| M5 – Mobile‑Experience                 | PWA‑Offline, Push‑Notifications  | 4 Wochen |
| M6 – Analytics Advanced                | Club‑Vergleich, Forecast         | 3 Wochen |

---

## Schlussfolgerung

SWINGZ ist technisch brillant aufgestellt (Clean Architecture, DDD, Type‑Safety), weist aber **existenzielle Sicherheitslücken** und **feature‑seitig unvollständige Admin‑Controls** auf. Priorität muss auf Sicherheit (Member‑Persistenz, CSRF, IDOR), Feature‑Completion (Court/Trainer CRUD, Scheduler API), und Monetarisierung (konfigurierbare Preise, Stripe‑Subscriptions) gelegt werden, bevor das Produkt an echte Clubs ausgerollt wird. Die Architektur ermöglicht schnelle Iteration, sobald die kritischen Fixes implementiert sind.

---

**Anhang:** Top‑Datei‑Referenzen

```
src/domain/entities/booking.ts:1
src/domain/repositories/booking-repository.interface.ts:1
src/infrastructure/persistence/repositories/booking.repository.ts:88
app/api/bookings/route.ts:49
lib/api-auth.ts:82
lib/csrf.ts:40
lib/rate-limit.ts:36
components/admin/admin-court-calendar.tsx:225
NAVIGATION_AUDIT.md:1
next.config.js:23
tailwind.config.ts:1
```
