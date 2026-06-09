# SwingZ - Phase 2 Implementation Strategy

**Start Date**: 2026-05-06  
**Duration**: 4 weeks  
**Estimated Effort**: ~88 hours  
**Goal**: Feature-Complete System with Excellent UX

---

## 🎯 Phase 2 Objectives

Transform SwingZ from **Production-Ready** → **Feature-Complete** with exceptional user experience, comprehensive testing, and enterprise-grade reliability.

**Key Results**:

- ✅ All features from ARCHITECTURE_ANALYSIS.md implemented
- ✅ 80%+ test coverage
- ✅ Complete API documentation
- ✅ Mobile-optimized responsive design
- ✅ Performance score >90/100
- ✅ User satisfaction >4.5/5

---

## 📋 Implementation Phases

### Week 1: UI/UX Foundation (28h)

#### Day 1-2: Notification & Feedback System (12h)

**1.1 Toast Notification System** (4h)

- Install & configure `sonner` toast library
- Create centralized toast service
- Implement success/error/warning/info variants
- Add toast for all CRUD operations
- Integration with React Query mutations

```typescript
// lib/toast/toast.service.ts
import { toast } from 'sonner';

export class ToastService {
  static success(message: string, options?: ToastOptions) {
    toast.success(message, { duration: 3000, ...options });
  }

  static error(message: string, options?: ToastOptions) {
    toast.error(message, { duration: 5000, ...options });
  }

  static info(message: string, options?: ToastOptions) {
    toast.info(message, { duration: 3000, ...options });
  }

  static warning(message: string, options?: ToastOptions) {
    toast.warning(message, { duration: 4000, ...options });
  }

  // Specialized methods
  static successfulBooking(sessionName: string) {
    toast.success(`Erfolgreich für "${sessionName}" angemeldet!`, {
      description: 'Du erhältst eine Bestätigungs-Email',
      action: {
        label: 'Anzeigen',
        onClick: () => (window.location.href = '/my-bookings'),
      },
    });
  }

  static errorWithRetry(message: string, retryFn: () => void) {
    toast.error(message, {
      action: {
        label: 'Erneut versuchen',
        onClick: retryFn,
      },
    });
  }
}
```

**Files to Update**:

- ✅ Create `lib/toast/toast.service.ts`
- ✅ Add to `app/api/members/route.ts` (POST, PATCH, DELETE)
- ✅ Add to `app/api/sessions/route.ts` (POST, PATCH, DELETE)
- ✅ Add to `app/api/bookings/route.ts` (POST, DELETE)
- ✅ Add to all forms in `app/(protected)/admin/`

**Testing**:

- Verify toasts appear for all CRUD operations
- Test action buttons in toasts
- Verify auto-dismiss timers
- Test toast stacking (multiple at once)

---

**1.2 Empty States** (4h)

- Create reusable `EmptyState` component
- Add icons, titles, descriptions, CTAs
- Implement for all list views

```typescript
// components/ui/empty-states/empty-state.tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Icon className="h-16 w-16 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button>{action.label}</Button>
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  )
}
```

**Usage Examples**:

```typescript
// app/(protected)/admin/members/page.tsx
{members.length === 0 && (
  <EmptyState
    icon={Users}
    title="Noch keine Mitglieder"
    description="Lade dein erstes Mitglied ein, um mit der Verwaltung zu beginnen."
    action={{
      label: "Mitglied einladen",
      href: "/admin/members/invite"
    }}
  />
)}

// app/(protected)/my-bookings/page.tsx
{bookings.length === 0 && (
  <EmptyState
    icon={Calendar}
    title="Keine Buchungen"
    description="Du hast noch keine Trainings gebucht. Schaue dir die verfügbaren Zeiten an!"
    action={{
      label: "Trainingszeiten anzeigen",
      href: "/training-schedule"
    }}
  />
)}
```

**Files to Update**:

- ✅ Create `components/ui/empty-states/empty-state.tsx`
- ✅ Add to `app/(protected)/admin/members/page.tsx`
- ✅ Add to `app/(protected)/admin/sessions/page.tsx`
- ✅ Add to `app/(protected)/my-bookings/page.tsx`
- ✅ Add to `app/(protected)/training-schedule/page.tsx`
- ✅ Add to `app/(protected)/news/page.tsx`

---

