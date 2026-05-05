# SwingZ – Navigation & Funktionsaudit

**Datum:** 2026-05-05  
**Autor:** Kilo (AI Agent)  
**Ziel:** Systematische Überprüfung der Navigationsleiste für jede Benutzerrolle, Prüfung erreichbarer Seiten auf korrekten Inhalt, technische Funktion und intuitive Bedienbarkeit. Identifikation fehlender Entitäten (Plätze/Gruppen), strukturelle Probleme und konkrete Maßnahmen.

---

## 1. Rollenübersicht

| Rolle        | Level | Beschreibung                                                                     |
| ------------ | ----- | -------------------------------------------------------------------------------- |
| `superadmin` | 4     | Verwaltet mehrere Vereine, globale Plattform-Einstellungen                       |
| `admin`      | 3     | Club-Administrator pro Verein, verwaltet Mitglieder, Trainer, Plätze, Abrechnung |
| `trainer`    | 2     | Erstellt Sessions, sieht Stundenplan, verwaltet eigene Verfügbarkeit             |
| `member`     | 1     | Buchet Trainingssessions, sieht Kalender, verwaltet eigene Rechnungen            |

---

## 2. Aktuelle Navigation (Sidebar)

### Hauptmenü (für alle authentifizierten Rollen)

| Link              | Route                 | Sichtbar für                   | Status |
| ----------------- | --------------------- | ------------------------------ | ------ |
| Dashboard         | `/dashboard`          | all                            | ✅     |
| Trainingszeiten   | `/training-schedule`  | all                            | ✅     |
| Anwesenheit       | `/attendance-history` | all                            | ✅     |
| News              | `/news`               | all                            | ✅     |
| Buchungen         | `/bookings`           | all                            | ✅     |
| Plätze (Kalender) | `/courts`             | all                            | ✅     |
| Scheduler         | `/scheduler`          | trainer+                       | ✅     |
| Abo & Rechnung    | `/billing`            | member+, außer superadmin      | ✅     |
| Vereinsübersicht  | `/admin/tenants`      | superadmin (ohne selectedClub) | ✅     |

### Administrations-Menü (nur admin & superadmin)

| Link          | Route                | Sichtbar für | Status                          |
| ------------- | -------------------- | ------------ | ------------------------------- |
| Analytics     | `/admin/analytics`   | admin+       | ✅                              |
| Onboarding    | `/admin/onboarding`  | admin+       | ✅                              |
| Clubs         | `/admin/clubs`       | admin+       | ✅                              |
| Mitglieder    | `/admin/members`     | admin+       | ✅                              |
| Schedules     | `/admin/schedules`   | admin+       | ✅                              |
| Plätze        | `/admin/courts`      | admin+       | ⚠️ **Nur Kalender, keine CRUD** |
| Genehmigungen | `/admin/approvals`   | admin+       | ✅                              |
| Einstellungen | `/admin/settings`    | admin+       | ✅                              |
| Billing Admin | `/admin/billing`     | admin+       | ✅                              |
| Trainer       | `/admin/trainers`    | admin+       | ❌ **Fehlt**                    |
| Court Types   | `/admin/court-types` | admin+       | ❌ **Fehlt**                    |
| Gruppen       | `/admin/groups`      | admin+       | ❌ **Fehlt**                    |
| Seasons       | `/admin/seasons`     | admin+       | ❌ **Fehlt**                    |

---

## 3. Kritische Lücken und Probleme

### PRIO 1 – Kritisch (sofort beheben)

| #   | Problem                                                    | Betroffene Rolle(n) | Auswirkung                                                                                                                                                   | Empfohlene Maßnahme                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Fehlende Court/Platz-Verwaltung (CRUD)**                 | admin, superadmin   | Admin kann Plätze nur im Kalender sehen, aber nicht anlegen/bearbeiten/löschen. Backend-API existiert (`court.service.ts`), Frontend fehlt komplett.         | Neue Seite `/admin/courts/manage` (oder `/admin/courts/list`) mit DataTable + Modal für Create/Edit. API: `GET/PATCH/DELETE /api/courts/[id]` ergänzen. Sidebar "Plätze" im Admin-Menü auf "Platzverwaltung" umlenken. |
| 2   | **Doppelte "Plätze"-Navigation**                           | admin               | Zwei Menüpunkte mit gleichem Namen (Hauptmenü "Plätze" → Member-Kalender; Admin-Menü "Plätze" → Admin-Kalender). Verwirrend, keine klare Trennung.           | Hauptmenü "Plätze" umbenennen in **"Platz-Verfügbarkeit"** oder **"Buchungen & Plätze"**. Admin-Menü "Plätze" umbenennen in **"Platzverwaltung"** (zeigt CRUD) oder **"Platz-Kalender"** (wenn getrennt).              |
| 3   | **Trainer-Profil-Management nicht erreichbar**             | admin               | Komponente `trainer-profile-management.tsx` existiert, aber keine Route und kein Nav-Link. Trainer-Daten nicht zentral verwaltbar.                           | Seite `/admin/trainers` anlegen und mit `TrainerProfileManagement` rendern. Sidebar-Eintrag "Trainer" nach "Mitglieder" einfügen.                                                                                      |
| 4   | **Court Types nicht verwaltbar**                           | admin               | `court_types` Tabelle existiert (Migration), aber keine UI. Bei Court-Erstellung Dropdown leer?                                                              | Einfache CRUD-Seite `/admin/court-types` oder Tab in Platzverwaltung. Felder: `name` (z.B. "Sand", "Hartplatz"), `surface` (clay/grass/hard/carpet), `is_active`. API: `GET /api/court-types` (admin).                 |
| 5   | **Scheduler Drag & Drop funktionsfähig machen**            | admin, trainer      | Drag & Drop im Scheduler ist nur visuell, kein API-Call zum Aktualisieren (TODO in `admin-court-calendar.tsx:225`). Sessions können nicht verschoben werden. | `scheduler/page.tsx:handleDragEnd` vervollständigen mit `PATCH /api/sessions/:id` (oder `POST /api/sessions/move`). Authorization in API prüfen: Trainer nur eigene Sessions, Admin alle. Toast + Refetch.             |
| 6   | **Platz-Kalender: Erstellung/Editierung von Courts fehlt** | admin               | `/admin/courts` zeigt nur Kalender. Kein "+" Button, keine Settings.                                                                                         | CRUD-UI entweder auf separater Seite oder als Modal über Kalender. Neue UI über `/admin/courts/manage` wie Punkt 1.                                                                                                    |

