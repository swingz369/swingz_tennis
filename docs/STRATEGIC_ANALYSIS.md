# Strategische Analyse: SwingZ aus Vereinsperspektive

> Stand: 15. Juni 2026 | Vogelperspektive eines deutschen Tennisvereins

---

## 1. Zusammenfassung

SwingZ ist eine **All-in-One-Vereinsplattform** für Tennisvereine, die von der Mitgliederverwaltung über Saisonplanung bis hin zu Liga-Management und Arbeitsdienst-Verwaltung reicht. Die Plattform richtet sich an den typischen deutschen Verein mit ehrenamtlichem Vorstand, 1–4 Trainern und 100–500 Mitgliedern.

**Kernfrage:** Macht das Konzept Sinn — und wo fehlt es im Vergleich zur Konkurrenz?

---

## 2. Konzeptanalyse: Was SwingZ gut macht

### ✅ Stärken

| Bereich                       | Bewertung  | Details                                                                                                                                           |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Saisonplanung**             | ⭐⭐⭐⭐⭐ | Einzigartig! Kein Konkurrent bietet automatische Planung mit Conflict-Detection, Member-Preferences und Cluster-Algorithmus. Das ist der **USP**. |
| **Multi-Tenant / Superadmin** | ⭐⭐⭐⭐⭐ | Plattform-Architektur für Dachverbände oder Multi-Club-Betreiber. ClubDesk hat das nicht.                                                         |
| **Rollen-System**             | ⭐⭐⭐⭐   | 4 Rollen (Member, Trainer, Admin, Superadmin) mit Feature-Flags. Sehr flexibel.                                                                   |
| **Arbeitsdienst-Verwaltung**  | ⭐⭐⭐⭐   | Kein Konkurrent bietet das. Typisch deutsches Vereinsproblem, perfekt gelöst.                                                                     |
| **Liga & Mannschaft**         | ⭐⭐⭐⭐   | Spieltage, Ergebnisse, Aufstellung — alles integriert.                                                                                            |
| **Wetter-Integration**        | ⭐⭐⭐     | Nett, aber nicht entscheidend. Smarte Ergänzung für Außenplätze.                                                                                  |
| **KI-Matchmaking**            | ⭐⭐⭐     | Zukunftsweisend, aber noch früh. Playtomic macht es ähnlich mit "Open Matches".                                                                   |

### ❌ Kritische Lücken

| Bereich                          | Bewertung | Impact       | Konkurrenz                                                                                                                                          |
| -------------------------------- | --------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platzbuchung durch Member**    | ⭐        | **KRITISCH** | Playtomic, MATCHi, CourtReserve — das ist DIE Kernfunktion jeder anderen App. Member können aktuell nur Trainer-Stunden buchen, nicht freie Plätze. |
| **Mobile App / PWA**             | ⭐        | **KRITISCH** | Alle Konkurrenten haben native Apps oder starke PWAs. SwingZ ist nur eine Web-App.                                                                  |
| **Push-Benachrichtigungen**      | ⭐⭐      | **HOCH**     | 360Player, Playtomic, Heja — alle haben Push. SwingZ nur E-Mail + in-app Messages.                                                                  |
| **Self-Service Registrierung**   | ⭐⭐      | **HOCH**     | Neues Mitglied muss eingeladen werden. Playtomic/CourtReserve允许 Selbst-Registrierung + Bezahlung.                                                 |
| **Online-Bezahlung bei Buchung** | ⭐⭐      | **HOCH**     | Beim Buchen direkt bezahlen (Stripe) fehlt. Rechnung kommt erst danach.                                                                             |
| **Community / Social Features**  | ⭐⭐      | **MITTEL**   | Playtomic hat Open Matches, Chat pro Spiel, Bewertungen. SwingZ hat nur internes Messaging.                                                         |
| **Kalender-Sync (Google/Apple)** | ⭐⭐      | **MITTEL**   | ICS-Export existiert, aber kein automatischer Sync. CourtReserve hat das.                                                                           |
| **QR-Check-in am Platz**         | ⭐⭐⭐    | **MITTEL**   | CourtReserve, 1club — QR-Code am Platz für Self-Check-in.                                                                                           |

---

## 3. Wettbewerbsvergleich

### Marktplatz-Archetypen

| Typ                   | Beispiele                       | Fokus                            | SwingZ-Position        |
| --------------------- | ------------------------------- | -------------------------------- | ---------------------- |
| **Booking-Platform**  | Playtomic, MATCHi, CourtReserve | Platzbuchung, Court-Utilization  | ❌ Kein Member-Booking |
| **Vereinsverwaltung** | ClubDesk, MeinVerein, Campai    | Finanzen, Mitglieder, Compliance | ✅ Stark               |
| **Sport-App**         | 360Player, Heja, Spond          | Kommunikation, Eltern, Jugend    | ⚠️ Teilweise           |
| **Enterprise**        | Jonas Club Management           | Country Clubs, F&B, POS          | ❌ Nicht relevant      |
| **Unified/AI**        | 1club, RacquetDesk              | Alles-in-1, KI-Preise            | ⚠️ Ähnliche Vision     |