**1.3 Loading States** (4h)

- Create skeleton loaders for all components
- Add loading states to all buttons
- Implement Suspense boundaries

```typescript
// components/ui/loading-states/skeleton.tsx
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-10 bg-gray-200 animate-pulse rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="h-6 bg-gray-200 animate-pulse rounded w-3/4" />
      <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2" />
      <div className="h-20 bg-gray-200 animate-pulse rounded" />
    </div>
  )
}

// components/ui/buttons/async-button.tsx
interface AsyncButtonProps extends ButtonProps {
  onClick: () => Promise<void>
  loadingText?: string
}

export function AsyncButton({ onClick, children, loadingText, ...props }: AsyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await onClick()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText || 'Lädt...'}
        </>
      ) : children}
    </Button>
  )
}
```

**Files to Update**:

- ✅ Create `components/ui/loading-states/skeleton.tsx`
- ✅ Create `components/ui/loading-states/loading.tsx`
- ✅ Create `components/ui/buttons/async-button.tsx`
- ✅ Add Suspense to `app/(protected)/layout.tsx`
- ✅ Replace all buttons with AsyncButton
- ✅ Add skeleton loaders to all pages

---

#### Day 3-4: Forms & Validation (16h)

**1.4 Form Validation with React Hook Form + Zod** (8h)

Create centralized form schemas:

```typescript
// lib/schemas/member.schema.ts
import { z } from 'zod';

export const createMemberSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().min(5, 'Telefonnummer muss mindestens 5 Zeichen lang sein'),
  dateOfBirth: z.date().max(new Date(), 'Geburtsdatum kann nicht in der Zukunft liegen'),
  address: z.object({
    street: z.string().min(3),
    zipCode: z.string().regex(/^\d{5}$/, 'Deutsche PLZ muss 5 Ziffern haben'),
    city: z.string().min(2),
  }),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

// lib/schemas/session.schema.ts
export const createSessionSchema = z
  .object({
    trainerId: z.string().uuid(),
    groupIds: z.array(z.string().uuid()).min(1, 'Mindestens eine Gruppe auswählen'),
    timeslotStart: z.date(),
    timeslotEnd: z.date(),
    courtId: z.string().uuid(),
    maxParticipants: z.number().int().min(1).max(50),
    notes: z.string().optional(),
  })
  .refine((data) => data.timeslotEnd > data.timeslotStart, {
    message: 'Endzeit muss nach Startzeit liegen',
    path: ['timeslotEnd'],
  });
```

Update forms:

```typescript
// components/forms/create-member-form.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createMemberSchema, CreateMemberInput } from '@/lib/schemas/member.schema'

export function CreateMemberForm() {
  const form = useForm<CreateMemberInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: {
        street: '',
        zipCode: '',
        city: ''
      }
    }
  })

  const onSubmit = async (data: CreateMemberInput) => {
    try {
      await createMember(data)
      ToastService.success('Mitglied erfolgreich erstellt!')
      router.push('/admin/members')
    } catch (error) {
      ToastService.error('Fehler beim Erstellen des Mitglieds')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vorname</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... more fields ... */}
        <AsyncButton type="submit" onClick={form.handleSubmit(onSubmit)}>
          Mitglied erstellen
        </AsyncButton>
      </form>
    </Form>
  )
}
```

**Forms to Implement**:

- ✅ `CreateMemberForm` - with full validation
- ✅ `EditMemberForm` - pre-populated
- ✅ `CreateSessionForm` - with date/time pickers
- ✅ `CreateBookingForm` - with availability check
- ✅ `CreateInvoiceForm` - with line items
- ✅ `ClubSettingsForm` - with nested objects
- ✅ `TrainerProfileForm` - with qualifications array

**Files to Create**:

- `lib/schemas/member.schema.ts`
- `lib/schemas/session.schema.ts`
- `lib/schemas/booking.schema.ts`
- `lib/schemas/invoice.schema.ts`
- `lib/schemas/club.schema.ts`
- `components/forms/create-member-form.tsx`
- `components/forms/edit-member-form.tsx`
- `components/forms/create-session-form.tsx`
- etc.

---

**1.5 Error Boundaries** (4h)

