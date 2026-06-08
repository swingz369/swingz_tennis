# DB-Schema-Sync: Diskrepanzen & Migrationen

> **Stand:** 2026-06-08  
> **Session:** Production-DB-Audit — Drizzle-Schema vs. Supabase-Ist-DB vs. Migrations-Soll  
> **Ziel:** Alle erkannten Diskrepanzen dokumentieren, Sync-Migrationen auflisten, verbleibende Lücken benennen.

### Sync-Migrationen (Quick-Reference)

| Migration                                  | Zweck                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260607_sync_dunning_records.sql`        | 6 Spalten + 2 FKs + 5 Indexes + Backfill (1.200 Zeilen)                                                                                                  |
| `20260607_add_dunning_rls_policies.sql`    | 2 fehlende RLS-Policies (members + admins)                                                                                                               |
| `20260607_fix_gobd_trigger.sql`            | GoBD-Trigger an Ist-Spalten angepasst                                                                                                                    |
| `20260607_dunning_rls_null_member.sql`     | SELECT-Policy für NULL `member_id` via Invoice-Chain                                                                                                     |
| `20260608_backfill_dunning_member_id.sql`  | Backfill dunning_records.member_id via sepa_mandates (1.026/1.200) + Trigger `set_dunning_member_id`                                                     |
| `20260608_add_missing_billing_columns.sql` | invoices: subtotal, invoice_date, paid_amount + dunning_records: original_amount, total_amount, escalated_at, cancelled_at + Backfill + GoBD-Trigger-Fix |
| `20260608_deploy_billing_triggers.sql`     | `update_invoice_status()` (total_amount→amount) + `calculate_dunning_level()` deployed                                                                   |
| `20260608_backfill_invoice_member_id.sql`  | Backfill invoices.member_id via sepa_mandates (5.521/6.453 adhoc)                                                                                        |

---

## 1. Tabellen-Diskrepanzen (Drizzle vs. Ist-DB vs. Migration)

### 1.1 `dunning_records` ⚠️ Gefixt

| Aspekt                       | Migration (20260502)               | Ist-DB (vor Fix) | Nach Sync                                          |
| ---------------------------- | ---------------------------------- | ---------------- | -------------------------------------------------- |
| Spalten                      | 17                                 | 7                | 13                                                 |
| `club_id`                    | ✅ NOT NULL, FK                    | ❌ Fehlte        | ✅                                                 |
| `member_id`                  | ✅ NOT NULL, FK                    | ❌ Fehlte        | ✅ nullable                                        |
| `status`                     | ✅ `sent/paid/escalated/cancelled` | ❌ Fehlte        | ✅                                                 |
| `paid_at`                    | ✅                                 | ❌ Fehlte        | ✅                                                 |
| `created_at`                 | ✅                                 | ❌ Fehlte        | ✅                                                 |
| `updated_at`                 | ✅                                 | ❌ Fehlte        | ✅                                                 |
| `dunning_level` → `level`    | `integer`                          | `smallint`       | Belassen (`level`)                                 |
| `dunning_fee` → `fee_amount` | `numeric`                          | `numeric`        | Belassen (`fee_amount`)                            |
| `dunning_date` → `sent_at`   | `date`                             | `timestamp`      | Belassen (`sent_at`)                               |
| `original_amount`            | ✅                                 | ✅               | 🟢 Gefixt (Backfill: invoice.amount)               |
| `total_amount`               | ✅                                 | ✅               | 🟢 Gefixt (Backfill: original_amount + fee_amount) |
| `escalated_at`               | ✅                                 | ✅               | 🟢 Gefixt                                          |
| `cancelled_at`               | ✅                                 | ✅               | 🟢 Gefixt                                          |

**Sync-Migration:** `supabase/migrations/20260607_sync_dunning_records.sql`  
**Code-Fix:** `lib/billing/dunning.service.ts` — `createDunningRecord()` holt `club_id`/`member_id` aus Invoice  
**Daten:** 1.200 Zeilen backfilled (`club_id` aus `invoices`, `created_at`/`updated_at` aus `sent_at`)

---

### 1.2 `trainer_availability` (singular) ⚠️ Gefixt

| Aspekt         | Status                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| Drizzle-Schema | ❌ Fehlte komplett                                                           |
| Ist-DB         | ✅ Existiert (8 Spalten, `user_id` + `day_of_week` Modell)                   |
| Nach Sync      | ✅ `src/infrastructure/persistence/schema.ts`: `trainerAvailability` Tabelle |

**Abgrenzung:** Existierende `trainerAvailabilities` (plural) ist ein ANDERES Modell (`trainer_id` + `date`). Beide Tabellen existieren parallel.

**Drizzle-Änderung:** `smallint` Import hinzugefügt, Tabelle vor `trainerAvailabilities` mit erklärendem Kommentar.

---

### 1.3 `bookings` — Tote Spalten ⚠️ Gefixt

| Spalte              | In DB? | Genutzt von                                  | Aktion           |
| ------------------- | ------ | -------------------------------------------- | ---------------- |
| `user_id`           | ❌     | `BookingService.createBooking()` (dead code) | Methode entfernt |
| `recurring_pattern` | ❌     | `BookingService.createBooking()` (dead code) | Methode entfernt |
| `number_of_players` | ❌     | `BookingService.createBooking()` (dead code) | Methode entfernt |

**Code-Fix:**

- `lib/booking/booking.service.ts` — `createBooking()` + `generateBookingNumber()` gelöscht
- `lib/court-booking-engine.ts` — Wrapper-Methoden gelöscht, `CreateBooking`-Import bereinigt

**Hintergrund:** Echter Booking-Flow läuft über DB-RPC `create_booking_safe` — nicht über BookingService.

---

### 1.4 `invoices` — Spalten-Differenzen ⚠️ Teilweise offen

| Spalte         | Migration   | Drizzle     | Ist-DB              | Status                                    |
| -------------- | ----------- | ----------- | ------------------- | ----------------------------------------- |
| `subtotal`     | ✅ NOT NULL | ✅          | ✅                  | 🟢 Gefixt (Backfill: amount - tax_amount) |
| `total_amount` | ✅ NOT NULL | ✅ `amount` | ❌ (heißt `amount`) | 🟡 Benennung (amount = total)             |
| `invoice_date` | ✅ NOT NULL | ✅          | ✅                  | 🟢 Gefixt (Backfill: created_at)          |
| `paid_amount`  | ✅ NOT NULL | ✅          | ✅                  | 🟢 Gefixt (Backfill: payments-Summe)      |
| `invoice_type` | ❌          | ✅          | ✅                  | 🟢 OK                                     |
| `trainer_id`   | ❌          | ✅          | ✅                  | 🟢 OK                                     |
| `season_id`    | ❌          | ✅          | ✅                  | 🟢 OK                                     |

**Konsequenz:**

- `prevent_invoice_content_update()` Trigger schlug fehl → gefixt
- `update_invoice_status()` Trigger → 🟢 Gefixt: deployed via `20260608_deploy_billing_triggers.sql` (total_amount→amount)
- `invoices.member_id` NULL bei 6.453 adhoc-Invoices → 🟢 Backfill: 5.521 via sepa_mandates (`20260608_backfill_invoice_member_id.sql`)

---

### 1.5 `invoice_items` — Generated Column

| Spalte        | Typ                                                          | Hinweis                         |
| ------------- | ------------------------------------------------------------ | ------------------------------- |
| `total_price` | `numeric GENERATED ALWAYS AS (quantity * unit_price) STORED` | Darf **nicht** im INSERT stehen |

**Gelernt:** Bei Invoice-Erstellung `total_price` aus INSERT weglassen — wird automatisch berechnet.

---

## 2. RLS-Policy-Abgleich (Migration vs. Ist-DB)

### 2.1 `invoices` ✅ Kein Gap

| Migration (20260502)                          | Ist-DB                          | Bewertung                                |
| --------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `club_members_can_view_own_invoices` (SELECT) | `invoices_select` (SELECT)      | ✅ Besser: +trainer_id, +is_superadmin() |
| `admins_can_create_invoices` (INSERT)         | `invoices_manage_admin` (ALL)   | ✅ Besser: ALL statt nur INSERT          |
| `admins_can_update_invoices` (UPDATE)         | (in ALL enthalten)              | ✅                                       |
| —                                             | `invoices_all_superadmin` (ALL) | ✅ Extra                                 |

### 2.2 `invoice_items` ✅ Kein Gap

| Migration                                      | Ist-DB                              | Bewertung                               |
| ---------------------------------------------- | ----------------------------------- | --------------------------------------- |
| `club_members_can_view_invoice_items` (SELECT) | `see_own_invoice_items` (SELECT)    | ✅ Besser: +trainer_id, is_club_admin() |
| `admins_can_manage_invoice_items` (ALL)        | `admins_manage_invoice_items` (ALL) | ✅ via invoices-Join                    |

### 2.3 `payments` ⚠️ Kein Gap (Edge-Case beachten)

| Migration                                     | Ist-DB                         | Bewertung                             |
| --------------------------------------------- | ------------------------------ | ------------------------------------- |
| `club_members_can_view_own_payments` (SELECT) | `see_own_payments` (SELECT)    | ✅ Äquivalent (indirekt via invoices) |
| `admins_can_manage_payments` (ALL)            | `admins_manage_payments` (ALL) | ✅ via invoices-Join                  |

> **⚠️ Edge-Case:** Migration prüft `payments.club_id` direkt, Ist-Policy prüft via `invoices.club_id`. Payments mit `invoice_id = NULL` (erlaubt durch `ON DELETE SET NULL`) wären für Admins unsichtbar. In der Praxis unwahrscheinlich, aber dokumentiert.

### 2.4 `sepa_mandates` ✅ Kein Gap

| Migration                                | Ist-DB                                     | Bewertung                         |
| ---------------------------------------- | ------------------------------------------ | --------------------------------- |
| `members_can_view_own_mandates` (SELECT) | `sepa_mandates_member_view_own` (SELECT)   | ✅                                |
| `admins_can_manage_mandates` (ALL)       | `sepa_mandates_admin_manage` (ALL)         | ✅ via club_members               |
| —                                        | `sepa_mandates_member_create_own` (INSERT) | ✅ Extra (member_id = auth.uid()) |
| —                                        | `sepa_mandates_superadmin_all` (ALL)       | ✅ Extra                          |

### 2.5 `dunning_records` ⚠️ Gefixt

| Migration                               | Vor Fix                                                 | Nach Fix                                        |
| --------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `members_can_view_own_dunning` (SELECT) | ❌                                                      | ✅ `20260607_add_dunning_rls_policies.sql`      |
| `admins_can_manage_dunning` (ALL)       | ❌                                                      | ✅ `20260607_add_dunning_rls_policies.sql`      |
| —                                       | `admins_see_dunning` (SELECT)                           | ✅ (existierte bereits)                         |
| —                                       | ~~`members_can_view_own_dunning_via_invoice` (SELECT)~~ | 🗑️ Entfernt (redundant nach member_id-Backfill) |

---

## 3. Trigger/Function-Diskrepanzen

### 3.1 `prevent_invoice_content_update()` ✅ Gefixt (2×)

| Referenz                                | Existiert? | Fix                                                                                     |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `NEW.subtotal` / `OLD.subtotal`         | ❌ → ✅    | `20260607`: → `NEW.amount` / `OLD.amount`                                               |
| `NEW.total_amount` / `OLD.total_amount` | ❌         | `20260607`: → entfernt, `20260608`: erneut entfernt (war irrtümlich wieder hinzugefügt) |
| `NEW.invoice_date` / `OLD.invoice_date` | ❌ → ✅    | `20260607`: → `NEW.due_date`, `20260608`: → `NEW.invoice_date` (Spalte existiert jetzt) |
| `NEW.subtotal`                          | ✅         | `20260608`: Spalte existiert jetzt, Schutz aktiv                                        |
| `NEW.invoice_type`                      | ✅         | Beibehalten                                                                             |

**Sync-Migrationen:** `20260607_fix_gobd_trigger.sql` + `20260608_add_missing_billing_columns.sql`

### 3.2 `update_invoice_status()` ✅ Gefixt

Referenzierte `total_amount` (heißt `amount`). `total_amount→amount` adaptiert + Trigger auf `payments` Tabelle deployed.

**Sync-Migration:** `20260608_deploy_billing_triggers.sql`

### 3.3 `calculate_dunning_level()` ✅ Gefixt

Referenzierte `invoice_date` — Spalte existiert jetzt nach `20260608_add_missing_billing_columns.sql`. Funktion deployed.

**Sync-Migration:** `20260608_deploy_billing_triggers.sql`

### 3.4 `set_dunning_member_id()` ✅ Neu

BEFORE INSERT Trigger auf `dunning_records`. Setzt `member_id` automatisch aus `invoices.member_id` bei INSERT.

**Sync-Migration:** `20260608_backfill_dunning_member_id.sql`

---

## 4. Code-Fixes (TypeScript) in dieser Session

| Datei                                              | Änderung                                                                         | Grund                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `lib/billing/dunning.service.ts`                   | `createDunningRecord()`: Invoice-Lookup für `club_id`/`member_id`                | `club_id` ist jetzt NOT NULL                               |
| `lib/booking/booking.service.ts`                   | `createBooking()` + `generateBookingNumber()` entfernt                           | Dead Code mit nicht-existenten DB-Spalten                  |
| `lib/court-booking-engine.ts`                      | Wrapper-Methoden entfernt, Import bereinigt                                      | Dead Code                                                  |
| `app/(protected)/admin/billing/page.tsx`           | `users(full_name)` → `users!invoices_member_id_fkey(full_name)` + Error-Handling | PostgREST-Ambiguität (2 FKs zu users)                      |
| `app/api/admin/billing/invoices/route.ts`          | Gleicher FK-Hint-Fix                                                             | PostgREST-Ambiguität                                       |
| `app/(protected)/admin/billing/billing-client.tsx` | Default-Tab `'subscriptions'` → `'invoices'`                                     | UX: Rechnungen statt Abos                                  |
| `lib/admin-context.ts`                             | `ADMIN_CLUB_COOKIE` jetzt auch für normale Admins                                | Multi-Club-Admins sahen falschen Club                      |
| `src/infrastructure/persistence/schema.ts`         | `trainerAvailability` + `dunningRecords` + invoices/dunning_records Spalten      | Fehlten im Drizzle-Schema                                  |
| `lib/types/billing.ts`                             | `InvoiceSchema` + `DunningRecordSchema` erweitert                                | Neue Spalten (subtotal, paid_amount, original_amount etc.) |
| `lib/services/billing.service.ts`                  | `total_price` aus invoice_items INSERT entfernt                                  | GENERATED COLUMN darf nicht im INSERT stehen               |
| `lib/billing/invoice.service.ts`                   | Kommentar zu total_price GENERATED COLUMN                                        | Dokumentation                                              |
| `app/(protected)/admin/page.tsx`                   | Sessions-Query: `user_club_memberships(users(full_name))` → `trainers(name)`     | PostgREST konnte Pfad nicht auflösen → 400                 |
| `app/(protected)/admin/page.tsx`                   | Bookings-Query: expliziter FK-Hint `users!bookings_member_id_fkey(full_name)`    | PostgREST-Ambiguität → 400                                 |

---

## 5. Sync-Migrationen (diese Session)

| Migration                                  | Datum      | Zweck                                                                                                                                           |
| ------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260607_sync_dunning_records.sql`        | 2026-06-07 | dunning_records: 6 Spalten + FK + Indexes + Backfill                                                                                            |
| `20260607_add_dunning_rls_policies.sql`    | 2026-06-07 | 2 fehlende RLS-Policies auf dunning_records                                                                                                     |
| `20260607_fix_gobd_trigger.sql`            | 2026-06-07 | prevent_invoice_content_update() an Ist-Schema angepasst                                                                                        |
| `20260607_dunning_rls_null_member.sql`     | 2026-06-07 | SELECT-Policy für NULL member_id via invoices-Join                                                                                              |
| `20260608_backfill_dunning_member_id.sql`  | 2026-06-08 | Backfill dunning_records.member_id (1.026/1.200 via sepa_mandates) + Trigger                                                                    |
| `20260608_add_missing_billing_columns.sql` | 2026-06-08 | invoices: subtotal/invoice_date/paid_amount + dunning_records: original_amount/total_amount/escalated_at/cancelled_at + Backfill + GoBD-Trigger |
| `20260608_deploy_billing_triggers.sql`     | 2026-06-08 | update_invoice_status() + calculate_dunning_level() deployed                                                                                    |
| `20260608_backfill_invoice_member_id.sql`  | 2026-06-08 | Backfill invoices.member_id (5.521/6.453 adhoc via sepa_mandates)                                                                               |

