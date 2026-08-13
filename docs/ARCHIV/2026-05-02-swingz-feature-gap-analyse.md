# Feature-Gap-Analyse: SWINGZ Tennis-SaaS-Plattform

**Analysiert am:** 02.05.2026  
**URL:** https://swingz.vercel.app  
**Ziel:** Identifikation fehlender Features für eine vollständige Tennis-Club-Management-Lösung

---

## ✅ Bereits vorhandene Features (basierend auf Landing Page)

- KI-gestützte Saisonplanung
- Dashboard mit Analytics/KPIs
- Buchungskalender mit Drag & Drop
- Mitgliederverwaltung
- Multi-Club-Support (Multi-Tenancy)
- Role-Based Access Control
- Demo-Modus

---

## 🔴 Kritische fehlende Features für eine vollständige Lösung

### 1. Finanzmanagement & Abrechnung

#### Mitgliedsbeiträge & Gebühren

- Automatische monatliche/jährliche Beitragsabrechnung
- Gestaffelte Preismodelle (Kinder, Erwachsene, Familien)
- Anpassbare Gebührenstrukturen pro Club
- Einmalige Gebühren (Aufnahmegebühr, Kaution)
- Saisonale Beitragsanpassungen

#### Rechnungsstellung & Payment

- PDF-Rechnungserstellung mit Club-Logo
- SEPA-Lastschriftmandat-Verwaltung
- Stripe/PayPal-Integration für Online-Zahlungen
- XML-Export für SEPA Pain.008 (Bankeinzug)
- Rechnungsnummern-Generierung (fortlaufend, pro Jahr)
- Sammelrechnungen (mehrere Positionen)
- Zahlungseingangs-Tracking

#### Mahnwesen

- 3-stufiges Dunning-System (14/28/42 Tage)
- Automatische Mahngebühren (gestaffelt)
- Zahlungserinnerungen per E-Mail
- Mahnhistorie pro Mitglied
- Mahnsperre bei Teilzahlungen
- Export offener Posten

---

### 2. Platzbuchungssystem

#### Court/Platz-Reservierung

- Öffentliche & mitgliederexklusive Buchungszeiten
- Außenplätze vs. Hallenplätze
- Platztypen (Sand, Hartplatz, Rasen)
- Wetterabhängige Platzfreigabe
- Stornierungsregeln & Deadlines
- Platzstatus (gesperrt, Wartung, verfügbar)
- Beleuchtungsmanagement

#### Buchungsregeln

- Maximale Buchungsdauer pro Woche/Monat
- Vorausbuchungszeitraum (z.B. 7 Tage für Mitglieder, 3 für Gäste)
- Recurring Bookings (feste Slots für Stammspieler)
- Warteliste für ausgebuchte Zeiten
- Gästebuchungen mit Aufpreis
- Buchungskontingente pro Mitgliedstyp
- Platz-Präferenzen (bestimmte Plätze bevorzugen)

#### Platz-Kalender

- Wochenansicht mit allen Plätzen
- Tagesansicht für detaillierte Planung
- Farbcodierung (Training, Mitglieder, Gäste, gesperrt)
- Drag & Drop für Admin-Umbuchungen
- Export als ICS/Google Calendar

---

### 3. Trainer-Management

#### Trainer-Portal

- Verfügbarkeitskalender (wann kann Trainer unterrichten)
- Wochenansicht eigener Trainings
- Stundenprotokoll & Anwesenheitsliste
- Automatische Stundenabrechnungen
- Trainer-Profil mit Qualifikationen/Lizenzen
- Abwesenheitsmeldungen (Urlaub, Krankheit)
- Vertretungsregelung

#### Trainer-Vergütung

- Stundensatz-Verwaltung (unterschiedlich nach Gruppentyp)
- Monatliche Abrechnungsübersicht
- Export für Lohnabrechnung (CSV/Excel)
- Zuschläge (Wochenende, Feiertage, Privatstunden)
- Fahrtkostenpauschale
- Gesamtübersicht Jahreseinkommen

#### Trainer-Kommunikation

