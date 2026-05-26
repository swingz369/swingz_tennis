# SwingZ — Vereinsanalyse

> **Umfassende Analyse aus Sicht eines Tennisvereins**  
> Stand: Mai 2026 · Version 1.0

---

## 1. Executive Summary

**SwingZ ist eine architektonisch hervorragend entworfene, moderne Tennisclub-Management-Plattform.** Sie bildet alle Kernprozesse eines Tennisvereins (Mitglieder, Platzbuchung, Saison-/Trainingsplanung, Finanzen) in einem geschlossenen, rollenbasierten System ab. Besonders herausragend ist die KI-gestützte Saisonplanung mit dem Clustering-Algorithmus, der einen der komplexesten Pain Points der Vereinsverwaltung massiv vereinfacht. Die Plattform ist sicher, transaktionssicher und Multi-Tenant-fähig. Es gibt jedoch substanzielle Lücken in den Bereichen Familien-/Eltern-Accounts, Platzwart-Funktionalität und Gastspielermanagement, die für einen produktiven Einsatz in vielen Vereinen essenziell wären.

**Gesamtbewertung: 8,5 / 10**

---

## 2. Methodik

Die Analyse betrachtet die App aus **sechs Vereins-Perspektiven** entlang des gesamten Vereinslebens:

| #   | Perspektive                         | Repräsentiert durch                                     |
| --- | ----------------------------------- | ------------------------------------------------------- |
| 1   | **Vorstand / Admin**                | Verwaltung, Finanzen, Saisonplanung, Mitglieder-CRUD    |
| 2   | **Trainer**                         | Stunden, Verfügbarkeit, Abrechnung, Teilnehmer-Feedback |
| 3   | **Mitglieder**                      | Buchung, Trainingsplan, Rechnungen, Kommunikation       |
| 4   | **Interessenten / Neue Mitglieder** | Registrierung, Probetraining, Onboarding                |
| 5   | **Eltern (Jugendliche)**            | Verwaltung minderjähriger Spieler, Familienabrechnung   |
| 6   | **Platzwart**                       | Platzpflege, Witterungssperren, Platzbelegung           |

---

## 3. Stärken — Was ist gut gelöst?

### 3.1 Trainingsplanung & Clustering-Engine 🟢 _Herausragend_

Der **9-stufige Greedy-Algorithmus** (`lib/season-planning/clustering-engine.ts`) ist das Herzstück und Alleinstellungsmerkmal:

- **Hard Constraints**: Trainer-/Platzverfügbarkeit, Doppelbuchungen, Niveau-Spannen
- **Soft Constraints**: Wunschpartner, historische Ausfallraten, Trainer-Spezialisierung
- **Saisonübergreifendes Lernen**: `seasonStatistics` → Optimierung zukünftiger Pläne
- **Drag & Drop Nachbearbeitung**: Admin kann Plan manuell anpassen
- **7 Konflikttypen**: Automatische Erkennung vor dem Publizieren
- **Transaktionale Sicherheit**: Alles-oder-nichts beim Veröffentlichen

Dies spart Vereinen **mehrere Tage manuelle Planungsarbeit pro Saison**.

### 3.2 Buchungssystem 🟢 _Sehr gut_

- **Race-Condition-sicher**: `create_booking_safe` (Supabase RPC) verhindert Doppelbuchungen
- **Serienbuchungen**: Wöchentliche/monatliche Dauerbuchungen bis zu 52 Wochen
- **Stornierungsregeln**: Konfigurierbare Fristen (`cancellation_hours_before`)
- **Automatische Stunden-Erfassung**: Jede Trainer-Session erzeugt einen `hours_log`-Eintrag

### 3.3 Rollen- & Sicherheitsmodell 🟢 _Vorbildlich_

| Schutz-Ebene   | Mechanismus                                                                     |
| -------------- | ------------------------------------------------------------------------------- |
| Auth           | Supabase Session (`withApiAuth`)                                                |
| Role           | `verifyRole(auth, minRole)` — Hierarchie: superadmin > admin > trainer > member |
| Rate Limit     | STANDARD (30/min), STRICT (10/min), CLUSTER (5/h), CONFIRM (3/h)                |
| CSRF           | Token-basiert für alle mutierenden Endpoints                                    |
| Club-Isolation | Non-Superadmin sieht nur eigenen Club                                           |
| Audit          | Komplette Historisierung aller Admin-Aktionen                                   |

### 3.4 Finanzen & Abrechnung 🟢 _Gut durchdacht_

