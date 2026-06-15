# Rollen-Audit: Trainer

> Stand: 15. Juni 2026 | SwingZ Plattform

## Übersicht

Die **Trainer**-Rolle ist für Tennis-/Sporttrainer konzipiert. Trainer können ihre Verfügbarkeit verwalten, Sessions einsehen, Anwesenheit erfassen und ihr Profil pflegen. Sie haben Zugriff auf alle Member-Funktionen plus trainer-spezifische Features.

**Layout-Guard:** `app/(protected)/trainer/layout.tsx` — Prüft auf `trainer`, `admin` oder `superadmin` Rolle. Redirect zu `/dashboard` bei fehlender Berechtigung.

---

## Navigation (Sidebar)

### Primäre Navigation (Trainer-spezifisch)

| Sektion   | Link       | Icon |
| --------- | ---------- | ---- |
| Dashboard | `/trainer` | Home |

**Hinweis:** Trainer haben **keine** eigenen Sidebar-Sektionen wie Admins. Die Navigation erfolgt über Quick Actions auf dem Dashboard und die sekundäre Navigation.

### Sekundäre Navigation ("Allgemein")

| Name        | Link        | Icon          | Beschreibung              |
| ----------- | ----------- | ------------- | ------------------------- |
| Mein Profil | `/profile`  | User          | Eigenes Profil bearbeiten |
| Nachrichten | `/messages` | MessageSquare | Interne Nachrichten       |

### Quick Actions (Dashboard)

| Aktion        | Link                    | Icon           |
| ------------- | ----------------------- | -------------- |
| Einheiten     | `/scheduler`            | Calendar       |
| Anwesenheit   | `/attendance-history`   | ClipboardCheck |
| Verfügbarkeit | `/trainer/availability` | Clock          |
| Profil        | `/trainer/profile`      | Users          |
| Abrechnung    | `/billing`              | BarChart3      |
| Nachrichten   | `/notifications`        | Bell           |

---

## Seiten & Funktionen im Detail

### 1. Trainer-Dashboard (`/trainer`)

**Datei:** `app/(protected)/trainer/page.tsx` (Client Component)

**Funktionen:**

- **Hero Header:** Gradient-Banner mit Begrüßung, "Sessions heute"-Badge, Link zu "Alle Einheiten"
- **Stat Cards (4×):**
  - Gesamt Sessions (alle Zeiten)
  - Kommende Sessions (anstehend)
  - Diese Woche (geplant)
  - Anwesenheitsquote (%)
- **Kommende Einheiten:** Liste der nächsten 5 Sessions mit:
  - Gruppen-/Platzname, Datum, Uhrzeit
  - "Anwesenheit"-Button pro Session → `/attendance-history?session={id}`
- **Session RSVPs:** `TrainerRsvpList` — Übersicht über Teilnahme-Zusagen
- **Ladezustand:** Skeleton-UI während API-Abruf
- **Fehlerzustand:** Fehlermeldung mit "Erneut versuchen"-Button

**API-Endpunkte:**

- `GET /api/trainer/me` — Eigene Sessions, Statistiken, Profil

---

### 2. Verfügbarkeit verwalten (`/trainer/availability`)

**Datei:** `app/(protected)/trainer/availability/page.tsx` → `components/trainer-availability-manager.tsx`

**Funktionen:**

- Wochen-Kalender-Ansicht (Mo–So)
- Verfügbare Zeitfenster setzen (Datum + Start-/Endzeit)
- Bestehende Slots bearbeiten/löschen
- Wochen-Navigation (vor/zurück)
- Visuelle Darstellung: existierende Slots farbig markiert

**API-Endpunkte:**

- `GET /api/trainer/availability?from=...&to=...` — Eigene Slots laden
- `POST /api/trainer/availability` — Neuen Slot erstellen
- `DELETE /api/trainer/availability/{id}` — Slot löschen

---

### 3. Trainer-Profil (`/trainer/profile`)

**Datei:** `app/(protected)/trainer/profile/page.tsx`

**Funktionen:**

- Profil-Übersicht: Name, E-Mail, Spezialisierungen
- Qualifikationen anzeigen
- Profil bearbeiten (Name, Bio, Spezialisierungen)
- Stundenlohn einsehen

**API-Endpunkte:**

