# Admin-Rollen-Audit — SwingZ

> Stand: 15. Juni 2026
> Erfasst alle Sidebar-Links, Feature-Flags, API-Routen und UI-Funktionen der Admin-Rolle.

---

## 1. Dashboard (`/admin`)

**Sidebar:** `Home` Icon — erster Link, immer sichtbar

| Funktion        | Beschreibung                                                               |
| --------------- | -------------------------------------------------------------------------- |
| KPI-Karten      | Mitglieder-Anzahl, aktive Buchungen, offene Rechnungen, Trainer-Auslastung |
| Schnellaktionen | Neue Buchung, Mitglied einladen, Saison planen                             |
| Tagesübersicht  | Heutige Sessions mit Platz + Trainer-Info                                  |
| Genehmigungen   | Offene Abwesenheits-/Stundengenehmigungen (Badge-Zähler)                   |

**Dateien:** `dashboard/page.tsx`, `dashboard/dashboard-client.tsx`

---

## 2. Mitglieder (Section: "Mitglieder")

**Sidebar:** `Users` Icon | Feature-Flag: `members` (Core, immer aktiv)

### 2.1 Alle Mitglieder (`/admin/members`)

| Funktion                              | Beschreibung                                          |
| ------------------------------------- | ----------------------------------------------------- |
| Mitgliederliste                       | Tabelle mit Suche, Filter, Sortierung                 |
| Mitglied einladen                     | E-Mail-Dialog mit Rollenauswahl                       |
| Detailansicht (`/admin/members/[id]`) | Profil, Präferenzen, Rechnungen, Gruppenzugehörigkeit |
| Bulk-Import                           | CSV/Excel-Import von Mitgliedern                      |
| Bulk-Deaktivierung                    | Mehrere Mitglieder gleichzeitig deaktivieren          |
| Planungs-Einbeziehung                 | Toggle: Mitglied in Saisonplanung einbeziehen         |

**API:** `/api/members`, `/api/members/[id]`, `/api/members/invite`, `/api/members/bulk-import`, `/api/members/bulk-deactivate`

### 2.2 Genehmigungen (`/admin/approvals`)

| Funktion       | Beschreibung                                |
| -------------- | ------------------------------------------- |
| Offene Anträge | Abwesenheiten, Stundenlogs zur Freigabe     |
| Badge-Zähler   | Anzahl offener Genehmigungen in der Sidebar |

**API:** `/api/admin/approvals/count`

---

## 3. Training & Saison (Section: "Training & Saison")

**Sidebar:** `GraduationCap` Icon | Feature-Flags: `trainers`, `seasons` (Core)

### 3.1 Saisonplanung (`/admin/seasons`)

| Funktion                                         | Beschreibung                                                  |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Saisonliste                                      | Alle Saisons mit Status (Draft, Published, Active, Completed) |
| Neue Saison (`/admin/seasons/new`)               | Name, Typ, Zeitraum, Auto-Plan-Config                         |
| Saison-Detail (`/admin/seasons/[id]`)            | Übersicht, Planung, Präferenzen, Kalender                     |
| Planungs-Wizard (`/admin/seasons/[id]/planning`) | 3-Schritte: Config → Plan generieren → Bestätigen             |
| Konflikterkennung                                | Automatische Trainer-/Platz-Konflikte                         |
| Saison-Gruppen (`/admin/seasons/[id]/groups`)    | Gruppen-Zuweisungen verwalten                                 |
| Präferenzen (`/admin/seasons/[id]/preferences`)  | Mitglieder-Präferenzen einsehen                               |

**API:** `/api/seasons`, `/api/seasons/[id]`, `/api/seasons/[id]/planning/*` (cluster, config, confirm, conflicts, dry-run, members, trainers, waitlist)

### 3.2 Trainer & Stunden (`/admin/trainers`)

| Funktion                                | Beschreibung                                       |
| --------------------------------------- | -------------------------------------------------- |
| Trainerliste                            | Alle Trainer mit Status, Spezialisierungen         |
| Trainer-Detail (`/admin/trainers/[id]`) | Profil, Verfügbarkeit, Stundenlogs, Feedback       |
| Stundenlogs (`/admin/hours-logs`)       | Zeiterfassung der Trainer mit Genehmigungsworkflow |
| Verfügbarkeit                           | Wöchentliche Verfügbarkeitsmuster                  |

**API:** `/api/trainers`, `/api/trainers/[id]`, `/api/trainer-availability`, `/api/hours-logs`

