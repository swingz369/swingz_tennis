# Themen-Interplay — Sequenzdiagramme der Schlüssel-Flows

> Wie Module, Rollen, DB-Tabellen und externe Services zusammenspielen. Diagramm-Repräsentation dessen, was im Code als Datenfluss passiert.

## 🎾 1. Mitglied bucht Training

```mermaid
sequenceDiagram
    autonumber
    actor M as Member (Browser)
    participant SC as App-Server (Next.js Server Component)
    participant N as Notification-Service
    participant Email as Resend-SMTP
    participant PG as Postgres (Supabase)
    participant Cal as Calendar-Export (ICS)

    M->>SC: Klick "Buchen" auf /sessions/[id]
    SC->>PG: POST /api/bookings { session_id }
    Note over SC,PG: withApiAuth(verifyRole 'member')<br/>BookingUseCase.create()
    PG->>PG: RPC create_booking_safe<br/>(FOR UPDATE + Capacity-Check + GIST-Exclusion)
    PG-->>SC: Return Booking (status='confirmed')
    SC->>N: notifyBookingCreated(booking)
    N->>PG: INSERT notifications { type: 'booking_created' }
    SC-->>M: 201 Created (JSON)
    Note over M,SC: Polling oder Push-Update

    par Async Dispatch (5 min later)
        N->>PG: CRON notification-dispatch
        N->>Email: sendEmail(member, template 'booking_confirmed')
        Email-->>M: "Buchung bestätigt" E-Mail
    and
        N->>Cal: UPDATE ical-feed-signed-url
    end
```

**Tables beteiligt:** `bookings`, `sessions`, `notifications`, `notification_dispatch`, `members`.
**Files beteiligt:** `app/api/bookings/route.ts`, `src/application/use-cases/booking.use-cases.ts`, `src/infrastructure/persistence/repositories/booking.repository.ts`, `lib/notifications/notification.service.ts`, `app/api/cron/notification-dispatch/route.ts`.

## 🌾 2. Admin plant Saison mit KI

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin (Browser)
    participant SC as App-Server
    participant Gemini as Google Gemini Flash
    participant PG as Postgres

    A->>SC: /admin/seasons/[id]/planning → "Cluster starten"
    SC->>PG: SELECT trainer_availabilities, members, preferences
    PG-->>SC: Rows
    SC->>Gemini: POST generateContent { prompt: buildSeasonClusterPrompt(rows) }
    Gemini-->>SC: Plan-Vorschlag (Trainingsgruppen, Tage, Trainer)
    SC->>PG: INSERT seasonal_planning_history (action='cluster', status='proposed')
    SC-->>A: Vorschlag in UI (Draggable Cards)
    A->>SC: Manuell adjustieren (drag-drop)
    SC->>PG: UPDATE seasonal_planning_history (action='manual_edit')
    A->>SC: "Publish"
    SC->>PG: INSERT seasons, season_plan_entries
    SC->>PG: INSERT sessions (für 1 Saison × ~40 Wochen)
    SC->>PG: INSERT notifications { type: 'season_published' }
    SC->>SC: cron over Wochen notify-team
```

**Modules beteiligt:** `seasons` (core), `ai_matchmaking` (optional).
**Files:** `app/(protected)/admin/(gated)/seasons/[id]/planning/`, `app/api/ai/season-cluster/route.ts`.

## 💳 3. Member zahlt Rechnung via Stripe

```mermaid
sequenceDiagram
    autonumber
    actor M as Member (Browser)
    participant SC as App-Server
    participant Stripe
    participant W as Stripe-Webhook-Receiver
    participant PG as Postgres
    participant Dunning as Dunning-Cron

    M->>SC: /member/billing/invoice/[id] → "Pay"
    SC->>Stripe: POST /v1/checkout/sessions { invoice_id, customer_id }
    Stripe-->>SC: checkout URL
    SC-->>M: Redirect zu Stripe
    M->>Stripe: Zahlt (Kreditkarte / SEPA / Stripe-Default)
    Stripe->>W: POST /api/webhooks/stripe { event: 'invoice.paid' }
    W->>W: stripe.webhooks.constructEvent (verify sig)
    W->>PG: RPC check_and_record_stripe_event
    W->>PG: UPDATE invoices { status: 'paid', paid_at: now() }
    W->>PG: INSERT notifications { type: 'invoice_paid' }
    W-->>Stripe: 200 OK
    Note over Stripe,M: Stripe → Member E-Mail "Receipt"
    Note over Dunning: Später (1 Tag):<br/>Dunning-Cron läuft<br/> sieht Invoice paid → keine Aktion