- Direktnachrichten an Gruppenmitglieder
- Feedback-System für Spieler
- Trainingsnotizen pro Stunde
- Materialanforderungen (mehr Bälle bestellen)

---

### 4. Member-Self-Service-Portal

#### Mitglieder-Dashboard

- Eigene Trainingszeiten & Buchungen einsehen
- Anwesenheitshistorie (Teilnahme-Rate)
- Rechnungen & Zahlungen downloaden (PDF)
- Profil-Self-Service (Adresse, Telefon, Notfallkontakt)
- Eigene Spielstärke & Levelfortschritt
- Trainingsstatistiken (Stunden/Monat)
- Kommende Events & Turniere

#### Buchungen verwalten

- Eigene Platzbuchungen erstellen/stornieren
- Privatstunden buchen
- Probetraining anmelden
- Gruppe wechseln (Antrag stellen)

#### Kommunikation

- News & Ankündigungen vom Club sehen
- Push-Benachrichtigungen (Training abgesagt, neue Rechnung)
- Direktnachrichten an Trainer/Admin
- Bewertung von Trainern abgeben

---

### 5. Mitgliederakquise & Onboarding

#### Public Registration Flow

- Öffentliche Club-Landing-Page (z.B. `/apply/tc-beispiel`)
- Online-Bewerbungsformular für neue Mitglieder
- Datenerfassung (Name, Geburtsdatum, Spielstärke, Präferenzen)
- Upload von Dokumenten (Einverständniserklärung, Gesundheitszeugnis)
- Admin-Genehmigungsworkflow (approve/reject)
- Automatisches Onboarding-Mail mit Login-Daten
- SEPA-Mandatsunterzeichnung online

#### Probetraining-Management

- Probetraining-Anfragen verwalten
- Zuordnung zu passender Gruppe
- Feedback nach Probetraining
- Conversion-Tracking (Probe → Mitglied)

#### Wartelisten-Management

- Warteliste für ausgebuchte Gruppen
- Automatische Benachrichtigung bei freiem Platz
- Priorisierung (Wartezeit, Level)

---

### 6. Datenimport & Migration

#### CSV/Excel-Import

- Bulk-Mitgliederimport mit Vorlage
- Validierung & Fehlerbehandlung (Duplikate, fehlende Felder)
- Historische Daten-Migration (alte Rechnungen, Buchungen)
- Mapping-Assistent (Spalten zuordnen)
- Preview vor finalem Import
- Rollback-Funktion bei Fehlern

#### Export-Funktionen

- Mitgliederliste als Excel/CSV
- Finanzdaten für Buchhaltung
- DSGVO-Datenauskunft pro Mitglied
- Backup gesamte Club-Daten

---

### 7. Erweiterte Saison-/Trainingsplanung

#### Langfristplanung

- Mehrere Saisonen parallel verwalten (Winter 24/25, Sommer 25)
- Saisonvorlagen (Winter/Sommer mit unterschiedlichen Zeiten)
- Ferienpausen automatisch blockieren (Schulferien)
- Jahresplanung mit Meilensteinen
- Saisonende-Automatismen (Gruppen archivieren, Neue Saison initiieren)

#### Gruppendynamik

- Automatische Level-Anpassung (Aufsteiger/Absteiger)
- Spielstärke-Tracking über Zeit
- Probetrainings-Verwaltung
- Warteliste für überbuchte Gruppen
- Gruppenwechsel-Requests
- Eltern-Kind-Gruppen

#### KI-Optimierungen

- Mitgliederpräferenzen lernen (bevorzugte Zeiten)
- Konflikt-Erkennung (Überschneidungen)
- Auslastungs-Forecast
- Trainer-Auslastung balancieren

---

### 8. Reporting & Compliance

#### Berichte & Exporte

- Mitgliederstatistiken (Alter, Geschlecht, Level, Aktivität)
- Auslastungsreports pro Platz/Trainer/Zeitslot
- Finanzübersicht (Einnahmen, offene Posten, Mahnungen)
- Trainingsauslastung (welche Gruppen laufen gut/schlecht)
- DSGVO-konforme Datenexporte
- Custom Reports (eigene KPIs definieren)