---

## 6. Noch offene Diskrepanzen 🔴

| #     | Tabelle               | Problem                                                                      | Impact                                                                                                                                     |
| ----- | --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~1~~ | ~~`invoices`~~        | ~~`subtotal`, `invoice_date`, `paid_amount` fehlen~~                         | 🟢 Gefixt: `20260608_add_missing_billing_columns.sql`                                                                                      |
| ~~2~~ | ~~`dunning_records`~~ | ~~`original_amount`, `total_amount`, `escalated_at`, `cancelled_at` fehlen~~ | 🟢 Gefixt: `20260608_add_missing_billing_columns.sql`                                                                                      |
| ~~3~~ | ~~`dunning_records`~~ | ~~`member_id` auf allen 1.200 Zeilen NULL~~                                  | 🟢 Gefixt: 1.026 via sepa_mandates backfilled. Trigger `set_dunning_member_id` für neue Records. 174 verbleibend (Clubs ohne SEPA-Mandat). |
| ~~4~~ | ~~`invoices`~~        | ~~`update_invoice_status()` referenziert `total_amount`~~                    | 🟢 Gefixt: `total_amount→amount` + Trigger deployed                                                                                        |
| ~~5~~ | ~~`invoices`~~        | ~~`calculate_dunning_level()` referenziert `invoice_date`~~                  | 🟢 Gefixt: `invoice_date` existiert jetzt + Funktion deployed                                                                              |
| 6     | `invoices`            | 932 adhoc-Invoices ohne `member_id`                                          | Clubs ohne valides SEPA-Mandat — manuell prüfen                                                                                            |
| 7     | `invoices`            | `total_amount` vs `amount` Namens-Inkongruenz                                | Drizzle nutzt `amount`, billing.types.ts hat `total_amount` — kein Runtime-Fehler, aber inkonsistent                                       |