### PRIO 2 – Hoch

| #   | Problem                                                                     | Betroffene Rolle(n) | Auswirkung                                                                                                                                                                                                                            | Empfohlene Maßnahme                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **Season/Schedule-Konfiguration fehlt**                                     | admin               | Onboarding-Step 2 "Schedules" verweist auf Saisonzeiten, aber es gibt nur Sessions-Verwaltung (`/admin/schedules`). Keine Saison-Definition (Start/Ende) oder Schedule-Objekte.                                                       | Prüfen, ob `schedules`-Tabelle genutzt wird (enthält nur `schedule_id` in sessions?). Falls Seasons benötigt: Tabelle `seasons` (club_id, name, start_date, end_date, is_active). Seite `/admin/seasons` oder `/admin/schedules` um Zeitraum-Felder erweitern.                      |
| 8   | **Gruppen-Management fehlt**                                                | admin               | Sessions verwenden `groupNames` als String-Array in `sessions` Tabelle, aber keine zentrale Gruppen-CRUD.                                                                                                                             | Falls Gruppen zentral verwaltet werden sollen: Tabelle `groups` (club_id, name, color, max_participants). Sessions referenzieren `groupId`. Seite `/admin/groups`. Andernfalls `groupNames` als Freitext belassen.                                                                  |
| 9   | **Court-Pricing/Regeln fehlt**                                              | admin, member       | Keine Preiskonfiguration pro Platz oder Club. Member-Billing hartkodiert €15/Session (`member-billing.tsx:89`).                                                                                                                       | Einfachste Lösung: `clubs` Tabelle um `default_hourly_rate NUMERIC` erweitern. Settings-Seite (`/admin/settings`) bekommt Feld "Stundenpreis (€)". Member-Billing liest Preis aus Club-Einstellung. Alternativ: Tabelle `pricing_rules` (court_id, price_per_hour, effective_from). |
| 10  | **Trainer-Profil-API-Routen nicht vollständig integriert**                  | admin               | API-Routen für trainer-profiles sind da, aber Komponente ist eigenständig, nicht in Layout eingebunden. Berechtigungen?                                                                                                               | Seite `/admin/trainers` (siehe Punkt 3). Zusätzlich prüfen, ob API nur Admin-Zugriff hat (`withAuth` + `verifyRole`). Trainer sollten ggf. ihr eigenes Profil einsehen können (`/trainer/profile`).                                                                                 |
| 11  | **Unklare Billing-Trennung (Superadmin vs. Admin)**                         | superadmin, admin   | Superadmin sieht "Abo & Rechnung" nicht (korrekt), aber Admin verwaltet Mitglieder-Abos und Rechnungen. Die Abrechnungslogik (Trainer-Stunden → Mitglieder-Rechnungen vs. Superadmin → Club-Rechnungen) könnte klarer geführt werden. | Doku ergänzen. Kein technisches Problem, aber im UI trennen: Admin-Billing nur für eigenen Club. Superadmin hat separates `/admin/billing` für Club-Gebühren (wenn vorhanden).                                                                                                      |
| 12  | **Members-API in `/admin/members` nutzt `selectedClubId` nicht konsequent** | admin, superadmin   | Die Seite holt members über `supabase.from('user_club_memberships')` mit `club_id = effectiveClubId`. Superadmin mit `selectedClubId` nutzt den Cookie (Seiten-Logik ist okay, aber könnte einfacher `auth.selectedClubId` nutzen).   | Kein dringendes Problem, aber Code vereinheitlichen: In Server Component `MembersPage` `auth.selectedClubId` aus `api-auth` nutzen statt CookieStore direkt.                                                                                                                        |

### PRIO 3 – Mittel