#### Dashboards für Vorstand

- Mitgliederentwicklung (Neu/Abgänge)
- Revenue-Entwicklung (Monat/Jahr)
- Zahlungsmoral (Quote offener Rechnungen)
- Trainer-Kosten vs. Einnahmen
- Platzauslastung (Spitzenzeiten identifizieren)
- Forecast nächste Saison

#### Steuer & Buchhaltung

- DATEV-Export (SKR03/SKR04)
- Umsatzsteuer-Berichte (7% für gemeinnützige Vereine)
- Jahresabschluss-Vorbereitung
- Mitgliedsbeiträge nach Steuerarten getrennt
- Spendenbescheinigungen (für gemeinnützige Vereine)

---

### 9. Mobile App (Phase 3)

#### Native iOS/Android App (Expo/React Native)

- Schnellerer Zugriff als Web
- Push-Notifications (Training in 1h, neue Nachricht)
- Offline-Funktionalität (Kalender, Kontakte)
- Mobile-optimierte Buchungsansicht
- Biometrische Anmeldung (Face ID, Fingerprint)
- QR-Code-Scanner (Check-in bei Trainings)

#### Mobile-spezifische Features

- GPS-Navigation zum Club
- Wetter-Widget für Platzentscheidung
- Schnellbuchung (nächster freier Platz)
- Live-Scores bei Turnieren
- Social Feed (Fotos, Erfolge teilen)

---

### 10. Clubhaus-Funktionen

#### Events & Turniere

- Turniermanagement (Anmeldung, Spielpläne, Ergebnisse)
- Turnierformate (KO, Gruppen, Schweizer System)
- Social Events (Clubfeste, Sommerfest, Weihnachtsfeier)
- Teilnehmerlisten & Check-in
- Event-Kalender (öffentlich & intern)
- Fotogalerien hochladen
- Event-Erinnerungen automatisch

#### Turnierplanung

- Bracket-Generator (automatisch nach Spielstärke)
- Match-Scheduling auf Plätzen
- Schiedsrichter-Einteilung
- Preisgelder/Pokale verwalten
- Live-Ergebnisse veröffentlichen
- Turnier-Historie

#### Shop & Ausrüstung

- Ball-Bestellung für Mitglieder (Rabatt)
- Merch-Shop (Club-Shirts, Jacken, Caps)
- Equipment-Verleih (Schläger, Ball-Maschine)
- Inventarverwaltung
- Online-Payment-Integration
- Abholung/Lieferung organisieren

---

### 11. Kommunikationstools

#### Messaging

- In-App-Chat (Mitglieder ↔ Trainer ↔ Admin)
- Gruppenchats pro Trainingsgruppe
- Broadcast-Nachrichten (an alle/bestimmte Gruppen)
- Dateianhänge (Trainingspläne, Fotos)
- Lesebestätigungen
- Archivierung alter Chats

#### E-Mail-Kampagnen

- Newsletter-System (Drag & Drop Editor)
- Automatische Erinnerungen (Training morgen, Rechnung offen)
- Geburtstags-Mails (mit Gutschein)
- Segmentierung (nur Erwachsene, nur Kinder, nur Trainer)
- A/B-Testing für E-Mails
- Öffnungs-/Klickraten tracken

#### Benachrichtigungen

- Push-Notifications (App)
- E-Mail-Benachrichtigungen
- SMS (optional, für wichtige Infos)
- Benachrichtigungs-Präferenzen pro User

---

### 12. Integrations & API

#### Drittanbieter-Integration

- Google Calendar Sync (Trainings automatisch eintragen)
- Apple Calendar Sync
- Mailchimp/SendGrid für E-Mail-Marketing
- Zapier/Make für Workflows (z.B. neues Mitglied → Slack-Nachricht)
- WhatsApp Business API (Status-Updates)
- Zoom/Teams (Online-Trainings)

#### Public API

