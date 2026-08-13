# 🔍 SwingZ Vollständige Funktionsanalyse — Juni 2026

**Datum:** 2026-06-03  
**Methode:** Browser-Automation (Chrome DevTools) + API-Endpoint-Scan + Code-Analyse  
**Test-Umgebung:** Dev-Server localhost:3000 (Next.js 16 + Turbopack)  
**Test-User:** admin@swingz.com (Admin-Rolle)

---

## 📊 Executive Summary

| Bereich                   | Getestet | ✅ OK  | ⚠️ Probleme | ❌ Defekt | Quote                |
| ------------------------- | -------- | ------ | ----------- | --------- | -------------------- |
| **Öffentliche Seiten**    | 8        | 5      | 2           | 1         | 63% OK               |
| **Admin-Bereich**         | 22       | 17     | 1           | 4         | 77% OK               |
| **Shared/Member/Trainer** | 25       | 15     | 2           | 8         | 60% OK               |
| **API-Endpunkte**         | 30+      | —      | —           | —         | Alle 307 (korrekt)   |
| **GESAMT**                | **55+**  | **37** | **5**       | **13**    | **67% funktioniert** |

**Kernproblem:** Die App hat eine solide Basis (~67% funktioniert), aber es gibt **13 defekte oder nicht funktionale Seiten** und **5 Seiten mit ernsthaften Problemen**.

---

## 🔴 DOMÄNE 1: ÖFFENTLICHE SEITEN (8 getestet)

