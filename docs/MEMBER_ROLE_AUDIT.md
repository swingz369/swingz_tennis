# Rollen-Audit: Member

> Stand: 15. Juni 2026 | SwingZ Plattform

## Übersicht

Die **Member**-Rolle ist die Standardrolle für Vereinsmitglieder. Mitglieder können sich für Sessions buchen, Trainer-Stunden reservieren, an Turnieren teilnehmen, Arbeitsdienste übernehmen und ihre Rechnungen einsehen.

**Layout-Guard:** `app/(protected)/member/layout.tsx` — Leitet Nutzer mit höheren Rollen (superadmin → `/superadmin`, admin → `/admin`, trainer → `/trainer`) automatisch weiter.

---

## Navigation (Sidebar)

### Primäre Navigation (Member-spezifisch)

| Sektion   | Link      | Icon | Feature-Flag |
| --------- | --------- | ---- | ------------ |
| Dashboard | `/member` | Home | —            |

### Sekundäre Navigation ("Allgemein")

| Name             | Link                  | Icon          | Beschreibung                      |
| ---------------- | --------------------- | ------------- | --------------------------------- |
| Mein Profil      | `/profile`            | User          | Eigenes Profil bearbeiten         |
| Nachrichten      | `/messages`           | MessageSquare | Interne Nachrichten (Posteingang) |
| Matchmaking      | `/matchmaking`        | Shuffle       | KI-basiertes Matchmaking          |
| Meine Rechnungen | `/billing`            | CreditCard    | Offene/bezahlte Rechnungen        |
| Arbeitsdienste   | `/member/work-duties` | HardHat       | Arbeitseinsätze einsehen & melden |

### Quick Actions (Dashboard)

| Aktion      | Link                      | Icon           |
| ----------- | ------------------------- | -------------- |
| Buchen      | `/bookings`               | Calendar       |
| Training    | `/training-schedule`      | BookOpen       |
| Trainer     | `/member/trainer-booking` | GraduationCap  |
| Turniere    | `/member/tournaments`     | Trophy         |
| Rechnungen  | `/billing`                | CreditCard     |
| Dienste     | `/member/work-duties`     | HardHat        |
| Präferenzen | `/member/preferences`     | ClipboardCheck |

---

## Seiten & Funktionen im Detail

### 1. Member-Dashboard (`/member`)

**Datei:** `app/(protected)/member/page.tsx` (Server Component)

**Funktionen:**

- **Onboarding-Flow:** Zeigt Probetraining-Formular, wenn keine aktive Mitgliedschaft vorhanden (`OnboardingTrialBooking`-Component)
- **Greeting:** Begrüßung mit Vorname + Clubname
- **Nächste Session (Hero Card):** Zeigt nächste Trainingseinheit mit Datum, Uhrzeit, Platzname. Link zu `/training-schedule`
- **Stat Cards (4×):**
  - Buchungen (bevorstehend) → `/bookings`
  - Rechnungen (offen) → `/billing`
  - Benachrichtigungen (ungelesen) → `/notifications`
  - Training (kommende Sessions) → `/training-schedule`
- **Nächste Buchungen:** Liste bestätigter Buchungen mit Platz, Datum, Status
- **Trainingseinheiten:** Kommende Sessions (ab 2.)
- **Hero Actions:** `MemberHeroActions`-Component

**API-Abhängigkeiten:**

- Supabase Direktzugriff: `user_club_memberships`, `bookings`, `sessions`, `notifications`, `invoices`

---

### 2. Turniere (`/member/tournaments`)

**Datei:** `app/(protected)/member/tournaments/page.tsx` (Client Component)

**Funktionen:**

- Alle Vereinsturniere anzeigen (Format, Kategorie, Platz, Startgebühr)
- Eigene Anmeldungen markiert (Badge "Angemeldet")
- Turnier-Anmeldung mit Bestätigungsdialog
- Anmeldeschluss, Teilnehmerzahl (X/max), Status-Anzeige
- Ausgebucht-Anzeige bei vollem Turnier

**API-Endpunkte:**

- `GET /api/tournaments` — Turnierliste
- `GET /api/tournaments/my-registrations` — Eigene Anmeldungen
- `POST /api/tournaments/{id}/register` — Anmeldung

---

### 3. Trainer buchen (`/member/trainer-booking`)

**Datei:** `app/(protected)/member/trainer-booking/page.tsx` (Client Component)

**Funktionen:**

- Trainer-Liste mit Name, E-Mail, Spezialisierungen
- Wochen-Kalender-Ansicht (Mo–So) für ausgewählten Trainer
- Verfügbare Slots (grün markiert) buchen
- Wochen-Navigation (vor/zurück)
- Buchungs-Bestätigungsdialog mit Trainer, Datum, Uhrzeit
- Erfolgs-Screen nach erfolgreicher Buchung

**API-Endpunkte:**

- `GET /api/trainers` — Trainer-Liste
- `GET /api/trainer/availability?trainerId=...&from=...&to=...` — Verfügbare Slots
- `POST /api/trainer/book` — Stunde buchen

---

### 4. Arbeitsdienste (`/member/work-duties`)

**Datei:** `app/(protected)/member/work-duties/work-duties-member-client.tsx`

**Funktionen:**

- Offene Arbeitseinsätze einsehen
- Sich selbst zuweisen (Volunteer)
- Zuweisung zurückziehen
- Dienst als erledigt markieren