### 3.3 Probetrainings (`/admin/trial-training`) ⚡ Feature-Flag: `trial_training`

| Funktion            | Beschreibung                               |
| ------------------- | ------------------------------------------ |
| Probetrainingsliste | Alle Anfragen mit Status                   |
| Statistiken         | Anfragen, Umwandlungsrate, beliebte Zeiten |
| Umwandlung          | Trial → Vollmitglied konvertieren          |

**API:** `/api/trial-trainings`, `/api/trial-trainings/[id]`, `/api/trial-trainings/stats`

### 3.4 Turniere (`/admin/tournaments`) ⚡ Feature-Flag: `tournaments`

| Funktion                                   | Beschreibung                      |
| ------------------------------------------ | --------------------------------- |
| Turnierliste                               | Alle Turniere mit Status          |
| Neues Turnier (`/admin/tournaments/new`)   | Name, Datum, Teilnehmerlimit, Typ |
| Turnier-Detail (`/admin/tournaments/[id]`) | Teilnehmer, Ergebnisse, Bracket   |

**API:** `/api/tournaments`, `/api/tournaments/[id]`, `/api/tournaments/[id]/register`

---

## 4. Plätze (Section: "Plätze")

**Sidebar:** `MapPin` Icon | Immer sichtbar

### 4.1 Platz-Kalender & Verwaltung (`/admin/courts`)

| Funktion                                  | Beschreibung                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Wochenansicht                             | 7-Tage-Kalender mit allen Plätzen, Sessions, Buchungen                               |
| Tagesansicht                              | Google-Calendar-Style Zeitachse (6:00–22:00)                                         |
| Listenansicht                             | Kompakte Buchungsübersicht                                                           |
| Platz-Auswahl                             | Kartenansicht aller Plätze mit Verfügbarkeits-Indikator                              |
| Drag & Drop                               | Admin: Sessions zwischen Plätzen/Zeiten verschieben                                  |
| Platz sperren                             | Dialog: Veranstaltung, Wartung oder **Wetter** (3 Optionen)                          |
| Wetter-Banner                             | Aktuelles Wetter (Stadt, Temp, Bedingung, Empfehlung) + Link zu /admin/weather       |
| Court-Closures                            | Aktive Platzsperren als Badges unter dem Wetter-Banner (nur Admin)                   |
| Wetter-Sperrtyp                           | Block-Dialog: "Wetter" füllt Beschreibung mit Wetter-Bedingung (z.B. "Regen, Frost") |
| ICS-Export                                | Kalender-Export aller Sessions                                                       |
| Direktbuchung                             | Admin: Walk-in-Buchung direkt im Kalender                                            |
| Plätze verwalten (`/admin/courts/manage`) | CRUD für Plätze (Name, Oberfläche, Indoor, Flutlicht)                                |

**API:** `/api/courts`, `/api/courts/[id]`, `/api/courts/[id]/schedule`, `/api/sessions/block`, `/api/bookings/direct`

### 4.2 KI-Matchmaking (`/admin/ai/matchmaking`) ⚡ Feature-Flag: `ai_matchmaking`

| Funktion               | Beschreibung                     |
| ---------------------- | -------------------------------- |
| Matchmaking-Vorschläge | KI-basierte Partner-Empfehlungen |

**API:** `/api/ai/matchmaking`

### 4.3 Wetter & Platzsperren (`/admin/weather`) ⚡ Feature-Flag: `weather_integration`

| Funktion                   | Beschreibung                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Wetterübersicht            | Aktuelle Temperatur, Wind, Niederschlag, Empfehlung                                                                                   |
| Automatische Ortserkennung | Club-Stadt aus `system_settings.club_city` + OpenWeatherMap Geocoding. Wird beim Onboarding automatisch gespeichert. Fallback: Berlin |
| Aktive Platzsperren        | Liste aller aktiven Closures                                                                                                          |
| Neue Sperre erstellen      | Platz, Grund (Wetter/Wartung/Event), Zeitraum                                                                                         |
| Sperre aufheben            | Einzelne Sperren deaktivieren                                                                                                         |
| Auto-Close                 | Bei Gewitter/Schnee/Regen>10mm: automatische Außenplatz-Sperre (Empfehlung rot)                                                       |
| Wetter-Empfehlung          | 3 Stufen: grün (ok), gelb (Regen/Wind>10/<2°C), rot (Gewitter/Schnee>2/Regen>10)                                                      |