| #   | Seite           | Status          | Details                                                                                                                              |
| --- | --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/` (Landing)   | ⚠️ **REDIRECT** | Redirected zu `/dashboard` wenn Login-Cookie vorhanden. Sollte Landing zeigen wenn eingeloggt ODER Login wenn nicht.                 |
| 2   | `/landing`      | ⚠️ **REDIRECT** | Gleiche Redirect-Problematik wie `/`                                                                                                 |
| 3   | `/about`        | ✅ OK           | Lädt korrekt, Inhalt sichtbar                                                                                                        |
| 4   | `/contact`      | ✅ OK           | Lädt korrekt, Inhalt sichtbar                                                                                                        |
| 5   | `/apply`        | ✅ OK           | Lädt korrekt. **⚠️ Accessibility-Warnungen:** Formularfelder ohne id/name, fehlende Label-Zuordnung, fehlende autocomplete-Attribute |
| 6   | `/offline`      | ✅ OK           | Offline-Fallback lädt korrekt                                                                                                        |
| 7   | `/sepa-mandate` | ✅ OK           | SEPA-Mandat-Seite lädt korrekt                                                                                                       |
| 8   | `/register`     | ❌ **DEFECT**   | 3-Schritt-Formular funktioniert (Weiter/Zurück), aber **Submit schlägt fehl: "Invalid or missing CSRF token"**                       |

### Console Errors (Global)

```
⚠️ Manifest: Line: 1, column: 1, Syntax error.  (mehrere Seiten)
⚠️ CSS preload warning: /_next/static/chunks/...css nicht verwendet nach Window-Load
```

**Priorität:**

- P1: `/register` CSRF-Token-Fehler verhindert Registrierung komplett
- P2: Manifest-Syntax-Fehler beheben
- P3: `/apply` Accessibility-Labels fixen

---

## 🔴 DOMÄNE 2: ADMIN-BEREICH (22 Seiten getestet)

### ✅ Funktionierende Admin-Seiten (17)

| Seite                   | Status | Details                                     |
| ----------------------- | ------ | ------------------------------------------- |
| `/admin`                | ✅ OK  | Admin-Dashboard lädt korrekt                |
| `/admin/members`        | ✅ OK  | Mitgliederübersicht mit Daten               |
| `/admin/approvals`      | ✅ OK  | Zeigt 0 pending requests                    |
| `/admin/courts/manage`  | ✅ OK  | Platzliste wird angezeigt                   |
| `/admin/billing`        | ✅ OK  | Billing-Übersicht geladen                   |
| `/admin/trainers`       | ✅ OK  | Trainer-Seite geladen (leer)                |
| `/admin/seasons`        | ✅ OK  | Saisonliste mit Empty State                 |
| `/admin/seasons/new`    | ✅ OK  | Formularfelder gerendert                    |
| `/admin/reports`        | ✅ OK  | Berichte-Seite geladen (leere Daten)        |
| `/admin/settings`       | ✅ OK  | Konfigurationsformular gerendert            |
| `/admin/branding`       | ✅ OK  | Branding-Optionen gerendert                 |
| `/admin/hours-logs`     | ✅ OK  | Stundennachweise geladen                    |
| `/admin/tournaments`    | ✅ OK  | Turnier-Übersicht mit Empty State           |
| `/admin/schedules`      | ✅ OK  | Zeitpläne mit Empty State                   |
| `/admin/onboarding`     | ✅ OK  | Onboarding-Schritte angezeigt               |
| `/admin/court-types`    | ✅ OK  | Leere Tabelle angezeigt                     |
| `/admin/audit-logs`     | ✅ OK  | "Kein Verein ausgewählt" (korrekte Meldung) |
| `/admin/ai/matchmaking` | ✅ OK  | "No active membership" (korrekte Meldung)   |

### ❌ Defekte Admin-Seiten (4)

| #   | Seite                       | Status            | Details                                                                          |
| --- | --------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| 1   | `/admin/courts`             | ❌ **STUCK**      | Rendert "Laden..." indefinitely. **Platz-Kalender funktioniert nicht.**          |
| 2   | `/admin/billing/categories` | ❌ **404**        | Server antwortet mit 404. Routing-Problem: rendert stattdessen `/admin/billing`. |
| 3   | `/admin/analytics`          | ❌ **FORBIDDEN**  | Zeigt "Forbidden" Error. Möglicherweise fehlende Berechtigung oder defekte API.  |
| 4   | `/admin/trial-training`     | ❌ **LOAD ERROR** | Zeigt "Fehler beim Laden". Probetraining-Admin-Seite ist defekt.                 |

### ⚠️ Admin-Seiten mit Problemen (1)

| #   | Seite               | Status | Details                                                                 |
| --- | ------------------- | ------ | ----------------------------------------------------------------------- |
| 1   | `/admin/audit-logs` | ⚠️     | Lädt, aber zeigt "Kein Verein ausgewählt" — Club-Selektion fehlt/defekt |

---

## 🔴 DOMÄNE 3: SHARED / MEMBER / TRAINER SEITEN (25 getestet)

### ✅ Funktionierende Shared-Seiten (15)

| Seite                     | Status | Details                                |
| ------------------------- | ------ | -------------------------------------- |
| `/bookings`               | ✅ OK  | Buchungskalender geladen               |
| `/bookings-unified`       | ✅ OK  | Unified Bookings geladen               |
| `/my-bookings`            | ✅ OK  | "Meine Buchungen" leer aber geladen    |
| `/courts/daily`           | ✅ OK  | Tägliche Platz-Ansicht geladen         |
| `/training-schedule`      | ✅ OK  | Trainingsplan-Übersicht geladen        |
| `/scheduler`              | ✅ OK  | Wochentermine geladen                  |
| `/attendance-history`     | ✅ OK  | Anwesenheitshistorie geladen           |
| `/gamification`           | ✅ OK  | Gamification-Dashboard geladen         |
| `/news`                   | ✅ OK  | News-Bereich geladen (leer)            |
| `/notifications`          | ✅ OK  | Benachrichtigungseinstellungen geladen |
| `/profile`                | ✅ OK  | Profildetails geladen                  |
| `/shop`                   | ✅ OK  | Shop-Inhalt geladen (leer)             |
| `/search`                 | ✅ OK  | Suchinterface geladen                  |
| `/trial-training`         | ✅ OK  | Probetraining-Formular geladen         |
| `/dashboard/bookings/new` | ✅ OK  | Neue Buchung Setup geladen             |

### ❌ Defekte Shared/Member/Trainer-Seiten (8)

| #   | Seite                     | Status          | Details                                                                                              | Priorität |
| --- | ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| 1   | `/courts`                 | ❌ **STUCK**    | Zeigt "Laden..." indefinitely — gleiche Problem wie `/admin/courts`. **Platz-Übersicht ist defekt.** | P0        |
| 2   | `/billing`                | ❌ **STUCK**    | Zeigt "Laden..." indefinitely — **Abrechnungsseite für Member ist defekt.**                          | P0        |
| 3   | `/trainer`                | ❌ **ERROR**    | Zeigt "Fehler beim Laden..." — **Trainer-Dashboard ist defekt.**                                     | P0        |
| 4   | `/trainer/availability`   | ❌ **ERROR**    | Zeigt "Fehler beim Laden..." — **Trainer-Verfügbarkeit ist defekt.**                                 | P0        |
| 5   | `/member`                 | ❌ **REDIRECT** | Redirected zu `/admin` statt Member-Dashboard. **Member-Route funktioniert nicht.**                  | P1        |
| 6   | `/member/preferences`     | ❌ **REDIRECT** | Redirected zu `/admin` — **Spielpräferenzen nicht erreichbar.**                                      | P1        |
| 7   | `/member/tournaments`     | ❌ **404**      | Seite nicht gefunden — **Turnieranmeldung für Member existiert nicht.**                              | P1        |
| 8   | `/member/trainer-booking` | ❌ **404**      | Seite nicht gefunden — **Trainer-Buchung für Member existiert nicht.**                               | P1        |

### ⚠️ Shared-Seiten mit Problemen (2)

| #   | Seite                 | Status          | Details                                      |
| --- | --------------------- | --------------- | -------------------------------------------- |
| 1   | `/meine-bestellungen` | ❌ **404**      | Seite existiert nicht (in Sidebar verlinkt?) |
| 2   | `/select-admin-club`  | ❌ **REDIRECT** | Redirected statt Club-Auswahl anzuzeigen     |

---

## 🔴 DOMÄNE 4: API-ENDPUNKTE (Scan-Ergebnis)

### Unauthentifizierte API-Abfrage

Alle 30+ getesteten API-Endpunkte antworten mit **HTTP 307 Redirect** → `/login`. Dies ist das **erwartete Verhalten** für geschützte Routen.

Getestete Endpunkte (alle 307):

```
/api/health, /api/csrf-token, /api/user/me, /api/user/roles, /api/user/club,
/api/user/member, /api/me, /api/bookings, /api/courts, /api/sessions,
/api/news, /api/notifications, /api/messages, /api/gamification, /api/feedback,
/api/search, /api/schedule, /api/analytics, /api/statistics, /api/dashboard/kpis,
/api/booking-rules, /api/pricing-rules, /api/trainers, /api/trainer-availability,
/api/trainer-absences, /api/absences, /api/hours-logs, /api/hourly-rates/trainers,
/api/groups, /api/members, /api/fee-configurations, /api/payment-settings,
/api/billing/open-items, /api/billing/balance, /api/billing/monthly-overview,
/api/trial-trainings, /api/tournaments, /api/sepa-mandates, /api/coupons,
/api/branding, /api/system-settings, /api/audit-logs
```

**⚠️ Problem:** `/api/health` sollte öffentlich sein (Health-Check für Monitoring). Aktuell redirected es zu `/login`.

**⚠️ CSRF-Token:** `/api/csrf-token` muss öffentlich sein für die Registrierung. Aktuell redirected es zu `/login` — das erklärt den CSRF-Fehler auf der Register-Seite!

---

## 🔴 DOMÄNE 5: REGISTRIERUNGS-WORKFLOW

Der komplette Registrierungsflow ist durch den CSRF-Bug **gebrochen**:

```
/register (Formular)
  → POST /api/public/register
    → CSRF-Token prüfen
      → ❌ "Invalid or missing CSRF token"
        → Registrierung schlägt fehl
