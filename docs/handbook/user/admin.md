# Admin — Vereins-Administrator

> Zuletzt verifiziert: 16.08.2026

> Wer bist du? Du bist Hauptverantwortliche:r **eines Vereins**. Dein Verein hat eine `club_id`, du bist genau diesem Verein zugeordnet. Du hast **alle Funktionen für deinen Verein** — aber keine Quer-Sicht auf andere Vereine.

**Dashboard:** `/admin/members` (Standard-Dispatch) · **Rolle in Hierarchie:** Stufe 3 · **club_id:** gesetzt (genau 1)

> **Dieses Handbuch-Kapitel ist das umfangreichste.** Mit ~30 Admin-Pages deckt es alle operativen Bereiche ab.

---

## 🎯 Was kannst du?

- Vollzugriff auf **alle deines Vereins** Modul-Bereiche
- Mitglieder einladen, Rollen zuweisen (Trainer, Familienmitglied, Office-Rollen)
- Sessions planen, Bookings verwalten
- Saison-Planung (Wizard), KI-Clustering
- Court- und Court-Type-Verwaltung
- Preisregeln (Peak/Off-Peak, Saison-Aufschläge)
- Rechnungen erstellen, Mahnwesen
- Tournament & Liga-Verwaltung (wenn Modul aktiv)
- Trainer-Verwaltung: Verfügbarkeiten, Abwesenheiten, Hours-Log, Member-Notes
- Branded-Emails, Newsletter
- Eigener Branding (Logo + Farben)
- Audit-Log für deinen Verein

## 🖥 Dashboard — `/admin/members`

Beim Login landest du hier. Das Dashboard zeigt:

- **KPI-Strip:** Mitglieder, Trainer, Heute-Sessions, Umsatz, offene Anfragen
- **Inbox-Banner:** Genehmigungen ausstehend? Rechnungen ausstehend?
- **Heute im Verein:** Trainings-Sessions, Aktivitäten
- **Quick Actions:** Mitglieder einladen, Session erstellen, Saison planen, Rechnung erstellen
- **Smart-Action-Cards:** Saison-Planung, Pricing, Decisions (je nach Modul-Activation)

## 🧭 Pages — alle 30+ Admin-Bereiche (gruppiert)

### Mitglieder-Verwaltung (`/admin/members*`)

| Page                              | Was tust du dort?                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `/admin/members`                  | Mitglieder-Liste mit Suche, Filter (Status, Rolle), Bulk-Action (Export, Einladen)    |
| `/admin/members/[id]`             | Member-Profil: Stammdaten, Memberships (über alle Vereine), Bookings, Invoices, Notes |
| `/admin/members/[id]/invoices`    | Rechnungs-Tab des Members                                                             |
| `/admin/members/[id]/preferences` | Spieler-Präferenzen (Niveau, Verfügbarkeiten)                                         |
| `/admin/members/new`              | Direkt-Anlage (meist lieber via Einladen)                                             |
| `/admin/members/family`           | Familiengruppen anlegen, Mitglieder zuordnen (Eltern verwalten Kinder)                |
| `/admin/members/invite`           | E-Mail-Einladung                                                                      |

**Workflow: Mitglied einladen**

1. `/admin/members/invite` → E-Mail, Rolle, optional Name
2. POST `/api/members/invite`
3. Supabase Magic-Link an E-Mail → User bestätigt → wird aktiv
4. Notification-Dispatch → Welcome-E-Mail (Template: `member_invite`)

### Saison-Planung (`/admin/seasons*`)

| Page                                  | Zweck                                                   |
| ------------------------------------- | ------------------------------------------------------- |
| `/admin/seasons`                      | Saison-Liste, Status (draft, planned, active, archived) |
| `/admin/seasons/new`                  | Saison anlegen (Name, Zeitraum, Trainings-Gruppen)      |
| `/admin/seasons/[id]`                 | Saison-Detail                                           |
| `/admin/seasons/[id]/edit`            | Saison bearbeiten                                       |
| `/admin/seasons/[id]/planning`        | Wizard: Trainings-Gruppen + Verfügbarkeiten             |
| `/admin/seasons/[id]/plan`            | Plan-Ansicht: generierter Wochenplan                    |
| `/admin/seasons/[id]/conflicts`       | Conflict-Resolution                                     |
| `/admin/seasons/[id]/billing`         | Saison-Abrechnung generieren                            |
| `/admin/seasons/[id]/preferences/new` | Mitglieder-Präferenzen für Saison erfassen              |

**Workflow: Saison planen (4 Schritte)**

```
1. /admin/seasons/new → Zeitraum + Spielgruppen-Größe
2. /admin/seasons/[id]/planning → Wizard Steps:
   a. Trainer-Verfügbarkeiten prüfen (read-only)
   b. Mitglieder-Wünsche erfassen (CSV-Import oder manuell)
   c. KI-Clustering (Gemini Flash): Vorschläge für Trainingsgruppen
   d. Backtrack-Konflikte lösen
3. /admin/seasons/[id]/plan → Wochenraster visualisieren
4. /admin/seasons/[id]/publish → in Produktion nehmen
5. /admin/seasons/[id]/billing → Rechnungen generieren
```

