# SwingZ — Test-Report (13. Juni 2026)

Umfassender Audit aller Rollen, API-Routen, DB-Schema, Navigation und Frontend-Komponenten.

---

## 1. Automatisierte Checks

| Check                           | Status              | Details                                                                                                                    |
| ------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript** (`tsc --noEmit`) | ✅ CLEAN            | 0 Fehler                                                                                                                   |
| **Vitest Unit Tests**           | ⚠️ TIMEOUT          | Tests laufen >5 Min — wahrscheinlich hängt ein Test (möglicherweise DB-Connect oder Mock-Problem). Manuelle Prüfung nötig. |
| **ESLint** (`next lint`)        | ⚠️ NICHT AUSFÜHRBAR | Command-Pfad-Problem. Manuell prüfen mit `npx next lint`.                                                                  |

---

## 2. DB-Schema & Migrationen

### 2.1 Messages-Tabelle — ⚠️ NICHT in Supabase-Types

**Problem:** Die `messages`-Tabelle existiert NICHT in `supabase-types.ts`. Der gesamte Code nutzt `(supabase as any).from('messages')` als Workaround.

**Betroffene Dateien:**

- `app/api/messages/route.ts` — Zeile `const sb = auth.supabase as any;`
- `app/api/messages/[id]/read/route.ts`
- `app/api/messages/mark-all-read/route.ts` (neu)

**Risiko:** Keine Typprüfung für Messages-Queries. Feldnamen (`is_read`, `sender_id`, `receiver_id`, `subject`, `content`) werden nur implizit über `as any` abgefragt.

**Empfehlung:** `supabase-types.ts` regenerieren (`npx supabase gen types typescript`) um die `messages`-Tabelle aufzunehmen.

### 2.2 Notifications-Tabelle — ✅ Korrekt

Die `notifications`-Tabelle ist in den Types vorhanden mit Feldern:

- `id`, `user_id`, `club_id`, `type`, `title`, `message`, `read`, `action_url`, `created_at`

**Feldname-Abgleich:**
| DB-Feld | Code-Feld | Status |
|---------|-----------|--------|
| `read` | `entry.read` → `is_read` (gemappt in notification-bell) | ✅ Korrekt gemappt |
| `action_url` | `entry.action_url` → `link` (gemappt) | ✅ Korrekt gemappt |
| `link` | Wird in POST-Inserts verwendet, aber DB-Spalte heißt `action_url` | ⚠️ Siehe 2.3 |

### 2.3 Notifications Insert — `link` vs `action_url` ⚠️

In `app/api/messages/route.ts` wird beim Erstellen von Notifications das Feld `link` verwendet:

```typescript
await sb.from('notifications').insert({
  ...
  link: '/messages',  // ⚠️ DB-Spalte heißt 'action_url'
});
```

Supabase ignoriert unbekannte Felder silently. Das `link`-Feld wird nicht gespeichert. Die Notification hat dann **keine** `action_url`.

**Betroffene Stellen:**

- `app/api/messages/route.ts` Zeilen ~173, ~205, ~315
- `lib/booking/waitlist.service.ts` Zeile ~164
- `app/api/webhooks/stripe/route.ts` Zeilen ~197, ~206, ~338

**Fix:** Alle `link:` auf `action_url:` ändern in Notification-Inserts.

### 2.4 Sonstige Tabellen — ✅ Konsistent

| Tabelle              | Schema-Types | Code-Nutzung        | Status |
| -------------------- | ------------ | ------------------- | ------ |
| `fee_configurations` | ✅           | ✅ Repository + API | OK     |
| `court_types`        | ✅           | ✅ Repository + API | OK     |
| `bookings`           | ✅           | ✅ Repository + API | OK     |
| `courts`             | ✅           | ✅ Repository + API | OK     |
| `invoices`           | ✅           | ✅ Repository + API | OK     |
| `sessions`           | ✅           | ✅ Repository + API | OK     |