```

**Files:** `app/api/stripe/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/services/billing.service.ts`.
**P0-Lücken in diesem Flow:**

- `invoice.payment_failed` wird nicht behandelt (P0-8)
- Plan-Switch erzeugt ggf. Doppel-Belastung (P0-7)

## 🧪 4. Probetraining-Anmeldung → Genehmigung → Membership

```mermaid
sequenceDiagram
    autonumber
    actor P as Public User (kein Login)
    participant SC as App-Server (Public Route)
    participant R as Resend-SMTP
    participant PG as Postgres
    actor A as Admin
    participant SB as Supabase Auth

    P->>SC: /trial-training → Form Submit
    SC->>SC: Zod-Validate + Rate-Limit (5/h per IP)
    SC->>PG: INSERT trial_trainings { status: 'pending_review' }
    SC->>PG: INSERT notifications { type: 'trial_training_request' }
    SC-->>P: "Anfrage erhalten" Page
    Note over PG: Cron notification-dispatch (5 min)

    par Admin-Notification
        SC->>R: sendEmail(admin, 'trial_request_admin')
        R-->>A: "Probetraining-Anfrage"
    and
        SC->>R: sendEmail(applicant, 'trial_request_confirmation')
        R-->>P: "Anfrage bestätigt"
    end

    A->>SC: /admin/trial-approvals → "Approve"
    SC->>PG: UPDATE trial_trainings { status: 'approved' }
    SC->>PG: INSERT user_club_memberships { role: 'member', is_active: true }
    Note over SC,SB: Optional: Magic-Link
    SC->>SB: supabase.auth.admin.inviteUserByEmail(applicant_email)
    SB-->>P: Magic-Link E-Mail
    P->>SB: Klick → Signup
    SB->>PG: neue auth.users Row + user_club_memberships
    SC->>R: sendEmail(new_member, 'welcome_to_club')
```

**Tables:** `trial_trainings`, `notifications`, `user_club_memberships`, `members`.
**Files:** `app/(public)/trial-training/`, `app/api/public/trial-training/route.ts`, `app/(protected)/admin/(gated)/trial-approvals/`.

## ⚗ 5. Mahnwesen-Stufen

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Dunning-Cron (täglich 09:00)
    participant PG as Postgres
    participant N as Notification-Service
    R over Email: Resend-SMTP (an Member)

    Cron->>PG: SELECT invoices WHERE status='pending' AND due_date < now()
    Loop pro Invoice
        alt Stufe 0 → 1 (15 Tage)
            Cron->>PG: UPDATE invoice { dunning_level: 1, late_fee: 5€ }
            Cron->>N: INSERT notifications { type: 'dunning_stage_1' }
            N->>Email: "1. Mahnung" Template
        else Stufe 1 → 2 (30 Tage)
            Cron->>PG: UPDATE invoice { dunning_level: 2, late_fee: 10€ }
            Cron->>N: INSERT notifications { type: 'dunning_stage_2' }
            N->>Email: "2. Mahnung + Verzugszins" Template
        else Stufe 2 → 3 (45 Tage)
            Cron->>PG: UPDATE invoice { dunning_level: 3, account_frozen: true }
            Cron->>PG: UPDATE user_club_memberships { is_active: false }
            Cron->>N: INSERT notifications { type: 'account_frozen' }
            N->>Email: "Inkasso-Drohung" Template
        end
    end
```

**Routes:** `app/api/cron/overdue-invoices/route.ts`, `app/api/cron/dunning-sync/route.ts`.
**⚠️ P0-8 Lücke:** Wenn Member mit SEPA/Lastschrift zahlt und Bank rejected → Stripe sendet `invoice.payment_failed` → unser Code reagiert NICHT. Folge: Dunning-Cron sieht nur via Datenbank-Stand, NICHT aktuelle Stripe-Status.

## 🏗 6. Smart-Court Hardware-Integration

