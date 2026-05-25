# API-Routen-Übersicht — 4 Kernfunktionen

> **Stand:** Mai 2026 · **Authentifizierung:** `withApiAuth` (Supabase Session) · **Autorisierung:** `verifyRole(auth, '<minRole>')`
> **Rollen-Priorität:** `superadmin > admin > trainer > member` — höhere Rollen schließen niedrigere ein.

---

## 🔴 1. Mitgliederverwaltung

### 1.1 Members CRUD

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/members` | `GET` | `member` | ❌ | STANDARD (30/min) | Mitgliederliste mit Filtern (status, type, trainingGroup, search, active, statistics). Superadmin kann via `clubId` filtern. |
| `/api/members` | `POST` | `trainer`¹ | ✅ | STANDARD | Neues Mitglied anlegen mit Zod-Validierung (`CreateMemberSchema`). |
| `/api/members/[id]` | `GET` | `member`² | ❌ | STANDARD | Einzelnes Mitglied abrufen. Trainer/Admin sehen alle, Member nur sich selbst. |
| `/api/members/[id]` | `PATCH` | `trainer` | ❌ | STANDARD | Mitglied aktualisieren (Profil + Membership-Felder wie `is_active`, `role`, `include_in_planning`). |
| `/api/members/[id]` | `DELETE` | `admin` | ❌ | STRICT (10/min) | Mitglied deaktivieren (Soft-Delete: `is_active = false` + Audit-Log). Kein Hard-Delete. |
| `/api/members/invite` | `POST` | `admin` | ❌ | — | Mitglied per E-Mail einladen (Supabase `inviteUserByEmail`). Prüft auf existierende User/Memberships. |

> ¹ `POST /api/members`: Admin **oder** Trainer.  
> ² `GET /api/members/[id]`: Member nur eigenes Profil; Trainer/Admin sehen alle.

### 1.2 Approvals (Registrierungs-Genehmigungen)

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/admin/approvals` | `GET` | `admin` | ❌ | — | Alle Registrierungsanfragen abrufen (`registration_requests`). |
| `/api/admin/approvals` | `PATCH` | `admin` | ❌ | — | Anfrage genehmigen/ablehnen. Bei Genehmigung: Auth-User erstellen, `users`-Eintrag, `user_club_memberships`-Eintrag, Onboarding-Mail. |

**Approval-Flow (PATCH):**
```
1. Auth-User via Admin API erstellen (email_confirm: true)
2. Insert in public.users
3. Insert in user_club_memberships (role: 'member')
4. Onboarding-Email senden (fire-and-forget)
   → Bei Fehler in Schritt 2: Auth-User rückgängig machen
   → Bei Fehler in Schritt 3: Warning, User bleibt bestehen
```

### 1.3 Memberships

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/admin/memberships/[id]` | `PATCH` | `admin` | ❌ | — | Membership-Status ändern (`is_active`, `role`, `include_in_planning`). |

---

## 🟢 2. Trainingsplanung

### 2.1 Seasons

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/seasons` | `GET` | `member` / `admin`³ | ❌ | STANDARD | Saisons abrufen (Filter: `club_id`, `season_type`, `year`, `planning_status`, `is_active`). |
| `/api/seasons` | `POST` | `admin` | ❌ | STANDARD | Neue Saison anlegen. Pflichtfelder: `club_id`, `name`, `season_type`, `year`, `start_date`, `end_date`. Dup-Prüfung. |
| `/api/seasons/[id]` | `GET` | `member` | ❌ | STANDARD | Einzelne Saison mit Stats (submitted/total preferences, planned entries, open conflicts). |
| `/api/seasons/[id]` | `PATCH` | `admin` | ✅ | STANDARD | Saison updaten. Erlaubte Felder: `name`, `season_type`, `year`, `start_date`, `end_date`, `preferences_deadline`, `description`, `notes`, `planning_status`, `preferences_open`, `is_active`, `auto_plan_config`. |
| `/api/seasons/[id]` | `DELETE` | `admin` | ✅ | STANDARD | Saison löschen (Hard-Delete). |

> ³ `GET /api/seasons`: Jeder authentifizierte User. Admin/Superadmin sehen alle Clubs, Member nur eigenen.

