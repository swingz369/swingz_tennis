# 🔒 Security & Architecture Updates - May 2026

## Quick Reference Guide

This guide covers the architectural improvements implemented on 2026-05-05.

---

## 🚀 Quick Start

### Apply Database Migration

```bash
# Development
supabase db push

# Production
psql $DATABASE_URL -f supabase/migrations/20260505_security_fixes.sql
```

### Set Environment Variables

```bash
# Required for webhook security
ZAPIER_WEBHOOK_SECRET=your-secret-key-here
```

### Grant Initial Superadmin

```sql
INSERT INTO user_club_memberships (user_id, club_id, role, is_active)
VALUES ('<your-user-id>', '<your-club-id>', 'superadmin', true)
ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'superadmin';
```

---

## 🔐 New Security Features

### 1. CSRF Protection

All mutation endpoints now require CSRF tokens.

**Frontend Integration:**

```typescript
// Get token
const { token } = await fetch('/api/csrf-token').then((r) => r.json());

// Use in requests
fetch('/api/sessions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  },
  body: JSON.stringify(data),
});
```

### 2. Rate Limiting

- **Login**: 5 attempts per 15 minutes
- **Strict endpoints**: 10 requests per minute
- **Standard endpoints**: 100 requests per minute

### 3. Safe Booking System

Use the race-condition-free booking helper:

```typescript
import { createBookingSafe } from '@/lib/booking/safe-booking';

const result = await createBookingSafe({
  memberId: 'user-id',
  sessionId: 'session-id',
  clubId: 'club-id',
  scheduleId: 'schedule-id',
});

if (!result.success) {
  // Handle error: session full, already booked, etc.
  console.error(result.error);
}
```

---

## 🎨 New UI Components

### Loading States

```typescript
import {
  LoadingSpinner,
  PageLoader,
  CardSkeleton,
  TableSkeleton,
  ButtonLoader
} from '@/components/ui/loading-states/loading';

// Full page loading
<PageLoader message="Daten werden geladen..." />

// Button loading
<Button disabled={isLoading}>
  {isLoading ? <ButtonLoader /> : 'Speichern'}
</Button>

// Table loading
{isLoading ? <TableSkeleton rows={5} /> : <DataTable data={data} />}
```

### Empty States

```typescript
import { EmptyState, NoResults, ErrorState } from '@/components/ui/empty-states/empty-state';
import { Users } from 'lucide-react';

// No data
{members.length === 0 && (
  <EmptyState
    icon={Users}
    title="Noch keine Mitglieder"
    description="Lade dein erstes Mitglied ein, um loszulegen."
    action={{
      label: 'Mitglied einladen',
      onClick: () => router.push('/admin/members/invite')
    }}
  />
)}

// No search results
<NoResults
  searchQuery={query}
  onClearSearch={() => setQuery('')}
  icon={Search}
/>

// Error with retry
<ErrorState
  onRetry={() => refetch()}
  icon={AlertCircle}
/>
```

---

## 📝 Audit Logging

### Enhanced Audit Service

```typescript
import { EnhancedAuditService } from '@/lib/audit/enhanced-audit.service';

// Log member update
await EnhancedAuditService.logMemberUpdate(
  actorId,
  memberId,
  { email: { from: 'old@email.com', to: 'new@email.com' } },
  request
);

// Log session creation
await EnhancedAuditService.logSessionCreated(
  actorId,
  sessionId,
  { day: 'Monday', time: '18:00' },
  request
);

// Query audit logs
const history = await EnhancedAuditService.getResourceHistory('booking', bookingId, 50);

const userActivity = await EnhancedAuditService.getUserActivity(userId, 100);

const recentLogs = await EnhancedAuditService.getRecentLogs({
  action: 'member_updated',
  startDate: new Date('2026-05-01'),
  limit: 100,
});
```

---

## 🔄 Breaking Changes

### 1. Booking Entity

**Before:**

```typescript
Booking.create(clubId, memberId, scheduleId, sessionId);
```

**After:**

```typescript
const session = await getSessionById(sessionId);
Booking.create(clubId, memberId, scheduleId, sessionId, session.timeslot_start);
```

### 2. Member Queries

**Before:**

```typescript
const members = await MemberService.getActiveMembers();
```

**After:**

```typescript
const members = await MemberService.getActiveMembers(
  auth.role === 'superadmin' ? undefined : auth.clubId
);
```

---

## 🧪 Testing

### Security Tests

```bash
# Test rate limiting
npm run test:rate-limit

# Test CSRF protection
npm run test:csrf

# Test booking race conditions
npm run test:booking-concurrency
```

### Manual Testing

```bash
# 1. Login rate limit
for i in {1..6}; do curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"test@test.com","password":"wrong"}'; done

# 2. Double booking prevention
# Try booking same session twice - second should fail

# 3. CSRF protection
# Try POST without X-CSRF-Token header - should fail with 403
```

---

## 📊 Monitoring

### Key Metrics to Watch

- **Login attempts**: Monitor for brute force
- **Booking failures**: Track RPC errors
- **Webhook failures**: Check signature validation
- **Audit log volume**: Ensure logging is working

### Recommended Alerts

```
- More than 5 failed logins from same IP: Alert
- Booking RPC error rate > 5%: Alert
- Webhook signature failures > 10/hour: Alert
- Audit logging failures: Alert
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "Invalid CSRF token" on all mutations**

```bash
# Solution: Get fresh token
const { token } = await fetch('/api/csrf-token').then(r => r.json());
```

**2. "Session is full" when booking**

```typescript
// Check current capacity
const count = await getSessionBookingCount(sessionId);
const session = await getSessionById(sessionId);
console.log(`${count}/${session.max_participants} booked`);
```

**3. "User has no active club membership"**

```sql
-- Grant membership
INSERT INTO user_club_memberships (user_id, club_id, role, is_active)
VALUES ('<user-id>', '<club-id>', 'member', true);
```

**4. Webhook failing with "Invalid signature"**

```bash
# Verify environment variable is set
echo $ZAPIER_WEBHOOK_SECRET

# Check signature calculation
# Zapier uses HMAC-SHA256
```

---

## 📚 Additional Resources

- **Full Implementation Guide**: See `IMPLEMENTATION_SUMMARY.md`
- **Architecture Analysis**: See `ARCHITECTURE_ANALYSIS.md`
- **Database Schema**: See `supabase/migrations/20260505_security_fixes.sql`
- **API Reference**: See API documentation

---

## 🎯 Next Steps

1. ✅ Apply database migration
2. ✅ Set environment variables
3. ✅ Grant initial superadmin
4. ✅ Test critical paths
5. ⬜ Update frontend forms with CSRF
6. ⬜ Monitor audit logs
7. ⬜ Conduct security audit

---

**Last Updated**: 2026-05-05  
**Version**: 2.0  
**Status**: Production Ready