- REST API für externe Tools
- Webhooks für Events (neues Mitglied, Buchung, Zahlung)
- Club-Website-Widgets (z.B. "Nächste Trainings", "Freie Plätze")
- API-Dokumentation (OpenAPI/Swagger)
- Rate-Limiting & Authentication (API Keys)

#### Datenfeeds

- Wetter-API (automatische Platzschließung bei Regen)
- Feiertags-API (automatisch freie Tage markieren)
- Payment-Provider (Stripe, PayPal, SEPA)

---

### 13. Admin-Tools

#### Benutzerrollen & Rechte

- Granulare Rechteverwaltung (wer darf was)
  - Superadmin (alles)
  - Club-Admin (Club-Verwaltung, Finanzen)
  - Trainer (eigene Gruppen, Anwesenheit)
  - Platzwart (Buchungen, Wartung)
  - Kassenwart (nur Finanzen)
  - Mitglied (eigene Daten, Buchungen)
- Rollen-Templates (schnelles Setup)
- Audit-Log (wer hat was wann geändert)
- Zwei-Faktor-Authentifizierung (Admin-Konten)

#### Club-Branding

- Logo-Upload (Header, Rechnungen, E-Mails)
- Farb-Theme pro Club (Primary Color, Akzentfarbe)
- Custom Domain (z.B. `buchung.tc-beispiel.de`)
- White-Label-Option (SWINGZ-Logo verstecken)
- Custom E-Mail-Templates
- Eigene AGBs/Datenschutzerklärung hochladen

#### Systemverwaltung

- Backup & Restore
- Datenbank-Wartungsfenster ankündigen
- Feature-Flags (neue Features schrittweise ausrollen)
- Staging-Umgebung für Tests
- Multi-Language-Support (Deutsch, Englisch)

---

### 14. KI-Erweiterungen

#### Intelligente Features

- Automatische Level-Einstufung (Spielstärke-Analyse basierend auf Matches)
- Churn-Prognose (wer könnte kündigen? → Engagement-Maßnahmen)
- Upselling-Vorschläge (Privatstunden anbieten, wenn Spieler stagniert)
- Wetterbasierte Planungsanpassungen (Hallenbuchung bei Regenprognose)
- Personalisierte Trainingsempfehlungen
- Automatisches Gruppen-Rebalancing bei Leveländerungen

#### Predictive Analytics

- Auslastungsprognose nächste Woche/Monat
- Optimale Trainingszeiten für neue Gruppen
- Trainer-Bedarf-Forecast
- Revenue-Forecast basierend auf Trends

#### Chatbot

- FAQ-Bot für Mitglieder ("Wann ist mein Training?")
- Buchungs-Assistent ("Finde mir einen Platz Dienstagabend")
- Onboarding-Hilfe für neue Mitglieder

---

## 🟡 Nice-to-Have Features

### Wartungsverwaltung

- Platzpflege-Kalender (wann wurde welcher Platz gepflegt)
- Netz-Checks, Linien nachmalen
- Beleuchtung-Wartungsintervalle
- Wartungsprotokolle mit Fotos
- Externe Dienstleister-Verwaltung

### Materialverwaltung

- Bälle-Inventar (wann nachbestellen)
- Netze, Schläger-Verleih tracken
- Verschleiß-Tracking (Plätze, Equipment)
- Automatische Nachbestellungen bei niedrigem Bestand

### Videoanalyse

- Upload von Trainingsvideos
- Annotationen durch Trainer
- Vorher/Nachher-Vergleiche
- Video-Bibliothek pro Spieler

### Gamification

- Badges & Achievements (100 Trainings absolviert, 1 Jahr Mitglied)
- Leaderboards (wer spielt am meisten)
- Challenges (z.B. "Spiele 10x im Mai")
- Loyalty-Programm (Punkte sammeln → Rabatte)

### Turnier-Features

- Bracket-Generator (automatisch)
- Live-Scores eingeben
- Turnier-Livestream (für wichtige Matches)
- Statistiken pro Spieler (Gewinnrate, Asse, etc.)

### Family-Accounts