```mermaid
sequenceDiagram
    autonumber
    actor T as Trainer/Admin (App)
    participant SC as App-Server
    participant Vendor as Hardware-Vendor-Cloud (Nuki/Shelly/Loxone)
    participant PG as Postgres
    participant IOT as IoT-Gateway (Platz)

    T->>SC: Smart Court Page → "Platz entsperren"
    SC->>PG: INSERT notifications { type: 'court_unlock', club_id, court_id }
    SC->>Vendor: POST /unlock { court_id, user_id, expires_in: 90min }
    Vendor->>IOT: MQTT/HTTP → entsperren
    IOT-->>Vendor: ACK
    Vendor-->>SC: 200 OK
    Note over SC: Booking-Reminder für nächsten Member
    Note over IOT: 90 min später automatisch Lock
```

**Voraussetzung:** `smart_court` Feature aktiv + Add-On Tier Professional + Hardware-Vendor-Setup.
**Tables:** `notifications`, smart_court-spezifische (Vendor-Account-Mapping).

## 🗳 7. Mitglieder-Abstimmung (Decisions)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    actor M1, M2 as Members
    participant SC as App-Server
    participant PG as Postgres

    A->>SC: /admin/decisions → "Neuer Vorschlag"
    SC->>PG: INSERT decision_proposals { status: 'open', deadline }
    SC->>PG: INSERT notifications { type: 'decision.published', recipient_ids: [alle_members] }

    M1->>SC: /member/decisions → Vote Up
    SC->>PG: INSERT decision_votes { member_id, proposal_id, vote: 'yes' }
    M2->>SC: /member/decisions → Vote No
    SC->>PG: INSERT decision_votes { member_id, proposal_id, vote: 'no' }

    Note over PG: Nach deadline
    Cron->>PG: SELECT * WHERE status='open' AND deadline<now()
    Cron->>PG: close decision_proposal(s) → status='closed', result
    Cron->>PG: INSERT notifications { type: 'decision.closed' }
```

**Tables:** `decision_proposals`, `decision_votes`, `notifications`, `audit_decision_changes`.
**Files:** `app/(protected)/admin/(gated)/decisions/`, `app/(protected)/member/decisions/`.

## 🔐 8. Owner lädt Admin ein (Cross-Tenant Onboarding)

```mermaid
sequenceDiagram
    autonumber
    actor O as Owner
    participant SC as App-Server (owner-route)
    participant SB as Supabase Auth (Admin SDK)
    participant PG as Postgres
    participant R as Resend

    O->>SC: /owner/admins → "Admin einladen" → email, club_id
    SC->>SB: auth.admin.inviteUserByEmail(email)
    SB-->>SC: User-Invite (Magic-Link)
    SC->>PG: INSERT user_club_memberships { user_id, club_id, role: 'admin', is_active: true }
    Note over SB,M: Aber User existiert noch nicht in users,<br/>Membership wird verknüpft sobald Magic-Link angeklickt wird
    SC->>R: sendEmail(email, 'invite_to_admin')
    R-->>Admin-Email: Magic-Link
    Note over O,M: Identity-Problematik:<br/>Falls bereits auth.users-Row existiert (z. B. Member → Admin-Promo),<br/>User wird reused, keine neue Row.
```

**P0-Relevanz:** P0-3 betrifft genau diese Route — Migration `20260621_add_owner_role.sql` muss mit dem Insert harmonieren.

## 🎯 9–15 · Tutorial-konkrete Mikro-Flows

Die großen Diagramme 1–8 oben zeigen **End-to-End-Patterns**. Hier sind die **kleinen konkreten Strecken**, die in den Schritt-für-Schritt-Tutorials tatsächlich durchlaufen werden. Jedes Diagramm verlinkt einen detaillierten Walkthrough. Alle Diagramme sind 1:1 aus den Source-Komponenten abgeleitet.

### 9 · Trainer pflegt Verfügbarkeit (Save: DELETE-before-POST)

> Walkthrough: [`tutorials/trainer-availability.md`](../user/tutorials/trainer-availability.md)
> Logik: Vor jedem POST werden alle API-Slots, die nicht mehr in der UI vorkommen, gelöscht — 409 (Slot ist mit `session` verknüpft) wird **stillschweigend ignoriert**.

```mermaid
sequenceDiagram
    autonumber
    actor T as Trainer (Browser)
    participant C as TrainerAvailabilityManager
    participant API as /api/trainer/availability
    participant PG as Postgres

    T->>C: Klick "Speichern"
    C->>API: GET ?from=<weekstart>&to=<weekend>
    API->>PG: SELECT trainer_availability WHERE date IN (week)
    PG-->>API: vorhandene Slots
    API-->>C: rows[]
    C->>C: existingKeys = Set("date|time|time")
    C->>C: uiKeys = Set aus aktuellem UI-State
    loop Slot in apiKeys und nicht in uiKeys
        C->>API: DELETE /api/trainer/availability/{id}
        alt 409 (slot mit session verknüpft)
            API-->>C: 409 — Slot bleibt in DB
            C->>C: silently ignore
        end
    end
    loop Slot in uiKeys und nicht in existingKeys
        C->>API: POST { date, start_time, end_time, notes: null }
        API->>PG: INSERT trainer_availability
        API-->>C: 201 Created
    end
    C-->>T: grünes Banner "X gespeichert, Y bereits vorhanden, Z gelöscht"