**API:** `/api/weather/check`, `/api/weather/closures`, `/api/weather/closures/[id]`

---

## 5. Liga & Mannschaft (Section: "Liga & Mannschaft") ⚡ Feature-Flag: `league_lineup`

**Sidebar:** `Flag` Icon

### 5.1 Ligen & Teams (`/admin/leagues`)

| Funktion                            | Beschreibung                                   |
| ----------------------------------- | ---------------------------------------------- |
| Liga-Liste                          | Alle Ligen mit Status, Sportart, Division      |
| Neue Liga                           | Name, Saison, Sportart, Division, Altersgruppe |
| Liga-Detail (`/admin/leagues/[id]`) | Teams, Spieltage, Tabelle                      |
| Team-Verwaltung                     | Teams erstellen, Mitglieder zuweisen           |

**API:** `/api/leagues`, `/api/leagues/[id]`, `/api/leagues/[id]/teams`, `/api/leagues/[id]/teams/[teamId]/members`

### 5.2 Spieltage (`/admin/leagues/matchdays`)

| Funktion           | Beschreibung                                       |
| ------------------ | -------------------------------------------------- |
| Spieltag-Liste     | Alle Spieltage mit Datum, Gegner, Ergebnis         |
| Ergebnis eintragen | Heim/Auswärts-Score, Sieg/Niederlage/Unentschieden |
| Liga-Status        | Aktiv/Abschließen/Reaktivieren                     |

**API:** `/api/leagues/[id]/matchdays`, `/api/leagues/[id]/matchdays/[matchdayId]`

---

## 6. Arbeitsdienst (Section: "Arbeitsdienst") ⚡ Feature-Flag: `work_duty`

**Sidebar:** `HardHat` Icon

### 6.1 Dienste verwalten (`/admin/work-duties`)

| Funktion       | Beschreibung                                                |
| -------------- | ----------------------------------------------------------- |
| Dienstliste    | Alle Arbeitsdienste mit Status, Datum, Priorität            |
| Neuer Dienst   | Titel, Typ, Datum, Zeit, max. Teilnehmer                    |
| Bulk-Erstellen | Serienerstellung mit Datumsbereich & Rhythmus               |
| Typen          | Platzwartung, Event-Support, Bardienst, Reinigung, Coaching |

**API:** `/api/work-duties`, `/api/work-duties/[id]`, `/api/work-duties/bulk`

### 6.2 Zuweisungen (`/admin/work-duties/assignments`)

| Funktion             | Beschreibung                                          |
| -------------------- | ----------------------------------------------------- |
| Zuweisungsliste      | Alle Zuweisungen mit Status                           |
| Mitglied zuweisen    | Einzelne oder mehrere Mitglieder zu Dienst hinzufügen |
| Freiwilligen-Meldung | Mitglieder können sich selbst zuweisen                |
| Abschluss bestätigen | Admin bestätigt erledigte Dienste                     |

**API:** `/api/work-duties/[id]/assign`, `/api/work-duties/[id]/volunteer`, `/api/work-duties/[id]/complete`

---

## 7. Finanzen (Section: "Finanzen")

**Sidebar:** `DollarSign` Icon | Feature-Flag: `finance` (Core)

### 7.1 Abrechnung & Kategorien (`/admin/billing`)

| Funktion             | Beschreibung                                      |
| -------------------- | ------------------------------------------------- |
| Rechnungsübersicht   | Alle Rechnungen mit Status, Filter                |
| Gebührenkategorien   | Verwaltung von Beitragsarten, Trainingsgebühren   |
| Monatliche Übersicht | Einnahmen/Ausgaben nach Kategorie                 |
| SEPA-Verwaltung      | Mandate, Lastschriften                            |
| Trainer-Abrechnung   | Stundenbasierte Trainer-Vergütung                 |
| Mahnwesen            | Automatische Mahnungen für überfällige Rechnungen |

**API:** `/api/billing/*`, `/api/fee-configurations`, `/api/payment-settings`

### 7.2 Analytics & Berichte (`/admin/analytics`)

| Funktion          | Beschreibung                            |
| ----------------- | --------------------------------------- |
| KPI-Dashboard     | Mitgliederwachstuch, Auslastung, Umsatz |
| Buchungs-Export   | CSV-Export aller Buchungen              |
| Mitglieder-Export | CSV-Export aller Mitglieder             |
| Umsatz-Export     | CSV-Export aller Zahlungen              |