- Mehrere Mitglieder unter einem Konto
- Familienrabatte
- Ein Login für Eltern → Kinder verwalten
- Gesamtrechnung für Familie

### Rabatt-Coupons

- Werbeaktionen ("Freund-werben-Freund")
- Saisonstart-Rabatte
- Frühbucher-Rabatt für nächste Saison
- Gutschein-Codes (einmalig/mehrfach verwendbar)

### QR-Code-Check-in

- QR-Code pro Training generieren
- Spieler scannen bei Ankunft → Anwesenheit erfasst
- Kontaktlose Erfassung (COVID-tauglich)
- Check-in-Historie

### Feedback-System

- Mitglieder bewerten Trainings (1-5 Sterne)
- Anonyme Verbesserungsvorschläge
- Trainer-Feedback an Spieler
- Zufriedenheits-Umfragen (NPS)

---

## 📊 Priorisierung nach Business-Impact

### ⚡ Must-Have (Phase 2 Completion)

**Business-kritisch, ohne diese Features keine vollständige SaaS-Lösung**

1. **Finanzmanagement** (Rechnungen, SEPA, Mahnwesen)
   - **Grund:** Ohne Abrechnung kein Revenue, ohne SEPA keine Automatisierung
   - **Effort:** Hoch (4-6 Wochen)
   - **Impact:** Kritisch

2. **Platzbuchungssystem**
   - **Grund:** Zweiter Hauptschmerzpunkt von Tennisclubs nach Trainingsplanung
   - **Effort:** Hoch (3-4 Wochen)
   - **Impact:** Sehr hoch

3. **Member-Self-Service-Portal**
   - **Grund:** Reduziert Admin-Workload massiv, steigert Mitgliederzufriedenheit
   - **Effort:** Mittel (2-3 Wochen)
   - **Impact:** Hoch

4. **Mitgliederakquise** (Public Registration)
   - **Grund:** Wachstum ohne manuelle Admin-Arbeit unmöglich
   - **Effort:** Mittel (2 Wochen)
   - **Impact:** Hoch

5. **Trainer-Portal mit Verfügbarkeit**
   - **Grund:** Ohne Trainer-Input keine realistische KI-Planung
   - **Effort:** Mittel (2-3 Wochen)
   - **Impact:** Hoch

---

### 🔥 High Priority (Post-MVP, Q2-Q3 2026)

**Steigern Produktwert erheblich, aber nicht blockierend**

6. **Reporting & Exports**
   - **Effort:** Mittel (2 Wochen)
   - **Impact:** Hoch (Entscheider brauchen Daten)

7. **E-Mail-Kampagnen & Benachrichtigungen**
   - **Effort:** Mittel (2 Wochen)
   - **Impact:** Hoch (Engagement)

8. **Event-Management**
   - **Effort:** Mittel (2-3 Wochen)
   - **Impact:** Mittel-Hoch

9. **Mobile App** (Phase 3)
   - **Effort:** Sehr hoch (8-12 Wochen)
   - **Impact:** Hoch (Mobile-First-Nutzer)

10. **API & Integrationen**
    - **Effort:** Mittel (2-3 Wochen)
    - **Impact:** Mittel (Flexibilität)

---

### 🎯 Medium Priority (Q4 2026)

**Differenzierungsmerkmale, steigern Stickiness**

11. **Shop & Merch**
    - **Effort:** Mittel (2 Wochen)
    - **Impact:** Mittel (zusätzlicher Revenue-Stream)

12. **In-App-Chat**
    - **Effort:** Hoch (3-4 Wochen)
    - **Impact:** Mittel

13. **KI-Erweiterungen** (Churn, Upselling)
    - **Effort:** Hoch (ongoing)
    - **Impact:** Mittel-Hoch (differenziert von Wettbewerb)

14. **Custom Branding**
    - **Effort:** Niedrig (1 Woche)
    - **Impact:** Mittel (wichtig für White-Label)

---

### 🌟 Low Priority / Nice-to-Have (2027+)

**Polishing, Niche-Features**

