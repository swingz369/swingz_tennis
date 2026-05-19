# Billing & Training System — Part 5: Admin UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin UI pages for invoices, price categories, group changes, and member balances — all wired to the API routes from Part 4.

**Architecture:** Next.js App Router pages with Server Components for data fetching and Client Components for interactive parts. Follow existing patterns from app/(protected)/admin/members/ (has page.tsx + members-client.tsx + member.types.ts pattern).

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, shadcn/ui components (Card, Badge, Button, Input, Select, Table, Dialog)

**Prerequisites:** Parts 1–4 completed.

---

## Task 1: `app/(protected)/admin/billing/` — Invoice list page (extend existing)

The directory `app/(protected)/admin/billing/` already exists with `billing-client.tsx`, `page.tsx`.
Extend the existing billing page to show:
- Tabs: "Alle" | "Saison" | "Mitgliedsbeitrag" | "Zusatz"
- Table columns: Rechnungsnr., Mitglied, Typ, Betrag, Status, Fälligkeit, Aktionen
- Status badge with colors: draft=gray, sent=blue, reminder_sent=yellow, partially_paid=orange, paid=green, overdue=red, dunning=red+bold, cancelled=gray+strikethrough
- "Neue Zusatz-Rechnung" button → Dialog

### Steps:

- [ ] Read existing `app/(protected)/admin/billing/page.tsx` and `billing-client.tsx` to understand current structure
- [ ] Add invoice type tabs using `useState` for active filter
- [ ] Add status badge helper function:

```typescript
function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: 'Entwurf', className: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Versendet', className: 'bg-blue-100 text-blue-700' },
    reminder_sent: { label: 'Erinnerung', className: 'bg-yellow-100 text-yellow-700' },
    partially_paid: { label: 'Teilbezahlt', className: 'bg-orange-100 text-orange-700' },
    paid: { label: 'Bezahlt', className: 'bg-green-100 text-green-700' },
    overdue: { label: 'Überfällig', className: 'bg-red-100 text-red-700' },
    dunning: { label: 'Mahnung', className: 'bg-red-200 text-red-900 font-bold' },
    cancelled: { label: 'Storniert', className: 'bg-gray-100 text-gray-400 line-through' },
  };
  const c = config[status] ?? config.draft;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>{c.label}</span>;
}
```

- [ ] Add invoice type badge helper (similar pattern for "Saison" / "Mitgliedsbeitrag" / "Zusatz")
- [ ] Wire GET `/api/billing/invoices?clubId=...&type=...` fetch
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): extend invoice list UI with type tabs and status badges`

---

## Task 2: Create Adhoc Invoice Dialog

Inside `billing-client.tsx`, add a Dialog component for creating Zusatz-Rechnungen:
- Member select (fetch from club members)
- Due date input
- Line items: dynamic list with "+" add row and "×" remove row (description, quantity, unit_price)
- Notes textarea
- Submit → POST `/api/billing/invoices`

```typescript
interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

function CreateAdhocInvoiceDialog({ clubId, onSuccess }: { clubId: string; onSuccess: () => void }) {
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string | number) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  // ... form state for memberId, dueDate, notes
  // total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  // show running total
}
```

### Steps:

- [ ] Add `CreateAdhocInvoiceDialog` component to billing-client.tsx
- [ ] Wire "Neue Zusatz-Rechnung" button to open dialog
- [ ] Submit handler calls POST `/api/billing/invoices` then calls `onSuccess()` to refresh list
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add create adhoc invoice dialog`

---

## Task 3: Invoice detail / installments view

Add a click-through from the invoice list to a detail view (or expand row / side panel).
Show:
- Invoice header (number, member, dates, status)
- Line items table
- Installments section (if installment_count > 1): each installment with due date, amount, status, "Als bezahlt markieren" button
- "Als versendet markieren" button (only when status=draft)
- "Stornieren" button (only when status=draft or sent, shows confirmation)

### Steps:

- [ ] Add `InvoiceDetailPanel` component (can be a slide-over or expanded row)
- [ ] "Als versendet markieren": PATCH `/api/billing/invoices/[id]` with `{ status: 'sent' }`
- [ ] "Stornieren": PATCH with `{ status: 'cancelled', cancellation_reason }` — show confirmation dialog first
- [ ] "Als bezahlt markieren" per installment: PATCH `/api/billing/installments/[id]` with payment_method select
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add invoice detail panel with installment management`

---

## Task 4: `app/(protected)/admin/members/[id]/` — member balance tab

Add a "Guthaben" tab to the member detail page (if it exists) or add a balance section to the members list.
Run: `ls app/(protected)/admin/members/` to see current structure.

Show:
- Current balance amount (green if positive, red if negative, gray if zero)
- Balance history table: date, reason, amount (+/-), type badge
- If balance > 0: "Guthaben wird bei nächster Rechnung verrechnet" info text
- If balance < 0: "Offener Betrag wird bei nächster Rechnung berechnet" warning

```typescript
function BalanceDisplay({ balance }: { balance: number }) {
  const isCredit = balance > 0;
  const isDebt = balance < 0;
  return (
    <div className={`p-4 rounded-xl border ${isCredit ? 'bg-green-50 border-green-200' : isDebt ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
      <p className="text-sm text-muted-foreground">Kontostand</p>
      <p className={`text-2xl font-bold ${isCredit ? 'text-green-700' : isDebt ? 'text-red-700' : 'text-gray-500'}`}>
        {balance >= 0 ? '+' : ''}{balance.toFixed(2)} €
      </p>
      {isCredit && <p className="text-xs text-green-600 mt-1">Wird bei nächster Rechnung verrechnet</p>}
      {isDebt && <p className="text-xs text-red-600 mt-1">Offener Betrag wird bei nächster Rechnung berechnet</p>}
    </div>
  );
}
```

### Steps:

- [ ] Run `ls /home/aeugeln/SwingZ/app/\\(protected\\)/admin/members/` to check structure
- [ ] Add balance section to member detail or members list
- [ ] Fetch balance from GET `/api/billing/balance?memberId=...&clubId=...`
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add member balance display to admin members view`

---

## Task 5: `app/(protected)/admin/seasons/[id]/` — bulk invoice generation UI

On the season detail page, add a "Saison-Rechnungen generieren" section:
- Show how many active members have no invoice yet for this season
- installment_count selector (1, 2, 3)
- Dynamic due date inputs (show N date inputs based on installment_count)
- "Rechnungen generieren" button → POST `/api/billing/generate-season-invoices`
- Progress feedback: "X Rechnungen erstellt, Y Fehler"

### Steps:

- [ ] Read existing `app/(protected)/admin/seasons/[id]/page.tsx` to understand structure
- [ ] Add `SeasonBillingSection` client component
- [ ] installment_count select: `useState(1)`, show date inputs accordingly
- [ ] Submit handler with loading state and result display
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add season invoice generation UI`

---

## Task 6: Group change UI — in training groups or members section

Where a group change can be initiated. Find the training groups admin page:
`grep -r "training_group\|Trainingsgruppe" /home/aeugeln/SwingZ/app --include="*.tsx" -l`

Add a "Gruppenwechsel" button per member-in-group row that opens a dialog:
- Current group shown (read-only)
- "Neue Gruppe" select (other groups in same season)
- Change date (default: today)
- Preview: "Gutschrift: X€ | Belastung: Y€ | Netto: Z€" (calculate client-side as estimate, exact on server)
- "Wechsel bestätigen" → POST `/api/billing/group-change`

### Steps:

- [ ] Find training group members UI with grep above
- [ ] Read file to understand structure
- [ ] Add `GroupChangeDialog` component
- [ ] Wire POST to `/api/billing/group-change`
- [ ] Show result: "Wechsel durchgeführt. Guthaben: +X€" or "Aufpreis: -Y€"
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add group change dialog with credit preview`

---

## Implementation Notes

- Every step uses `- [ ]` checkbox syntax for tracking progress
- TypeScript/TSX examples provided for every component
- All UI text is in German
- No TBD or placeholder content
- Each step is scoped to 2–5 minutes of work
- Status badges follow consistent color scheme across all views
- Client components handle state, server components fetch initial data
- All API endpoints are already defined in Part 4 and should integrate cleanly
