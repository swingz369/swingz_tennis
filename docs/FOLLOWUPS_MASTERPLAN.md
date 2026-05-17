# SWINGZ Follow-Up Masterplan

> **Erstellt:** 2026-05-13  
> **Basis:** UMFASSENDE_PROJEKTANALYSE_2026.md + SWINGZ_EXECUTION_ROADMAP.md  
> **Gesamtpunkte:** 50 | **Geschätzter Aufwand:** 40-58 Wochen

---

## ✅ Bereits erledigt (Punkte 1-12 aus der Analyse)

| #   | Punkt                                                           | Status |
| --- | --------------------------------------------------------------- | ------ |
| 1   | Stripe Integration (Checkout, Webhooks, Payment Flow)           | ✅     |
| 2   | Season Planning (Migration, API, UI)                            | ✅     |
| 3   | Email System (Resend Configuration)                             | ✅     |
| 4   | PWA Icons (192x192 + 512x512, Tennis-themed)                    | ✅     |
| 5   | Type Safety (any-Types eliminiert in Entities, Services, Audit) | ✅     |
| 6   | DB Performance Indexes (Composite + pg_trgm Full-Text)          | ✅     |
| 7   | Server Components Migration (Dashboard, Members, Bookings)      | ✅     |
| 8   | Cache Strategy (differenzierte TTLs, Server Cache)              | ✅     |
| 9   | PDF Invoice Generation (React-PDF Templates)                    | ✅     |
| 10  | KI Features V2 (Schedule Generator mit Claude/OpenAI + Retry)   | ✅     |
| 11  | Internal Messaging System (DB + API + Inbox UI)                 | ✅     |
| 12  | Push Notifications + In-App Notification Center                 | ✅     |

---

## 🔴 HIGH PRIORITY – Phase 2: Must-Have Completion (Punkte 13-35)

### Platzbuchungssystem (13-15)

| #   | Punkt                                                       | Aufwand | Priorität   | Abhängigkeiten             |
| --- | ----------------------------------------------------------- | ------- | ----------- | -------------------------- |
| 13  | Court-Kalender UI – Wochen-/Tagesansicht mit Drag & Drop    | 3-4d    | ⚡ Kritisch | courts table, bookings API |
| 14  | ICS/Google Calendar Export für Buchungen                    | 1-2d    | 🔥 Hoch     | bookings API               |
| 15  | Waiting List Management – Warteliste für ausgebuchte Zeiten | 2-3d    | 🎯 Mittel   | bookings table             |

### Member-Self-Service-Portal (16-22)

| #   | Punkt                                                            | Aufwand | Priorität | Abhängigkeiten               |
| --- | ---------------------------------------------------------------- | ------- | --------- | ---------------------------- |
| 16  | Mitglieder-Dashboard – Eigene Trainings, Anwesenheit, Rechnungen | 3-4d    | 🔥 Hoch   | sessions, bookings, invoices |
| 17  | Mitglieder-Platzbuchungen – Self-Service Court Booking           | 2-3d    | 🔥 Hoch   | bookings API, RLS            |
| 18  | Privatstunden buchen – Direktbuchung bei Trainern                | 2-3d    | 🎯 Mittel | trainer availability         |
| 19  | Probetraining-Anmeldung – Public-Facing Formular                 | 2-3d    | 🔥 Hoch   | trial_trainings table        |
| 20  | Gruppenwechsel-Antrag – Member beantragt Wechsel                 | 1-2d    | 🎯 Mittel | groups, members              |
| 21  | News & Ankündigungen – Club-Newsfeed auf Dashboard               | 2-3d    | 🎯 Mittel | news table                   |
| 22  | Profil-Self-Service – Adresse, Kontaktdaten, Spielstärke         | 2-3d    | 🔥 Hoch   | users, members               |

### Mitgliederakquise & Onboarding (23-28)