**API:** `/api/analytics`, `/api/analytics/bookings/export`, `/api/analytics/members/export`, `/api/analytics/revenue/export`

---

## 8. Einstellungen (Section: "Einstellungen")

**Sidebar:** `Settings` Icon

### 8.1 Vereinseinstellungen (`/admin/settings`)

| Funktion      | Beschreibung                               |
| ------------- | ------------------------------------------ |
| Allgemein     | Vereinsname, Öffnungszeiten, Standardwerte |
| Branding      | Logo, Farben, Custom Domain                |
| Audit-Logs    | Alle Admin-Aktionen mit Zeitstempel        |
| Saisonplanung | Globale Planungseinstellungen              |

**API:** `/api/system-settings`, `/api/branding`, `/api/admin/audit-logs`

### 8.2 Shop verwalten (`/admin/shop`) ⚡ Feature-Flag: `shop`

| Funktion     | Beschreibung                |
| ------------ | --------------------------- |
| Produkte     | CRUD für Shop-Artikel       |
| Bestellungen | Bestellübersicht mit Status |
| Datei-Upload | Produktbilder hochladen     |

**API:** `/api/admin/shop/products`, `/api/admin/shop/orders`, `/api/admin/shop/upload`

---

## 9. Allgemein (Secondary Navigation)

Immer sichtbar für alle Rollen:

| Link                      | Icon            | Beschreibung                            |
| ------------------------- | --------------- | --------------------------------------- |
| Mein Profil (`/profile`)  | `User`          | Profil bearbeiten, Avatar, Kontaktdaten |
| Nachrichten (`/messages`) | `MessageSquare` | Interne Messaging-Funktion              |

---

## 10. Feature-Flags Übersicht

| Flag                  | Standard   | Beschreibung                  |
| --------------------- | ---------- | ----------------------------- |
| `members`             | ✅ aktiv   | Mitgliederverwaltung (Core)   |
| `trainers`            | ✅ aktiv   | Trainerverwaltung (Core)      |
| `seasons`             | ✅ aktiv   | Saisonplanung (Core)          |
| `finance`             | ✅ aktiv   | Abrechnung & Finanzen (Core)  |
| `shop`                | ❌ inaktiv | Vereinsshop                   |
| `tournaments`         | ❌ inaktiv | Turnierverwaltung             |
| `trial_training`      | ❌ inaktiv | Probetrainings                |
| `ai_matchmaking`      | ❌ inaktiv | KI-Matchmaking                |
| `weather_integration` | ❌ inaktiv | Wetter & Platzsperren         |
| `league_lineup`       | ❌ inaktiv | Liga & Mannschaftsaufstellung |
| `work_duty`           | ❌ inaktiv | Arbeitsdienst-Verwaltung      |

---

## 11. Zusammenfassung: Admin-Navigation

```
📊 Dashboard                          /admin
├── 👥 Mitglieder
│   ├── Alle Mitglieder               /admin/members
│   └── Genehmigungen                /admin/approvals
├── 🎓 Training & Saison
│   ├── Saisonplanung                /admin/seasons
│   ├── Trainer & Stunden            /admin/trainers
│   ├── Probetrainings               /admin/trial-training     ⚡
│   └── Turniere                     /admin/tournaments        ⚡
├── 📍 Plätze
│   ├── Platz-Kalender & Verwaltung  /admin/courts
│   ├── KI-Matchmaking               /admin/ai/matchmaking     ⚡
│   └── Wetter & Platzsperren        /admin/weather            ⚡
├── 🏁 Liga & Mannschaft             (Feature-Flag)            ⚡
│   ├── Ligen & Teams                /admin/leagues
│   └── Spieltage                   /admin/leagues/matchdays
├── 🔨 Arbeitsdienst                 (Feature-Flag)            ⚡
│   ├── Dienste verwalten            /admin/work-duties
│   └── Zuweisungen                  /admin/work-duties/assignments
├── 💰 Finanzen
│   ├── Abrechnung & Kategorien      /admin/billing
│   └── Analytics & Berichte         /admin/analytics
├── ⚙️ Einstellungen
│   ├── Vereinseinstellungen         /admin/settings
│   └── Shop verwalten               /admin/shop               ⚡
└── Allgemein
    ├── Mein Profil                  /profile
    └── Nachrichten                  /messages
```

⚡ = Feature-Flag-gesteuert, kann deaktiviert werden
