# Security Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entfernt 4 kritische Sicherheitslücken: Test-Mode-Bypass, Demo-Rolle, Stripe-Idempotenz, Role-Bleeding.

**Architecture:** Chirurgische Einzel-Datei-Edits. Jede Änderung ist unabhängig. E2E-Tests werden angepasst.

**Tech Stack:** Next.js App Router, Supabase SSR, Stripe, TypeScript, Vitest, Playwright

---

## Task 1: Test-Mode-Cookie entfernen

**Files:**
- Modify: `middleware.ts:77-81`
- Modify: `app/api/auth/login/route.ts:8-18`

- [ ] **Step 1: Middleware-Block entfernen**

In `middleware.ts` Zeilen 77-81 löschen (3 Kommentarzeile + 2 Code-Zeilen):

```typescript
// ENTFERNEN — diese 5 Zeilen komplett löschen:
  // Test-Mode für Playwright E2E-Tests: Auth-Check via Cookie überspringen
  const testModeCookie = request.cookies.get('swingz_test_mode');
  if (testModeCookie?.value === 'true') {
    return response;
  }
```

Nach dem Edit muss Zeile 75 (`let response = ...`) direkt von Zeile 83 (`// Supabase Session refreshen`) gefolgt werden.

- [ ] **Step 2: Login-Route — Rate-Limit immer aktiv**

In `app/api/auth/login/route.ts` Zeilen 8-18 ersetzen mit:

```typescript
export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.AUTH);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { email, password } = await request.json();
```

- [ ] **Step 3: TypeScript-Check**

```bash
cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20
```