15. Wartungsverwaltung
16. Videoanalyse
17. Gamification
18. Turnier-Livestream
19. QR-Code-Check-in
20. Feedback-Umfragen

---

## 💡 Strategische Empfehlungen für SWINGZ

### Sofortmaßnahmen (nächste 3 Monate)

1. **Finanzmodul implementieren** (exakt wie bei TSOW)
   - Rechnungserstellung mit PDF-Export
   - SEPA-Mandate & Pain.008 XML
   - 3-Stufen-Mahnwesen
   - Stripe-Integration
   - **Warum zuerst:** Ohne Billing kein SaaS-Business

2. **Platzbuchungssystem bauen**
   - Platz-Kalender (Wochen-/Tagesansicht)
   - Buchungsregeln (Vorlaufzeit, Maximaldauer)
   - Warteliste
   - **Warum:** Löst zweiten Hauptschmerzpunkt

3. **Member-Portal launchen**
   - Dashboard (Trainings, Rechnungen)
   - Profil-Self-Service
   - Platzbuchungen für Mitglieder
   - **Warum:** Reduziert 80% der Admin-Anfragen

### Mittelfristig (6-12 Monate)

4. **Public Registration Flow**
5. **Trainer-Portal erweitern** (über Verfügbarkeit hinaus)
6. **E-Mail-Automatisierung** (Onboarding, Erinnerungen)
7. **Reporting-Dashboard** für Vorstände
8. **Mobile App** starten (iOS + Android)

### Langfristig (12-24 Monate)

9. **Event & Turniermanagement**
10. **Shop-Modul**
11. **API öffnen** für Partner
12. **White-Label-Option** für große Verbände
13. **KI-Erweiterungen** (Churn, Personalisierung)

---

## 🎯 Umsetzungskonzept: Quick Wins

### Feature: Finanzmodul (4 Wochen)

**Woche 1:** Datenmodell & Rechnung-Generator

- Tabellen: `invoices`, `invoice_items`, `payments`, `sepa_mandates`
- PDF-Generator mit React-PDF
- Rechnungsnummern-Logik

**Woche 2:** SEPA & Zahlungstracking

- Pain.008 XML-Export
- Zahlungseingang buchen
- Offene Posten-Übersicht

**Woche 3:** Mahnwesen

- Automatische Mahnläufe (Cron/Edge Function)
- 3-Stufen-Logik (14/28/42 Tage)
- Mahngebühren-Berechnung

**Woche 4:** Admin-UI & Testing

- Rechnungsübersicht
- Manuelle Rechnungserstellung
- Zahlungsimport (CSV)
- Stripe Checkout

---

## 📂 Tech Stack Empfehlungen

**Basierend auf TSOW-Architektur:**

- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Payment:** Stripe Connect (für Multi-Tenancy)
- **E-Mail:** Resend oder SendGrid
- **File Generation:**
  - PDFs: react-pdf oder pdfkit
  - Excel: exceljs
  - XML: fast-xml-parser
- **Deployment:** Vercel
- **Mobile:** Expo (React Native) für Phase 3

---

## 🚀 Nächste Schritte

1. **Priorisierung validieren:** Welche 3 Features bringen den meisten Business-Value?
2. **Roadmap erstellen:** Q2-Q4 2026 mit realistischen Timelines
3. **MVP definieren:** Was ist das Minimum für Go-Live mit zahlenden Clubs?
4. **Pilotclubs gewinnen:** 3-5 Early Adopters für Feedback
5. **Feature-Flagging einbauen:** Schrittweise Ausrollen neuer Features

---

## 📞 Kontakt & Feedback

Dieses Dokument ist ein Living Document. Ergänzungen, Priorisierungs-Änderungen und Feature-Requests bitte über:

- **GitHub Issues** (tsowapp/swingz-features)
- **Feedback-Form** auf swingz.vercel.app
- **E-Mail:** feedback@swingz.app

---

**Letzte Aktualisierung:** 02.05.2026  
**Version:** 1.0  
**Erstellt von:** Feature-Analyse-System