```

### 10 · Trainer bulked — "Auf alle Wochen im Monat anwenden"

> Walkthrough: [`tutorials/trainer-availability.md`](../user/tutorials/trainer-availability.md)
> Aktion ist **idempotent** — POST-Skip wenn Key bereits existiert, niemals destruktiv.

```mermaid
sequenceDiagram
    autonumber
    actor T as Trainer
    participant C as TrainerAvailabilityManager
    participant API as /api/trainer/availability

    T->>C: Klick "Auf alle Wochen im Monat anwenden"
    C->>C: weeks = computeWeeksInMonth(currentMonth) (4 bis 6 Wochen)
    loop pro Woche in weeks (ausser currentVisibleWeek)
        C->>API: GET ?from=weekStart&to=weekEnd
        API-->>C: existingKeys (Set)
        loop UI-Slot pro Wochentag
            alt Key noch nicht in existingKeys
                C->>API: POST { date, start_time, end_time }
                API-->>C: 201 Created
            else bereits vorhanden
                C->>C: skip — niemals überschreiben
            end
        end
    end
    C-->>T: Banner "12 erstellt, 4 bereits vorhanden" (4s auto-dismiss)
```

### 11 · Trainer-Check-in (RSVP → Attendance-Record)

> Walkthrough: [`tutorials/trainer-sessions-and-checkin.md`](../user/tutorials/trainer-sessions-and-checkin.md)
> **Kein** Optimistic Update: Pill bleibt im IDLE-State bis 200 OK eintrifft; bei Fehler Toast ohne State-Change.

```mermaid
sequenceDiagram
    autonumber
    actor T as Trainer
    participant C as TrainerDashboardClient + RsvpList
    participant API as /api/attendance-records
    participant PG as Postgres

    T->>C: Klick "Check-in" bei Member (Pill noch im IDLE-State)
    C->>API: POST { sessionId, participantId, status: "present", checkInTime: "HH:MM", date: now }
    API->>PG: INSERT attendance_records
    alt 200 OK
        PG-->>API: row inserted
        API-->>C: 200 (Attendance written)
        C->>C: Pill wechselt auf grünen Hintergrund + "Eingecheckt"-Badge
        C-->>T: Toast "Teilnehmer eingecheckt"
    else 4xx oder 5xx
        API-->>C: error
        C->>C: Pill bleibt im IDLE-State (kein Rollback noetig)
        C-->>T: Toast "Check-in fehlgeschlagen"
    end
```

### 12 · 2FA-Enrollment (TOTP) — Enroll → Hand-Paste-Code → Verify → optional Unenroll

> Walkthrough: [`tutorials/member-profile-security-billing.md`](../user/tutorials/member-profile-security-billing.md)
> 4 Schritte aus `supabase.auth.mfa.*`: `listFactors` (mount) → `enroll` → `challengeAndVerify` → `unenroll`.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant C as MemberProfile (Sicherheit-Tab)
    participant SB as supabase.auth.mfa

    M->>C: Mount der Sicherheit-Card
    C->>SB: mfa.listFactors()
    SB-->>C: { totp: [verified-oder-leer] }

    alt kein verified TOTP
        C->>SB: mfa.enroll({ factorType: "totp", issuer: "SwingZ" })
        SB-->>C: enroll Response (id, qr_code als base64 PNG, secret)
        C-->>M: QR-Code-Image + manueller Secret + 6-digit Input
        M->>C: 6-stelliger Code (Enter oder "Bestätigen")
        C->>SB: mfa.challengeAndVerify({ factorId, code })
        alt gültig
            SB-->>C: 200 OK
            C-->>M: Toast "2FA aktiviert" + Status "2FA ist aktiv"
        else ungültig
            SB-->>C: 401 invalid
            C-->>M: Toast "Ungültiger Code — erneut versuchen"
        end
    else bereits verified TOTP
        C-->>M: Badge "2FA ist aktiv" + Danger-Outline "2FA deaktivieren"
        M->>C: Klick
        C->>SB: mfa.unenroll({ factorId })
        SB-->>C: 200 OK
        C-->>M: Toast "2FA deaktiviert"
    end
```

