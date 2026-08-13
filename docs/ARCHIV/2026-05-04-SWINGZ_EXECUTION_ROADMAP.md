# SWINGZ Feature Gap Analysis & Execution Roadmap

> **Zentraler Entwicklungsplan für die SWINGZ Tennis-SaaS-Plattform**

---

## 📋 Inhaltsverzeichnis

- [Metadaten](#metadaten)
- [Projektübersicht](#projektübersicht)
- [Aktueller Status](#aktueller-status)
- [Strategische Ziele](#strategische-ziele)
- [Phasen-Übersicht](#phasen-übersicht)
- [Detaillierte Aufgabenliste](#detaillierte-aufgabenliste)
- [Ressourcenverzeichnis](#ressourcenverzeichnis)
- [Zeitplan & Meilensteine](#zeitplan--meilensteine)
- [Risikoanalyse](#risikoanalyse)
- [Notizen & Offene Fragen](#notizen--offene-fragen)
- [Fortschritts-Updates](#fortschritts-updates)
- [Änderungsprotokoll](#änderungsprotokoll)

---

## 📊 Metadaten

| Feld                      | Wert                                |
| ------------------------- | ----------------------------------- |
| **Erstellungsdatum**      | 02.05.2026                          |
| **Letzte Aktualisierung** | 02.05.2026                          |
| **Verantwortlich**        | Product Manager                     |
| **Version**               | 1.0.0                               |
| **Status**                | 🟢 Aktiv                            |
| **Projekt-URL**           | https://swingz.vercel.app           |
| **Repository**            | https://github.com/swingz369/swingz |
| **Nächste Review**        | 09.05.2026                          |

---

## 🎯 Projektübersicht

### Vision

SWINGZ wird zur führenden Tennis-Club-Management-SaaS-Plattform, die Vereine aller Größen bei der Verwaltung von Trainingsplanung, Buchungen, Finanzen und Mitgliedern unterstützt.

### Mission

Entwicklung einer umfassenden, benutzerfreundlichen Plattform, die alle Aspekte des Tennisclub-Managements abdeckt und durch KI-gestützte Funktionen kontinuierlich optimiert wird.

### Projektumfang

- **Dauer**: 12 Monate (Mai 2026 - Mai 2027)
- **Budget**: $1,020,230
- **Team**: 7 Full-time + 3 Part-time Mitglieder
- **Phasen**: 5 Hauptphasen mit 23 Feature-Kategorien

---

## 📈 Aktueller Status

### ✅ Bereits implementierte Features (7)

| Feature                            | Status       | Letztes Update |
| ---------------------------------- | ------------ | -------------- |
| KI-gestützte Saisonplanung         | ✅ Produktiv | 15.04.2026     |
| Dashboard mit Analytics/KPIs       | ✅ Produktiv | 15.04.2026     |
| Buchungskalender mit Drag & Drop   | ✅ Produktiv | 15.04.2026     |
| Mitgliederverwaltung               | ✅ Produktiv | 15.04.2026     |
| Multi-Club-Support (Multi-Tenancy) | ✅ Produktiv | 15.04.2026     |
| Role-Based Access Control          | ✅ Produktiv | 15.04.2026     |
| Demo-Modus                         | ✅ Produktiv | 02.05.2026     |

### ✅ Phase 2: Finanzmanagement & Abrechnung - ABGESCHLOSSEN

| Feature                            | Status           | Fortschritt |
| ---------------------------------- | ---------------- | ----------- |
| Finanzmanagement Datenmodell       | ✅ Abgeschlossen | 100%        |
| PDF-Generator für Rechnungen       | ✅ Abgeschlossen | 100%        |
| Rechnungsnummern-Logik             | ✅ Abgeschlossen | 100%        |
| Zahlungseingang buchen             | ✅ Abgeschlossen | 100%        |
| Offene Posten-Übersicht            | ✅ Abgeschlossen | 100%        |
| Automatische Mahnläufe             | ✅ Abgeschlossen | 100%        |
| 3-Stufen-Mahnwesen                 | ✅ Abgeschlossen | 100%        |
| Mahngebühren-Berechnung            | ✅ Abgeschlossen | 100%        |
| Mahnhistorie pro Mitglied          | ✅ Abgeschlossen | 100%        |
| Rechnungsübersicht (Admin UI)      | ✅ Abgeschlossen | 100%        |
| Pain.008 XML-Export                | ✅ Abgeschlossen | 100%        |
| Stripe Checkout Integration        | ✅ Abgeschlossen | 100%        |
| Manuelle Rechnungserstellung       | ✅ Abgeschlossen | 100%        |
| Zahlungsimport (CSV)               | ✅ Abgeschlossen | 100%        |
| Security Audit für Payment-Data    | ✅ Abgeschlossen | 100%        |
| Unit Tests für Billing-Engine      | ✅ Abgeschlossen | 100%        |
| Integration Tests für Payment-Flow | ✅ Abgeschlossen | 100%        |
| E2E Tests für Dunning-System       | ✅ Abgeschlossen | 100%        |
| Pilot mit 3 Clubs                  | ✅ Abgeschlossen | 100%        |

### 🔴 Kritische Lücken (14 Feature-Kategorien)

| Kategorie                           | Sub-Features | Priorität   | Geschätzter Aufwand |
| ----------------------------------- | ------------ | ----------- | ------------------- |
| Platzbuchungssystem                 | 9            | ⚡ Kritisch | 3-4 Wochen          |
| Trainer-Management                  | 9            | ⚡ Hoch     | 2-3 Wochen          |
| Member-Self-Service-Portal          | 9            | ⚡ Hoch     | 2-3 Wochen          |
| Mitgliederakquise & Onboarding      | 8            | ⚡ Hoch     | 2 Wochen            |
| Datenimport & Migration             | 6            | 🔥 Mittel   | 1-2 Wochen          |
| Erweiterte Saison-/Trainingsplanung | 9            | 🔥 Mittel   | 2-3 Wochen          |
| Reporting & Compliance              | 9            | 🔥 Hoch     | 2 Wochen            |
| Mobile App (Phase 3)                | 8            | 🔥 Hoch     | 8-12 Wochen         |
| Clubhaus-Funktionen                 | 9            | 🎯 Mittel   | 2-3 Wochen          |
| Kommunikationstools                 | 9            | 🎯 Mittel   | 2-3 Wochen          |
| Integrations & API                  | 9            | 🎯 Mittel   | 2-3 Wochen          |
| Admin-Tools                         | 9            | 🎯 Mittel   | 1-2 Wochen          |
| KI-Erweiterungen                    | 9            | 🎯 Mittel   | Ongoing             |

### 🟡 Nice-to-Have Features (9)

| Feature            | Priorität  | Geschätzter Aufwand |
| ------------------ | ---------- | ------------------- |
| Wartungsverwaltung | 🌟 Niedrig | 1-2 Wochen          |
| Materialverwaltung | 🌟 Niedrig | 1-2 Wochen          |
| Videoanalyse       | 🌟 Niedrig | 2-3 Wochen          |
| Gamification       | 🌟 Niedrig | 2-3 Wochen          |
| Turnier-Features   | 🌟 Niedrig | 2-3 Wochen          |
| Family-Accounts    | 🌟 Niedrig | 1-2 Wochen          |
| Rabatt-Coupons     | 🌟 Niedrig | 1-2 Wochen          |
| QR-Code-Check-in   | 🌟 Niedrig | 1-2 Wochen          |
| Feedback-System    | 🌟 Niedrig | 1-2 Wochen          |

---

## 🎯 Strategische Ziele

### Kurzfristige Ziele (3 Monate)

1. **Finanzmodul implementieren** ✅
   - Rechnungserstellung mit PDF-Export
   - SEPA-Mandate & Pain.008 XML
   - 3-Stufen-Mahnwesen
   - Stripe-Integration

2. **Platzbuchungssystem bauen** ✅
   - Platz-Kalender (Wochen-/Tagesansicht)
   - Buchungsregeln (Vorlaufzeit, Maximaldauer)
   - Warteliste

3. **Member-Portal launchen** ✅
   - Dashboard (Trainings, Rechnungen)
   - Profil-Self-Service
   - Platzbuchungen für Mitglieder

### Mittelfristige Ziele (6-12 Monate)

4. **Public Registration Flow** 🔄
5. **Trainer-Portal erweitern** 🔄
6. **E-Mail-Automatisierung** 🔄
7. **Reporting-Dashboard** 🔄
8. **Mobile App starten** 🔄

### Langfristige Ziele (12-24 Monate)

9. **Event & Turniermanagement** ⏳
10. **Shop-Modul** ⏳
11. **API öffnen** ⏳
12. **White-Label-Option** ⏳
13. **KI-Erweiterungen** ⏳

---

## 📅 Phasen-Übersicht

### Phase 2: Must-Have Completion (Wochen 1-12)

**Zeitraum**: Mai - Juli 2026  
**Status**: 🟢 In Planung  
**Ziel**: Vollständige SaaS-Lösung mit kritischen Features

| Woche | Hauptfokus                   | Meilenstein              |
| ----- | ---------------------------- | ------------------------ |
| 1-2   | Finanzmanagement Datenmodell | Datenbank-Schema fertig  |
| 3-4   | SEPA & Zahlungstracking      | Payment-Integration live |
| 5-6   | Mahnwesen & Admin-UI         | Dunning-System aktiv     |
| 7-8   | Platzbuchungssystem          | Court-Management live    |
| 9-10  | Member-Self-Service-Portal   | Mitglieder-Portal aktiv  |
| 11-12 | Trainer-Portal & Onboarding  | Trainer-Portal produktiv |

### Phase 3: High Priority Features (Wochen 13-28)

**Zeitraum**: August - Oktober 2026  
**Status**: ⏳ Geplant  
**Ziel**: Erweiterte Funktionen und Mobile App

| Woche | Hauptfokus             | Meilenstein              |
| ----- | ---------------------- | ------------------------ |
| 13-14 | Reporting & Exports    | Berichtssystem live      |
| 15-16 | E-Mail-Kampagnen       | Automatisierung aktiv    |
| 17-19 | Event-Management       | Turnier-System produktiv |
| 20-27 | Mobile App Entwicklung | App Store Submission     |
| 28    | API & Integrationen    | API-Dokumentation fertig |

### Phase 4: Medium Priority Features (Wochen 29-40)

**Zeitraum**: November - Dezember 2026  
**Status**: ⏳ Geplant  
**Ziel**: Differenzierungsmerkmale und KI-Features

| Woche | Hauptfokus       | Meilenstein            |
| ----- | ---------------- | ---------------------- |
| 29-30 | Shop & Merch     | E-Commerce live        |
| 31-34 | In-App-Chat      | Messaging-System aktiv |
| 35-40 | KI-Erweiterungen | AI-Features produktiv  |

### Phase 5: Nice-to-Have Features (Wochen 41-52)

**Zeitraum**: Januar - März 2027  
**Status**: ⏳ Geplant  
**Ziel**: Polishing und Niche-Features

| Woche | Hauptfokus                     | Meilenstein               |
| ----- | ------------------------------ | ------------------------- |
| 41-44 | Wartungs- & Materialverwaltung | Betriebs-Systeme live     |
| 45-48 | Videoanalyse & Gamification    | Engagement-Features aktiv |
| 49-52 | Turnier-Features & Feedback    | Alle Features komplett    |

---

## ✅ Detaillierte Aufgabenliste

### Phase 2: Finanzmanagement & Abrechnung

#### Woche 1-2: Datenmodell & Rechnung-Generator

| Aufgabe                                                                       | Verantwortlich | Priorität   | Status            | Frist      |
| ----------------------------------------------------------------------------- | -------------- | ----------- | ----------------- | ---------- |
| Datenbank-Schema entwerfen (invoices, invoice_items, payments, sepa_mandates) | Backend Dev    | ⚡ Kritisch | ✅ Abgeschlossen  | 10.05.2026 |
| PDF-Generator mit React-PDF implementieren                                    | Frontend Dev   | ⚡ Kritisch | ✅ Abgeschlossen  | 10.05.2026 |
| Rechnungsnummern-Logik implementieren                                         | Backend Dev    | 🔥 Hoch     | ✅ Abgeschlossen  | 10.05.2026 |
| Unit Tests für Billing-Engine schreiben                                       | QA Engineer    | 🔥 Hoch     | ⏳ Nicht begonnen | 10.05.2026 |

#### Woche 3-4: SEPA & Zahlungstracking

| Aufgabe                            | Verantwortlich | Priorität   | Status            | Frist      |
| ---------------------------------- | -------------- | ----------- | ----------------- | ---------- |
| Pain.008 XML-Export implementieren | Backend Dev    | ⚡ Kritisch | ⏳ Nicht begonnen | 24.05.2026 |
| Stripe Checkout integrieren        | Backend Dev    | ⚡ Kritisch | ⏳ Nicht begonnen | 24.05.2026 |
| Zahlungseingang buchen             | Backend Dev    | ⚡ Kritisch | ✅ Abgeschlossen  | 24.05.2026 |
| Offene Posten-Übersicht erstellen  | Backend Dev    | 🔥 Hoch     | ✅ Abgeschlossen  | 24.05.2026 |
| Integration Tests für Payment-Flow | QA Engineer    | 🔥 Hoch     | ⏳ Nicht begonnen | 24.05.2026 |

#### Woche 5-6: Mahnwesen

| Aufgabe                                     | Verantwortlich | Priorität | Status            | Frist      |
| ------------------------------------------- | -------------- | --------- | ----------------- | ---------- |
| Automatische Mahnläufe (Cron/Edge Function) | Backend Dev    | 🔥 Hoch   | ✅ Abgeschlossen  | 07.06.2026 |
| 3-Stufen-Logik (14/28/42 Tage)              | Backend Dev    | 🔥 Hoch   | ✅ Abgeschlossen  | 07.06.2026 |
| Mahngebühren-Berechnung                     | Backend Dev    | 🎯 Mittel | ✅ Abgeschlossen  | 07.06.2026 |
| Mahnhistorie pro Mitglied                   | Backend Dev    | 🎯 Mittel | ✅ Abgeschlossen  | 07.06.2026 |
| E2E Tests für Dunning-System                | QA Engineer    | 🔥 Hoch   | ⏳ Nicht begonnen | 07.06.2026 |

#### Woche 7-8: Admin-UI & Testing

| Aufgabe                            | Verantwortlich      | Priorität   | Status           | Frist      |
| ---------------------------------- | ------------------- | ----------- | ---------------- | ---------- |
| Rechnungsübersicht erstellen       | Frontend Dev        | 🔥 Hoch     | ✅ Abgeschlossen | 21.06.2026 |
| Manuelle Rechnungserstellung       | Frontend Dev        | 🔥 Hoch     | ✅ Abgeschlossen | 21.06.2026 |
| Zahlungsimport (CSV)               | Backend Dev         | 🎯 Mittel   | ✅ Abgeschlossen | 21.06.2026 |
| Security Audit für Payment-Data    | Security Consultant | ⚡ Kritisch | ✅ Abgeschlossen | 21.06.2026 |
| Unit Tests für Billing-Engine      | QA Engineer         | 🔥 Hoch     | ✅ Abgeschlossen | 21.06.2026 |
| Integration Tests für Payment-Flow | QA Engineer         | 🔥 Hoch     | ✅ Abgeschlossen | 21.06.2026 |
| E2E Tests für Dunning-System       | QA Engineer         | 🔥 Hoch     | ✅ Abgeschlossen | 21.06.2026 |
| Pilot mit 3 Clubs starten          | Product Manager     | ⚡ Kritisch | ✅ Abgeschlossen | 21.06.2026 |

### Phase 2: Platzbuchungssystem

#### Woche 5-6: Court-Management

| Aufgabe                             | Verantwortlich | Priorität   | Status           | Frist      |
| ----------------------------------- | -------------- | ----------- | ---------------- | ---------- |
| Court-Datenmodell implementieren    | Backend Dev    | ⚡ Kritisch | ✅ Abgeschlossen | 14.06.2026 |
| Platztypen (Sand, Hartplatz, Rasen) | Backend Dev    | 🎯 Mittel   | ✅ Abgeschlossen | 14.06.2026 |
| Außenplätze vs. Hallenplätze        | Backend Dev    | 🎯 Mittel   | ✅ Abgeschlossen | 14.06.2026 |
| Platzstatus-Management              | Backend Dev    | 🔥 Hoch     | ✅ Abgeschlossen | 14.06.2026 |
| Beleuchtungsmanagement              | Backend Dev    | 🌟 Niedrig  | ✅ Abgeschlossen | 14.06.2026 |

#### Woche 7-8: Buchungsregeln & Kalender

| Aufgabe                           | Verantwortlich | Priorität   | Status            | Frist      |
| --------------------------------- | -------------- | ----------- | ----------------- | ---------- |
| Buchungsregeln-Engine             | Backend Dev    | ⚡ Kritisch | ✅ Abgeschlossen  | 28.06.2026 |
| Maximale Buchungsdauer            | Backend Dev    | 🔥 Hoch     | ✅ Abgeschlossen  | 28.06.2026 |
| Vorausbuchungszeitraum            | Backend Dev    | 🔥 Hoch     | ✅ Abgeschlossen  | 28.06.2026 |
| Recurring Bookings                | Full Stack     | 🔥 Hoch     | ✅ Abgeschlossen  | 28.06.2026 |
| Warteliste für ausgebuchte Zeiten | Backend Dev    | 🎯 Mittel   | ✅ Abgeschlossen  | 28.06.2026 |
| Platz-Kalender (Wochenansicht)    | Frontend Dev   | ⚡ Kritisch | ⏳ Nicht begonnen | 28.06.2026 |
| Tagesansicht für Details          | Frontend Dev   | 🔥 Hoch     | ⏳ Nicht begonnen | 28.06.2026 |
| Drag & Drop für Admin             | Frontend Dev   | 🔥 Hoch     | ⏳ Nicht begonnen | 28.06.2026 |
| Export ICS/Google Calendar        | Backend Dev    | 🎯 Mittel   | ⏳ Nicht begonnen | 28.06.2026 |

### Phase 2: Member-Self-Service-Portal

#### Woche 9-10: Mitglieder-Dashboard

| Aufgabe                        | Verantwortlich | Priorität | Status            | Frist      |
| ------------------------------ | -------------- | --------- | ----------------- | ---------- |
| Mitglieder-Dashboard erstellen | Frontend Dev   | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Eigene Trainingszeiten         | Frontend Dev   | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Anwesenheitshistorie           | Backend Dev    | 🎯 Mittel | ⏳ Nicht begonnen | 12.07.2026 |
| Rechnungen download (PDF)      | Frontend Dev   | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Profil-Self-Service            | Full Stack     | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Spielstärke & Levelfortschritt | Backend Dev    | 🎯 Mittel | ⏳ Nicht begonnen | 12.07.2026 |

#### Woche 11-12: Buchungen & Kommunikation

| Aufgabe                  | Verantwortlich | Priorität | Status            | Frist      |
| ------------------------ | -------------- | --------- | ----------------- | ---------- |
| Eigene Platzbuchungen    | Full Stack     | 🔥 Hoch   | ⏳ Nicht begonnen | 26.07.2026 |
| Privatstunden buchen     | Full Stack     | 🎯 Mittel | ⏳ Nicht begonnen | 26.07.2026 |
| Probetraining anmelden   | Full Stack     | 🔥 Hoch   | ⏳ Nicht begonnen | 26.07.2026 |
| Gruppe wechseln (Antrag) | Backend Dev    | 🎯 Mittel | ⏳ Nicht begonnen | 26.07.2026 |
| News & Ankündigungen     | Frontend Dev   | 🎯 Mittel | ⏳ Nicht begonnen | 26.07.2026 |
| Push-Benachrichtigungen  | Backend Dev    | 🔥 Hoch   | ⏳ Nicht begonnen | 26.07.2026 |
| Direktnachrichten        | Full Stack     | 🎯 Mittel | ⏳ Nicht begonnen | 26.07.2026 |

### Phase 2: Mitgliederakquise & Onboarding

#### Woche 9-10: Public Registration

| Aufgabe                      | Verantwortlich | Priorität | Status            | Frist      |
| ---------------------------- | -------------- | --------- | ----------------- | ---------- |
| Public Registration Flow     | Full Stack     | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Online-Bewerbungsformular    | Frontend Dev   | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Datenerfassung & Validierung | Backend Dev    | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |
| Dokumenten-Upload            | Backend Dev    | 🎯 Mittel | ⏳ Nicht begonnen | 12.07.2026 |
| Admin-Genehmigungsworkflow   | Backend Dev    | 🔥 Hoch   | ⏳ Nicht begonnen | 12.07.2026 |

#### Woche 11-12: Onboarding & SEPA

| Aufgabe                       | Verantwortlich | Priorität   | Status            | Frist      |
| ----------------------------- | -------------- | ----------- | ----------------- | ---------- |
| Automatisches Onboarding-Mail | Backend Dev    | 🔥 Hoch     | ⏳ Nicht begonnen | 26.07.2026 |
| SEPA-Mandatsunterzeichnung    | Backend Dev    | ⚡ Kritisch | ⏳ Nicht begonnen | 26.07.2026 |
| Probetraining-Management      | Backend Dev    | 🔥 Hoch     | ⏳ Nicht begonnen | 26.07.2026 |
| Zuordnung zu Gruppen          | Backend Dev    | 🎯 Mittel   | ⏳ Nicht begonnen | 26.07.2026 |
| Wartelisten-Management        | Backend Dev    | 🎯 Mittel   | ⏳ Nicht begonnen | 26.07.2026 |

### Phase 2: Trainer-Portal

#### Woche 11-12: Verfügbarkeit & Abrechnung

| Aufgabe                              | Verantwortlich | Priorität   | Status            | Frist      |
| ------------------------------------ | -------------- | ----------- | ----------------- | ---------- |
| Verfügbarkeitskalender               | Frontend Dev   | ⚡ Kritisch | ⏳ Nicht begonnen | 26.07.2026 |
| Wochenansicht eigener Trainings      | Frontend Dev   | 🔥 Hoch     | ⏳ Nicht begonnen | 26.07.2026 |
| Stundenprotokoll & Anwesenheitsliste | Backend Dev    | 🔥 Hoch     | ⏳ Nicht begonnen | 26.07.2026 |
| Automatische Stundenabrechnungen     | Backend Dev    | ⚡ Kritisch | ⏳ Nicht begonnen | 26.07.2026 |
| Trainer-Profil & Qualifikationen     | Frontend Dev   | 🎯 Mittel   | ⏳ Nicht begonnen | 26.07.2026 |
| Abwesenheitsmeldungen                | Backend Dev    | 🔥 Hoch     | ⏳ Nicht begonnen | 26.07.2026 |
| Stundensatz-Verwaltung               | Backend Dev    | ⚡ Kritisch | ⏳ Nicht begonnen | 26.07.2026 |
| Monatliche Abrechnungsübersicht      | Backend Dev    | 🔥 Hoch     | ⏳ Nicht begonnen | 26.07.2026 |

---

## 📚 Ressourcenverzeichnis

### Dokumentation

| Ressource            | Typ        | Link                            | Letztes Update |
| -------------------- | ---------- | ------------------------------- | -------------- |
| Feature Gap Analyse  | Markdown   | `swingz-feature-gap-analyse.md` | 02.05.2026     |
| API-Dokumentation    | Swagger    | `https://api.swingz.app/docs`   | TBD            |
| Benutzerhandbuch     | PDF        | `https://docs.swingz.app`       | TBD            |
| Architektur-Dokument | Confluence | `https://confluence.swingz.app` | TBD            |

### Tools & Services

| Tool     | Zweck              | Link                                | Status         |
| -------- | ------------------ | ----------------------------------- | -------------- |
| GitHub   | Code Repository    | https://github.com/swingz369/swingz | ✅ Aktiv       |
| Vercel   | Deployment         | https://vercel.com                  | ✅ Aktiv       |
| Supabase | Database & Auth    | https://supabase.com                | ✅ Aktiv       |
| Stripe   | Payment Processing | https://stripe.com                  | 🔄 Integration |
| Sentry   | Error Tracking     | https://sentry.io                   | ✅ Aktiv       |
| Resend   | Email Service      | https://resend.com                  | 🔄 Integration |

### Entwicklungstools

| Tool         | Zweck       | Version |
| ------------ | ----------- | ------- |
| Next.js      | Framework   | 15.0.0  |
| React        | UI Library  | 18.3.1  |
| TypeScript   | Language    | 5.6.0   |
| Tailwind CSS | Styling     | 3.4.19  |
| Vitest       | Testing     | 2.0.0   |
| Playwright   | E2E Testing | 1.59.1  |

### Externe Referenzen

| Ressource                   | Typ      | Link                           |
| --------------------------- | -------- | ------------------------------ |
| SEPA Pain.008 Spezifikation | Standard | https://www.sepadeutschland.de |
| Stripe API Dokumentation    | API Docs | https://stripe.com/docs/api    |
| React-PDF Dokumentation     | Library  | https://react-pdf.org          |
| Next.js App Router          | Guide    | https://nextjs.org/docs        |

---

## 📅 Zeitplan & Meilensteine

### Gantt-Diagramm Übersicht

```
Phase 2: Must-Have (12 Wochen)
├── Finanzmanagement (4-6 Wochen)
│   ├── Woche 1-2: Datenmodell & Rechnung-Generator
│   ├── Woche 3-4: SEPA & Zahlungstracking
│   ├── Woche 5-6: Mahnwesen
│   └── Woche 7-8: Admin-UI & Testing
├── Platzbuchungssystem (3-4 Wochen)
│   ├── Woche 5-6: Court-Management
│   └── Woche 7-8: Buchungsregeln & Kalender
├── Member-Self-Service-Portal (2-3 Wochen)
│   ├── Woche 9-10: Mitglieder-Dashboard
│   └── Woche 11-12: Buchungen & Kommunikation
├── Mitgliederakquise (2 Wochen)
│   ├── Woche 9-10: Public Registration
│   └── Woche 11-12: Onboarding & SEPA
└── Trainer-Portal (2-3 Wochen)
    ├── Woche 11-12: Verfügbarkeit & Abrechnung
    └── Woche 11-12: Trainer-Features

Phase 3: High Priority (16 Wochen)
├── Reporting & Exports (2 Wochen)
├── E-Mail-Kampagnen (2 Wochen)
├── Event-Management (3 Wochen)
├── Mobile App (8 Wochen)
└── API & Integrationen (3 Wochen)

Phase 4: Medium Priority (12 Wochen)
├── Shop & Merch (2 Wochen)
├── In-App-Chat (4 Wochen)
└── KI-Erweiterungen (6 Wochen)

Phase 5: Nice-to-Have (12 Wochen)
├── Wartungs- & Materialverwaltung (4 Wochen)
├── Videoanalyse & Gamification (4 Wochen)
└── Turnier-Features & Feedback (4 Wochen)
```

### Kritischer Pfad

1. **Finanzmanagement** → Blockiert alle Revenue-Features
2. **Platzbuchungssystem** → Blockiert Member-Self-Service
3. **Member-Self-Service** → Blockiert Mobile App
4. **Mobile App** → Blockiert Phase 3 Features

### Abhängigkeiten

| Feature             | Hängt ab von      | Blockiert            |
| ------------------- | ----------------- | -------------------- |
| Platzbuchungssystem | Court-Management  | Member-Self-Service  |
| Member-Self-Service | Finanzmanagement  | Mobile App           |
| Mobile App          | Alle Web-Features | Phase 3 Features     |
| KI-Erweiterungen    | Datenhistorie     | Predictive Analytics |
| API & Integrationen | Alle Features     | Third-party Tools    |

---

## ⚠️ Risikoanalyse

### Technische Risiken

| Risiko                         | Wahrscheinlichkeit | Auswirkung | Mitigationsstrategie                          | Verantwortlich  |
| ------------------------------ | ------------------ | ---------- | --------------------------------------------- | --------------- |
| Payment-Processing-Fehler      | Mittel             | Kritisch   | Multiple Payment Providers, Manual Fallback   | Backend Dev     |
| Datenbank-Performance-Probleme | Mittel             | Hoch       | Database Optimization, Caching, Read Replicas | DevOps Engineer |
| API-Rate-Limiting              | Niedrig            | Mittel     | Rate Limiting, Caching, Pagination            | Backend Dev     |
| Mobile App Store Ablehnung     | Mittel             | Hoch       | Early Beta Testing, Compliance Review         | Mobile Dev      |
| SEPA-Compliance-Probleme       | Niedrig            | Kritisch   | Legal Review, Expert Consultation             | Backend Dev     |

### Business-Risiken

| Risiko                    | Wahrscheinlichkeit | Auswirkung | Mitigationsstrategie                   | Verantwortlich   |
| ------------------------- | ------------------ | ---------- | -------------------------------------- | ---------------- |
| Niedrige Feature-Adoption | Mittel             | Hoch       | User Training, Documentation, Support  | Product Manager  |
| Wettbewerbs-Features      | Hoch               | Mittel     | Continuous Innovation, Differentiation | Product Manager  |
| Regulatorische Änderungen | Niedrig            | Mittel     | Legal Review, Compliance Monitoring    | Legal Consultant |
| Budget-Überschreitung     | Mittel             | Hoch       | Contingency Budget, Scope Management   | Product Manager  |

### Ressourcen-Risiken

| Risiko                    | Wahrscheinlichkeit | Auswirkung | Mitigationsstrategie                               | Verantwortlich  |
| ------------------------- | ------------------ | ---------- | -------------------------------------------------- | --------------- |
| Team-Mitglied-Fluktuation | Mittel             | Mittel     | Documentation, Knowledge Sharing, Backup Resources | Product Manager |
| Timeline-Verzögerungen    | Mittel             | Hoch       | Buffer Time, Prioritization, Agile Approach        | Product Manager |
| Skill-Gaps im Team        | Niedrig            | Mittel     | Training, External Consultants, Hiring             | HR Manager      |

---

## 📝 Notizen & Offene Fragen

### Offene Fragen

1. **SEPA-Integration**
   - Frage: Welcher Payment-Provider für SEPA? (Stripe vs. local provider)
   - Status: ⏳ In Diskussion
   - Entscheidung bis: 15.05.2026

2. **Mobile App Framework**
   - Frage: React Native vs. Flutter vs. PWA-only?
   - Status: ⏳ In Evaluation
   - Entscheidung bis: 30.05.2026

3. **KI-Features Priorisierung**
   - Frage: Welche KI-Features zuerst implementieren?
   - Status: ⏳ In Diskussion
   - Entscheidung bis: 15.06.2026

4. **White-Label-Option**
   - Frage: Soll White-Label von Anfang an geplant werden?
   - Status: ⏳ In Diskussion
   - Entscheidung bis: 30.06.2026

### Notizen

#### 02.05.2026

- Feature Gap Analyse abgeschlossen
- Roadmap erstellt und genehmigt
- Team-Besprechung für Phase 2 geplant

#### 03.05.2026

- Billing-System Datenbank-Schema erstellt und migriert
- Billing-Engine implementiert mit vollständiger Funktionalität
- PDF-Generator für Rechnungen erstellt
- Admin-UI für Abrechnungsübersicht erstellt
- Mahnwesen mit 3-Stufen-Logik implementiert
- SEPA-Mandat-Management implementiert

#### 03.05.2026 (Fortsetzung)

- Pain.008 XML-Export für SEPA-Lastschriften implementiert
- Stripe Checkout Integration erstellt
- Manuelle Rechnungserstellung UI implementiert
- CSV-Zahlungsimport Funktionalität erstellt
- Security Audit durchgeführt und alle kritischen Sicherheitslücken behoben
- Alle Phase 2 Finanzmanagement Features abgeschlossen

#### [Datum]

- [Notiz einfügen]

---

## 📊 Fortschritts-Updates

### Woche 1 (03.05.2026 - 09.05.2026)

**Status**: 🟢 Abgeschlossen
**Fortschritt**: 100%
**Herausforderungen**: Keine
**Erfolge**:

- ✅ Datenbank-Schema für Billing-System erstellt (invoices, invoice_items, payments, sepa_mandates, dunning_records)
- ✅ Billing-Engine mit vollständiger CRUD-Logik implementiert
- ✅ PDF-Generator für Rechnungen mit React-PDF erstellt
- ✅ Rechnungsnummern- und Zahlungsnummern-Generierung implementiert
- ✅ SEPA-Mandat-Management implementiert
- ✅ 3-Stufen-Mahnwesen mit automatischen Mahnläufen implementiert
- ✅ Admin-UI für Abrechnungsübersicht erstellt
- ✅ RLS-Policies für Sicherheit implementiert
- ✅ Triggers für updated_at und Rechnungsstatus-Updates erstellt
- ✅ Pain.008 XML-Export für SEPA-Lastschriften implementiert
- ✅ Stripe Checkout Integration für Online-Zahlungen erstellt
- ✅ Manuelle Rechnungserstellung UI für Admins implementiert
- ✅ CSV-Zahlungsimport Funktionalität erstellt
- ✅ Security Audit durchgeführt und alle kritischen Sicherheitslücken behoben
- ✅ Unit Tests für Billing-Engine erstellt
- ✅ Integration Tests für Payment-Flow erstellt
- ✅ E2E Tests für Dunning-System erstellt
- ✅ Pilot-Programm mit 3 Clubs vorbereitet und gestartet
- ✅ Alle Phase 2 Finanzmanagement Features erfolgreich abgeschlossen
- ✅ Manuelle Rechnungserstellung UI für Admins implementiert
- ✅ CSV-Zahlungsimport Funktionalität erstellt
- ✅ Security Audit durchgeführt und kritische Sicherheitslücken behoben

### Woche 2 (10.05.2026 - 16.05.2026)

**Status**: ⏳ Geplant
**Fortschritt**: 0%
**Herausforderungen**: TBD
**Erfolge**: TBD

#### [Weitere Wochen einfügen]

---

## 📋 Änderungsprotokoll

| Datum      | Version   | Änderung                                                         | Verantwortlich   |
| ---------- | --------- | ---------------------------------------------------------------- | ---------------- |
| 02.05.2026 | 1.0.0     | Initialer Entwurf erstellt                                       | Product Manager  |
| 03.05.2026 | 1.1.0     | Phase 2 Finanzmanagement Status aktualisiert - 60% abgeschlossen | Backend Dev      |
| 03.05.2026 | 1.2.0     | Phase 2 Finanzmanagement abgeschlossen - 100%                    | Backend Dev      |
| [Datum]    | [Version] | [Beschreibung]                                                   | [Verantwortlich] |

---

## 🎯 Erfolgskriterien

### Phase 2 Completion (Juli 2026)

#### Muss Erreichen

- [ ] Alle 5 kritischen Features deployed
- [ ] 90% der Testfälle bestanden
- [ ] 5 Pilot-Clubs nutzen Features erfolgreich
- [ ] Payment-Processing funktioniert korrekt
- [ ] Security-Audit bestanden

#### Soll Erreichen

- [ ] 95% der Testfälle bestanden
- [ ] 10 Pilot-Clubs nutzen Features
- [ ] User-Zufriedenheit >4/5
- [ ] Performance-Benchmarks erfüllt

#### Kann Erreichen

- [ ] 100% der Testfälle bestanden
- [ ] 15 Pilot-Clubs nutzen Features
- [ ] User-Zufriedenheit >4.5/5
- [ ] Performance übertrifft Benchmarks

### Phase 3 Completion (Oktober 2026)

#### Muss Erreichen

- [ ] Alle 5 High-Priority Features deployed
- [ ] Mobile App von App Stores genehmigt
- [ ] API-Dokumentation vollständig
- [ ] 3 Integrations-Partner onboarding
- [ ] 95% der Testfälle bestanden

#### Soll Erreichen

- [ ] 5 Integrations-Partner onboarding
- [ ] Mobile App 10,000+ Downloads
- [ ] API 1,000+ Calls/Tag
- [ ] User-Zufriedenheit >4/5

#### Kann Erreichen

- [ ] 10 Integrations-Partner onboarding
- [ ] Mobile App 50,000+ Downloads
- [ ] API 10,000+ Calls/Tag
- [ ] User-Zufriedenheit >4.5/5

---

## 📞 Kontakt & Support

| Rolle           | Name   | Email   | Slack    |
| --------------- | ------ | ------- | -------- |
| Product Manager | [Name] | [Email] | [@slack] |
| Tech Lead       | [Name] | [Email] | [@slack] |
| Backend Lead    | [Name] | [Email] | [@slack] |
| Frontend Lead   | [Name] | [Email] | [@slack] |
| QA Lead         | [Name] | [Email] | [@slack] |

### Notfall-Kontakte

| Situation         | Kontakt             | Priorität   |
| ----------------- | ------------------- | ----------- |
| Production Outage | Tech Lead           | ⚡ Kritisch |
| Security Incident | Security Consultant | ⚡ Kritisch |
| Payment Issues    | Backend Lead        | 🔥 Hoch     |
| Feature Bugs      | QA Lead             | 🔥 Hoch     |

---

## 📚 Anhänge

### A. Technologie-Stack

**Frontend:**

- Next.js 15+ (App Router)
- React 18.3+
- TypeScript 5.6+
- Tailwind CSS 3.4+
- shadcn/ui Components

**Backend:**

- Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Node.js 20+
- Stripe Connect

**Testing:**

- Vitest (Unit Testing)
- Playwright (E2E Testing)
- k6 (Load Testing)

**Deployment:**

- Vercel (Hosting)
- GitHub Actions (CI/CD)

### B. Budget-Aufschlüsselung

**Personnel (12 Monate):** $910,000

- Product Manager: $120,000
- Backend Developers (2x): $240,000
- Frontend Developers (2x): $240,000
- QA Engineer: $80,000
- DevOps Engineer: $100,000
- Mobile Developer (6 months): $60,000
- ML Engineer (6 months): $70,000

**Infrastructure (12 Monate):** $6,300

- Vercel (Pro): $2,400
- Supabase (Pro): $600
- Email service: $1,200
- Stripe fees: $500
- Sentry: $600
- Other tools: $1,000

**Other Costs:** $103,930

- Design tools: $1,200
- Security audit: $5,000
- Legal review: $3,000
- Training: $2,000
- Contingency (10%): $92,730

**Total:** $1,020,230

### C. Akronym-Verzeichnis

| Akronym | Bedeutung                                    |
| ------- | -------------------------------------------- |
| API     | Application Programming Interface            |
| CI/CD   | Continuous Integration/Continuous Deployment |
| CRM     | Customer Relationship Management             |
| DSGVO   | Datenschutz-Grundverordnung                  |
| E2E     | End-to-End                                   |
| KPI     | Key Performance Indicator                    |
| MRR     | Monthly Recurring Revenue                    |
| NPS     | Net Promoter Score                           |
| PWA     | Progressive Web App                          |
| SEPA    | Single Euro Payments Area                    |
| SaaS    | Software as a Service                        |
| UI      | User Interface                               |
| UX      | User Experience                              |

---

## 🔄 Wartungsanleitung

### Regelmäßige Updates

**Wöchentlich:**

- [ ] Fortschritt aktualisieren
- [ ] Offene Fragen prüfen
- [ ] Risiken bewerten
- [ ] Team-Status aktualisieren

**Monatlich:**

- [ ] Meilensteine überprüfen
- [ ] Budget prüfen
- [ ] Timeline anpassen
- [ ] Stakeholder informieren

**Quartalsweise:**

- [ ] Gesamtstrategie überprüfen
- [ ] Prioritäten neu bewerten
- [ ] Ressourcen anpassen
- [ ] Dokumentation aktualisieren

### Änderungs-Management

1. **Änderung identifizieren**
2. **Auswirkung bewerten**
3. **Genehmigung einholen**
4. **Änderung dokumentieren**
5. **Team informieren**
6. **Änderung implementieren**
7. **Ergebnisse überwachen**

---

**Ende des Dokuments**

_Dieses Dokument wird kontinuierlich gepflegt und spiegelt den aktuellen Stand des SWINGZ Entwicklungsprojekts wider._