Familien werden dabei zu **einer Sammel-Rechnung an den Erwachsenen** zusammengefasst
(im Finalize-Schritt als „Familie"-Badge erkennbar); die Kinderpositionen stehen
aufgeschlüsselt in derselben Rechnung.

### Sessions & Bookings (`/admin/sessions*`, `/admin/seasons*`)

Sessions sind die Eintrittskarte für jeden Trainingstag:

- Sessions aus Plan generieren (auto)
- Manuelle Session hinzufügen
- Cancellation einer Session → Notification + ggf. Storno-Rechnung
- QR-Checkin für Anwesenheit

### Plätze (`/admin/courts*`)

| Page                   | Zweck                               |
| ---------------------- | ----------------------------------- |
| `/admin/courts`        | Platz-Liste                         |
| `/admin/courts/[id]`   | Platz-Details, Wartung              |
| `/admin/courts/manage` | Bulk-Edit (Typ, Beleuchtung, Belag) |

Platztypen (Sandplatz, Halle, …) werden in `/admin/courts` verwaltet — aufklappbarer
Bereich in der Platz-Liste. `/admin/court-types` existiert nicht mehr und leitet dorthin.

Plätze sind auch Smart-Court-relevant → IoT-Integration via `/admin/hardware/*` (wenn Modul aktiv).

### Trainer (`/admin/trainers*`)

| Page                         | Zweck                                              |
| ---------------------------- | -------------------------------------------------- |
| `/admin/trainers`            | Liste, Filter (aktiv, inaktiv), Verfügbarkeit-Sync |
| (Detail über Trainer-Profil) | Trainer-Stundennachweis, Member-Notes              |

⚠️ Trainer-Verwaltung ist stark mit `/trainer`-Pages verzahnt — viele Daten Sync-Zwischen Admin und Trainer-Self-Service.

### Finanzen (`/admin/billing*`, `/admin/fees*`)

| Page                           | Zweck                                                             |
| ------------------------------ | ----------------------------------------------------------------- |
| `/admin/billing`               | Rechnungs-Übersicht (Status, Suche, Filter)                       |
| `/admin/billing/invoices/[id]` | Rechnungs-Detail (line-items, status-machine)                     |
| `/admin/billing/dunning`       | Mahnwesen-Liste (Stufe 1/2/Verzug)                                |
| `/admin/billing/season/[id]`   | Saison-Abrechnung-Detail                                          |
| `/admin/billing/dues`          | Monats-Beiträge (periodisch)                                      |
| `/admin/billing/stripe-portal` | Stripe-Customer-Portal-Link                                       |
| `/admin/billing/categories`    | Fee-Categories (Trainer-Stunde, Platz-Buchung, Mitglieds-Beitrag) |
| `/admin/fees`                  | Fee-Configuration CRUD                                            |

**Workflow: Monats-Rechnung generieren**

1. `/admin/billing/dues` → "Monats-Beiträge erstellen"
2. POST `/api/billing/dues/generate { period: 'YYYY-MM' }`
3. Pro Member: LineItem mit Status `pending` → INSERT
4. Versand via `/api/notifications/dispatch` → E-Mail mit PDF-Attachment

### Preisregeln (Preisgestaltung)

`/admin/pricing` → Preisregeln definieren (Peak/Off-Peak, Sonn-/Feiertage, Saison-Aufschläge). Immer verfügbar — kein Feature-Flag mehr.

### Turniere & Liga (je nach Modul)

- `/admin/events` — Veranstaltungen-Hub (Tabs „Turniere" + „Sonderveranstaltungen")
- `/admin/leagues` — Liga-Verwaltung (nuLiga-Sync)
- `/admin/leagues/[id]` — Tabs: Teams, Spieltage, Kader, Tabelle, Bewirtung

**Liga mit nuLiga verbinden:** In den Liga-Einstellungen die **Mannschaftsseite**
hinterlegen — also die nuLiga-Seite der eigenen Mannschaft („Mannschaftsportrait",
URL enthält `/wa/teamPortrait`). Aus dieser einen Adresse holt der Sync die eigenen
Spieltermine, den Kader mit LK (per DTB-ID den Mitgliedern zugeordnet) und über
den Liga-Link die Tabelle. Wer stattdessen die Gruppenseite (`/wa/groupPage`)
einträgt, muss zusätzlich „Eigene Mannschaft" exakt so ausfüllen, wie der Name in
der nuLiga-Tabelle steht — sonst wird nur die Tabelle übernommen, nicht der
Spielplan.

Bei einem Heimspieltag lassen sich über den Button „Plätze" alle aktiven Plätze
für diesen Tag sperren; das Löschen des Spieltags gibt sie automatisch wieder frei.

### Analytics (`/admin/analytics*`)

KPIs: Buchungs-Trends, Trainer-Performance, Revenue (Charts in `components/charts/recharts`).

### Audit & Maintenance

- `/admin/audit-logs` — Vereins-Audit-Log (DSGVO-Pflicht)
- `/admin/maintenance` — Wartungs-Modus togglen
- `/admin/settings` — Branding, Module, Vereins-Setup

### Decisions (Mitglieder-Abstimmung)

`/admin/decisions` → Vorschläge erstellen, Voting managen, Ergebnis publizieren. Siehe `lib/decisions/`.

### Engagement

- `/admin/email-campaigns` — Newsletter, Broadcast
- `/admin/newsletters` → Newsletter-Templates
- `/admin/documents` — Vereins-Doku hochladen

## ⚙ Häufige Aktionen

### Mitglied einladen (siehe oben)

### Saison planen + KI-Clustering

```
Voraussetzungen:
- ≥ 6 Mitglieder
- ≥ 2 Trainer mit Verfügbarkeiten
- Modul 'seasons' aktiv (default)

Schritte:
1. /admin/seasons/[id]/planning → "Cluster starten"
   → POST /api/ai/season-cluster
   → Gemini Flash analysiert Verfügbarkeiten + Niveau + Trainer-Kapazität
   → Vorschläge: 3-5 Trainingsgruppen mit Zuordnung
2. Manueller Override möglich (Drag-and-Drop)
3. Conflict-Resolution: "Welcher Trainer ist Doppel-belegt?"
4. Publish
```

### Rechnungslauf (Monats-Beiträge)

1. `/admin/billing/dues` → "Beiträge für aktuellen Monat erstellen"
2. Bestätigen → POST `/api/billing/invoices/generate`
3. Übersicht: alle Pending-Invoices mit Status `pending`
4. Stripe-Sync: Send-Link an Member → Zahlen via Stripe

### Mahnwesen-Stufen

```
Stufe 0: Rechnung fällig (14 Tage nach Versand)
Stufe 1: Mahnung (15 Tage überfällig) → 5 € Gebühr
Stufe 2: 2. Mahnung (30 Tage) → 10 € Gebühr + Verzugszins
Stufe 3: Inkasso (45 Tage) → ggf. Member-Account-Sperre
```

## 🤝 Zusammenspiel mit anderen Rollen

| Edge-Case                                 | Was passiert?                                                                                                                           | Wie handelst du?                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Member verlässt Verein                    | Membership `is_active=false`, NICHT gelöscht (DSGVO-Audit-Trail bleibt)                                                                 | "Re-Activate"-Button oder anonymisieren (via Owner)                                                     |
| Trainer wechselt zwischen Vereinen        | Mehrfach-Membership in `user_club_memberships`                                                                                          | Du verwaltest **deinen** Eintrag, andere Vereine handle andere Admins                                   |
| Du spielst selbst im Verein               | Du bist bereits Mitglied (eine Zeile pro Verein) → Sidebar-Schalter „Verwalten (Admin)" ↔ „Spielen (Mitglied)", kein Freischalten nötig | Persönliche Suche unter `/partner-finder`; die Admin-Seite `/admin/partner-finder` bleibt nur Übersicht |
| Saison-Plan berührt PLANS-Wizard          | Genehmigung deinerseits, dann Publish                                                                                                   | /admin/seasons/[id]/publish                                                                             |
| Member hat SEPA-Lastschrift → Rückbuchung | Stripe-Chargeback-Notification → Du siehst es im Audit-Log                                                                              | Mit Bank klären, ggf. manuell korrigieren                                                               |
| Smart-Court Hardware-Problem              | IoT schickt Status-Update                                                                                                               | /admin/hardware/\* zeigt Status, manuelles Override                                                     |

## ⚠️ Pflichten & Risiken

1. **Audit-Trail niemals löschen** — DSGVO-relevant
2. **DSGVO-Auskunft** auf Verlangen: `/api/user/data-export` triggern, an Member senden
3. **Mahnwesen**: Nicht willkürlich Stufe überspringen, immer dokumentieren
4. **Stripe**: bei Refund > 50 € immer Owner informieren

## 🧪 Tests

`tests/e2e/admin-*.spec.ts`:

- Member-Einladung → Login → Onboarding
- Saison-Planung Wizard
- Rechnung generieren → Versenden → Paid (Webhook-Mock)
- Audit-Log-Verifikation

## 📚 Verwante Kapitel

- [`../user/owner.md`](./owner.md), [`../user/superadmin.md`](./superadmin.md), [`../user/trainer.md`](./trainer.md), [`../user/member.md`](./member.md)
- [`dev/auth-rbac.md`](../dev/auth-rbac.md), [`dev/data-model.md`](../dev/data-model.md)