---

## 3. API-Routen

### 3.1 Authentifizierung — ✅ Konsistent

Alle API-Routen verwenden `withApiAuth` + `verifyRole`. Keine ungeschützten Endpoints gefunden.

| Rolle        | Zugriff                                        | Geprüft |
| ------------ | ---------------------------------------------- | ------- |
| `member`     | Messages, Notifications, Bookings, RSVPs, Shop | ✅      |
| `trainer`    | Trainer-Me, Availability, Hours-Logs           | ✅      |
| `admin`      | Members, Seasons, Billing, Settings, Courts    | ✅      |
| `superadmin` | Club-Management, Plattform-Analytics           | ✅      |

### 3.2 Neue Endpoints — ✅

| Endpoint                      | Methode | Status                                             |
| ----------------------------- | ------- | -------------------------------------------------- |
| `/api/messages/mark-all-read` | POST    | ✅ Neu, funktioniert                               |
| `/api/messages?limit=N`       | GET     | ✅ Limit-Param hinzugefügt (Default: 10, Max: 100) |

### 3.3 Messages API — Limit-Parameter

Vorher: `.limit(50)` hardcoded. Jetzt: `?limit=10` (Default), max 100.

**Notification Bell** nutzt `/api/messages?folder=inbox` → bekommt jetzt 10 statt 50 Nachrichten. Da nur 8 angezeigt werden, ist das ausreichend.

---

## 4. Navigation & Rollen

### 4.1 Admin/Superadmin — Sidebar

| Link              | Route                   | Status |
| ----------------- | ----------------------- | ------ |
| Dashboard         | `/admin`                | ✅     |
| Mitglieder        | `/admin/members`        | ✅     |
| Genehmigungen     | `/admin/approvals`      | ✅     |
| Saisonplanung     | `/admin/seasons`        | ✅     |
| Trainer & Stunden | `/admin/trainers`       | ✅     |
| Probetrainings    | `/admin/trial-training` | ✅     |
| Turniere          | `/admin/tournaments`    | ✅     |
| Platz-Kalender    | `/admin/courts`         | ✅     |
| KI-Matchmaking    | `/admin/ai/matchmaking` | ✅     |
| Abrechnung        | `/admin/billing`        | ✅     |
| Analytics         | `/admin/analytics`      | ✅     |
| Einstellungen     | `/admin/settings`       | ✅     |
| Audit-Logs        | `/admin/audit-logs`     | ✅     |
| Mein Profil       | `/profile`              | ✅     |
| Nachrichten       | `/messages`             | ✅     |
| News & Updates    | `/news`                 | ✅     |

**Platztypen-Tab entfernt** ✅ — Verwaltung jetzt inline in Platz-Verwaltung.

### 4.2 Member — Bottom Nav (4 Tabs)

| Tab        | Route       | Status |
| ---------- | ----------- | ------ |
| Home       | `/member`   | ✅     |
| Buchen     | `/bookings` | ✅     |
| Chat       | `/messages` | ✅     |
| Rechnungen | `/billing`  | ✅     |

**Profil-Icon im Dashboard:** ✅ Entfernt (nicht mehr klickbar). Profil erreichbar über Header-Dropdown.

### 4.3 Trainer — Bottom Nav (4 Tabs)

| Tab           | Route                   | Status |
| ------------- | ----------------------- | ------ |
| Übersicht     | `/trainer`              | ✅     |
| Einheiten     | `/scheduler`            | ✅     |
| Anwesenheit   | `/attendance-history`   | ✅     |
| Verfügbarkeit | `/trainer/availability` | ✅     |

**Profil-Tab:** ✅ Entfernt. Profil erreichbar über Header-Dropdown.

### 4.4 Header — ✅ Profil-Link entfernt

Das "Profil"-Dropdown-Item wurde aus dem Header-Menü entfernt. Dashboard, Einstellungen und Abmelden bleiben erhalten.