### 13 · Account löschen (Anonymize-Service statt Hard-Delete)

> Walkthrough: [`tutorials/member-profile-security-billing.md`](../user/tutorials/member-profile-security-billing.md)
> DSGVO + GoBD: User-PII wird anonymisiert, **Buchungen + Invoices bleiben 10 Jahre** in der DB (GoBD §147 AO).

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant C as MemberProfile (Gefahrenzone)
    participant API as DELETE /api/user/delete
    participant S as lib/services/anonymize.service.ts
    participant PG as Postgres

    M->>C: Klick "Konto löschen" → ConfirmDialog → "Bestätigen"
    C->>API: DELETE /api/user/delete
    API->>S: anonymizeUser(userId)
    S->>PG: UPDATE users SET full_name='Anonym', email='anon-<hash>@deleted.local', phone=NULL
    S->>PG: UPDATE user_club_memberships SET is_active=false (soft, kein DELETE)
    Note over S,PG: bookings + invoices + attendance bleiben unverändert<br/>(GoBD §147 AO — 10 Jahre Aufbewahrung)
    S->>PG: INSERT audit_logs (action='user_anonymized', actor=system)
    API-->>C: 200 OK
    C->>C: router.push('/login') (Auth-Cookie gelöscht)
```

### 14 · Admin konvertiert Probetraining-Teilnehmer → Mitglied

> Walkthrough: [`tutorials/admin-trial-approvals.md`](../user/tutorials/admin-trial-approvals.md)
> Voraussetzung: `status='scheduled' | 'completed'`. Konvertierung erzeugt Supabase-Account + `user_club_memberships`-Row in **einem** Schritt.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant C as AdminTrialApprovals (Konvertieren-Modal)
    participant API as POST /api/admin/trial-training/[id]/convert-to-member
    participant SB as Supabase Admin SDK
    participant PG as Postgres
    participant R as Resend SMTP

    A->>C: Klick "Zu Mitglied konvertieren" (UserPlus-Icon)
    C-->>A: Modal mit Name + E-Mail + Hinweistext (Supabase-Account + Magic-Link)
    A->>C: Bestätigen
    C->>API: POST { email, fullName, clubId }
    API->>SB: auth.admin.inviteUserByEmail(email)
    SB-->>API: User-Invite (Magic-Link generiert)
    API->>PG: INSERT user_club_memberships { role: 'member', club_id, is_active: true }
    alt Success
        API->>R: sendEmail(new_member, 'welcome_to_club')
        API-->>C: 200 OK
        C-->>A: Badge "Konvertiert" ersetzt Button — irreversible
    else 409 "Email existiert bereits"
        API-->>C: error
        C-->>A: rote Error-Banner im Modal ("Manuelle Account-Migration via Support")
    end
```

### 15 · Admin erstellt Rechnung — Membership-Fee-Gate