| #   | Punkt                                                    | Aufwand | Priorität   | Abhängigkeiten   |
| --- | -------------------------------------------------------- | ------- | ----------- | ---------------- |
| 23  | Public Registration Flow – Online-Bewerbungsformular     | 3-4d    | 🔥 Hoch     | clubs, users     |
| 24  | Dokumenten-Upload – Ausweis, Bankdaten                   | 1-2d    | 🎯 Mittel   | Supabase Storage |
| 25  | Admin-Genehmigungsworkflow – Mitglieder freischalten     | 2-3d    | 🔥 Hoch     | users, audit     |
| 26  | Automatisches Onboarding-Mail – Willkommens-Mail         | 1d      | 🔥 Hoch     | Resend           |
| 27  | SEPA-Mandatsunterzeichnung – Digitaler Signatur-Workflow | 2-3d    | ⚡ Kritisch | sepa_mandates    |
| 28  | Zuordnung zu Gruppen – Admin/automatisch                 | 1-2d    | 🎯 Mittel   | groups           |

### Trainer-Portal (29-35)

| #   | Punkt                                                      | Aufwand | Priorität   | Abhängigkeiten         |
| --- | ---------------------------------------------------------- | ------- | ----------- | ---------------------- |
| 29  | Trainer-Verfügbarkeitskalender – UI zur Pflege             | 3-4d    | ⚡ Kritisch | trainer_availability   |
| 30  | Trainer-Wochenansicht – Eigene Trainings auf einen Blick   | 2-3d    | 🔥 Hoch     | sessions               |
| 31  | Stundenprotokoll & Anwesenheitsliste – Digital pro Session | 3-4d    | 🔥 Hoch     | hours_logs, attendance |
| 32  | Automatische Stundenabrechnung – Monatsabrechnung          | 2-3d    | ⚡ Kritisch | hours_logs, billing    |
| 33  | Trainer-Profil & Qualifikationen – Lizenzen, Zertifikate   | 2-3d    | 🎯 Mittel   | trainer_profiles       |
| 34  | Abwesenheitsmeldungen – Vertretungslogik                   | 2-3d    | 🔥 Hoch     | absences               |
| 35  | Monatliche Abrechnungsübersicht – Verdienst-Dashboard      | 2-3d    | 🔥 Hoch     | billing                |

---

## 🟡 MEDIUM PRIORITY – Phase 3: High Priority Features (Punkte 36-40)

| #   | Punkt                                                    | Aufwand | Priorität | Abhängigkeiten    |
| --- | -------------------------------------------------------- | ------- | --------- | ----------------- |
| 36  | Reporting & Exports – Berichtssystem mit CSV/PDF         | 3-4d    | 🔥 Hoch   | analytics API     |
| 37  | E-Mail-Kampagnen – Newsletter, Geburtstag, Saisonstart   | 3-4d    | 🔥 Hoch   | Resend, members   |
| 38  | Event-/Turniermanagement – Turniere, Draw, Ergebnisse    | 5-7d    | 🎯 Mittel | tournaments table |
| 39  | PWA Vollausbau – Service Worker, Offline, Install-Prompt | 3-4d    | 🔥 Hoch   | next-pwa          |
| 40  | API-Dokumentation & Developer Portal – Swagger/OpenAPI   | 2-3d    | 🎯 Mittel | API routes        |

---

## 🟢 MEDIUM PRIORITY – Phase 4: Differentiation (Punkte 41-45)

| #   | Punkt                                                  | Aufwand | Priorität  | Abhängigkeiten      |
| --- | ------------------------------------------------------ | ------- | ---------- | ------------------- |
| 41  | Shop & Merch – Vereins-Shop mit Stripe                 | 5-7d    | 🎯 Mittel  | Stripe              |
| 42  | In-App-Chat Erweiterung – Gruppen-Chats, Datei-Upload  | 3-4d    | 🎯 Mittel  | messages table      |
| 43  | KI Churn Prediction – Predictive Analytics             | 3-4d    | 🎯 Mittel  | members, statistics |
| 44  | KI Matchmaking – Spielpartner-Vorschläge               | 2-3d    | 🎯 Mittel  | members             |
| 45  | KI Predictive Scheduling – Wetterbasierte Empfehlungen | 3-4d    | 🌟 Niedrig | AI API              |

---

## 🔵 LOW PRIORITY – Phase 5: Nice-to-Have (Punkte 46-53)

