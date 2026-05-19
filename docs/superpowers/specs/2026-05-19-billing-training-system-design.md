# Billing & Training System Design

**Date:** 2026-05-19  
**Status:** Approved for implementation

---

## 0. Multi-Verein / Superadmin

Der Superadmin-Kontext ist bereits vollständig implementiert: `/superadmin` zeigt alle Vereine plattformweit, über `Als Admin →` setzt ein Cookie (`ADMIN_CLUB_COOKIE`) und der Superadmin landet im normalen Admin-Dashboard des jeweiligen Vereins. Das Billing-System läuft vollständig im Club-Kontext — kein zusätzliches Verbund-Layer nötig. Der Superadmin erbt das gesamte Billing-UI über den bestehenden Club-Switch-Mechanismus.

---

## 1. Overview

A unified billing and training management system for tennis clubs on SwingZ. Handles three invoice types, configurable pricing (extending existing `fee_configurations`), school-holiday-aware scheduling, SEPA-first payment flows, and a symmetric credit system for group changes.

---

## 2. Invoice Types

`invoices.invoice_type` — neue Spalte auf der bestehenden `invoices`-Tabelle:

| Wert | Bedeutung |
|---|---|
| `season` | Saison-Rechnung (Training) |
| `membership` | Mitgliedsbeitrag |
| `adhoc` | Zusatz-Rechnung |

Zusätzlich: `invoices.season_id uuid FK → schedules` — Verknüpfung zur Saison (nullable, für Zusatz-Rechnungen leer).

### 2.1 Saison-Rechnung
- Generiert automatisch bei Saisonstart oder manuell vom Admin
- Basis: alle nicht-schulferien-gesperrten Sessions der Saison
- Preis pro Mitglied: per `fee_configurations` (type=`training`) inkl. JSONB-Bedingungen (Alter, Mitgliedstyp)
- Unterstützt Ratenzahlung → `invoice_installments`-Tabelle (s. Abschnitt 6)
- GoBD: nach `sent` → immutable (kein Edit, nur Storno + Neu)

### 2.2 Mitgliedsbeitrag
- Einmalig pro Saison/Jahr pro Mitglied
- Betrag aus `fee_configurations` (type=`membership`)
- Keine Ratenzahlung
- GoBD: gleiche Immutability-Regel

### 2.3 Zusatz-Rechnung
- Manuell, Freitext-Positionen mit Menge und Einheitspreis
- Referenz optional: Booking, Session oder ohne Referenz
- Immer Einmalzahlung

---

## 3. Pricing Architecture

### 3.1 `fee_configurations` erweitern (kein neues Schema)

Die bestehende Tabelle `fee_configurations` (type ∈ `membership|training|court|other`, JSONB-Conditions) wird direkt genutzt — keine separate `training_price_categories`. Die JSONB-`conditions`-Spalte unterstützt bereits Alters- und Mitgliedstypfilterung.

Ergänzung: `fee_configurations.billing_unit_count int` — Anzahl Billing-Units pro Session (wird für Berechnungen gebraucht).

### 3.2 Member-Category Assignment

Neue Spalte auf `user_club_memberships`:
```sql
fee_configuration_id uuid REFERENCES fee_configurations(id) ON DELETE SET NULL
```
Admin weist Mitglied eine Fee-Konfiguration zu. Null = Fallback auf die Standardkonfiguration des Clubs für diesen Typ.

### 3.3 Billing Unit

`clubs.billing_unit_minutes int DEFAULT 60` — 45 oder 60 Min. Session-Dauer ÷ billing_unit_minutes = Anzahl Billing-Units für Preisberechnung.

### 3.4 Umsatzsteuer

`clubs.tax_rate numeric(5,2) DEFAULT 0` — Pro Club konfigurierbar. Gemeinnützige e.V. nach §4 Nr. 22b UStG: 0%. Gewerbliche Anbieter: 19%. `invoice_items.tax_rate` bleibt wie bisher, wird bei Generierung aus `clubs.tax_rate` übernommen.

---

## 4. School Holiday Calendar

### 4.1 Storage

```sql
school_holidays (
  id uuid PK,
  bundesland text NOT NULL,     -- "Bayern", "NRW", "Baden-Württemberg" etc.
  name text NOT NULL,            -- "Sommerferien 2026"
  start_date date NOT NULL,
  end_date date NOT NULL,
  year int NOT NULL,
  UNIQUE (bundesland, name, year)
)
```