> Walkthrough: [`tutorials/admin-billing.md`](../user/tutorials/admin-billing.md)
> **Sub-Feature-Scope (Finanzen-Modul #4 in [`docs/HANDBOOK.md`](../../HANDBOOK.md#modul-index-13-features-pro-verein)):** Dunning-Stufen 0/1/2/3 sind Teil des selben Moduls wie Rechnungs-Erstellung — Cron-getrieben, geht von §5 (Mahnwesen-Diagramm oben) aus. Für die ausführliche Stufen-Walkthrough siehe [`tutorials/admin-mahnwesen.md`](../user/tutorials/admin-mahnwesen.md).
> Server-Page blockiert Rechnungserstellung, wenn **keine aktive `type='membership'`-Config** existiert (gelbe Warnung oben) — häufigste Fehlerquelle bei "Rechnung erstellen"-Bugs.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant P as Billing-Page (Server Component)
    participant PG as Postgres
    participant N as Notification-Service

    P->>PG: 3x parallel — fee_configs, clubMemberships (role IN member,trainer), invoices (paginiert)
    PG-->>P: rows[]
    P->>P: hasActiveMembershipFee = fee_configs.some(type='membership' AND is_active)

    alt hasActiveMembershipFee === false
        P-->>A: Warnung gelb — "Keine aktive Mitgliedsgebühr konfiguriert"
        Note over A,P: "+ Rechnung" ist deaktiviert —<br/>Link "Jetzt Mitgliedsgebühr anlegen" fuehrt auf ?tab=categories
    else hat aktive Membership-Gebühr
        A->>P: "+ Rechnung" → Modal: { Member, Betrag, Fälligkeit, type }
        P->>PG: INSERT invoices { club_id, member_id, period_start, type, subtotal }
        alt 200 OK
            PG-->>P: row inserted
            P->>N: INSERT notifications { type: 'invoice_created' }
            P->>PG: notification-dispatch Cron (5 min) → E-Mail
            P-->>A: Rechnung erscheint in Liste
        else 409 (club × member × period × type) bereits vorhanden
            PG-->>P: 409 Conflict
            P-->>A: rote Fehler-Banner "Doppelte Rechnung — bereits angelegt?"
        end
    end
```

## 📊 Übersicht der Schlüssel-Flows

### 1–8 · End-to-End-Patterns

| Flow             | Schlüssel-Routes                                                | Schlüssel-Tabellen                                            | Externe             | Tutorial-Walkthrough                                                                                                                          |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Buchen           | `POST /api/bookings`                                            | `bookings`, `sessions`, `notifications`                       | –                   | [`member-bookings-and-attendance`](../user/tutorials/member-bookings-and-attendance.md)                                                       |
| Saison-Planung   | `/admin/seasons/[id]/planning/*`, `/api/ai/season-cluster`      | `seasons`, `season_plan_entries`, `seasonal_planning_history` | Gemini              | _(kein dediziertes Tutorial vorhanden)_                                                                                                       |
| Zahlung          | `/api/stripe/checkout`, `/api/webhooks/stripe`                  | `invoices`, `stripe_events`, `subscriptions`                  | Stripe              | [`admin-billing`](../user/tutorials/admin-billing.md)                                                                                         |
| Public-Trial     | `POST /api/public/trial-training`, `PATCH /api/trial-trainings` | `trial_trainings`, `user_club_memberships`                    | Resend              | [`public-trial-booking`](../user/tutorials/public-trial-booking.md) und [`admin-trial-approvals`](../user/tutorials/admin-trial-approvals.md) |
| Mahnwesen        | `/api/cron/overdue-invoices`                                    | `invoices`, `dunning_records`                                 | –                   | [`admin-mahnwesen.md`](../user/tutorials/admin-mahnwesen.md)                                                                                  |
| Smart Court      | `/api/hardware/vendor/*`                                        | `notifications`, smart_court-spezifische                      | Hardware-Vendor     | _(kein dediziertes Tutorial vorhanden)_                                                                                                       |
| Decisions        | `/api/decisions/*`                                              | `decision_proposals`, `decision_votes`                        | –                   | _(kein dediziertes Tutorial vorhanden)_                                                                                                       |
| Admin-Onboarding | `POST /api/owner/invite-admin`                                  | `user_club_memberships`, `auth.users`                         | Resend + Magic-Link | _(kein dediziertes Tutorial vorhanden)_                                                                                                       |

### 9–15 · Tutorial-konkrete Mikro-Flows

| #   | Mikro-Flow                         | Schlüssel-Route                                         | Schlüssel-Tabelle                                 | Tutorial-Walkthrough                                                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 9   | Trainer-Verfügbarkeit Save         | `GET/POST/DELETE /api/trainer/availability`             | `trainer_availability`                            | [`trainer-availability`](../user/tutorials/trainer-availability.md#schritt-3--speichern)                                             |
| 10  | Trainer "Auf alle Wochen im Monat" | `POST x N /api/trainer/availability`                    | `trainer_availability`                            | [`trainer-availability`](../user/tutorials/trainer-availability.md#bulk-aktion-auf-alle-wochen-im-monat-anwenden)                    |
| 11  | Trainer-RSVP Check-in              | `POST /api/attendance-records`                          | `attendance_records`                              | [`trainer-sessions-and-checkin`](../user/tutorials/trainer-sessions-and-checkin.md)                                                  |
| 12  | 2FA Enroll → Verify                | `supabase.auth.mfa.*` (Client-SDK)                      | `auth.mfa_factors`                                | [`member-profile-security-billing`](../user/tutorials/member-profile-security-billing.md#32-zwei-faktor-authentifizierung-2fa--totp) |
| 13  | Account löschen → Anonymize        | `DELETE /api/user/delete` → `anonymize.service.ts`      | `users` (anonymized), `audit_logs`                | [`member-profile-security-billing`](../user/tutorials/member-profile-security-billing.md#33-konto-löschen-gefahrenzone)              |
| 14  | Trial → Member Convert             | `POST /api/admin/trial-training/[id]/convert-to-member` | `user_club_memberships`, `auth.users`             | [`admin-trial-approvals`](../user/tutorials/admin-trial-approvals.md#schritt-5--zu-mitglied-konvertieren-nach-geplanter-session)     |
| 15  | Rechnung-Erstellung mit Fee-Gate   | `POST /api/invoices` (vorher Fee-Check)                 | `invoices`, `fee_configurations`, `notifications` | [`admin-billing`](../user/tutorials/admin-billing.md#b-gelbe-warnung-oben-auf-der-page)                                              |

**Map-of-Content:** Diagramme 1–8 zeigen die **Big-Picture-Architektur**; Diagramme 9–15 zeigen die **konkreten Mikro-Strecken**, die ein User tatsächlich durchläuft. Tutorials sind der ausführliche Walkthrough, Diagramme sind das visuelle Skelett.

**Tutorial-Coverage-Policy:** `–` war zuvor als Platzhalter etabliert. Aktuell existieren 10 Tutorials (9 User-facing + 1 Plattform). Wo ein Walkthrough existiert, wird er in Spalte 5 verlinkt; wo keiner existiert, steht explizit `_(kein dediziertes Tutorial vorhanden)_`. Die 10 Tutorials decken primär User-facing Flows (Public Trial / Member-Buchungen / Trainer-Sessions / Admin-Trial-Approvals / Admin-Billing) plus Mahnwesen (Plattform-Cron). Plattform- und IoT-Flows (Saison-Planung, Smart Court, Decisions, Admin-Onboarding) sind als Diagramme dokumentiert, aber nicht in einem Schritt-für-Schritt-Walkthrough ausgearbeitet. Erst bei Bedarf gezielt erstellen — siehe [Tutorial-Index](../user/tutorials/README.md).

## 📚 Verwandte Kapitel

### Handbuch-Struktur

- [`README.md`](../README.md) — Handbuch-Index + Architektur-Übersicht
- [`architecture.md`](./architecture.md) — wie die Schichten zusammenspielen
- [`notifications.md`](./notifications.md) — Notification-Service im Detail
- [`stripe-integration.md`](./stripe-integration.md) — Webhook-Idempotenz
- [`background-jobs.md`](./background-jobs.md) — Cron-Worker-Pattern
- [`data-model.md`](./data-model.md) — Tabellen-Übersicht (88+ Tabellen)

### Schritt-für-Schritt-Tutorials (indexiert nach Rolle)

- [`tutorials/README.md`](../user/tutorials/README.md) — Index aller 9 Walk-throughs
- **Mitglied**: [`getting-started`](../user/tutorials/member-getting-started.md) · [`bookings-and-attendance`](../user/tutorials/member-bookings-and-attendance.md) · [`profile-security-billing`](../user/tutorials/member-profile-security-billing.md)
- **Trainer**: [`availability`](../user/tutorials/trainer-availability.md) · [`sessions-and-checkin`](../user/tutorials/trainer-sessions-and-checkin.md)
- **Admin**: [`trial-approvals`](../user/tutorials/admin-trial-approvals.md) · [`members-and-courts`](../user/tutorials/admin-members-and-courts.md) · [`billing`](../user/tutorials/admin-billing.md)
- **Public**: [`trial-booking`](../user/tutorials/public-trial-booking.md)