```typescript
// components/error-boundary.tsx
'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: (error: Error, reset: () => void) => React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
    // TODO: Send to Sentry/error tracking service
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, () => this.setState({ hasError: false, error: null }))
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops! Etwas ist schiefgegangen</h2>
          <p className="text-gray-600 mb-6 text-center max-w-md">
            {this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
          </p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Erneut versuchen
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

// app/error.tsx (Next.js App Router global error)
'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorBoundary fallback={(err, resetFn) => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">500</h1>
          <p className="text-xl mb-8">Server Error</p>
          <Button onClick={resetFn}>Zurück zur Startseite</Button>
        </div>
      </div>
    )}>
      {/* This will never render, but satisfies Next.js */}
      <div>{error.message}</div>
    </ErrorBoundary>
  )
}
```

**Files to Create**:

- ✅ `components/error-boundary.tsx`
- ✅ `app/error.tsx`
- ✅ `app/(protected)/error.tsx`
- ✅ `app/(protected)/admin/error.tsx`

---

### Week 2: State Management & Business Logic (24h)

#### Day 5-6: State Machines (12h)

**2.1 Invoice Status State Machine** (6h)

```typescript
// lib/state-machines/invoice.state-machine.ts
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'dunning' | 'cancelled';

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'dunning', 'cancelled'],
  dunning: ['paid', 'cancelled'],
  paid: [], // Terminal state
  cancelled: [], // Terminal state
};

export class InvoiceStateMachine {
  static canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
    return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static validateTransition(from: InvoiceStatus, to: InvoiceStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid transition from ${from} to ${to}`);
    }
  }

  static getAllowedTransitions(currentStatus: InvoiceStatus): InvoiceStatus[] {
    return INVOICE_TRANSITIONS[currentStatus] || [];
  }

  static async transition(
    invoiceId: string,
    from: InvoiceStatus,
    to: InvoiceStatus,
    context: { actorId: string; reason?: string }
  ): Promise<void> {
    this.validateTransition(from, to);

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ status: to, updated_at: new Date() })
      .eq('id', invoiceId);

    // Log transition
    await EnhancedAuditService.logInvoiceStatusChange(
      context.actorId,
      invoiceId,
      from,
      to,
      context.reason
    );

    // Side effects based on transition
    switch (to) {
      case 'sent':
        await this.handleInvoiceSent(invoiceId);
        break;
      case 'paid':
        await this.handleInvoicePaid(invoiceId);
        break;
      case 'overdue':
        await this.handleInvoiceOverdue(invoiceId);
        break;
      case 'dunning':
        await this.handleInvoiceDunning(invoiceId);
        break;
    }
  }

  private static async handleInvoiceSent(invoiceId: string) {
    // Send email notification
    // Set due date
  }

  private static async handleInvoicePaid(invoiceId: string) {
    // Send receipt email
    // Update member balance
  }

  private static async handleInvoiceOverdue(invoiceId: string) {
    // Send reminder email
    // Flag in dashboard
  }

  private static async handleInvoiceDunning(invoiceId: string) {
    // Send dunning notice
    // Add dunning fees
  }
}
```

**Usage in API**:

```typescript
// app/api/billing/invoices/[id]/status/route.ts
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiAuth(req, async (auth) => {
    const { status } = await req.json();

    // Get current invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', params.id)
      .single();

    // Attempt transition
    try {
      await InvoiceStateMachine.transition(
        params.id,
        invoice.status as InvoiceStatus,
        status as InvoiceStatus,
        { actorId: auth.user.id }
      );

      ToastService.success(`Rechnung auf "${status}" gesetzt`);
      return NextResponse.json({ success: true });
    } catch (error) {
      ToastService.error(`Ungültiger Status-Übergang: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  });
}
```

---

**2.2 Booking Status State Machine** (6h)

Similar implementation for booking states:

- `pending` → `confirmed` | `cancelled`
- `confirmed` → `completed` | `no_show` | `cancelled`
- `completed` → (terminal)
- `no_show` → (terminal)
- `cancelled` → (terminal)

---

#### Day 7-8: Webhooks & Integrations (12h)

**2.3 Zapier Webhook Signature Validation** (4h)

Already implemented in Phase 1! Just need to test it:

```typescript
// app/api/webhooks/zapier/route.ts
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-zapier-signature');

  // ✅ Validate signature
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.ZAPIER_WEBHOOK_SECRET!;
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // Process webhook...
}
```

**Testing Tasks**:

- ✅ Create test Zapier webhook in Zapier dashboard
- ✅ Test signature validation works
- ✅ Test signature rejection works
- ✅ Document webhook setup for users

---

**2.4 Extended Error Tracking (Sentry)** (4h)

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      integrations: [new Sentry.BrowserTracing(), new Sentry.Replay()],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
}

export function captureError(error: Error, context?: Record<string, any>) {
  console.error(error);
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error') {
  Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email: string; role: string }) {
  Sentry.setUser(user);
}
```

**Files to Update**:

- ✅ Install `@sentry/nextjs`
- ✅ Create `sentry.client.config.ts`
- ✅ Create `sentry.server.config.ts`
- ✅ Add Sentry DSN to `.env.local`
- ✅ Wrap all error boundaries with Sentry
- ✅ Add `captureError` to all try-catch blocks

---

**2.5 Performance Monitoring** (4h)

```typescript
// lib/monitoring/performance.ts
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.recordMetric(name, duration);

      if (duration > 1000) {
        console.warn(`Slow operation: ${name} took ${duration}ms`);
        captureMessage(`Slow operation: ${name}`, 'warning');
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}.error`, duration);
      throw error;
    }
  }

  private static recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }

  static getMetrics() {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [name, durations] of this.metrics.entries()) {
      result[name] = {
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length,
      };
    }

    return result;
  }
}

// Usage
export async function getMembers() {
  return PerformanceMonitor.measure('api.members.get', async () => {
    const response = await fetch('/api/members');
    return response.json();
  });
}
```

---

### Week 3: Testing & Documentation (24h)

#### Day 9-10: Testing Infrastructure (16h)

**3.1 Jest Setup** (4h)

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

```typescript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{js,ts,tsx}',
    'app/**/*.{js,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

---

**3.2 Unit Tests for Domain Entities** (6h)

```typescript
// lib/booking/booking.test.ts
import { Booking } from './booking';

describe('Booking', () => {
  describe('getCancellationPolicy', () => {
    it('should return 100% refund when cancelled >24h before session', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
      const booking = new Booking(
        'booking-id',
        'member-id',
        'session-id',
        'club-id',
        'schedule-id',
        'pending',
        new Date(),
        futureDate // session starts in 48h
      );

      const policy = booking.getCancellationPolicy();

      expect(policy.refundPercentage).toBe(100);
      expect(policy.cancellationFee).toBe(0);
      expect(policy.requiresApproval).toBe(false);
    });

    it('should return 50% refund when cancelled 2-24h before session', () => {
      const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now
      const booking = new Booking(
        'booking-id',
        'member-id',
        'session-id',
        'club-id',
        'schedule-id',
        'pending',
        new Date(),
        futureDate
      );

      const policy = booking.getCancellationPolicy();

      expect(policy.refundPercentage).toBe(50);
      expect(policy.cancellationFee).toBe(5);
      expect(policy.requiresApproval).toBe(true);
    });

    it('should return 0% refund when cancelled <2h before session', () => {
      const futureDate = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1h from now
      const booking = new Booking(
        'booking-id',
        'member-id',
        'session-id',
        'club-id',
        'schedule-id',
        'pending',
        new Date(),
        futureDate
      );

      const policy = booking.getCancellationPolicy();

      expect(policy.refundPercentage).toBe(0);
      expect(policy.cancellationFee).toBe(10);
      expect(policy.requiresApproval).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should throw error when cancelling already cancelled booking', () => {
      const booking = Booking.reconstitute({
        id: 'booking-id',
        memberId: 'member-id',
        sessionId: 'session-id',
        clubId: 'club-id',
        scheduleId: 'schedule-id',
        status: 'cancelled',
        bookedAt: new Date(),
        sessionStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      expect(() => {
        booking.cancel('test reason');
      }).toThrow('Cannot cancel booking in status: cancelled');
    });
  });
});
```

**Tests to Write**:

- ✅ `lib/booking/booking.test.ts` (cancellation policies, state transitions)
- ✅ `lib/invoice/invoice.test.ts` (calculations, status)
- ✅ `lib/member/member.test.ts` (validation, membership dates)
- ✅ `lib/state-machines/invoice.state-machine.test.ts` (transitions)

---

**3.3 Integration Tests for API Routes** (6h)

```typescript
// app/api/bookings/route.test.ts
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/bookings', () => {
  it('should create booking successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'valid-token',
      },
      body: JSON.stringify({
        sessionId: 'session-123',
        memberId: 'member-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.status).toBe('pending');
  });

  it('should return 409 when session is full', async () => {
    // Mock session as full
    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'full-session-123',
        memberId: 'member-123',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
  });

  it('should return 403 without CSRF token', async () => {
    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-123',
        memberId: 'member-123',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });
});
```

**Tests to Write**:

- ✅ `app/api/bookings/route.test.ts`
- ✅ `app/api/members/route.test.ts`
- ✅ `app/api/sessions/route.test.ts`
- ✅ `app/api/admin/memberships/[id]/route.test.ts`

---

#### Day 11-12: Documentation (8h)

**3.4 API Documentation (OpenAPI/Swagger)** (4h)

```yaml
# swagger.yaml
openapi: 3.0.0
info:
  title: SwingZ API
  version: 2.1.0
  description: Tennis Club Management System API
  contact:
    name: SwingZ Support
    email: support@swingz.com

servers:
  - url: https://api.swingz.com/v1
    description: Production
  - url: http://localhost:3000/api
    description: Development

paths:
  /members:
    get:
      summary: List all members
      description: Returns a list of members in the club
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: role
          schema:
            type: string
            enum: [member, trainer, admin]
        - in: query
          name: is_active
          schema:
            type: boolean
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Member'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      summary: Create a new member
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateMemberInput'
      responses:
        '201':
          description: Member created
        '400':
          $ref: '#/components/responses/ValidationError'
        '403':
          $ref: '#/components/responses/Forbidden'

components:
  schemas:
    Member:
      type: object
      properties:
        id:
          type: string
          format: uuid
        firstName:
          type: string
        lastName:
          type: string
        email:
          type: string
          format: email
        phone:
          type: string
        dateOfBirth:
          type: string
          format: date

    CreateMemberInput:
      type: object
      required:
        - firstName
        - lastName
        - email
      properties:
        firstName:
          type: string
          minLength: 2
        lastName:
          type: string
          minLength: 2
        email:
          type: string
          format: email

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string

    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
```

Install Swagger UI:

```bash
npm install swagger-ui-react
```

Create API docs page:

```typescript
// app/(protected)/admin/api-docs/page.tsx
'use client'

import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">API Documentation</h1>
      <SwaggerUI url="/swagger.yaml" />
    </div>
  )
}
```

---

**3.5 User Documentation** (4h)

Create comprehensive user guides:

```markdown
# SwingZ User Documentation