- **Automatische Monatsrechnungen**: `POST /api/billing/generate-invoices`
- **SEPA-Lastschrift**: Vollständiger PAIN.008 XML-Export
- **Trainer-Abrechnung**: `hours_logs` → Genehmigung → `trainer_billings` + Rechnung
- **Zahlungs-Gateways**: Stripe, Bank-Transfer, Barzahlung (erweiterbar)
- **Gebührenkonfiguration**: Flexible `fee_configurations` mit Staffelung nach Alter, Typ

### 3.5 Trainer-Feedback & Höherstufungen 🟢 _Innovativ_

- Trainer können am Saisonende jedes Mitglied bewerten
- `ready_for_next_level` fließt automatisch in die nächste Saison-Clustering ein
- `trainer_feedback`-Tabelle mit Performance-Ratings, Stärken, Verbesserungsbereichen

---

## 4. Verbesserungspotential & fehlende Features

### 🔴 A. Hohe Dringlichkeit / Hoher geschäftlicher Nutzen

#### A1. Familien- & Eltern-Accounts (Fehlt nahezu vollständig)

**Problem:**  
Die `users`- und `members`-Entitäten setzen Einzelpersonen mit eigener E-Mail voraus. Im Tennisverein verwalten Eltern typischerweise die Buchungen/Trainings ihrer Kinder, die oft keine eigene E-Mail-Adresse haben. Es gibt keine Möglichkeit, Kinder unter einem Eltern-Account zu führen.

**Auswirkungen:**

- Eltern müssen separate Logins für jedes Kind verwalten
- Keine Familien-Sammelrechnung möglich
- Keine elterliche Kontrolle über Buchungen Minderjähriger
- Datenschutz: Elterliche Zustimmung nicht abbildbar

**Lösungsansatz:**

```sql
-- Neue Tabelle: family_accounts
CREATE TABLE family_accounts (
  id UUID PRIMARY KEY,
  primary_user_id UUID REFERENCES users(id),
  family_name VARCHAR(200),
  billing_consolidated BOOLEAN DEFAULT true
);

-- Neue Tabelle: family_members
CREATE TABLE family_members (
  family_id UUID REFERENCES family_accounts(id),
  user_id UUID REFERENCES users(id),
  relationship VARCHAR(20), -- 'parent', 'child', 'spouse'
  can_manage_bookings BOOLEAN DEFAULT false
);
```

**Aufwand:** Mittel-Hoch (Schema, UI, Buchungslogik, Billing)

---

#### A2. Gastspieler-Management (Fehlt/Unzureichend)

**Problem:**  
Es existiert kein Workflow, wenn ein Mitglied mit einem Nicht-Mitglied (Gast) spielen möchte. Gastgebühren sind nicht in der Buchungs- oder Abrechnungslogik integriert. `trialTrainings` deckt nur Probetrainings ab, nicht aber reguläre Gastspiele.

**Auswirkungen:**

- Vereine können Gastspieler nicht korrekt abrechnen
- Keine Nachverfolgung von Gastspieler-Frequenz (potenzielle Mitglieder)
- Keine automatische Gastgebühr auf Mitgliedsrechnung

**Lösungsansatz:**

- `bookings`-Tabelle um `is_guest_booking` und `guest_name` erweitern
- Gastgebühren-Konfiguration in `fee_configurations` (`type: 'guest'`)
- Automatische Abrechnung über die Rechnung des buchenden Mitglieds

**Aufwand:** Mittel

---

#### A3. Kommunikations-Modul (Fehlt)

**Problem:**  
Es gibt keine vereinsweiten Benachrichtigungen außerhalb von Transaktions-E-Mails (Buchungsbestätigung, Saisonplan, Rechnung). Es gibt keine Ankündigungen, Newsletter, Push-Nachrichten für Platzsperrungen oder Event-Einladungen.

**Auswirkungen:**

- Keine zentrale Kommunikationsplattform für den Verein
- Witterungsbedingte Platzsperrungen erreichen Mitglieder nicht rechtzeitig
- Kein Newsfeed oder Ankündigungssystem ersichtlich

**Lösungsansatz:**

- Vorhandene `notifications`-Tabelle ausbauen
- `POST /api/notifications/broadcast` für Massen-Benachrichtigungen
- E-Mail-Templates für verschiedene Anlässe
- Optional: Push-Benachrichtigungen (Web Push API)

**Aufwand:** Mittel

---

### 🟡 B. Mittlere Dringlichkeit / Variabler Nutzen

#### B1. Platzwart-Rolle & Platzsperrungen

**Problem:**  
Es gibt keine dedizierte Platzwart-Rolle. Kurzfristige Sitz-bedingte Sperrungen (Regen, Platzpflege) sind nicht abbildbar. Plätze kennen nur `is_active` (Dauerzustand), keine temporären Sperrzeiten.

**Lösungsansatz:**