| #   | Problem                                           | Betroffene Rolle(n) | Auswirkung                                                                                                                                        | Empfohlene Maßnahme                                                                                                                                                           |
| --- | ------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Onboarding-Seite ist nur informativ**           | admin               | Onboarding listet Schritte auf, aber keine interaktive Checkliste oder Wizard zur Einrichtung.                                                    | Jeden Schritt zu klickbarem Button "Jetzt einrichten" machen, der zur entsprechenden Seite führt (Clubs, Courts, Schedules, Trainer). Fortschritt lokal oder in DB speichern. |
| 14  | **Analytics-Daten nur für einen Club**            | admin               | `/admin/analytics` nutzt nur `memberships[0].club_id`; Superadmin mit mehreren Clubs sieht nur einen Club.                                        | Analytics-Seite um Club-Auswahl erweitern (Dropdown aller Clubs des Superadmin) oder aggregierte Plattform-Statistiken anbieten.                                              |
| 15  | **News-Seite existiert, aber Inhalte unsichtbar** | all                 | `/news` Seite vorhanden, aber keine Inhalte oder CMS-Anbindung erkennbar.                                                                         | News-Komponente mit statischen Daten oder einfachem CMS (Tabelle `news_posts`).                                                                                               |
| 16  | **Attendance (Anwesenheit) nur Statistik**        | member, trainer     | `/attendance-history` zeigt nur History, keine Check-in/out-Funktionalität.                                                                       | Entscheiden, ob Check-In gewünscht. Falls ja: Button "Check-In" mit Location/Time; Tabelle `attendance_logs`.                                                                 |
| 17  | **Trial Training Seite nur Komponente**           | member              | `trial-training/page.tsx` rendert Komponente, aber kein Auto-Redirect wenn nicht eingeloggt? (Wird durch `ProtectedRoute` abgesichert, ist okay.) | Prüfen, ob Trial Training für Mitglieder oder Gäste? Falls nur Mitglieder: routing korrekt.                                                                                   |
| 18  | **Profil-Seite (`/profile`) unsichtbar in Nav**   | all                 | Profil-Seite existiert, aber kein Link in Sidebar.                                                                                                | Link in Sidebar unter "Einstellungen" oder als separater Menüpunkt "Mein Profil" hinzufügen (unter Hauptmenü).                                                                |
| 19  | **Notifications-Seite unsichtbar**                | all                 | `/notifications` existiert, aber keine Nav-Link.                                                                                                  | Glocke im Header mit Dropdown? Oder separater Menüpunkt "Benachrichtigungen".                                                                                                 |
| 20  | **My-Bookings Seite getrennt von Buchungen**      | member              | Separate Seite `my-bookings` neben `bookings`; könnte konsolidiert werden.                                                                        | Prüfen, ob Unterschied: `/bookings` = Monatskalender aller Sessions, `/my-bookings` = Liste meiner Buchungen? Falls ja, beide behalten. Label klar machen.                    |

---

## 4. Technische Prüfung – Auth & Route Guards