### Feature-Matrix: SwingZ vs. Konkurrenz

| Feature                   | SwingZ | Playtomic | CourtReserve | ClubDesk | 360Player |
| ------------------------- | ------ | --------- | ------------ | -------- | --------- |
| **Platzbuchung (Member)** | ❌     | ✅        | ✅           | ❌       | ❌        |
| **Trainer-Buchung**       | ✅     | ✅        | ✅           | ❌       | ✅        |
| **Saisonplanung**         | ✅⭐   | ❌        | ❌           | ❌       | ❌        |
| **Liga-Management**       | ✅     | ❌        | ✅           | ❌       | ❌        |
| **Arbeitsdienst**         | ✅     | ❌        | ❌           | ❌       | ❌        |
| **Rechnungswesen**        | ✅     | ⚠️        | ✅           | ✅⭐     | ❌        |
| **SEPA/Lastschrift**      | ✅     | ❌        | ❌           | ✅       | ❌        |
| **Mobile App**            | ❌     | ✅        | ✅           | ⚠️       | ✅        |
| **Push-Notifications**    | ❌     | ✅        | ✅           | ❌       | ✅        |
| **Social/Community**      | ⚠️     | ✅⭐      | ⚠️           | ❌       | ✅⭐      |
| **Multi-Tenant**          | ✅⭐   | ❌        | ❌           | ❌       | ❌        |
| **KI-Features**           | ⚠️     | ⚠️        | ❌           | ❌       | ❌        |
| **Wetter-Integration**    | ✅     | ❌        | ❌           | ❌       | ❌        |
| **Self-Check-in (QR)**    | ❌     | ❌        | ✅           | ❌       | ❌        |

---

## 4. Empfohlene Änderungen (Priorisiert)

### 🔴 P0 — Kritisch (vor Launch)

#### 4.1 Member-Platzbuchung

**Was:** Mitglieder können freie Plätze selbst buchen (nicht nur Trainer-Stunden).
**Warum:** Das ist DIE Grundfunktion jeder Sport-App. Ohne das ist SwingZ nur ein Admin-Tool, keine Member-Platform.
**Vorbild:** Playtomic (3 Klicks: Platz → Zeit → Bezahlen), CourtReserve (Echtzeit-Verfügbarkeit).

**Umsetzung:**

- Verfügbarkeits-Ansicht: Kalender mit freien/belegten Slots pro Platz
- Buchungslogik: Min/Max-Dauer, Vorausbuchung, Stornierungsregeln (aus `booking_rules`)
- Direktzahlung: Stripe Checkout bei Buchung (nicht erst Rechnung)
- Bestätigung: E-Mail + In-App + (später) Push

#### 4.2 Self-Service Registrierung + Onboarding

**Was:** Neues Mitglied kann sich selbst registrieren, Platz buchen und bezahlen — ohne Admin-Einladung.
**Warum:** Vereine wollen keine Gatekeeper sein. Jeder Interessent soll sofort loslegen können.
**Vorbild:** Playtomic (Google-Login → Club wählen → Buchen), 1club (QR-Code am Zaun → Registrierung → Buchung).

**Umsetzung:**

- `/register` Seite mit Club-Auswahl
- Probetraining-Buchung ohne Account (E-Mail reicht)
- Nach Buchung: Account erstellen, Profil vervollständigen
- Admin sieht neue Registrierungen in Genehmigungen

#### 4.3 PWA / Mobile-First

**Was:** Progressive Web App mit Offline-Fähigkeit, Push-Notifications, Home-Screen-Icon.
**Warum:** 70% der Member nutzen das Handy. Eine Web-App ohne Mobile-Optimierung verliert Nutzer.
**Vorbild:** 1club (PWA, kein App-Store nötig), Spond (extrem einfach).

**Umsetzung:**

- `manifest.json` + Service Worker (existiert bereits teilweise!)
- Push-Notifications via Web Push API
- Bottom Navigation für Member (existiert bereits!)
- Touch-optimierte Buchungs-UI

### 🟡 P1 — Wichtig (erste 3 Monate nach Launch)

#### 4.4 Push-Benachrichtigungen

**Was:** Automatische Push-Notifications für Buchungsbestätigungen, Erinnerungen, Saison-Updates.
**Warum:** E-Mails werden ignoriert. Push erreicht sofort.
**Vorbild:** 360Player (Alles wird gepusht), Heja (Eltern-App).

#### 4.5 Online-Bezahlung bei Buchung

**Was:** Bezahlen direkt bei der Buchung, nicht erst Rechnung.
**Warum:** Reduziert Ausfälle, verbessert Cashflow.
**Vorbild:** Playtomic (Stripe), CourtReserve (Stripe + POS).

#### 4.6 Kalender-Sync (Google/Apple)

**Was:** Automatischer ICS-Feed für gebuchte Sessions.
**Warum:** Mitglieder wollen ihre Termine im eigenen Kalender sehen.
**Vorbild:** CourtReserve, Google Calendar Integration.