- Neue Rolle `court_manager` oder Delegation an Trainer
- `court_blockouts`-Tabelle mit Start/Ende, Grund (`rain`, `maintenance`, `tournament`)
- Massen-Stornierung betroffener Sessions mit automatischer E-Mail
- Selbstbedienungs-Portal für Platzwart (Mobile-optimiert)

**Aufwand:** Gering-Mittel

---

#### B2. Flexible Mitgliedschaften & Pausierung

**Problem:**  
`is_active` ist binär. Im echten Vereinsleben gibt es medizinische Pausen, passive Mitgliedschaften, Auslandssemester etc. Das Billing unterscheidet diese Fälle nicht.

**Lösungsansatz:**

- `membershipStatus` um Werte wie `medical_leave`, `passive`, `sabbatical` erweitern
- Billing-Engine: automatisches Pausieren/Aussetzen bei bestimmten Status
- Wiedereintritts-Workflow nach Pause

**Aufwand:** Gering

---

#### B3. Trainer-Spesen & Zusatzkosten

**Problem:**  
`trainer_billings` kennt nur Stunden × Stundensatz. In der Praxis fallen Fahrtkosten, Turnierbetreuungspauschalen oder Materialkosten an, die separat abgerechnet werden müssen.

**Lösungsansatz:**

- `billingLineItems` um `expense_type`-Feld erweitern (`travel`, `tournament`, `material`)
- Spesenabrechnung im Trainer-Billing-Workflow

**Aufwand:** Gering

---

#### B4. SEPA Pre-Notification (Vorabankündigung)

**Problem:**  
Gemäß SEPA-Regularien muss der Einzug dem Zahler vorab angekündigt werden (meist 14 Tage). Der aktuelle Workflow zeigt nur die PAIN.008-XML-Generierung, keine automatisierte Vorabankündigung.

**Lösungsansatz:**

- Trigger beim Invoice-Generate: Plane Pre-Notification-E-Mail X Tage vor Fälligkeit
- Checkbox im Billing-UI: „Pre-Notification heute versenden"
- Compliance: Rechtssichere Vorlagen mit Widerspruchsfrist

**Aufwand:** Gering

---

### 🟢 C. Niedrige Dringlichkeit / Nice-to-have

#### C1. Turniermanagement

**Problem:**  
Es gibt `tournaments`-Routen, aber die Integration in den restlichen Workflow (Platzsperrungen, Teilnehmer-Management, Auslosung) ist unklar.

**Empfehlung:** Bestehende `tournaments`-Struktur ausbauen und mit `court_blockouts` verknüpfen.

---

#### C2. Inventar- & Materialverwaltung

**Problem:**  
Keine Verwaltung von Vereinsmaterial (Bälle, Leibchen, Markierungshütchen, Schlüssel). Gerade für größere Vereine mit mehreren Plätzen relevant.

---

#### C3. Gamification & Member-Engagement

**Problem:**  
Es existiert eine `gamification`-Route, aber der Funktionsumfang ist unklar. Eine spielerische Komponente (Ranglisten, Challenges, Abzeichen) könnte die Mitgliederbindung erhöhen.

---

#### C4. Matchmaking / Spielpartner-Vermittlung

**Problem:**  
Es gibt `POST /api/ai/matchmaking` — dies könnte zu einem starken Differenzierungsmerkmal werden, wenn es Mitgliedern hilft, passende Spielpartner zu finden.

---

## 5. Architektur- & Tech-Debt-Anmerkungen

### 5.1 DB-Schema-Konsistenz