| Komponente                                  | Status          | Bemerkung                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api-auth.ts` – `requireAuth`           | ✅ Gut          | Nutzt jetzt `getUser()` (statt `getSession()`), sicherer.                                                                                                                                                                                                                                                                                                                                                                                 |
| `lib/api-auth.ts` – `selectedClubId` Cookie | ✅ Gut          | Superadmin kann Club wechseln, Cookie wird in `buildAuthContext` ausgewertet.                                                                                                                                                                                                                                                                                                                                                             |
| `lib/api-auth.ts` – Role Hierarchy          | ✅ Gut          | `superadmin(4) > admin(3) > trainer(2) > member(1)`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `lib/api-auth.ts` – `verifyClubAccess`      | ✅ Gut          | Superadmin hat Zugriff auf alle Clubs.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `components/layout/protected-route.tsx`     | ✅ Gut          | Demo-Mode erkannt, Client-seitiger Schutz. Nur `/login` als public; könnte auch `/api/auth/*` ausschließen (wird aber durch Next.js Routing ohnehin separat behandelt).                                                                                                                                                                                                                                                                   |
| **Sicherheitslücke API POST `/api/courts`** | ❌ **Kritisch** | `app/api/courts/route.ts:54-89`: POST nimmt `clubId` aus Request-Body ohne Prüfung, ob erstellender Admin auch zu diesem Club gehört (außer `verifyRole(admin)`). Ein Admin könnte Courts für einen anderen Club anlegen, wenn er `clubId` im Body manipuliert. **Fix:** Bei non-superadmin `clubId` aus Body muss `auth.clubId` sein; sonst 403. Oder `clubId` aus Body ignorieren und immer `auth.clubId` verwenden (außer superadmin). |
| **Club-Scoping in Admin-APIs**              | ✅ Gut          | `app/api/admin/billing/*` und `admin/members` nutzen `auth.clubId` oder `selectedClubId` (Superadmin).                                                                                                                                                                                                                                                                                                                                    |
| `requireAuth` Demo-Mode                     | ✅ Gut          | Demo-Mode liefert Demo-User mit clubId `demo-club`.                                                                                                                                                                                                                                                                                                                                                                                       |

---

## 5. UI/UX – Intuitivität und Konsistenz

**Positive Aspekte:**

- Klare Farbcodierung: Admin-Items (orange Gradient), Hauptmenü (grün)
- Icons konsistent (Lucide)
- Responsive: Mobile per Drawer
- Aktiver Link wird hervorgehoben

**Schwachstellen:**

1. **Doppelte "Plätze"** im Menü verwirrt
2. **Fehlende Platzverwaltung** – kein "Hinzufügen"-Button
3. **Fehlende Trainer-Verwaltung** im Nav
4. **Court Types** nicht sichtbar
5. **Onboarding** passiv (keine Buttons)
6. **Kalender-Ansichten** – Mitglieder: Monat (`/bookings`), Admin: Woche (`/courts`), Trainer: Woche (`/scheduler`) – keine einheitliche Navigation zwischen Ansichten

---

## 6. Fehlende Entitäten (Strukturelle Probleme)

| Entität                  | Vorhanden?                                                           | Beschreibung                                            | Empfehlung                                                                                                            |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Courts (Plätze)**      | ✅ DB + Service + API (GET-Liste)                                    | Fehlt: CRUD-UI, Update/Delete-API, Court-Type-Zuordnung | Priorität 1: CRUD-Seite + ergänzende API-Routen (`/api/courts/[id]`)                                                  |
| **Court Types**          | ✅ DB (Seed)                                                         | Keine UI, keine API                                     | Priorität 1: einfache Referenz-Tabelle verwalten (Read-only oder CRUD)                                                |
| **Trainer Profiles**     | ✅ DB + API + Komponente                                             | Route fehlt, Nav-Link fehlt                             | Priorität 1: Route `/admin/trainers` + Nav-Eintrag                                                                    |
| **Groups**               | ❌ DB/API/UI                                                         | Sessions speichern `groupNames` als Array (Text)        | Priorität 2: Falls Gruppen benötigt werden, eigene Tabelle mit ID, Name, Farbe; dann Sessions auf `groupId` umstellen |
| **Seasons / Schedules**  | ⚠️ `schedules` Tabelle existiert, aber nur `schedule_id` in sessions | Keine UI, um Saison-Zeitraum zu definieren              | Priorität 2: Klären, ob Saison-Konzept benötigt. Falls ja: Seasons CRUD + Zuweisung zu Sessions                       |
| **Pricing Rules**        | ❌                                                                   | Mitglieder-Abrechnung hartkodiert €15/Session           | Priorität 2: Preis pro Club/Court konfigurierbar machen (Clubs-Tabelle oder separate Tabelle)                         |
| **News / Announcements** | ❌                                                                   | `/news` Seite ohne Inhalt                               | Priorität 3: Einfaches CMS oder statische Inhalte                                                                     |
| **Attendance Logs**      | ⚠️ `attendance_history` Tabelle?                                     | Nur History-Ansicht, kein Check-In                      | Priorität 3: Falls benötigt, Check-In/Out-Button + API                                                                |

---

## 7. Route-Übersicht und -Prüfung

### Superadmin-Routen

| Route                      | Rolle      | Inhalt                                   | Status |
| -------------------------- | ---------- | ---------------------------------------- | ------ |
| `/admin/dashboard`         | superadmin | Plattform-Übersicht (alle Clubs)         | ✅     |
| `/admin/tenants`           | superadmin | Club-Liste mit Stats + Switch-Button     | ✅     |
| `/admin/clubs`             | admin+     | Club-CRUD                                | ✅     |
| `/admin/members`           | admin+     | Club-Mitglieder (club-scoped)            | ✅     |
| `/admin/trainers`          | admin+     | **Fehlt** – Trainer-CRUD                 | ❌     |
| `/admin/courts` (Kalender) | admin+     | Admin-Kalender mit Drag & Drop           | ✅     |
| `/admin/courts/manage`     | admin+     | **Fehlt** – CRUD-UI                      | ❌     |
| `/admin/court-types`       | admin+     | **Fehlt**                                | ❌     |
| `/admin/schedules`         | admin+     | Sessions-CRUD (Wochenplan)               | ✅     |
| `/admin/approvals`         | admin+     | Registrierungs-Workflow                  | ✅     |
| `/admin/billing`           | admin+     | Mitglieder-Abos + Rechnungen             | ✅     |
| `/admin/analytics`         | admin+     | Club-Statistiken (aktuell nur 1 Club)    | ⚠️     |
| `/admin/onboarding`        | admin+     | Infoseite                                | ✅     |
| `/admin/settings`          | admin+     | Club-Einstellungen + System (superadmin) | ✅     |

### Trainer-Routen

| Route        | Rolle   | Inhalt                                         | Status                                             |
| ------------ | ------- | ---------------------------------------------- | -------------------------------------------------- |
| `/trainer`   | trainer | Dashboard + eigene Sessions                    | ✅                                                 |
| `/scheduler` | trainer | Drag & Drop Stundenplan (Demo: hardcoded club) | ✅ (aber clubId fest)                              |
| `/sessions`  | –       | API                                            | ⚠️ `PATCH /api/sessions/:id` fehlt für Drag & Drop |

### Member-Routen

| Route                 | Rolle  | Inhalt                           | Status                  |
| --------------------- | ------ | -------------------------------- | ----------------------- |
| `/bookings`           | member | Monatskalender + Buchung         | ✅                      |
| `/billing`            | member | Rechnungen einsehen + generieren | ✅                      |
| `/my-bookings`        | member | Liste meiner Buchungen           | ✅                      |
| `/courts`             | member | Wochen-Kalender (Plätze)         | ✅                      |
| `/trial-training`     | member | Probetraining-Registrierung      | ✅                      |
| `/attendance-history` | member | Anwesenheits-Historie            | ✅                      |
| `/profile`            | all    | Benutzerprofil                   | ✅ (aber kein Nav-Link) |

---

## 8. API-Routen – Status und Fehlende Endpoints

| Route                              | Methode  | Rolle         | Status | Bemerkung                                                                        |
| ---------------------------------- | -------- | ------------- | ------ | -------------------------------------------------------------------------------- |
| `/api/courts`                      | GET      | member+       | ✅     | Filter `clubId` erforderlich                                                     |
| `/api/courts`                      | POST     | admin         | ✅     | **Sicherheitslücke:** keine Prüfung, ob `clubId` aus Body zu `auth.clubId` passt |
| `/api/courts/[id]`                 | GET      | member+       | ❌     | Fehlt                                                                            |
| `/api/courts/[id]`                 | PATCH    | admin         | ❌     | Fehlt                                                                            |
| `/api/courts/[id]`                 | DELETE   | admin         | ❌     | Fehlt (soft delete via `is_active`)                                              |
| `/api/court-types`                 | GET      | member+       | ⚠️     | Nur per DB-Seed; keine API-Route                                                 |
| `/api/court-types`                 | CRUD     | admin         | ❌     | Fehlt                                                                            |
| `/api/sessions`                    | CRUD     | –             | ✅?    | Prüfen, ob `PATCH /api/sessions/:id` existiert (für Scheduler)                   |
| `/api/sessions/:id`                | PATCH    | admin/trainer | ⚠️     | Muss implementiert/geprüft werden                                                |
| `/api/trainer-profiles`            | GET      | admin         | ✅     | Existiert                                                                        |
| `/api/trainer-profiles/:id`        | PATCH    | admin         | ✅     | Existiert                                                                        |
| `/api/seasons`                     | CRUD     | admin         | ❌     | Falls benötigt                                                                   |
| `/api/groups`                      | CRUD     | admin         | ❌     | Falls benötigt                                                                   |
| `/api/admin/billing/subscriptions` | GET/POST | admin         | ✅     | Club-scoped                                                                      |
| `/api/admin/billing/invoices`      | GET      | admin         | ✅     | Club-scoped                                                                      |
| `/api/billing/invoices/create`     | POST     | admin         | ✅     | Prüft Mitglied gehört zu Club                                                    |

---

## 9. Sicherheitsprobleme

### 9.1 Courts-API: Club-Übergreifende Erstellung möglich

**Datei:** `app/api/courts/route.ts:54-89`

**Problem:**

```ts
const body = await req.json();
const { name, surface, hasIndoor, isActive, clubId } = body;
// ... wird direkt verwendet
await courtRepo.save(court); // court enthält clubId aus Body
```

Ein Admin kann im Request-Body einen beliebigen `clubId` mitsenden und so Courts für andere Vereine anlegen. Bei Superadmin ist das okay, aber bei `admin` (Rolle 3) muss `clubId == auth.clubId` sein.

**Fix:**

```ts
// Nach dem parse von body:
if (auth.role !== 'superadmin') {
  // Admin darf nur für eigenen Club Courts anlegen
  if (clubId !== auth.clubId) {
    return forbiddenResponse('Cannot create court for a different club');
  }
  // Optional: clubId aus Body ignorieren und stattdessen auth.clubId verwenden
  // clubId = auth.clubId;
}
```

### 9.2 Sessions-Update prüft Authorization (noch offen)

**Datei:** `components/admin-court-calendar.tsx` (Drag & Drop) und `components/scheduler/page.tsx`

**Problem:** In `handleDragEnd` wird aktuell nur ein Toast angezeigt. Der eigentliche API-Call fehlt. Wenn er implementiert wird, muss prüfen:

- Admin darf alle Sessions verschieben
- Trainer darf nur **eigene** Sessions verschieben (session.trainerId === auth.user.id)

### 9.3 Courts-Lese-API prüft Zugehörigkeit?

**Datei:** `app/api/courts/[id]/schedule/route.ts:41-55`

Das ist die Schedule-API für einen Court. Dort wird geprüft:

```ts
if (court.club_id !== auth.clubId && !['admin','superadmin'].includes(...)) {
  return 403
}
```

Das ist gut. Muss bei allen Court-Zugriffen analog sein.

---

## 10. Detaillierter Action Plan

### **Sprint 1 – Court & Trainer Management (Prio 1)**

#### Aufgabe 1.1: Court CRUD UI und ergänzende API

- **Backend:**
  - `app/api/courts/[id]/route.ts` erstellen:
    - `GET`: Einen Court nach ID holen ( `select * from courts where id = :id` ), prüfen club-Zugehörigkeit (außer superadmin)
    - `PATCH`: Court updaten ( `name, number, court_type_id, surface, has_lighting, lighting_hours_start, lighting_hours_end, status, is_active` ), clubId nicht änderbar
    - `DELETE`: Soft delete `is_active = false` oder hard delete? → Soft preferiert
  - `courtService` in `lib/booking/court.service.ts` um Methoden `updateCourt`, `deleteCourt` ergänzen (falls nicht vorhanden)
- **Frontend:**
  - `app/(protected)/admin/courts/manage/page.tsx` anlegen:
    - Tabelle mit allen Courts des Clubs (für Superadmin mit selectedClubId, für Admin nur eigener Club)
    - Spalten: Name, Nummer, Typ, Oberfläche, Indoor, Status, Aktiv
    - Actions: Edit (öffnet Modal), Delete (mit Confirm), Neu (Button oben rechts)
    - Modal mit Formular (Felder wie oben, Pflichtfelder: Name, Typ, Oberfläche)
    - Dropdown für Court Types: von `/api/court-types` laden (oder statisch aus Seed)
  - ODER: `components/admin-court-calendar.tsx` um Button "+ Neuer Platz" erweitern, der Modal öffnet
- **Sidebar:**
  - Admin-Menü "Plätze" umbenennen zu **"Platzverwaltung"** und Link auf `/admin/courts/manage`
  - Option 2: Hauptmenü "Plätze" bleibt bei `/courts` (Kalender), Admin-Menü "Plätze" auf `/admin/courts/manage`. ODER: Trennpunkt: "Buchungen" und "Plätze" im Hauptmenü getrennt?
- **Tests:** E2E-Test: Admin erstellt Court, sieht Court in Kalender, kann bearbeiten/löschen

#### Aufgabe 1.2: Trainer-Profil-Management integrieren

- **Route:** `app/(protected)/admin/trainers/page.tsx` erstellen:
  ```tsx
  import TrainerProfileManagement from '@/components/trainer-profile-management';
  export default function AdminTrainersPage() {
    return <TrainerProfileManagement />;
  }
  ```
  (Komponente prüfen, ob sie admin-only ist – enthält bereits `isAdmin` Check)
- **Sidebar:** Admin-Menü "Trainer" nach "Mitglieder" einfügen (vor "Schedules")
- **API:** Prüfen, ob `/api/trainer-profiles` alle Trainer **des Clubs** zurückgibt oder alle. Falls alle, Filter nach clubId ergänzen (siehe Punkt 12). trainer-profile-management.tsx:114 lädt alle Trainer; ggf. clubId-Parameter ergänzen.
- **Berechtigung:** Trainer selbst sollten ihr Profil sehen/ändern können → ggf. separate Seite `/trainer/profile`.

#### Aufgabe 1.3: Scheduler Drag & Drop fertigstellen

- **API:** Prüfen, ob `PATCH /api/sessions/:id` existiert. Wenn nicht, erstellen:
  - `app/api/sessions/[id]/route.ts` (PATCH): aktualisiert `day_of_week`, `start_time`, ggf. `court_id`. Prüft Authorization: Trainer nur eigene Sessions (session.trainer_id === auth.user.id), Admin alle.
- **Frontend:** `scheduler/page.tsx` (für Trainer) und `admin-court-calendar.tsx` (für Admin) `handleDragEnd` vervollständigen:

  ```ts
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !schedule) return;
    const activeSession = schedule.sessions.find((s) => s.id === active.id);
    if (!activeSession) return;

    const [targetCourtId, targetDateStr, targetTimeSlot] = over.id.toString().split('-');
    // ... Umrechnung in dayOfWeek und startTime

    // API Call
    await fetch(`/api/sessions/${activeSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek: newDay, startTime: newStartTime, courtId: targetCourtId }),
    });
    // Toast + Refetch
  };
  ```

- **Authorization:** In API-Route prüfen, dass Trainer nur ihre Sessions ändern dürfen.

#### Aufgabe 1.4: Navigation aufräumen

- Sidebar `components/layout/sidebar.tsx`:
  - Hauptmenü "Plätze" → **"Platz-Kalender"** (oder "Buchungen & Plätze")
  - Admin-Menü "Plätze" → **"Platzverwaltung"** (Link zu `/admin/courts/manage`)
  - Optional: "Platz-Kalender" (Admin) als separater Admin-Menüpunkt falls CRUD getrennt bleiben soll
- Prüfen, ob `adminNav` "Plätze" doppelt eingetragen war – Entfernen einer Duplikation

#### Aufgabe 1.5: Sicherheitsfix Courts-API

- **Datei:** `app/api/courts/route.ts:POST`
- Code:

  ```ts
  const body = await req.json();
  const { name, surface, hasIndoor, isActive, clubId } = body;

  // Fix: Prüfung einbauen
  if (auth.role !== 'superadmin') {
    if (clubId !== auth.clubId) {
      return forbiddenResponse('Cannot create court for another club');
    }
    // Optional: clubId auf auth.clubId setzen, um Body-Manipulation zu ignorieren
    // clubId = auth.clubId;
  }
  ```

- Ähnliche Prüfung für PATCH/DELETE (falls implementiert)

---

### **Sprint 2 – Struktur & Konfiguration (Prio 2)**

#### Aufgabe 2.1: Court Types Management

- **DB:** Tabelle `court_types` ist vorhanden (`supabase/migrations/...sql`)
- **API:** `app/api/court-types/route.ts` erstellen:
  - GET: alle aktiven court_types
  - POST/PUT/DELETE: admin only
- **UI:** Einfache Seite `/admin/court-types` mit Tabelle (Name, Surface, Aktionen). ODER als Tab in "Platzverwaltung" integrieren
- **Seed:** Initiale Types: Sand (clay), Rasen (grass), Hartplatz (hard), Teppich (carpet)

#### Aufgabe 2.2: Pricing pro Club

- **DB Migration:** `clubs` Tabelle um `default_hourly_rate NUMERIC(10,2) DEFAULT 15.00` ergänzen
- **Settings-Seite:** `/admin/settings` erhält neues Feld "Stundenpreis (€)" im Club-Tab (nicht System)
- **API:** `PATCH /api/clubs/:id` muss `default_hourly_rate` akzeptieren + speichern (prüfen, ob bereits vorhanden)
- **Member Billing:** `components/member-billing.tsx:88-90` ersetzen:
  ```ts
  // Statt: return monthSessions.length * 15.0;
  const { data: club } = await supabase
    .from('clubs')
    .select('default_hourly_rate')
    .eq('id', clubId)
    .single();
  const rate = club?.default_hourly_rate || 15.0;
  return monthSessions.length * rate;
  ```
  (Client-seitig via Hook oder Server Component Daten laden)

#### Aufgabe 2.3: Seasons/Schedules Definition

- **Entscheidung:** Braucht man Saisons? Use Case: "Winterrunde" vs "Sommerrunde" mit unterschiedlichen Zeiten.
- Falls ja:
  - DB: Tabelle `seasons` (`id, club_id, name, start_date, end_date, is_active`)
  - API: `GET /api/seasons` (admin), `POST/PUT/DELETE`
  - UI: `/admin/seasons` (Liste + Formular)
  - Sessions um `season_id` erweitern (optional)
- Falls nein: `schedules` Tabelle klären – aktuell nur `schedule_id` in `sessions`. Vielleicht ist `schedules` bereits die Saison-Tabelle? Prüfen DB-Schema.

#### Aufgabe 2.4: Gruppen-Management (optional)

- **DB:** Tabelle `groups` (`id, club_id, name, color, max_participants`)
- **API:** CRUD
- **UI:** `/admin/groups`
- **Migration:** `sessions.group_names` → `group_id` (JSON-Array oder多了对多-Beziehung über `session_groups` Tabelle). Aufwändig; nur falls Gruppen zentral verwaltet werden müssen.

#### Aufgabe 2.5: Trainer-Profil-API komplettieren

- Prüfen, ob alle Felder aus `TrainerProfile` Interface in `trainer-profile-management.tsx` von den API-Routen unterstützt werden:
  - `qualifications` (Array mit verify)
  - `specializations` (Array)
  - `availability` (7 Tage Boolean)
  - `preferredTimeSlots` (Array)
  - `emergencyContact` (Objekt)
  - `experience` (years, previousClubs[], achievements[])
  - `status`
  - `hourlyRate`
- API-Routen prüfen:
  - `GET /api/trainer-profiles` – gibt alle Trainer? Mit Filtern?
  - `PATCH /api/trainer-profiles/:id` – akzeptiert partielle Updates?
  - `POST /api/trainer-profiles/:id/qualifications/:qualificationId/verify` – existiert
- Fehlende Felder nachrüsten oder Komponente anpassen.

---

### **Sprint 3 – UI/UX & Polishing (Prio 3)**

#### Aufgabe 3.1: Onboarding interaktiv gestalten

- `app/(protected)/admin/onboarding/page.tsx` umbauen:
  - Aus statischen Cards werden Buttons: "Verein anlegen" → `/admin/clubs`
  - Fortschritt in `localStorage` oder DB (`user_onboarding_progress`) speichern
  - Abgeschlossene Schritte als grüner Haken anzeigen

#### Aufgabe 3.2: Analytics für Superadmin multi-club

- `/admin/analytics` erweitern:
  - Wenn Superadmin mehrere Clubs hat: Dropdown "Verein auswählen" oder Tabs
  - Option: aggregierte Plattform-Statistiken (Summe aller Clubs) zusätzlich
- Backend: `GetClubAnalyticsUseCase` für mehrere Clubs aufrufen oder neuen UseCase `GetPlatformAnalytics`

#### Aufgabe 3.3: Navigation ergänzen

- Hauptmenü: "Einstellungen" oder "Profil" → `/profile` hinzufügen
- Optional: Benachrichtigungen-Glocke im Header statt Menüpunkt (realistischer)
- Trainer-Profil-Link für Trainer in Sidebar: "Mein Profil" → `/trainer/profile` (falls separat)

#### Aufgabe 3.4: Kalender-Konsistenz prüfen

- `/bookings` (Monatsansicht) und `/courts` (Wochenansicht) – beide für Mitglieder? Aktuell:
  - `/bookings` – Mitglieder buchen Sessions (Monatskalender)
  - `/courts` – Wochen-Kalender der Plätze (für alle sichtbar, aber Member buchen hier auch? Ja, court-calendar.tsx erlaubt Buchung)
  - Doppelte Funktionalität? Möglicherweise Merge: `/bookings` = Monatsansicht, `/courts` = Wochenansicht; beide zeigen Buchungsmöglichkeiten. Label klar halten: "Buchungen (Monat)" und "Plätze (Woche)".
- Einheitliche Navigation zwischen Monat/Woche in beiden Kalendern (Button "Tages-/Wochenansicht wechseln")

#### Aufgabe 3.5: Berechtigungen feiner steuern

- Scheduler (`/scheduler`): Aktuell dürfen Trainer alle Sessions verschieben (Drag & Drop). Sollten Trainer nur ihre eigenen Sessions verschieben können?
  - Frontend schon eingeschränkt? `scheduler/page.tsx` lädt `schedule` für clubId, aber zeigt alle Sessions. Drag & Drop erlaubt alle.
  - Entscheidung: Trainer → nur eigene Sessions verschiebbar; Admin → alle.
  - Umsetzung: `getSessionsForSlot` filtern nach `session.trainerId === auth.user.id` (oder `session.bookedByUser`?) Nur Sessions, bei denen Trainer = current user, sind draggable.

---

## 11. Geschätzte Aufwände

| Aufgabe                      | Aufwand (Personen-Tage) | Abhängigkeiten                                |
| ---------------------------- | ----------------------- | --------------------------------------------- |
| 1.1 Court CRUD UI + API      | 2-3                     | Court Types (2.1) empfohlen vorher            |
| 1.2 Trainer Management       | 1-2                     | API bereits vorhanden, nur Route + Nav        |
| 1.3 Scheduler DnD            | 1                       | API `PATCH /api/sessions/:id` muss existieren |
| 1.4 Navigation aufräumen     | 0.5                     | 1.1, 1.2                                      |
| 1.5 Security Fix Courts      | 0.5                     | –                                             |
| 2.1 Court Types CRUD         | 1-2                     | Unabhängig                                    |
| 2.2 Pricing pro Club         | 1-2                     | DB Migration + Settings-UI                    |
| 2.3 Seasons/Schedules        | 2-3                     | DB Migration + UI                             |
| 2.4 Gruppen-Management       | 3-4                     | DB Migration + UI + Sessions-Migration        |
| 2.5 Trainer-Profil-API       | 1-2                     | Prüfung existing API                          |
| 3.1 Onboarding interaktiv    | 1                       | –                                             |
| 3.2 Analytics multi-club     | 1-2                     | Backend UseCase erweitern                     |
| 3.3 Navigation ergänzen      | 0.5                     | –                                             |
| 3.4 Kalender-Konsistenz      | 1                       | –                                             |
| 3.5 Berechtigungen Scheduler | 0.5                     | Auth-Frontend + API                           |

**GesamtMinimum (Prio 1+ ausgewählte):** ~6-8 PT  
**Vollständig (alle Prio 1-3):** ~15-20 PT

---

## 12. Zusammenfassung – Dringlichste Maßnahmen

### Unbedingt (Prio 1)

1. ✅ **Security Fix:** `/api/courts` POST prüft club-Zugehörigkeit für non-superadmin
2. ✅ **Court CRUD:** Neue Admin-Seite "Platzverwaltung" mit List/Edit/Create + ergänzende API (`/api/courts/[id]`)
3. ✅ **Trainer Management:** Route `/admin/trainers` anlegen und Sidebar eintragen
4. ✅ **Scheduler Drag & Drop:** API `PATCH /api/sessions/:id` implementieren und Frontend-Call vervollständigen
5. ✅ **Navigation klar trennen:** "Plätze" (Kalender Member) vs "Platzverwaltung" (Admin CRUD)

### Empfohlene Reihenfolge Implementierung

1. **Sprint 1** (Woche 1-2):
   - Court CRUD (1.1) + Court Types (2.1) + Navigation (1.4) + Security Fix (1.5)
   - Trainer Management (1.2) + Scheduler Fix (1.3)
2. **Sprint 2** (Woche 3-4):
   - Pricing pro Club (2.2) + Seasons (2.3) nach Bedarf
   - Trainer-Profil-API prüfen (2.5)
3. **Sprint 3** (Woche 5-6):
   - Onboarding interaktiv (3.1) + Analytics erweitern (3.2)
   - Kalender-Konsistenz (3.4) + Profil-Link (3.3)

---

## 13. Offene Fragen / Entscheidungsbedarf

| Frage                                                       | Option A                                | Option B                            | Empfehlung                                                          |
| ----------------------------------------------------------- | --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Court CRUD als separate Seite oder als Modal über Kalender? | Separate `/admin/courts/manage` Tabelle | Modal über `/admin/courts` Kalender | Separate Seite, übersichtlicher bei vielen Courts                   |
| Scheduler: Trainer dürfen nur eigene Sessions verschieben?  | Ja                                      | Nein (alle)                         | Ja (Security + Usability)                                           |
| Gruppen als separate Entität?                               | Ja (zentral)                            | Nein (freitext in Sessions)         | Nein, zu aufwändig; erst wenn echte Gruppenverwaltung benötigt      |
| Seasons benötigt?                                           | Ja (Saisonzeiten)                       | Nein (nur Sessions)                 | Prüfen mit Product; aktuell nur `schedules` Tabelle, aber ungenutzt |
| Member-Billing Preis nur pro Club oder pro Court?           | Pro Club (einfach)                      | Pro Court (flexibel)                | Pro Club, da Courts meist gleiche Preise haben                      |
| Analytics für Superadmin: Aggregiert oder Club-Auswahl?     | Aggregiert (Summe aller)                | Pro Club auswählbar                 | Beides: Default aggregiert, mit Filter pro Club                     |

---

## 14. Nächste Schritte (Stories)

1. **[SEC-001]** Courts-API: POST/PATCH clubId prüfen für non-superadmin
2. **[CRUD-001]** Court Types CRUD API (falls noch nicht)
3. **[UI-001]** Seite `/admin/courts/manage` mit Court-Tabelle (List, Create, Edit Modal)
4. **[UI-002]** Sidebar: "Plätze" → "Platz-Kalender" (Hauptmenü) und "Platzverwaltung" (Admin)
5. **[UI-003]** Seite `/admin/trainers` anlegen
6. **[API-001]** PATCH `/api/sessions/:id` implementieren + Authorization (Trainer nur eigene, Admin alle)
7. **[UI-004]** Scheduler Drag & Drop Call einbauen (`scheduler/page.tsx` und `admin-court-calendar.tsx`)
8. **[CONFIG-001]** Clubs-Tabelle: `default_hourly_rate` Spalte + API-Update + Settings-UI
9. **[FIX-001]** Member-Billing: Preis aus Club-Einstellung lesen
10. **[UI-005]** Onboarding Buttons "Jetzt einrichten"
11. **[UI-006]** Analytics: Superadmin Club-Auswahl oder Aggregation
12. **[NAV-001]** Profil-Link in Sidebar einfügen
13. **[TEST-001]** E2E-Tests für Court CRUD und Trainer Management ergänzen

---

## 15. Referenzen

**Wichtige Dateien:**

- `lib/api-auth.ts` – Auth Context, Rollen, Club-Zugriff
- `components/layout/sidebar.tsx` – Navigation
- `app/api/courts/route.ts` – Courts API (nur GET Liste + POST)
- `lib/booking/court.service.ts` – Court Service
- `components/admin-court-calendar.tsx` – Admin Kalender mit DnD
- `components/trainer-profile-management.tsx` – Trainer-Komponente
- `app/(protected)/admin/settings/page.tsx` – Einstellungen (Preis hier einfügen)
- `components/member-billing.tsx` – Member Rechnungen (Preis hartkodiert)

**DB-Tabellen (aus Migrations):**

- `clubs` – Vereine
- `courts` – Plätze
- `court_types` – Platz-Typen
- `user_club_memberships` – Rollen
- `sessions` – Trainingseinheiten
- `bookings` – Buchungen
- `trainer_profiles` – Trainerprofile
- `seasons` – (existiert? prüfen)
- `groups` – (existiert nicht)

---

**Audit abgeschlossen am:** 2026-05-05  
**Nächste Review:** Nach Sprint 1 Abschluss