Expected: Keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts app/api/auth/login/route.ts
git commit -m "security: remove test-mode cookie bypass from middleware and login route"
```

---

## Task 2: E2E-Tests anpassen

**Files:**
- Modify: `tests/helpers/auth.ts:43-51`
- Modify: `tests/e2e/all-pages-render.spec.ts` (addCookies-Block)
- Modify: `tests/e2e/navigation-flows.spec.ts` (addCookies-Block)

- [ ] **Step 1: `loginAs` in auth.ts — Cookie nur im Request-Header, nicht im Browser-Context**

Ersetze die `loginAs`-Funktion (ca. Zeilen 43-51):

```typescript
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  const targetUrl = await doLogin(page, email, password, 'swingz_test_mode=true');
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
}
```

- [ ] **Step 2: addCookies aus all-pages-render.spec.ts entfernen**

In `tests/e2e/all-pages-render.spec.ts` die Zeile mit `addCookies([{ name: 'swingz_test_mode'` entfernen.

- [ ] **Step 3: addCookies aus navigation-flows.spec.ts entfernen**

In `tests/e2e/navigation-flows.spec.ts` die Zeile mit `addCookies([{ name: 'swingz_test_mode'` entfernen.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: remove swingz_test_mode cookie from browser context in e2e tests"
```

---

## Task 3: Demo-Rolle entfernen

**Files:**
- Modify: `lib/auth/guards.ts:8,47`
- Modify: `lib/actions/booking.actions.ts:21-23`
- Modify: `scripts/seed-users.ts:24`

- [ ] **Step 1: UserRole-Typ in guards.ts — demo entfernen**

Zeile 8:
```typescript
export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';
```

Zeile 47 (`demo: 0,`) aus dem `roleHierarchy`-Objekt entfernen:
```typescript
  const roleHierarchy: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };
```

- [ ] **Step 2: Demo-Guard aus booking.actions.ts entfernen**

Zeilen 21-23 entfernen:
```typescript
    // Demo-User darf nicht buchen
    if (user.role === 'demo') {
      return { success: false, error: 'Demo-User können keine Buchungen erstellen.' };
    }
```

- [ ] **Step 3: Demo-User aus seed-users.ts entfernen**

Zeile 24 entfernen:
```typescript
  { email: 'demo@swingz.local', role: 'demo' },
```

- [ ] **Step 4: TypeScript-Check**

```bash
cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth/guards.ts lib/actions/booking.actions.ts scripts/seed-users.ts
git commit -m "security: remove demo role — no production path uses it"
```

---

## Task 4: Stripe-Webhook Idempotenz

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: handleInvoicePayment mit Idempotenz-Guard**

Funktion `handleInvoicePayment` (Zeilen 76-89) ersetzen:

```typescript
async function handleInvoicePayment(session: Stripe.Checkout.Session, invoiceId: string) {
  const invoice = await billingEngine.getInvoiceById(invoiceId);
  if (!invoice) {
    console.error(`Invoice ${invoiceId} not found`);
    return;
  }

  const supabase = await createAdminClient();
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('external_id', session.payment_intent as string)
    .maybeSingle();

  if (existingPayment) {
    console.log(`Payment for session ${session.id} already processed — skipping`);
    return;
  }

  const payment = await billingEngine.createPayment({
    invoice_id: invoiceId,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    payment_method: 'stripe',
    external_id: session.payment_intent as string,
  });
  await billingEngine.updatePaymentStatus(payment.id, 'completed');
  console.log(`Payment completed for invoice ${invoiceId}`);
}
```

- [ ] **Step 2: handleBookingPayment mit Idempotenz-Guard**

Funktion `handleBookingPayment` (Zeilen 94-121) ersetzen:

```typescript
async function handleBookingPayment(session: Stripe.Checkout.Session, bookingId: string) {
  const supabase = await createAdminClient();
  const { userId, clubId } = session.metadata || {};

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, payment_status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) {
    console.error(`[Stripe Webhook] Booking ${bookingId} not found`);
    return;
  }

  if (booking.payment_status === 'paid') {
    console.log(`[Stripe Webhook] Booking ${bookingId} already paid — skipping`);
    return;
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', payment_status: 'paid' })
    .eq('id', bookingId);

  if (bookingError) {
    console.error('[Stripe Webhook] Failed to update booking:', bookingError);
    return;
  }

  if (userId) {
    await supabase.from('notifications').insert({
      user_id: userId,
      club_id: clubId || null,
      title: 'Zahlung erfolgreich',
      message: 'Deine Buchung wurde bezahlt und ist jetzt bestätigt.',
      type: 'booking',
      action_url: '/bookings',
    });
  }
}
```

- [ ] **Step 3: TypeScript-Check**

```bash
cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "security: add idempotency guards to Stripe webhook handlers"
```

---

## Task 5: Role-Bleeding Fix

**Files:**
- Modify: `lib/api-auth.ts:59-89`

- [ ] **Step 1: effectiveClubId an effectiveMembership binden**

Zeilen 59-89 in `lib/api-auth.ts` ersetzen:

```typescript
  const roleOrder: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };

  // Highest role wins — track which membership granted it
  let effectiveRole = memberships[0].role as 'superadmin' | 'admin' | 'trainer' | 'member';
  let effectiveMembership = memberships[0];

  for (let i = 1; i < memberships.length; i++) {
    const m = memberships[i];
    const role = m.role as keyof typeof roleOrder;
    if ((roleOrder[role] ?? 0) > (roleOrder[effectiveRole] ?? 0)) {
      effectiveRole = role as 'superadmin' | 'admin' | 'trainer' | 'member';
      effectiveMembership = m;
    }
  }

  let selectedClubId: string | undefined;
  let effectiveClubId: string | null = null;

  if (effectiveRole === 'superadmin') {
    const cookieValue = request.cookies.get(ADMIN_CLUB_COOKIE)?.value;
    if (cookieValue) {
      const { data: clubCheck } = await supabase
        .from('clubs')
        .select('id')
        .eq('id', cookieValue)
        .maybeSingle();
      if (clubCheck) {
        selectedClubId = cookieValue;
        effectiveClubId = cookieValue;
      }
    }
  } else {
    // effectiveClubId comes from the membership that granted the effective role
    effectiveClubId = effectiveMembership.club_id ?? null;
  }
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/api-auth.ts
git commit -m "security: fix role-bleeding — clubId now tracks the membership that granted the effective role"
```

---

## Verifikation

- [ ] **Build**

```bash
cd /home/aeugeln/SwingZ && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`

- [ ] **Unit-Tests**

```bash
cd /home/aeugeln/SwingZ && npx vitest run 2>&1 | tail -10
```

- [ ] **Manueller Security-Test**

1. Browser-Konsole: `document.cookie = "swingz_test_mode=true"` → `/admin` laden → muss auf `/login` redirecten
2. Als Member einloggen → `/admin` direkt aufrufen → muss auf `/dashboard` redirecten
