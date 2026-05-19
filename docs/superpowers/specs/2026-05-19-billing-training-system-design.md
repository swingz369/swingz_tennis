# Billing & Training System Design

**Date:** 2026-05-19  
**Status:** Approved for implementation

---

## 1. Overview

A unified billing and training management system for tennis clubs on SwingZ. Handles three invoice types, configurable pricing, school-holiday-aware scheduling, and a symmetric credit system for group changes.

---

## 2. Invoice Types

### 2.1 Saison-Rechnung (Season Invoice)
- Created automatically at season start or on-demand by admin
- Covers all training sessions in the season at the configured unit price
- Split by `training_price_category` — each member may have a different category
- Supports installment payment (configurable: 1, 2, or 3 installments)
- Installment due dates set by admin at season level

### 2.2 Mitgliedsbeitrag (Membership Fee)
- Annual or season-based flat fee per member
- Amount configurable per club, optionally per membership tier
- Created once per season per member
- No installment option (single payment)

### 2.3 Zusatz-Rechnung (Ad-hoc Invoice)
- Manually created by admin for any one-off charge
- Free-text line items with quantity and unit price
- Can reference a booking, a training session, or nothing
- Always single payment

---

## 3. Pricing Architecture

### 3.1 `training_price_categories` Table
Club-defined, extensible. Each club maintains its own set of categories.

```sql
training_price_categories (
  id uuid PK,
  club_id uuid FK → clubs,
  name text,                    -- e.g. "Erwachsene", "Jugend U18", "Senioren"
  price_per_unit decimal(10,2), -- price per billing unit (45 or 60 min)
  created_at timestamptz,
  updated_at timestamptz
)
```

### 3.2 Member-Category Assignment
Each member has a price category per club (stored on `club_memberships` or a join table). Admin can override per season.

### 3.3 Billing Unit
Configurable at club level: 45 min or 60 min. Stored in `clubs.billing_unit_minutes`. Training sessions are divided into billing units for invoice calculation.

---

## 4. School Holiday Calendar

### 4.1 Storage
```sql
school_holidays (
  id uuid PK,
  bundesland text,              -- e.g. "Bayern", "NRW", "Berlin"
  name text,                    -- e.g. "Sommerferien 2026"
  start_date date,
  end_date date,
  year int
)
```

Seeded centrally (all German Bundesländer). Clubs select their Bundesland in settings.

### 4.2 Season Planning Integration
When building a season's training schedule, any training session that falls within a school holiday period for the club's Bundesland is automatically flagged as cancelled (or skipped). Admin can override individual sessions.

### 4.3 Invoice Calculation
School-holiday-cancelled sessions are excluded from the Saison-Rechnung calculation. Only sessions marked `status = 'scheduled'` or `'completed'` are billed.

---

## 5. Group Change Credit System

### 5.1 `member_balances` Table
Tracks running credit/debit balance per member per club.

```sql
member_balances (
  id uuid PK,
  member_id uuid FK → profiles,
  club_id uuid FK → clubs,
  balance decimal(10,2) DEFAULT 0,  -- positive = credit, negative = debit
  updated_at timestamptz
)

member_balance_entries (
  id uuid PK,
  member_balance_id uuid FK → member_balances,
  amount decimal(10,2),             -- positive = credit, negative = charge
  reason text,                      -- human-readable
  reference_type text,              -- 'group_change', 'payment', 'invoice', 'manual'
  reference_id uuid,                -- FK to relevant record (nullable)
  created_by uuid FK → profiles,
  created_at timestamptz
)
```

### 5.2 Group Change Logic
When a member switches training groups mid-season:

1. **Leaving group:** Credit issued = sessions remaining in old group × price_per_unit × billing_units
2. **Joining group:** Charge issued = sessions remaining in new group × price_per_unit × billing_units
3. Net delta applied to `member_balances.balance`
4. On next invoice: positive balance reduces invoice total; negative balance increases it (or triggers a Zusatz-Rechnung)

Symmetry guarantee: the system always computes both sides of the change in the same transaction.

### 5.3 Balance Application
At invoice generation time: if `member_balances.balance > 0`, it is applied as a line-item credit on the invoice (up to invoice total). Remaining balance carries forward. If `balance < 0`, a debt line item is added.

---

## 6. Payment Configuration

### 6.1 Payment Mode (per Club)
`clubs.payment_mode`: `'full'` | `'installments'`

When `'installments'`, Saison-Rechnung is split into N installments (N ∈ {2, 3}), configured at season level (`seasons.installment_count`, `seasons.installment_due_dates[]`).

### 6.2 Stripe Integration
- Each installment becomes a separate Stripe Checkout Session
- Existing idempotency guards on webhook handlers protect against duplicate processing
- Invoice status: `draft` → `sent` → `partially_paid` → `paid` | `overdue`

---

## 7. Data Flow

```
Season created
  └→ Admin configures: Bundesland, billing_unit_minutes, payment_mode, price_categories
  └→ Training sessions generated (school holidays auto-excluded)
  └→ Saison-Rechnung generated per member (using their price_category)
       └→ member_balances.balance applied as credit/debit
       └→ Invoice sent → Stripe Checkout → webhook → invoice marked paid
  
Group change mid-season
  └→ Credit entry (leaving group) + Charge entry (joining group) → balance updated
  └→ Reflected on next invoice or Zusatz-Rechnung
```

---

## 8. Admin UI

- **Seasons page:** billing_unit_minutes selector, payment_mode toggle, installment config
- **Members page:** price_category assignment per member
- **Invoices page:** list by type, status filter, manual Zusatz-Rechnung creation
- **Price Categories page:** CRUD for club's categories
- **School Holidays:** read-only view + Bundesland selector in club settings

---

## 9. Out of Scope (this iteration)

- Automated email delivery of invoices (send button only)
- Multi-currency
- Invoice PDF generation (plain HTML view first)
- Recurring Stripe subscriptions (Checkout Sessions only)