Zentral gepflegt (Seed-Skript), read-only für Clubs. Clubs wählen ihr Bundesland in den Vereinseinstellungen: `clubs.bundesland text`.

### 4.2 Saison-Planung

Beim Generieren von Sessions für eine Saison: jede Session deren `timeslot_start::date` innerhalb einer Schulferienperiode des Club-Bundeslands liegt, erhält `status = 'holiday_cancelled'`. Admin kann einzelne Sessions manuell überschreiben.

### 4.3 Rechnungsberechnung

Nur Sessions mit `status IN ('scheduled', 'completed')` fließen in die Saison-Rechnung ein. `holiday_cancelled`-Sessions werden nicht berechnet.

---

## 5. Training Group Membership History

Um Gruppenänderungs-Credits korrekt berechnen zu können, braucht das System den vollständigen Verlauf wer wann in welcher Gruppe war.

```sql
training_group_memberships (
  id uuid PK,
  training_group_id uuid FK → training_groups,
  member_id uuid FK → users,
  club_id uuid FK → clubs,
  joined_at date NOT NULL,
  left_at date,                  -- NULL = aktiv
  left_reason text,              -- 'group_change', 'season_end', 'cancelled', 'manual'
  created_by uuid FK → users,
  created_at timestamptz DEFAULT now()
)
```

Beim Gruppenänderungsprozess:
1. Alte Zeile: `left_at = today`, `left_reason = 'group_change'`
2. Neue Zeile: `joined_at = today`
3. Sessions remaining old group = Sessions in `training_groups.schedule_id` mit `timeslot_start > today` und `status != 'holiday_cancelled'`
4. → Credit/Debit-Buchung in `member_balance_entries`

---

## 6. Group Change Credit System

### 6.1 Neue Tabellen

```sql
member_balances (
  id uuid PK,
  member_id uuid FK → users,
  club_id uuid FK → clubs,
  balance numeric(10,2) DEFAULT 0,   -- positiv = Guthaben, negativ = Schuld
  updated_at timestamptz,
  UNIQUE (member_id, club_id)
)

member_balance_entries (
  id uuid PK,
  member_balance_id uuid FK → member_balances,
  amount numeric(10,2) NOT NULL,       -- positiv = Gutschrift, negativ = Belastung
  reason text NOT NULL,
  reference_type text,                 -- 'group_change', 'invoice', 'payment', 'manual'
  reference_id uuid,
  created_by uuid FK → users,
  created_at timestamptz DEFAULT now()
)
```

### 6.2 Gruppenänderungs-Logik

Symmetrie-Garantie: beide Seiten werden in einer DB-Transaktion geschrieben.

```
Gutschrift = remaining_sessions_old × price_per_unit_old × billing_units_per_session
Belastung  = remaining_sessions_new × price_per_unit_new × billing_units_per_session
```

Nettodelta → `member_balances.balance` update.

### 6.3 Balance-Anwendung bei Rechnungsgenerierung

- `balance > 0`: Als Gutschrift-Position auf der Rechnung (bis max. Rechnungsbetrag), Rest verbleibt als Guthaben
- `balance < 0`: Als Schuldenposition auf der Rechnung addiert
- Beide Fälle erzeugen einen `member_balance_entries`-Eintrag mit `reference_type = 'invoice'`

---

## 7. Payment Configuration

### 7.1 Zahlungswege — SEPA primär

In deutschen Vereinen ist SEPA-Lastschrift der Standard. Stripe/Online-Zahlung ist sekundär.

**Reihenfolge im UI:**
1. SEPA Lastschrift (Mandat bereits in `sepa_mandates` modelliert)
2. Überweisung (manuell, Admin markiert als bezahlt)
3. Bar (Admin markiert als bezahlt)
4. Stripe Checkout (Online-Zahlung)

`clubs.default_payment_method text DEFAULT 'sepa'` — steuert welcher Weg in der Rechnung als primär angeboten wird.

### 7.2 Ratenzahlung — `invoice_installments` Tabelle

Statt Array in Season-Config eine eigenständige Tabelle:

```sql
invoice_installments (
  id uuid PK,
  invoice_id uuid FK → invoices ON DELETE CASCADE,
  installment_number int NOT NULL,        -- 1, 2, 3
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'pending'           -- 'pending', 'paid', 'overdue'
    CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_at timestamptz,
  payment_id uuid FK → payments,
  created_at timestamptz DEFAULT now()
)
```