#### 4.7 Open Matches / Social Play

**Was:** Mitglieder können offene Spiele erstellen, andere können beitreten.
**Warum:** Fördert Community, füllt freie Plätze, hält Mitglieder engaged.
**Vorbild:** Playtomic "Open Matches" — das Feature, das sie populär gemacht hat.

### 🟢 P2 — Nice-to-have (6–12 Monate)

#### 4.8 QR-Check-in am Platz

**Was:** QR-Code am Platz scannen → automatischer Check-in.
**Warum:** Reduziert No-Shows, ermöglicht Self-Service.
**Vorbild:** 1club, CourtReserve.

#### 4.9 Dynamische Preisgestaltung

**Was:** Preise variieren nach Zeit (Peak/Off-Peak), Auslastung, Mitgliedstyp.
**Warum:** Erhöht Court-Utilization und Umsatz.
**Vorbild:** 1club (KI-basierte Preise).

#### 4.10 WhatsApp-Integration

**Was:** Buchungsbestätigungen und Erinnerungen via WhatsApp.
**Warum:** In Deutschland der dominante Kommunikationskanal.
**Vorbild:** Viele kleine Tools nutzen WhatsApp Business API.

---

## 5. Architekturempfehlungen

### 5.1 Booking-Engine als eigenes Modul

Die aktuelle `sessions`-Tabelle ist trainer-zentriert. Für Member-Platzbuchung braucht es eine separate `court_bookings`-Tabelle mit:

- `member_id`, `court_id`, `start_time`, `end_time`
- `booking_type`: `recurring` | `single` | `tournament` | `training`
- `payment_status`: `pending` | `paid` | `refunded`
- `check_in_status`: `pending` | `checked_in` | `no_show`

### 5.2 Notification-Service

Aktuell: nur E-Mail + in-app Messages. Empfehlung:

- **Web Push API** (PWA, kein Drittanbieter nötig)
- **Expo Push** (falls später native App)
- **WhatsApp Business API** (über Twilio oder 360dialog)

### 5.3 Payment-Flow ändern

Aktuell: Admin erstellt Rechnung → Member bezahlt später.
Empfohlen: Buchung → Stripe Checkout → automatische Rechnung.
Die Stripe-Integration existiert bereits (`/api/billing/invoices/[id]/checkout`), muss aber in den Buchungsflow eingebettet werden.

---

## 6. Fazit

**SwingZ hat das Potenzial, die beste deutsche Tennisvereins-App zu werden** — aber nur, wenn die kritischen Lücken geschlossen werden.

### Was SwingZ einzigartig macht (und kein Konkurrent bietet):

1. **Automatische Saisonplanung** mit Conflict-Detection
2. **Arbeitsdienst-Verwaltung** (typisch deutsch, perfekt gelöst)
3. **Multi-Tenant Superadmin** für Dachverbände
4. **Wetter-Integration** für Außenplätze
5. **Liga-Management** integriert

### Was fehlt, um konkurrenzfähig zu sein:

1. **Member-Platzbuchung** — ohne das kein Launch
2. **Mobile-First / PWA** — ohne das keine Adoption
3. **Self-Service Registrierung** — ohne das kein Wachstum
4. **Push-Notifications** — ohne das kein Engagement

### Strategischer Vorschlag:

> SwingZ positioniert sich nicht als "Playtomic-Klon", sondern als **"Vereins-Betriebssystem"** mit einzigartiger Saisonplanung. Die Platzbuchung wird als Grundfunktion hinzugefügt, aber der USP bleibt die Verwaltungstiefe, die kein Booking-Tool bietet.

---

## 7. Priorisierte Roadmap

```
Q3 2026 (P0 — Launch-Voraussetzung)
├── Member-Platzbuchung (Court Booking Engine)
├── Self-Service Registrierung
├── PWA mit Push-Notifications
└── Online-Bezahlung bei Buchung

Q4 2026 (P1 — Engagement)
├── Kalender-Sync (ICS Feed)
├── Open Matches / Social Play
├── WhatsApp-Benachrichtigungen
└── QR-Check-in am Platz

Q1 2027 (P2 — Monetarisierung)
├── Dynamische Preisgestaltung
├── Marketplace (Externe Spieler buchen)
├── Vereinsshop Integration
└── Reporting/Dashboard Erweiterung
```

---

## 8. Quellen & Konkurrenz-Links

| Tool         | URL              | Fokus                    |
| ------------ | ---------------- | ------------------------ |
| Playtomic    | playtomic.com    | Booking + Social         |
| MATCHi       | matchi.com       | Nordic Court Management  |
| CourtReserve | courtreserve.com | Flexible Scheduling      |
| ClubDesk     | clubdesk.de      | German Vereinsverwaltung |
| 360Player    | 360player.com    | Youth Sports Platform    |
| 1club        | 1club.ai         | AI-native Club OS        |
| Heja         | heja.com         | Team Communication       |
| Spond        | spond.com        | Grassroots Sports        |