| Tabelle                                    | Problem                                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_club_memberships`                    | Compound Primary Key `(user_id, club_id)` definiert — aber `id`-Spalte ist trotzdem vorhanden und als PK markiert. Das `pk`-Constraint in Drizzle ist evtl. nur ein Index. |
| `club_members` vs. `user_club_memberships` | Zwei separate Tabellen mit ähnlicher Funktion. Sollte konsolidiert werden.                                                                                                 |
| `trainers`                                 | Kein `club_id`-Feld, nur N:M über `trainer_club`. Verkompliziert Query-Logik.                                                                                              |
| `sepa_mandates`                            | Verwendet CamelCase (`clubId`, `memberId`) statt Snake_Case wie die restlichen Tabellen.                                                                                   |

### 5.2 Soft-Delete DSGVO-Konformität

- `members`-Route macht Soft-Delete (`is_active = false`), aber es fehlt eine `deleted_at`-Spalte
- Kein dokumentierter Prozess für DSGVO-Hard-Delete nach Ablauf der Aufbewahrungsfrist
- Kein Anonymisierungs-Workflow für ausgetretene Mitglieder

### 5.3 Legacy-Routen & API-Konsistenz

- `/api/billing/invoices/create` wird als „Legacy" bezeichnet — sollte entfernt werden
- `POST /api/billing/invoices` hat keine explizite `verifyRole`-Prüfung, nur `requireAuth`
- Inkonsistente Response-Formate zwischen verschiedenen API-Gruppen

### 5.4 Rate-Limiting-Lücken

- `GET /api/coupons` ist öffentlich ohne Auth — Brute-Force-Risiko für Gutscheincodes
- Einige POST-Endpoints haben kein Rate-Limiting dokumentiert

### 5.5 Testing

- Nur ein E2E-Test (`member-lifecycle.test.ts`) und ein Wizard-Test in Entwicklung
- Keine Load-Tests für das Buchungssystem (Race-Conditions unter Last)
- Unit-Test-Abdeckung unklar

---

## 6. Perspektiven-Matrix: Wer kann was?

| Aktion                          | Member | Trainer | Admin | Superadmin |
| ------------------------------- | :----: | :-----: | :---: | :--------: |
| Eigene Buchungen verwalten      |   ✅   |   ✅    |  ✅   |     ✅     |
| Platz buchen                    |   ✅   |   ✅    |  ✅   |     ✅     |
| Trainingsplan einsehen          |   ✅   |   ✅    |  ✅   |     ✅     |
| Eigene Rechnungen sehen         |   ✅   |   ✅    |  ✅   |     ✅     |
| Stunden erfassen                |   ❌   |   ✅    |  ✅   |     ✅     |
| Rechnungen für andere erstellen |   ❌   |   ❌    |  ✅   |     ✅     |
| Saison planen (Wizard)          |   ❌   |   ❌    |  ✅   |     ✅     |
| SEPA-Lastschrift ausführen      |   ❌   |   ❌    |  ❌   |     ✅     |
| Kinder/Familie verwalten        |   ❌   |   ❌    |  ❌   |     ❌     |
| Platz sperren (Witterung)       |   ❌   |   ❌    |  ❌   |     ❌     |
| Gastspieler anmelden            |   ❌   |   ❌    |  ❌   |     ❌     |

---

## 7. Roadmap-Empfehlung

### Q2 2026 — Foundation (3 Monate)

1. **Familien- & Elternfunktionen** — Account-Verknüpfung, Kinder-Accounts, Eltern-Berechtigung
2. **Platzwart-Features** — Witterungssperren, Push-Benachrichtigungen, temporäre Court-Blockaden
3. **Kommunikations-Modul** — Vereinsweite Ankündigungen, E-Mail-Newsletter, Push-Nachrichten

### Q3 2026 — Maturity (3 Monate)

4. **Gastspieler-Management** — Buchung, Abrechnung, Conversion-Tracking
5. **Flexible Mitgliedschaften** — Pausierung, Medizinische Pause, Passive Mitgliedschaft
6. **SEPA Pre-Notification** — Rechtssichere Vorabankündigung, automatisierter Versand
7. **Trainer-Spesen** — Fahrtkosten, Turnierpauschalen, Material

### Q4 2026 — Excellence (3 Monate)

8. **Turniermanagement ausbauen** — Auslosung, Platzsperrungen, Ergebnis-Erfassung
9. **Gamification** — Challenges, Abzeichen, Ranglisten
10. **Matchmaking AI** — Spielpartner-Vermittlung auf Basis von Niveau & Präferenzen
11. **DSGVO-Tooling** — Automatisierte Löschfristen, Anonymisierung, Datenexport

---

## 8. Fazit

**SwingZ ist eine beeindruckend durchdachte, technisch exzellente Plattform mit einem klaren USP in der KI-gestützten Saisonplanung.** Die Architektur (Next.js, Supabase, Drizzle) ist modern, die Sicherheit vorbildlich und die Entwicklungsqualität hoch (transaktionale Buchungen, 7-fache Konfliktprüfung, vollständiges Audit-Logging).

Die größten Lücken liegen nicht in der technischen Qualität, sondern in der Abbildung realer Vereinsstrukturen — insbesondere Familien-/Eltern-Accounts. Diese sind für die Mehrheit der Tennisvereine mit aktiver Jugendarbeit ein **harter Produktanforderung**, kein Nice-to-have.

Mit der in der Roadmap vorgeschlagenen Priorisierung kann SwingZ innerhalb eines Jahres von einer exzellenten technischen Plattform zu einer **marktreifen, vollständigen Vereinsmanagement-Lösung mit Alleinstellungsmerkmal** reifen.

---

_Analyse erstellt am 21. Mai 2026 · Grundlage: Codebase-Analyse (Schema, API-Routen, Workflows, Pages, Domain-Modell)_