**API-Endpunkte:**

- `GET /api/work-duties` — Alle Dienste
- `POST /api/work-duties/{id}/volunteer` — Selbst zuweisen
- `DELETE /api/work-duties/{id}/volunteer` — Zuweisung entfernen
- `POST /api/work-duties/{id}/complete` — Als erledigt markieren

---

### 5. Profil (`/profile`)

**Funktionen:**

- Eigene Profildaten anzeigen/bearbeiten
- Avatar, Name, E-Mail, Telefon

**API-Endpunkte:**

- `GET /api/me` — Eigene Profildaten
- `PATCH /api/members/{id}` — Profil aktualisieren

---

### 6. Nachrichten (`/messages`)

**Datei:** `app/(protected)/messages/page.tsx`

**Funktionen:**

- Posteingang, Gesendet, Archiv (Ordner-Filter)
- Nachricht lesen (als gelesen markieren)
- Neue Nachricht verfassen (Empfänger aus Mitglieder-Liste)
- Alle als gelesen markieren
- Ungelesen-Badge in Sidebar

**API-Endpunkte:**

- `GET /api/messages?folder=inbox|sent|archived` — Nachrichten laden
- `POST /api/messages` — Nachricht senden
- `PATCH /api/messages/{id}/read` — Als gelesen markieren
- `POST /api/messages/mark-all-read` — Alle als gelesen

---

### 7. Matchmaking (`/matchmaking`)

**Funktionen:**

- KI-basierte Spielervermittlung
- Passende Spielpartner finden
- Nur für Member (nicht für Admin/Trainer in Sidebar)

---

### 8. Meine Rechnungen (`/billing`)

**Datei:** `components/member-billing.tsx`

**Funktionen:**

- Offene und bezahlte Rechnungen einsehen
- Rechnung als PDF herunterladen
- Online-Bezahlung (Stripe Checkout)

**API-Endpunkte:**

- `GET /api/billing/invoices/overview?memberId=...` — Rechnungsübersicht
- `POST /api/billing/invoices/{id}/checkout` — Stripe Checkout starten

---

### 9. Präferenzen (`/member/preferences`)

**Funktionen:**

- Trainings-Präferenzen setzen (bevorzugte Zeiten, Platz, etc.)
- Wird bei Saisonplanung berücksichtigt

**API-Endpunkte:**

- `GET /api/members/{id}/schedule-preferences` — Präferenzen laden
- `PUT /api/members/{id}/schedule-preferences` — Präferenzen speichern

---

### 10. Weitere Routen

| Route                 | Beschreibung                      |
| --------------------- | --------------------------------- |
| `/bookings`           | Buchungsübersicht und -verwaltung |
| `/training-schedule`  | Trainingsplan einsehen            |
| `/scheduler`          | Session-Übersicht                 |
| `/notifications`      | Benachrichtigungen                |
| `/attendance-history` | Anwesenheitshistorie              |

---

## API-Endpunkte (Zusammenfassung)

| Endpoint                                 | Methode     | Beschreibung               |
| ---------------------------------------- | ----------- | -------------------------- |
| `/api/me`                                | GET         | Eigene Profildaten         |
| `/api/trainers`                          | GET         | Trainer-Liste              |
| `/api/trainer/availability`              | GET         | Trainer-Verfügbarkeit      |
| `/api/trainer/book`                      | POST        | Trainer-Stunde buchen      |
| `/api/tournaments`                       | GET         | Turnierliste               |
| `/api/tournaments/my-registrations`      | GET         | Eigene Turnier-Anmeldungen |
| `/api/tournaments/{id}/register`         | POST        | Turnier-Anmeldung          |
| `/api/work-duties`                       | GET         | Arbeitsdienste             |
| `/api/work-duties/{id}/volunteer`        | POST/DELETE | Selbst zuweisen/entfernen  |
| `/api/work-duties/{id}/complete`         | POST        | Als erledigt markieren     |
| `/api/messages`                          | GET/POST    | Nachrichten                |
| `/api/messages/{id}/read`                | PATCH       | Als gelesen markieren      |
| `/api/messages/mark-all-read`            | POST        | Alle als gelesen           |
| `/api/billing/invoices/overview`         | GET         | Rechnungsübersicht         |
| `/api/billing/invoices/{id}/checkout`    | POST        | Stripe Checkout            |
| `/api/members/{id}/schedule-preferences` | GET/PUT     | Trainingspräferenzen       |

---

## Feature-Flags

| Flag             | Auswirkung auf Member                  |
| ---------------- | -------------------------------------- |
| `trial_training` | Probetraining-Onboarding auf Dashboard |
| `tournaments`    | Turnier-Navigation (Quick Action)      |
| `work_duty`      | Arbeitsdienst-Navigation               |
| `shop`           | Shop-Zugang (falls implementiert)      |

---

## Berechtigungen (RBAC)

- **Zugriff:** Nur eigene Daten (Mitgliedschaft, Buchungen, Rechnungen)
- **Kein Zugriff auf:** Admin-Bereich, Trainer-Bereich, Superadmin-Bereich, andere Mitglieder-Daten
- **Multi-Tenant:** Club-Zugehörigkeit über `user_club_memberships` mit `club_id`
- **Layout-Guard:** Redirect zu höherer Rolle wenn vorhanden (superadmin > admin > trainer > member)