### 2.2 Season Planning Wizard

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/seasons/[id]/planning/members` | `GET` | `admin` | ❌ | STANDARD (30/min) | Planungsrelevante Mitglieder abrufen (mit Präferenzen, Niveaus, Verfügbarkeit). |
| `/api/seasons/[id]/planning/preferences-summary` | `GET` | `admin` | ❌ | STANDARD (30/min) | Präferenz-Statistiken (Verteilung, Abdeckung). |
| `/api/seasons/[id]/planning/cluster` | `POST` | `admin` | ❌ | STRICT (5/h) | **Clustering-Engine ausführen.** 9-Schritt-Pipeline: Config laden → Members/Trainer/Courts/Groups laden → Niveau-Promotions → Candidate-Groups → Greedy-Cluster → Waitlist → Metrics → Explanations → DB speichern. |
| `/api/seasons/[id]/planning/conflicts` | `GET` | `admin` | ❌ | STANDARD (30/min) | Konflikte für eine Saison abrufen (7 Konflikttypen). |
| `/api/seasons/[id]/planning/confirm` | `POST` | `admin` | ✅ | STRICT (3/h) | **Plan publizieren.** DB-Transaktion: Schedule erstellen/finden → Weekly-Sessions → Plan-Entries → Season-Status → Konflikte persistieren → Audit-Trail. Post-Transaction: Ferien-Sessions markieren + E-Mail-Benachrichtigungen. |
| `/api/seasons/[id]/planning/remind` | `POST` | `admin` | ✅ | STRICT (5/h) | Erinnerungs-Emails an Mitglieder ohne Präferenzen senden. |
| `/api/seasons/[id]/planning/waitlist` | `GET` | `admin` | ❌ | STANDARD (30/min) | Warteliste abrufen. |
| `/api/seasons/[id]/planning/waitlist` | `POST` | `admin` | ✅ | STANDARD (30/min) | Mitglieder auf Warteliste setzen/entfernen. |

### 2.3 Training Groups

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/training-groups` | `GET` | `admin` | ❌ | STANDARD | Alle Trainingsgruppen des Clubs. |
| `/api/training-groups` | `POST` | `admin` | ❌ | STANDARD | Neue Gruppe anlegen (`name`, `level`, `age_group`, `season_id`). Erstellt automatisch Schedule. |
| `/api/training-groups/[id]` | `PATCH` | `admin` | ❌ | STANDARD | Gruppe aktualisieren. |
| `/api/training-groups/[id]` | `DELETE` | `admin` | ❌ | STANDARD | Gruppe löschen (204 No Content). |

### 2.4 Trainers

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/trainers` | `GET` | `member` | ❌ | — | Alle aktiven Trainer des Clubs (mit `trainer_profiles`: Specialties, Bio). |

### 2.5 Sessions

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/sessions` | `GET` | `member` | ❌ | STANDARD | Sessions abrufen (4 Wochen, mit Trainer-Namen, Court-Namen, User-Bookings). |
| `/api/sessions` | `POST` | `admin` | ❌ | — | Session erstellen (`schedule_id`, `trainer_id`, `court_id`, `timeslot_start/end`, `max_participants`, `group_ids`, `week_number`). |
| `/api/sessions/[id]` | `PATCH` | `trainer`⁴ | ❌ | STANDARD | Session verschieben (neuer Court, Tag, Zeit). Trainer nur eigene, Admin alle im Club. |
| `/api/sessions/[id]` | `DELETE` | `trainer`⁴ | ❌ | STANDARD | Session löschen. Trainer nur eigene, Admin alle im Club. |

> ⁴ `PATCH/DELETE /api/sessions/[id]`: Admin **oder** Trainer (Trainer nur eigene Sessions).

### 2.6 Absences (Abwesenheiten)

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/absences` | `GET` | `trainer`⁵ | ❌ | — | Abwesenheiten anzeigen. Trainer sehen eigene, Admin alle. |
| `/api/absences` | `POST` | `member` | ❌ | — | Abwesenheit melden (Member meldet eigene, Admin für andere). |
| `/api/absences/[id]` | `GET` | `member` | ❌ | — | Einzelne Abwesenheit abrufen (Member nur eigene). |
| `/api/absences/[id]` | `PATCH` | `trainer` | ❌ | — | Abwesenheit bearbeiten. |
| `/api/absences/[id]` | `DELETE` | `admin` | ❌ | — | Abwesenheit löschen. |
| `/api/absences/[id]/approve` | `POST` | `admin` | ❌ | — | Abwesenheit genehmigen. |
| `/api/absences/[id]/reject` | `POST` | `admin` | ❌ | — | Abwesenheit ablehnen. |

> ⁵ `GET /api/absences`: Trainer (eigene), Admin (alle), Superadmin (alle Clubs).

### 2.7 Hours Logs (Stundennachweise)

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/hours-logs` | `GET` | `trainer`⁶ | ❌ | STANDARD | Stundennachweise abrufen (Filter: `trainerId`, `startDate`, `endDate`, `status`). Trainer nur eigene, Admin alle. |
| `/api/hours-logs` | `POST` | `trainer` | ❌ | STANDARD | Stundennachweis erstellen (Dauer automatisch berechnet, `status: pending`). |