- `GET /api/trainer/me` — Eigene Profil-ID
- `GET /api/trainer-profiles/{id}` — Profil-Details
- `PATCH /api/trainer-profiles/{id}` — Profil aktualisieren

---

### 4. Session-Übersicht (`/scheduler`)

**Funktionen:**

- Alle zugewiesenen Einheiten (vergangen + zukünftig)
- Filter nach Datum, Gruppe, Status
- Detail-Ansicht pro Session

---

### 5. Anwesenheit (`/attendance-history`)

**Funktionen:**

- Anwesenheit für eigene Sessions erfassen
- Historische Anwesenheitsdaten einsehen
- Check-in/Check-out für Teilnehmer

**Hinweis:** Verlinkt vom Dashboard pro Session via `/attendance-history?session={id}`

---

### 6. Abrechnung (`/billing`)

**Funktionen:**

- Eigene Rechnungen und Abrechnungen einsehen
- Stunden-Statistiken

**API-Endpunkte:**

- `GET /api/trainer/hours-logs/stats` — Aggregierte Stunden-Statistiken

---

### 7. Nachrichten (`/messages`)

**Funktionen:**

- Gleiche Nachrichten-Funktionen wie Member
- Posteingang, Gesendet, Archiv
- Nachricht senden, lesen, als gelesen markieren

---

## API-Endpunkte (Zusammenfassung)

| Endpoint                         | Methode   | Beschreibung                     |
| -------------------------------- | --------- | -------------------------------- |
| `/api/trainer/me`                | GET       | Eigene Sessions + Stats + Profil |
| `/api/trainer/availability`      | GET       | Verfügbarkeit (Woche)            |
| `/api/trainer/availability`      | POST      | Slot erstellen                   |
| `/api/trainer/availability/{id}` | DELETE    | Slot löschen                     |
| `/api/trainer-profiles/{id}`     | GET/PATCH | Profil lesen/bearbeiten          |
| `/api/trainer/hours-logs/stats`  | GET       | Stunden-Statistiken              |
| `/api/messages`                  | GET/POST  | Nachrichten                      |
| `/api/messages/{id}/read`        | PATCH     | Als gelesen markieren            |
| `/api/messages/mark-all-read`    | POST      | Alle als gelesen                 |

---

## Feature-Keine

Trainer haben **keine** eigenen Feature-Flags. Sie sind von folgenden Admin-Flags indirekt betroffen:

| Flag       | Auswirkung                                        |
| ---------- | ------------------------------------------------- |
| `trainers` | Trainer-Rolle überhaupt nutzbar                   |
| `seasons`  | Saisonplanung (Trainer werden Saisons zugewiesen) |

---

## Berechtigungen (RBAC)

- **Zugriff:** Eigene Sessions, Verfügbarkeit, Profil, Anwesenheit eigener Gruppen
- **Kein Zugriff auf:** Admin-Bereich, andere Trainer-Daten, Vereinseinstellungen, Mitgliederverwaltung
- **Multi-Tenant:** Club-Zugehörigkeit über `user_club_memberships` mit `club_id` + `role: 'trainer'`
- **Layout-Guard:** Admins und Superadmins haben ebenfalls Zugriff auf `/trainer`
- **Doppelrolle:** Ein Nutzer kann gleichzeitig Member UND Trainer sein (z.B. Spielertrainer)

---

## Trainer-Absenzen

**Komponente:** `components/trainer-availability-manager.tsx`

Trainer können Abwesenheiten melden:

- `POST /api/trainer-absences` — Abwesenheit erstellen
- Wird bei Saisonplanung berücksichtigt
- Sichtbar für Admins im Trainer-Detail

---

## Unterschiede zu Member

| Feature        | Member                          | Trainer                            |
| -------------- | ------------------------------- | ---------------------------------- |
| Dashboard      | Buchungen, Stats, Quick Actions | Sessions, Anwesenheit, RSVP        |
| Kalender       | Buchbare Sessions               | Eigene Verfügbarkeit setzen        |
| Turniere       | Anmelden                        | — (nicht sichtbar)                 |
| Matchmaking    | Ja                              | Nein (in Sidebar)                  |
| Arbeitsdienste | Volunteer                       | —                                  |
| Rechnungen     | Eigene Rechnungen               | Stunden-Abrechnung                 |
| Profil         | Basis-Profil                    | Trainer-Profil mit Qualifikationen |