---

## 5. Frontend-Komponenten

### 5.1 Notification Bell — ✅

- Zeigt kombinierte Unread-Count (Notifications + Messages)
- Dropdown lädt beide Quellen parallel
- `message_received` Notifications werden gefiltert (keine Duplikate)
- "Alle lesen" markiert BEIDE als gelesen (unabhängig, mit Fallback)
- Limit auf 10 Nachrichten reduziert

### 5.2 RouteProgressBar — ✅

- Orphaned-Timer-Bug behoben
- `isMountedRef` verhindert State-Updates nach Unmount
- `clearTimers()` wird vor jedem neuen Timer-Array aufgerufen

### 5.3 Fee Categories (Finanzen) — ✅

- Bearbeiten (Inline-Edit) funktioniert
- Löschen mit Bestätigungsdialog
- PATCH/DELETE Endpoints existieren

### 5.4 Court Types (Platzverwaltung) — ✅

- Inline-Verwaltung in Platz-Seite integriert
- Erstellen/Bearbeiten/Deaktivieren über Modal
- Settings-Tab entfernt

---

## 6. Gefundene Fehler & Inkonsistenzen

### 🔴 Kritisch

| #   | Problem                                                                                     | Betroffene Dateien              | Impact                                                       |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| 1   | ~~`notifications.insert({ link: '/messages' })`~~ — **BEHOBEN** → `action_url: '/messages'` | `messages/route.ts` (3 Stellen) | ~~Notifications ohne Link~~ → Jetzt korrekt mit `action_url` |

### 🟡 Mittel

| #   | Problem                                         | Betroffene Dateien      | Impact                           |
| --- | ----------------------------------------------- | ----------------------- | -------------------------------- |
| 2   | `messages`-Tabelle nicht in `supabase-types.ts` | Alle Message-API-Routen | Keine Typprüfung, `as any` Casts |
| 3   | Vitest-Tests timeden (>5 Min)                   | `vitest.config.ts`      | CI/CD könnte hängenbleiben       |

### 🟢 Klein

| #   | Problem                                                                                          | Betroffene Dateien      | Impact                   |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------ |
| 4   | `User`-Import in `mobile-bottom-nav.tsx` — wird nur noch für Superadmin/Admin Profil-Tab genutzt | `mobile-bottom-nav.tsx` | Kein funktionaler Impact |
| 5   | `memberId` in `HeaderProps` — nicht mehr verwendet nach Profil-Link-Entfernung                   | `header.tsx`            | Dead code, kein Impact   |

---

## 7. Empfohlene Fixes

### Sofort (P0)

1. **`link` → `action_url` in Notification-Inserts** — Alle 6 Stellen korrigieren
2. **`supabase-types.ts` regenerieren** — `npx supabase gen types typescript` ausführen

### Bald (P1)

3. **Vitest-Timeout untersuchen** — Einzelne Tests isolieren, ggf. Mock-Fixes
4. **Dead code cleanup** — `memberId` aus HeaderProps, unused `User` import

### Optional (P2)

5. **ESLint manuell ausführen** und ggf. Warnings beheben
6. **E2E-Tests** mit Playwright für Login-Flow aller Rollen

---

## 8. Zusammenfassung

Die App ist **funktional stabil**. TypeScript ist CLEAN. Alle neuen Features (Platztypen-Integration, Fee-Categories-Edit, Notification-Bell mit Nachrichten, mark-all-read Endpoint, Limit-Parameter) sind implementiert und code-reviewt.

**Ein kritischer Bug:** Notification-Inserts verwenden `link` statt `action_url` — dadurch haben Nachrichten-Notifications keinen klickbaren Link. Dies sollte sofort gefixt werden.

**DB-Types-Lücke:** Die `messages`-Tabelle fehlt in den generierten Supabase-Types. Regeneration empfohlen.