Saison-Konfiguration auf `schedules`: `installment_count int DEFAULT 1` (1 = keine Raten), `installment_due_dates date[]`. Bei Generierung werden `invoice_installments`-Zeilen automatisch angelegt.

### 7.3 Invoice-Status-Lifecycle (GoBD-konform)

```
draft → sent → partially_paid → paid
              ↓
            overdue → dunning (Level 1/2/3, bereits in dunning_records)
              ↓
           cancelled (nur mit Storno-Beleg, Originaldokument bleibt erhalten)
```

Nach `sent`: UPDATE auf `invoices` nur noch für Status-Felder (`status`, `paid_amount`, `paid_at`, `cancelled_at`). Alle anderen Felder sind gesperrt — erzwungen via DB-Trigger `prevent_invoice_content_update`.

### 7.4 Invoice-Nummernformat

Konfigurierbar per Club: `clubs.invoice_number_prefix text DEFAULT 'INV'`. Format: `{prefix}-{YYYY}{MM}-{NNNNN}`. Bestehende `generate_invoice_number()`-Funktion wird entsprechend erweitert.

### 7.5 Zahlungserinnerung (vor Mahnung)

Neuer Status zwischen `overdue` und `dunning`: `reminder_sent`. Freundliche Erinnerung ohne Mahngebühr, 7 Tage nach Fälligkeit. Erst danach greift `dunning_records` Level 1.

---

## 8. DATEV-Export Vorbereitung

Kein UI jetzt, aber das Datenmodell muss es ermöglichen:
- `invoice_items.datev_account_number text` — nullable, optional manuell pflegbar
- `clubs.datev_creditor_number text` — nullable Konfigurationsfeld
- Ziel: künftiger CSV-Export nach DATEV-Buchungsstapel-Format ohne Schema-Änderung

---

## 9. Data Flow

```
Saison angelegt
  └→ Admin konfiguriert: Bundesland, billing_unit_minutes, default_payment_method, 
        installment_count, invoice_number_prefix, tax_rate
  └→ Sessions generiert → Schulferien-Check → holiday_cancelled Sessions markiert
  └→ Saison-Rechnung generiert pro Mitglied:
       - fee_configuration per Mitglied ermitteln
       - billable Sessions zählen × billing_units × price_per_unit
       - member_balances.balance anwenden (Gutschrift/Schuld)
       - invoice_installments anlegen wenn installment_count > 1
       └→ Status: draft → Admin verschickt → sent (danach immutable)
       └→ Zahlung: SEPA / Überweisung / Bar / Stripe
       └→ Webhook / manuell → payment created → invoice status update trigger

Gruppenänderung
  └→ training_group_memberships: old.left_at = today, new row
  └→ Credit/Debit berechnen (Transaktion)
  └→ member_balance_entries × 2 → balance update
  └→ Nächste Rechnung: Balance als Zeile
```

---

## 10. Admin UI

- **Vereinseinstellungen:** Bundesland, billing_unit_minutes, tax_rate, default_payment_method, invoice_number_prefix, DATEV-Felder
- **Saisons:** installment_count + due dates, Schulferienprev iew
- **Mitglieder:** fee_configuration zuweisen, Guthaben/Schulden-Saldo sichtbar
- **Gruppen:** Gruppenänderung durchführen (Credit-Berechnung mit Vorschau)
- **Rechnungen:** Liste nach Typ + Status, Zusatz-Rechnung erstellen, Status-Übergänge, Mahnstatus
- **Preiskategorien:** `fee_configurations` CRUD (type=training/membership)
- **Schulferien:** Bundesland-Info, read-only Kalender

---

## 11. Superadmin

Der Superadmin nutzt den bestehenden Club-Switch-Mechanismus (`ADMIN_CLUB_COOKIE`). Nach dem Switch landet er im normalen Admin-UI des gewählten Vereins — das gesamte Billing-System ist dadurch ohne Änderungen für den Superadmin nutzbar. Kein separates Verbund-Billing-Layer nötig.

---

## 12. Out of Scope (this iteration)

- Automatischer E-Mail-Versand (nur Versand-Button)
- Invoice-PDF-Generierung (HTML-Ansicht zuerst)
- Automatischer DATEV-Export (Datenmodell vorbereitet, UI später)
- Recurring Stripe Subscriptions (nur Checkout Sessions)
- Mehrwährung