## Inhaltsverzeichnis

1. [Erste Schritte](#erste-schritte)
2. [Mitglieder-Handbuch](#mitglieder-handbuch)
3. [Trainer-Handbuch](#trainer-handbuch)
4. [Admin-Handbuch](#admin-handbuch)

## Erste Schritte

### Anmeldung

1. Öffne https://swingz.com/login
2. Gib deine E-Mail und Passwort ein
3. Klicke auf "Anmelden"

### Dashboard

Nach der Anmeldung siehst du dein persönliches Dashboard mit:

- Deinen nächsten Trainings
- Aktuellen Buchungen
- Wichtigen Benachrichtigungen
- Deiner Anwesenheitsstatistik

## Mitglieder-Handbuch

### Training buchen

1. Navigiere zu "Trainingszeiten"
2. Wähle das gewünschte Training aus
3. Klicke auf "Buchen"
4. Bestätige deine Buchung

### Training stornieren

⚠️ **Wichtig**: Stornierungsfristen beachten!

- **>24h vorher**: Kostenlose Stornierung
- **2-24h vorher**: 50% Rückerstattung, 5€ Gebühr
- **<2h vorher**: Keine Rückerstattung, 10€ Gebühr

So stornierst du:

1. Gehe zu "Meine Buchungen"
2. Finde die Buchung
3. Klicke auf "Stornieren"
4. Gib einen Grund an (optional)

## Trainer-Handbuch

### Session erstellen

1. Navigiere zu "Scheduler"
2. Klicke auf "+ Neue Session"
3. Fülle das Formular aus:
   - Trainer (wähle dich selbst)
   - Gruppen (1-3 Gruppen)
   - Datum & Zeit
   - Platz
   - Max. Teilnehmer (1-50)
   - Notizen (optional)
4. Klicke auf "Erstellen"

### Anwesenheit erfassen

1. Navigiere zu "Scheduler"
2. Finde die abgeschlossene Session
3. Klicke auf "Anwesenheit erfassen"
4. Markiere anwesende/abwesende Teilnehmer
5. Speichern

## Admin-Handbuch

### Mitglied hinzufügen

1. Navigiere zu "Mitglieder"
2. Klicke auf "+ Mitglied einladen"
3. Fülle das Formular aus
4. Wähle die Rolle (member/trainer/admin)
5. Klicke auf "Einladung senden"

Das Mitglied erhält eine E-Mail mit Anmeldedaten.

### Rolle ändern

1. Navigiere zu "Mitglieder"
2. Finde das Mitglied
3. Klicke auf "Bearbeiten"
4. Wähle neue Rolle
5. Speichern

⚠️ **Warnung**: Nur Superadmins können andere Superadmins erstellen!

### Rechnung erstellen

1. Navigiere zu "Billing Admin"
2. Klicke auf "+ Neue Rechnung"
3. Wähle Mitglied
4. Füge Positionen hinzu
5. Prüfe die Berechnung
6. Klicke auf "Rechnung erstellen"

Die Rechnung wird automatisch per E-Mail versendet.
```

**Files to Create**:

- ✅ `docs/USER_GUIDE.md`
- ✅ `docs/ADMIN_GUIDE.md`
- ✅ `docs/API_REFERENCE.md`
- ✅ `docs/DEVELOPER_GUIDE.md`

---

### Week 4: Performance & Advanced Features (12h)

#### Day 13-14: Performance Optimization (12h)

**4.1 Query Optimization** (4h)

Identify and fix N+1 queries:

```typescript
// BEFORE (N+1 Problem)
const members = await supabase.from('users').select('*');
for (const member of members) {
  const bookings = await supabase.from('bookings').select('*').eq('member_id', member.id); // ❌ N queries!
  member.bookings = bookings;
}

// AFTER (Single Query with JOIN)
const members = await supabase.from('users').select(`
    *,
    bookings (*)
  `); // ✅ Single query!
```

Create optimized queries:

```typescript
// lib/queries/optimized-queries.ts
export async function getMembersWithBookings(clubId: string) {
  return supabase
    .from('users')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      memberships!inner (
        club_id,
        role,
        is_active
      ),
      bookings (
        id,
        status,
        booked_at,
        session:sessions (
          id,
          timeslot_start,
          timeslot_end
        )
      )
    `
    )
    .eq('memberships.club_id', clubId)
    .eq('memberships.is_active', true)
    .order('last_name', { ascending: true });
}

export async function getDashboardData(userId: string) {
  // Use Supabase RPC for complex aggregations
  return supabase.rpc('get_dashboard_kpis', { p_user_id: userId });
}
```

**Database Indices to Add**:

```sql
-- Add missing indices
CREATE INDEX IF NOT EXISTS idx_bookings_member_status
  ON bookings(member_id, status);

CREATE INDEX IF NOT EXISTS idx_sessions_club_date
  ON sessions(club_id, timeslot_start);

CREATE INDEX IF NOT EXISTS idx_user_club_memberships_active
  ON user_club_memberships(club_id, is_active)
  WHERE is_active = true;
```

---

**4.2 Caching Strategy** (4h)

```typescript
// lib/cache/redis-cache.ts (if using Redis)
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value as T;
  }

  static async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  static async invalidate(key: string): Promise<void> {
    await redis.del(key);
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Usage
export async function getMembers(clubId: string) {
  const cacheKey = `members:${clubId}`;

  // Try cache first
  const cached = await CacheService.get<Member[]>(cacheKey);
  if (cached) return cached;

  // Fetch from DB
  const members = await supabase.from('users').select('*').eq('club_id', clubId);

  // Cache for 5 minutes
  await CacheService.set(cacheKey, members, 300);

  return members;
}

// Invalidate cache on updates
export async function updateMember(id: string, data: any, clubId: string) {
  await supabase.from('users').update(data).eq('id', id);

  // Invalidate relevant caches
  await CacheService.invalidate(`member:${id}`);
  await CacheService.invalidate(`members:${clubId}`);
}
```

**Alternative: SWR with React Query (Client-side caching)**:

```typescript
// Already using React Query, optimize staleTime and cacheTime
export function useMembers(clubId: string) {
  return useQuery({
    queryKey: ['members', clubId],
    queryFn: () => fetchMembers(clubId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

---

**4.3 Image & Asset Optimization** (2h)

```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['qeckztuzeymuwwtyoryi.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },

  // Enable compression
  compress: true,

  // Optimize fonts
  optimizeFonts: true,

  // Enable SWC minification
  swcMinify: true,
}

// Use Next.js Image component
import Image from 'next/image'

<Image
  src={user.avatar_url}
  alt={user.name}
  width={40}
  height={40}
  className="rounded-full"
  priority={false}  // Lazy load by default
/>
```

---

**4.4 Bundle Size Optimization** (2h)

```bash
# Analyze bundle
npm run build
npx @next/bundle-analyzer
```

Optimize imports:

```typescript
// BEFORE
import { Button, Card, Dialog, ... } from '@/components/ui'  // ❌ Large bundle

// AFTER
import { Button } from '@/components/ui/button'  // ✅ Tree-shaking works
import { Card } from '@/components/ui/card'
```

Dynamic imports for heavy components:

```typescript
// app/(protected)/admin/analytics/page.tsx
import dynamic from 'next/dynamic'

const AnalyticsChart = dynamic(() => import('@/components/charts/analytics-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false  // Client-side only
})
```

---

## 📊 Success Metrics

### Week 1 Goals

- ✅ Toast notifications on all CRUD operations
- ✅ Empty states on all list pages
- ✅ Loading states on all async actions
- ✅ Form validation with Zod on all forms
- ✅ Error boundaries on all major pages

### Week 2 Goals

- ✅ State machines for invoices & bookings
- ✅ Zapier webhook fully tested
- ✅ Sentry error tracking configured
- ✅ Performance monitoring in place

### Week 3 Goals

- ✅ 70%+ test coverage
- ✅ API documentation complete
- ✅ User guides published
- ✅ Developer onboarding doc ready

### Week 4 Goals

- ✅ N+1 queries eliminated
- ✅ Caching strategy implemented
- ✅ Bundle size < 500KB
- ✅ Lighthouse score > 90

---

## 🎯 Final Deliverables

### Code

- ✅ All features implemented and tested
- ✅ 80%+ test coverage
- ✅ TypeScript strict mode enabled
- ✅ ESLint: 0 errors, 0 warnings
- ✅ Production build successful

### Documentation

- ✅ API documentation (OpenAPI/Swagger)
- ✅ User guide (German)
- ✅ Admin guide
- ✅ Developer onboarding guide
- ✅ Architecture decision records (ADRs)

### Performance

- ✅ Lighthouse Performance > 90
- ✅ Lighthouse Accessibility > 95
- ✅ Lighthouse Best Practices > 90
- ✅ Lighthouse SEO > 90
- ✅ Bundle size < 500KB
- ✅ TTFB < 200ms
- ✅ LCP < 2.5s

### Security

- ✅ OWASP Top 10 addressed
- ✅ Security headers configured
- ✅ Rate limiting active
- ✅ CSRF protection global
- ✅ Input validation everywhere
- ✅ Audit logging comprehensive

---

## 🚀 Deployment Checklist

Before deploying Phase 2 to production:

### Pre-Deployment

- [ ] Run full test suite: `npm test`
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Test production build locally
- [ ] Review security checklist
- [ ] Backup production database

### Environment Variables

- [ ] `SENTRY_DSN` configured
- [ ] `UPSTASH_REDIS_REST_URL` configured (if using cache)
- [ ] All API keys rotated
- [ ] Webhook secrets updated

### Database

- [ ] Run performance migrations
- [ ] Add new indices
- [ ] Test query performance
- [ ] Verify backup strategy

### Monitoring

- [ ] Sentry error tracking active
- [ ] Performance monitoring configured
- [ ] Uptime monitoring setup
- [ ] Alert rules configured

### Post-Deployment

- [ ] Smoke test all critical paths
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review user feedback

---

**Status**: 📋 **READY TO START**  
**Phase**: Phase 2 - Feature Completion  
**Duration**: 4 weeks (88 hours)  
**Start Date**: 2026-05-06

---

_End of Phase 2 Strategy Document_