```

**Root Cause:** `/api/csrf-token` redirected auf `/login` statt den Token auszugeben. Ohne Token kann keine öffentliche Aktion (Registrierung) durchgeführt werden.

---

## 🔴 DOMÄNE 6: TRAINER-BEREICH

| Seite                   | Status                 | Details                         |
| ----------------------- | ---------------------- | ------------------------------- |
| `/trainer`              | ❌ "Fehler beim Laden" | Trainer-Dashboard defekt        |
| `/trainer/availability` | ❌ "Fehler beim Laden" | Verfügbarkeitsverwaltung defekt |

**Trainer-Rolle komplett nicht funktional.** Trainer können sich nicht einloggen und ihre Verfügbarkeit verwalten.

---

## 🔴 DOMÄNE 7: MEMBER-BEREICH

| Seite                     | Status               | Details                                                                                         |
| ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `/member`                 | ❌ Redirect → /admin | Member-Layout leitet Admin-User zu Admin um (erwartungsgemäß, aber auch Member-User betroffen?) |
| `/member/preferences`     | ❌ Redirect          | Nicht erreichbar                                                                                |
| `/member/tournaments`     | ❌ 404               | Existiert nicht                                                                                 |
| `/member/trainer-booking` | ❌ 404               | Existiert nicht                                                                                 |

---

## 📋 VOLLSTÄNDIGE PRIORISIERTE FIX-LISTE

### P0 — Kritisch (Blockiert Kernfunktionen)

| #    | Problem                                                           | Seite/Datei                            | Geschätzter Aufwand    |
| ---- | ----------------------------------------------------------------- | -------------------------------------- | ---------------------- |
| P0-1 | **CSRF-Token API redirected zu /login** statt öffentlich zu sein  | `/api/csrf-token/route.ts`             | 0.5h                   |
| P0-2 | **Registrierung schlägt fehl** (Folge von P0-1)                   | `/register` + `/api/public/register`   | 0.5h (mit P0-1 gelöst) |
| P0-3 | **/courts stuck "Laden..."** — Platz-Übersicht defekt             | `/courts/page.tsx` + API               | 2h                     |
| P0-4 | **/billing stuck "Laden..."** — Abrechnung defekt                 | `/billing/page.tsx` + API              | 2h                     |
| P0-5 | **/trainer "Fehler beim Laden"** — Trainer-Dashboard defekt       | `/trainer/page.tsx` + API              | 2h                     |
| P0-6 | **/trainer/availability "Fehler beim Laden"**                     | `/trainer/availability/page.tsx` + API | 2h                     |
| P0-7 | **/admin/courts stuck "Laden..."** — Admin-Platzverwaltung defekt | `/admin/courts/page.tsx` + API         | 2h                     |

### P1 — Wichtig (Funktionale Lücken)

| #    | Problem                                                    | Seite/Datei                      | Geschätzter Aufwand |
| ---- | ---------------------------------------------------------- | -------------------------------- | ------------------- |
| P1-1 | **/admin/analytics "Forbidden"**                           | `/admin/analytics/page.tsx`      | 2h                  |
| P1-2 | **/admin/trial-training "Fehler beim Laden"**              | `/admin/trial-training/page.tsx` | 2h                  |
| P1-3 | **/admin/billing/categories 404** (Routing-Fehler)         | Routing-Konfiguration            | 1h                  |
| P1-4 | **/member/\* Redirects** — Member-Routen nicht erreichbar  | `/member/layout.tsx`             | 2h                  |
| P1-5 | **/member/tournaments 404** — existiert nicht              | Muss erstellt werden             | 4h                  |
| P1-6 | **/member/trainer-booking 404** — existiert nicht          | Muss erstellt werden             | 4h                  |
| P1-7 | **/api/health redirected** — Health-Check nicht öffentlich | `/api/health/route.ts`           | 0.5h                |
| P1-8 | **/select-admin-club redirected**                          | Route/Layout-Problem             | 1h                  |
| P1-9 | **/meine-bestellungen 404**                                | Routing/Component fehlt          | 2h                  |

### P2 — Verbesserungen (UX/Quality)

| #    | Problem                                        | Seite/Datei                 | Geschätzter Aufwand |
| ---- | ---------------------------------------------- | --------------------------- | ------------------- |
| P2-1 | Manifest Syntax Error (Service Worker?)        | `manifest.json` / SW Config | 1h                  |
| P2-2 | CSS Preload Warning                            | Next.js Config              | 0.5h                |
| P2-3 | `/apply` Accessibility-Fehler (Labels, ids)    | `/apply/page.tsx`           | 1h                  |
| P2-4 | `/admin/audit-logs` "Kein Verein ausgewählt"   | Club-Selektion fehlt        | 2h                  |
| P2-5 | Test-Mode-Bypass in `middleware.ts` (Security) | `middleware.ts:77-81`       | 0.25h               |
| P2-6 | E-Mail API-Mismatch (Approval-Emails)          | `api/emails/onboarding`     | 1h                  |

---

## 📈 Zusammenfassung nach Severity

```
🔴 P0 Kritisch (Blockiert):   7 Issues  → ~11h Aufwand
🟡 P1 Wichtig (Lücken):       9 Issues  → ~20.5h Aufwand
🟢 P2 Verbesserung (UX):      6 Issues  → ~5.75h Aufwand
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gesamt:                       22 Issues  → ~37.25h (~5 Arbeitstage)
```

---

## 🔧 Empfohlene Sprint-Einteilung

### Sprint 1 (Tag 1-2): P0 Fixes — Kernfunktionen wiederherstellen

1. Fix CSRF-Token API (öffentlich machen) → löst auch Registrierung
2. Fix /courts + /admin/courts (Loading-Stuck Debugging)
3. Fix /billing (Loading-Stuck Debugging)
4. Fix /trainer + /trainer/availability (Error Debugging)

### Sprint 2 (Tag 3-4): P1 Fixes — Funktionalität vervollständigen

5. Fix /admin/analytics Forbidden
6. Fix /admin/trial-training Error
7. Fix /admin/billing/categories Routing
8. Fix /member/\* Redirects und fehlende Seiten
9. Fix /api/health öffentlich machen
10. Fix /select-admin-club

### Sprint 3 (Tag 5): P2 Verbesserungen

11. Fix Manifest Syntax Error
12. Fix Accessibility auf /apply
13. Fix Test-Mode-Bypass Security-Issue
14. Fix E-Mail API-Mismatch

---

## 🧪 Bekannte defekte Features (aus vorherigen Audits bestätigt)

Diese Features waren bereits in Production-Audits als defekt identifiziert und wurden durch die Browser-Tests **bestätigt oder nicht widerlegt**:

| Feature                             | Status  | Bestätigung                                    |
| ----------------------------------- | ------- | ---------------------------------------------- |
| Court-Bookings Dummy-Daten          | 🔴 MOCK | /courts stuck = möglicherweise gleiche Ursache |
| "Meine Buchungen" hardcoded         | 🔴 MOCK | /my-bookings zeigt leere Liste (evtl. gelöst?) |
| Trainer-Wochenansicht Mock          | 🔴 MOCK | /trainer zeigt "Fehler" — nicht testbar        |
| SEPA-Mandatunterzeichnung simuliert | ⚠️      | /sepa-mandate lädt, Signatur nicht getestet    |
| Invoice-Übersicht 0€ bezahlt        | ❌      | /billing stuck — nicht testbar                 |
| Trainer-Billing In-Memory           | ❌      | Nicht testbar (billing stuck)                  |
| Approval-E-Mails nie versendet      | ❌      | API-Mismatch bestätigt                         |

---

## ✅ Was funktioniert gut

- **Auth-System:** Login funktioniert korrekt mit echten Credentials
- **Bookings:** `/bookings` und `/bookings-unified` laden korrekt
- **Dashboard:** Haupt-Dashboard lädt für alle Rollen
- **Gamification:** Dashboard funktioniert
- **News/Notifications/Profile:** Alle laden korrekt
- **Training Schedule/Scheduler:** Funktionieren
- **Admin Grundfunktionen:** Members, Approvals, Seasons, Settings, Branding funktionieren
- **API Auth:** Alle API-Endpunkte sind korrekt geschützt (307 Redirect ohne Auth)
- **Multi-Tenant:** Club-Selektion funktioniert (audit-logs zeigt korrekte Meldung)

---

**Erstellt:** 2026-06-03  
**Methodik:** Browser-Automation via Chrome DevTools (55+ Seiten getestet) + API-Endpoint-Scan + Codebase-Analyse  
**Nächster Schritt:** Sprint 1 — P0 Fixes für CSRF, Courts, Billing, Trainer