---

## 7. Architektur-Erkenntnisse

1. **Migration `20260502_billing_system.sql` wurde nie 1:1 auf die Ist-DB angewandt.** Stattdessen existieren alternative Policies und Tabellenstrukturen (vermutlich via Drizzle `db push` oder manuell erstellt).

2. **Zwei FKs zu `users` verursachen PostgREST-Ambiguität.** Immer `users!fk_name(columns)` statt `users(columns)` verwenden, wenn eine Tabelle mehrere FKs zur selben Zieltabelle hat (z.B. `invoices` → `users` via `member_id` + `trainer_id`).

3. **Generated Columns erkennen.** `invoice_items.total_price` ist `GENERATED ALWAYS AS (quantity * unit_price) STORED` — nie in INSERT/UPDATE inkludieren.

4. **`requireAdminClub()` sortiert Memberships nach `club_id` (UUID).** Multi-Club-Admins sehen einen pseudozufälligen Club. Der `ADMIN_CLUB_COOKIE`-Fix löst das, aber ohne ClubSwitcher-UI nur programmatisch nutzbar.

5. **Service-Client umgeht RLS.** Alle Billing-Services nutzen `createServiceClient()` → RLS-Policies sind für den Produktions-Code weniger kritisch, aber für direkte Supabase-API-Calls (z.B. aus dem Frontend) essentiell.

6. **GoBD-Trigger muss bei Schema-Änderungen mitgezogen werden.** `prevent_invoice_content_update()` referenzierte nach dem Hinzufügen von `subtotal`/`invoice_date` irrtümlich erneut `total_amount` — musste zweimal gefixt werden.

7. **`sepa_mandates` als Proxy für Member-Auflösung.** Wenn direkte Pfade fehlen (invoices.member_id, dunning_records.member_id), kann `sepa_mandates.member_id` (validiert gegen `public.users`) als Stellvertreter dienen — funktioniert nur bei 1 Mandat pro Club.

8. **PostgREST Embeds erfordern korrekte FK-Pfade.** `sessions` → `user_club_memberships(users(full_name))` funktioniert nicht, weil sessions keinen FK zu user_club_memberships hat. Korrekt: `sessions` → `trainers(name)` (via trainer_id).