> ⁶ `GET /api/hours-logs`: Trainer (eigene), Admin/Superadmin (alle, optional via `trainerId` filterbar).

---

## 🟡 3. Platzbuchung

### 3.1 Courts (Plätze)

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/courts` | `GET` | `member` | ❌ | STANDARD | Alle Plätze eines Clubs (via `clubId` Query-Param). Superadmin nutzt Cookie. |
| `/api/courts` | `POST` | `admin` | ❌ | STANDARD | Neuen Platz anlegen (`name`, `surface`, `hasIndoor`, `hasLighting`). |
| `/api/courts/[id]` | `GET` | `member` | ❌ | STANDARD | Einzelnen Platz abrufen. |
| `/api/courts/[id]` | `PATCH` | `admin` | ❌ | STANDARD | Platz aktualisieren. |
| `/api/courts/[id]` | `DELETE` | `admin` | ❌ | — | Platz deaktivieren (Soft-Delete: `is_active = false`). |

### 3.2 Bookings

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/bookings` | `GET` | `member` | ❌ | STANDARD | Eigene Buchungen abrufen (letzte 50, mit Session- und Court-Daten). |
| `/api/bookings` | `POST` | `member` | ❌ | STANDARD | Buchung erstellen. Prüft: Session existiert, `max_bookings_per_week`-Limit, atomare DB-Operation via `createBookingSafe`. Fire-and-Forget: `hours_log`-Eintrag. |
| `/api/bookings/series` | `POST` | `member` | ❌ | — | Serienbuchung (daily/weekly/biweekly/monthly, max 52 Occurrences). Prüft jeden Slot auf Konflikte. |
| `/api/bookings/[id]/cancel` | `POST` | `member`⁷ | ❌ | — | Buchung stornieren (Member eigene, Admin alle). |
| `/api/bookings/[id]/status` | `PATCH` | `trainer` | ❌ | — | Buchungsstatus ändern (Trainer/Admin). |

> ⁷ `POST /api/bookings/[id]/cancel`: Member (eigene) oder Admin (alle).

### 3.3 Pricing Rules

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/pricing-rules` | `GET` | `admin` | ❌ | STANDARD | Preisregeln eines Clubs abrufen. |
| `/api/pricing-rules` | `POST` | `admin` | ❌ | STANDARD | Neue Preisregel anlegen (hourly, member, trial, group, season). |
| `/api/pricing-rules/match` | `GET` | `member` | ❌ | STANDARD | Beste Preisregel für Szenario finden (memberType, bookingHours, advanceDays). Fallback: €15/h Default. |

---

## 🔵 4. Finanzen & Abrechnung

### 4.1 Invoices (Rechnungen)

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/billing/invoices` | `GET` | `member`⁸ | ❌ | — | Rechnungen abrufen (Filter: `clubId`, `type`, `status`, `memberId`). Mit `invoice_items` und `invoice_installments`. |
| `/api/billing/invoices` | `POST` | `member`¹⁰ | ❌ | — | Ad-hoc-Rechnung erstellen (Zod-validiert: `club_id`, `member_id`, `due_date`, `items[]`). Keine explizite Rollen-Prüfung — Autorisierung implizit via `club_id`/`member_id`. |
| `/api/billing/invoices/overview` | `GET` | `member` | ❌ | STANDARD | Rechnungs-Übersicht mit Summary (total_count, total_amount, paid_amount, outstanding_amount, status_counts). Paginiert. |
| `/api/billing/invoices/create` | `POST` | `trainer` | ❌ | — | (Legacy) Rechnung erstellen via `verifyRole(auth, 'trainer')`. |
| `/api/billing/invoices/[id]/checkout` | `POST` | `member` | ❌ | — | Checkout-Prozess für Einzelrechnung. |
| `/api/billing/generate-invoices` | `POST` | `admin` | ❌ | STRICT (10/min) | **Monatsrechnungen generieren.** Für alle aktiven Member eines Clubs. Dup-Prüfung, Auto-Nummerierung (`INV-YYYY-MM-NNNN`). Nutzt `fee_configurations`. |
| `/api/invoices/[id]/pdf` | `GET` | `trainer` / `admin` | ❌ | — | Rechnung als PDF generieren. |