| #   | Punkt                                             | Aufwand | Priorität  |
| --- | ------------------------------------------------- | ------- | ---------- |
| 46  | Wartungsverwaltung – Platzpflege, Reparaturen     | 3-4d    | 🌟 Niedrig |
| 47  | Materialverwaltung – Bälle, Netze, Trikots        | 3-4d    | 🌟 Niedrig |
| 48  | Videoanalyse – Upload, Zeitlupe, Technik-Feedback | 5-7d    | 🌟 Niedrig |
| 49  | Gamification – Punkte, Badges, Leaderboards       | 5-7d    | 🌟 Niedrig |
| 50  | Family Accounts – Verknüpfte Familienmitglieder   | 3-4d    | 🌟 Niedrig |
| 51  | Rabatt-Coupons – Gutschein-System                 | 2-3d    | 🌟 Niedrig |
| 52  | QR-Code-Check-in – Contactless per QR             | 2-3d    | 🌟 Niedrig |
| 53  | Feedback-System – NPS, Trainer-Bewertungen        | 3-4d    | 🌟 Niedrig |

---

## ⚙️ TECHNICAL DEBT & QUALITY (Punkte 54-62)

| #   | Punkt                                                              | Aufwand | Priorität   |
| --- | ------------------------------------------------------------------ | ------- | ----------- |
| 54  | DB-Migrationen auf Produktiv-DB anwenden (indexes + messaging)     | 0.5d    | ⚡ Kritisch |
| 55  | TypeScript Strict Mode aktivieren + Type-Errors fixen              | 2-3d    | 🔥 Hoch     |
| 56  | Service-Migration – 11 Services auf Drizzle-Repos                  | 38h     | 🔥 Hoch     |
| 57  | Unit Test Coverage von ~20% auf 80%+ erhöhen                       | 2-3w    | 🔥 Hoch     |
| 58  | Integration Tests für neue Features (Messaging, Notifications, KI) | 1w      | 🎯 Mittel   |
| 59  | Stripe Production Setup – Live-Mode, Webhook-Endpunkte             | 1-2d    | ⚡ Kritisch |
| 60  | Monitoring & Observability – Lighthouse CI, Uptime                 | 1-2d    | 🎯 Mittel   |
| 61  | GDPR Compliance Audit – DSGVO-Check                                | 2-3d    | 🔥 Hoch     |
| 62  | E2E Tests für neue Features (Messaging, Notifications, KI)         | 1w      | 🎯 Mittel   |

---

## 📊 Aufwandsübersicht

| Phase                  | Punkte | Aufwand          |
| ---------------------- | ------ | ---------------- |
| Erledigt (1-12)        | 12     | ✅ Done          |
| High Priority (13-35)  | 23     | 8-12 Wochen      |
| Medium Phase 3 (36-40) | 5      | 12-16 Wochen     |
| Medium Phase 4 (41-45) | 5      | 8-12 Wochen      |
| Low Phase 5 (46-53)    | 8      | 8-12 Wochen      |
| Technical Debt (54-62) | 9      | 4-6 Wochen       |
| **Gesamt**             | **62** | **40-58 Wochen** |

---

## 🗂️ Dateiübersicht der Implementierungen

| Phase     | Neue Dateien (geplant)                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 2   | `components/court-calendar.tsx`, `app/api/bookings/export-ics/route.ts`, `components/member-dashboard/`, `app/(public)/register/`, `components/trainer-portal/`, `app/api/news/route.ts` |
| Phase 3   | `app/(protected)/admin/reports/`, `app/api/email-campaigns/`, `components/tournament-manager.tsx`, `next.config.js` (PWA), `app/api/docs/`                                               |
| Phase 4   | `components/shop/`, `app/api/shop/`, `lib/ai/churn-prediction.ts`, `lib/ai/matchmaking.ts`                                                                                               |
| Phase 5   | `components/maintenance/`, `components/inventory/`, `components/gamification/`, `app/api/coupons/`                                                                                       |
| Tech Debt | — (Änderungen an bestehenden Dateien + Migrationen)                                                                                                                                      |

---

## 🚀 Nächste Schritte

1. **Technical Debt sofort:** DB-Migrationen ausführen, Strict Mode aktivieren
2. **Phase 2 starten:** Court Calendar UI → Member Dashboard → Public Registration
3. **Parallel:** Service-Migration + Unit Tests

---

**Letzte Aktualisierung:** 2026-05-13  
**Nächste Review:** Nach Abschluss Phase 2
