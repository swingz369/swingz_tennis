---
name: swingz-booking-flow
description: SwingZ-specific knowledge for the booking system — status machine, court bookings, waitlist logic, double-booking prevention, and cancellation flows.
---

# SwingZ Booking Flow

## Where it lives

- **Core services:** `lib/booking/booking.service.ts`, `court.service.ts`, `safe-booking.ts`, `schedule.service.ts`, `waitlist.service.ts`
- **Status machine:** `src/domain/services/booking-status-machine.ts`
- **API endpoints:** `app/api/bookings/` (direct, [id], series, validate-series)
- **Schema:** `bookings` table in `src/infrastructure/persistence/schema.ts`
- **UI components:** `components/bookings/court-bookings.tsx`, `app/(protected)/bookings/`
- **Validation:** `src/domain/services/validation.service.ts`
- **Audit:** `audit_logs` table (every booking write is logged)

## The booking status machine

```typescript
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'], // Admin confirm OR user cancel
  confirmed: ['completed', 'cancelled', 'no_show'], // Trainer marks OR user cancels
  cancelled: [], // Terminal
  completed: [], // Terminal
  no_show: [], // Terminal
};
```

**Rules:**

- Only `confirmed` bookings count toward capacity
- Cancellation within 24h before session → triggers no-refund logic (see billing service)
- `completed` is set automatically 2h after session end (cron) OR manually by trainer
- `no_show` is set by trainer at session start if member didn't show up

## Double-booking prevention (CRITICAL)

**Three layers of defense:**

1. **Database:** Unique constraint on `(court_id, session_id)` — hard error on conflict
2. **Service layer:** `safe-booking.ts` wraps the insert in a transaction with `SELECT ... FOR UPDATE`
3. **API layer:** `validate-series` endpoint checks all dates before confirming a series booking

**Never** bypass these. If you see `BookingConflictError`, the user needs to pick a different slot — don't try to "force" it.

## Booking creation flow

```typescript
// In booking.service.ts
async createBooking(input: CreateBookingInput): Promise<Booking> {
  // 1. Validate member has active club membership
  const membership = await this.getActiveMembership(input.memberId, input.clubId);
  if (!membership) throw new NoActiveMembershipError();

  // 2. Check session is in the future
  if (input.session.startsAt < new Date()) throw new PastSessionError();

  // 3. Check capacity (confirmed bookings only)
  const confirmedCount = await this.countConfirmedBookings(input.sessionId);
  if (confirmedCount >= input.session.capacity) throw new SessionFullError();

  // 4. Check member doesn't already have a booking for this session
  const existing = await this.findMemberBooking(input.memberId, input.sessionId);
  if (existing) throw new DuplicateBookingError(existing.id);

  // 5. Insert booking + audit log (atomic)
  return this.db.transaction(async (tx) => {
    const booking = await tx.insert(bookings).values({...}).returning();
    await tx.insert(auditLogs).values({action: 'booking.created', bookingId: booking.id, ...});
    return booking;
  });
}
```

## Waitlist logic

When a session is full, members can join the waitlist:

```typescript
// In waitlist.service.ts
async joinWaitlist(memberId: string, sessionId: string): Promise<WaitlistEntry> {
  // Position is calculated by registration time (configurable in season_planning_configs)
  const position = await this.getNextWaitlistPosition(sessionId);
  return this.db.insert(seasonWaitlists).values({
    member_id: memberId,
    session_id: sessionId,
    position,
    joined_at: new Date(),
  }).returning();
}
```

**Auto-promotion:** When a `confirmed` booking is cancelled, the first waitlist entry is promoted to `confirmed` (via cron every 5 min, or immediately on WebSocket event).

## Cancellation flow

```typescript
async cancelBooking(bookingId: string, reason: CancellationReason, userId: string): Promise<Booking> {
  // 1. Verify ownership (member can cancel own; admin can cancel any in their club)
  const booking = await this.getBooking(bookingId);
  await assertCanCancel(userId, booking);

  // 2. Check 24h rule (configurable per club)
  const hoursUntil = differenceInHours(booking.session.startsAt, new Date());
  if (hoursUntil < 24 && !userIsAdmin) throw new LateCancellationError(hoursUntil);

  // 3. Update status + audit + notify waitlist
  return this.db.transaction(async (tx) => {
    const updated = await tx.update(bookings)
      .set({ status: 'cancelled', cancelled_at: new Date(), cancellation_reason: reason })
      .where(eq(bookings.id, bookingId))
      .returning();
    await tx.insert(auditLogs).values({action: 'booking.cancelled', ...});
    // Trigger waitlist promotion (async, don't await)
    this.waitlistService.promoteNext(sessionId).catch(console.error);
    return updated;
  });
}
```

## Series bookings

`POST /api/bookings/series` creates a series of bookings (e.g. every Tuesday for 12 weeks):

1. Calls `validate-series` first to check ALL dates for conflicts
2. If any conflict → returns 409 with list of conflicting dates
3. If all clear → creates bookings in a single transaction
4. **If any insert fails → entire transaction rolls back** (no partial series)

## Common tasks

### Add a new booking status

1. Add to `BookingStatus` type in `booking-status-machine.ts`
2. Update `TRANSITIONS` map (what's allowed from this status)
3. Update UI badge in `court-bookings.tsx` (color + icon)
4. Add test case in `booking-status-machine.test.ts`

### Add a cancellation reason category

1. Add to `CancellationReason` enum
2. Update analytics aggregation in `club-analytics.use-cases.ts`
3. Add to `VERKAUFSBEREITSCHAFT.md` "Cancellation Insights" section

### Debug "why was my booking rejected?"

1. Check audit log: `SELECT * FROM audit_logs WHERE action LIKE 'booking.%' AND booking_id = X`
2. Common causes: past session, session full, duplicate, no membership, 24h rule
3. The error message is user-friendly by design — show it to the user verbatim

## Gotchas

- **Capacity is dynamic** — it's `sessions.capacity`, not a hardcoded number. Admins can change it mid-season.
- **Status transitions are strict** — use the `BookingStatusMachine` class, don't manually set `status: 'cancelled'`.
- **Audit logs are required** — every booking mutation must write an audit log. Don't skip this for "internal" operations.
- **Timezone matters** — sessions store `starts_at` in UTC but display in club timezone. Always compare with `.toISOString()` in service layer.
- **The `24h rule` is per-club** — check `clubs.cancellation_window_hours`, not a hardcoded constant.