> ⁸ `GET /api/billing/invoices`: Membership-Prüfung via `user_club_memberships` — User muss aktives Mitglied des Clubs sein.  
> ¹⁰ `POST /api/billing/invoices`: Nutzt `requireAuth` (Session-Check) ohne `verifyRole` — jeder authentifizierte User kann Rechnungen erstellen. Autorisierung implizit via `club_id`/`member_id` im Body.

### 4.2 Payments

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/payments` | `GET` | `trainer` | ❌ | STANDARD | Zahlungen abrufen (via `invoiceId`). |
| `/api/payments` | `POST` | `trainer` | ❌ | STRICT (10/min) | Zahlung erfassen (`invoiceId`, `amount`, `paymentMethod`). |

### 4.3 Trainer Billing

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/billing/trainers` | `GET` | `trainer` | ❌ | STANDARD | Trainer-Abrechnungen abrufen (Filter: `billingPeriodId`, `trainerId`, `status`, `summary`). |
| `/api/billing/trainers` | `POST` | `trainer` | ❌ | STRICT (10/min) | Trainer-Abrechnung erstellen (`billingPeriodId`, `trainerId`, `totalHours`, `hourlyRate`, `totalAmount`). |
| `/api/billing/monthly-overview` | `GET` | `admin` | ❌ | — | **Monatsübersicht:** Trainer-Stunden (aus `hours_logs`), Revenue (aus `invoices`), Paid-Summe. |

### 4.4 SEPA

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/sepa-mandates` | `GET` | `trainer` | ❌ | — | SEPA-Mandate abrufen (via `memberId` oder `mandateId`). |
| `/api/sepa-mandates` | `POST` | `member`⁹ | ✅ | STRICT (10/min) | SEPA-Mandat erstellen (Member nur eigenes, Admin für andere). |
| `/api/billing/sepa/pain008` | `POST` | `superadmin` | ❌ | STANDARD | **SEPA XML Export** (Pain.008). Validiert: alle Payments existieren, gehören zum Club, haben Mandate. Markiert Payments als `processing`. |

> ⁹ `POST /api/sepa-mandates`: Member (nur eigenes) oder Admin (alle).

### 4.5 Coupons & Pricing

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/coupons` | `GET` | *public* | ❌ | — | Coupon validieren (Code, Ablaufdatum, Usage-Limit). Keine Auth nötig. |
| `/api/coupons` | `POST` | `admin` | ❌ | — | Coupon erstellen (`code`, `discountType`, `discountValue`, `maxUses`, `expiresAt`, `minAmount`). |

### 4.6 Audit Logs

| Endpoint | Methode | Min. Rolle | CSRF | Rate Limit | Beschreibung |
|----------|---------|-----------|------|------------|-------------|
| `/api/audit-logs` | `GET` | `admin` | ❌ | — | Audit-Logs abrufen. |
| `/api/audit-logs/[id]` | `GET` | `admin` | ❌ | — | Einzelnen Audit-Log abrufen. |
| `/api/audit-logs/summary` | `GET` | `admin` | ❌ | — | Audit-Log-Zusammenfassung. |
| `/api/audit-logs/export` | `GET` | `admin` | ❌ | — | Audit-Logs exportieren. |

---

## 📐 Rollen-Matrix (Zusammenfassung)

| Endpoint-Gruppe | superadmin | admin | trainer | member | public |
|-----------------|------------|-------|---------|--------|--------|
| **Members GET** | ✅ alle Clubs | ✅ eigener Club | ✅ eigener Club | ✅ nur eigenes | ❌ |
| **Members POST/PATCH/DELETE** | ✅ | ✅ | ✅ (POST/PATCH) | ❌ | ❌ |
| **Approvals** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Seasons CRUD** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Seasons GET** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Planning Wizard** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Training Groups** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Trainers GET** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Sessions CRUD** | ✅ | ✅ | ✅ (nur eigene) | ❌ | ❌ |
| **Sessions GET** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Absences** | ✅ | ✅ | ✅ (eigene/alle) | ✅ (nur eigene) | ❌ |
| **Hours Logs** | ✅ | ✅ | ✅ (nur eigene) | ❌ | ❌ |
| **Courts GET** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Courts CRUD** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Bookings GET** | ✅ | ✅ | ✅ | ✅ (nur eigene) | ❌ |
| **Bookings POST** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Invoices GET** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Invoices POST** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Generate Invoices** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Payments** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Trainer Billing** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **SEPA Mandates GET** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **SEPA Mandates POST** | ✅ | ✅ | ❌ | ✅ (nur eigenes) | ❌ |
| **SEPA Pain.008** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Coupons GET** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Coupons POST** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🔐 Sicherheits-Architektur

```
Request → withApiAuth → verifyRole → checkRateLimitOrFail → (withCSRFProtection) → Handler
```

| Schutz-Ebene | Mechanismus | Beschreibung |
|-------------|-------------|-------------|
| **Auth** | `withApiAuth` | Validiert Supabase-Session, extrahiert `auth.user`, `auth.clubId`, `auth.role`, `auth.supabase` |
| **Autorisierung** | `verifyRole(auth, minRole)` | Prüft ob User mindestens `minRole` hat (Hierarchie: superadmin > admin > trainer > member) |
| **Rate Limiting** | `checkRateLimitOrFail` | STANDARD (30/min), STRICT (10/min), oder spezifisch (5/h für Cluster, 3/h für Confirm) |
| **CSRF** | `withCSRFProtection` | Token-basierter CSRF-Schutz für mutierende Operationen (nicht bei GET) |
| **Club-Isolation** | `auth.clubId` | Non-Superadmin-User sehen nur Daten ihres eigenen Clubs. Superadmin nutzt `ADMIN_CLUB_COOKIE`. |
| **RLS (Supabase)** | Row-Level Security | Datenbank-Ebene: User-spezifische Policies auf `user_club_memberships`, `bookings`, etc. |

### Rate Limit Stufen

| Stufe | Limit | Verwendet für |
|-------|-------|---------------|
| `STANDARD` | 30 req/min | Allgemeine Lese-Operationen, einfache POSTs |
| `STRICT` | 10 req/min | Destruktive Operationen (DELETE), Massen-Operationen (generate-invoices, payments) |
| `SEASON_CLUSTER` | 5 req/h | Clustering-Engine (teuer) |
| `SEASON_CONFIRM` | 3 req/h | Plan-Publish (DB-Transaktion + Emails) |
| `SEASON_REMIND` | 5 req/h | Erinnerungs-Emails (Rate-Limiting für Email-API) |

### CSRF-geschützte Endpoints

CSRF-Schutz (`withCSRFProtection`) wird auf alle **mutierenden** Endpoints angewendet:
- Alle `POST`/`PATCH`/`DELETE` auf `/api/members`, `/api/members/invite` (POST)
- `PATCH`/`DELETE` auf `/api/seasons/[id]`
- `POST` auf `/api/seasons/[id]/planning/confirm`, `/remind`, `/waitlist`
- `POST` auf `/api/sepa-mandates`
- Nicht auf `GET`-Endpoints (CSRF nur für State-Changing relevant)

---

## 📊 Response-Formate (Standard)

### Erfolg (200/201)
```json
// Collection
{ "success": true, "seasons": [...], "count": 5 }

// Single
{ "success": true, "member": {...} }

// Paginated
{ "members": [...], "pagination": { "total": 120, "limit": 20, "offset": 0, "hasMore": true } }
```

### Fehler
```json
// Validation
{ "error": "Validation failed", "details": { "email": ["Ungültige E-Mail-Adresse"] } }

// Forbidden
{ "error": "Forbidden" }  // oder "Admin access required"

// Rate Limit
{ "error": "Too many requests. Please try again later." }

// Not Found
{ "error": "Season not found" }

// Conflict
{ "error": "A summer season for year 2026 already exists" }

// Migration Missing
{ "error": "Season planning database tables not yet configured.", "migration_command": "psql ..." }
```

---

## 📁 Datei-Übersicht

| Datei | Beschreibung |
|-------|-------------|
| `lib/api-auth.ts` | `withApiAuth`, `verifyRole`, `forbiddenResponse`, `requireAuth` |
| `lib/rate-limit.ts` | `checkRateLimitOrFail`, `RATE_LIMITS` |
| `lib/csrf.ts` | `withCSRFProtection` |
| `lib/cookies.ts` | `ADMIN_CLUB_COOKIE` (Superadmin Club-Kontext) |
| `lib/validation-schemas.ts` | Zod-Schemas: `CreateMemberSchema`, `MemberQuerySchema`, `CreateSEPAMandateSchema`, etc. |
| `lib/billing-engine.ts` | `billingEngine` (Invoices, Payments, SEPA) |
| `lib/booking/safe-booking.ts` | `createBookingSafe` (atomare DB-Buchung via RPC) |
| `lib/services/billing.service.ts` | `createAdhocInvoice` |
| `src/application/services/member-service.adapter.ts` | `memberService` |
| `src/application/services/sepa-mandate.service.ts` | `SEPAMandateService` |
| `src/application/services/billing.service.ts` | `BillingService` (Trainer Billing) |
| `infrastructure/persistence/repositories/pricing-rule.repository.ts` | `DrizzlePricingRuleRepository` |
