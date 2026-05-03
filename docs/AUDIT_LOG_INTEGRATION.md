# Audit Log Integration Guide

This guide shows how to integrate audit logging with all existing features in the SwingZ application.

## Overview

The audit logging system provides comprehensive tracking of all system actions, including:
- User actions (create, update, delete)
- Authentication events (login, logout)
- Approval workflows
- Data exports
- System configuration changes

## Quick Start

### 1. Import the AuditLogger

```typescript
import { AuditLogger } from '@/src/application/utils/audit-logger';
import { AuditAction, EntityType } from '@/src/domain/entities/audit-log.entity';
```

### 2. Log an Action

```typescript
await AuditLogger.logCreate(
  'member',
  memberId,
  userId,
  userName,
  userEmail,
  userRole,
  memberData,
  ipAddress,
  userAgent
);
```

## Integration Examples

### Member Management

```typescript
// Create member
await AuditLogger.logCreate(
  'member',
  member.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  member,
  request.ip,
  request.headers.get('user-agent')
);

// Update member
await AuditLogger.logUpdate(
  'member',
  member.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  [
    { field: 'status', oldValue: 'trial', newValue: 'active', changeType: 'modified' }
  ],
  request.ip,
  request.headers.get('user-agent')
);

// Delete member
await AuditLogger.logDelete(
  'member',
  member.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  member,
  request.ip,
  request.headers.get('user-agent')
);
```

### Trial Training Management

```typescript
// Create trial training
await AuditLogger.logCreate(
  'trial_training',
  trial.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  trial,
  request.ip,
  request.headers.get('user-agent')
);

// Convert trial to member
await AuditLogger.log({
  action: 'convert',
  entityType: 'trial_training',
  entityId: trial.id,
  userId: currentUser.id,
  userName: currentUser.name,
  userEmail: currentUser.email,
  userRole: currentUser.role,
  metadata: { convertedToMemberId: memberId },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
});
```

### Trainer Management

```typescript
// Create trainer profile
await AuditLogger.logCreate(
  'trainer',
  trainer.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  trainer,
  request.ip,
  request.headers.get('user-agent')
);

// Update trainer qualifications
await AuditLogger.logUpdate(
  'trainer',
  trainer.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  [
    { field: 'qualifications', oldValue: oldQuals, newValue: newQuals, changeType: 'modified' }
  ],
  request.ip,
  request.headers.get('user-agent')
);
```

### Hours Log Management

```typescript
// Approve hours log
await AuditLogger.logApprove(
  'hours_log',
  hoursLog.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  { hours: hoursLog.hours, rate: hoursLog.hourlyRate },
  request.ip,
  request.headers.get('user-agent')
);

// Reject hours log
await AuditLogger.logReject(
  'hours_log',
  hoursLog.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  rejectionReason,
  request.ip,
  request.headers.get('user-agent')
);
```

### Billing Management

```typescript
// Create billing
await AuditLogger.logCreate(
  'billing',
  billing.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  billing,
  request.ip,
  request.headers.get('user-agent')
);

// Mark payment
await AuditLogger.log({
  action: 'pay',
  entityType: 'billing',
  entityId: billing.id,
  userId: currentUser.id,
  userName: currentUser.name,
  userEmail: currentUser.email,
  userRole: currentUser.role,
  metadata: { amount: billing.totalAmount, paymentMethod: 'bank_transfer' },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
});
```

### Booking Management

```typescript
// Create booking
await AuditLogger.logCreate(
  'booking',
  booking.id,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  booking,
  request.ip,
  request.headers.get('user-agent')
);

// Cancel booking
await AuditLogger.log({
  action: 'cancel',
  entityType: 'booking',
  entityId: booking.id,
  userId: currentUser.id,
  userName: currentUser.name,
  userEmail: currentUser.email,
  userRole: currentUser.role,
  metadata: { reason: cancellationReason },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
);
```

### SEPA Mandate Management

```typescript
// Sign SEPA mandate
await AuditLogger.log({
  action: 'sign',
  entityType: 'sepa_mandate',
  entityId: mandate.id,
  userId: currentUser.id,
  userName: currentUser.name,
  userEmail: currentUser.email,
  userRole: currentUser.role,
  metadata: { ibanLast4: mandate.iban.slice(-4) },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
});
```

### Email Sending

```typescript
// Send email
await AuditLogger.log({
  action: 'send',
  entityType: 'email',
  entityId: emailId,
  userId: currentUser.id,
  userName: currentUser.name,
  userEmail: currentUser.email,
  userRole: currentUser.role,
  metadata: { 
    template: templateId,
    recipient: recipientEmail,
    subject: emailSubject 
  },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
});
```

### Export Operations

```typescript
// Export data
await AuditLogger.logExport(
  'report',
  reportId,
  currentUser.id,
  currentUser.name,
  currentUser.email,
  currentUser.role,
  format,
  { reportType: 'statistics', period: 'monthly' },
  request.ip,
  request.headers.get('user-agent')
);
```

### Authentication

```typescript
// Login
await AuditLogger.logLogin(
  user.id,
  user.name,
  user.email,
  user.role,
  request.ip,
  request.headers.get('user-agent')
);

// Logout
await AuditLogger.logLogout(
  user.id,
  user.name,
  user.email,
  user.role,
  request.ip,
  request.headers.get('user-agent')
);
```

### Error Handling

```typescript
try {
  // Perform operation
  await createMember(data);
  
  // Log success
  await AuditLogger.logCreate(
    'member',
    member.id,
    currentUser.id,
    currentUser.name,
    currentUser.email,
    currentUser.role,
    member,
    request.ip,
    request.headers.get('user-agent')
  );
} catch (error) {
  // Log error
  await AuditLogger.logError(
    'create',
    'member',
    memberId,
    currentUser.id,
    currentUser.name,
    currentUser.email,
    currentUser.role,
    error.message,
    { errorDetails: error.stack },
    request.ip,
    request.headers.get('user-agent')
  );
  
  throw error;
}
```

## API Route Integration

### Using AuditContext Helper

```typescript
import { getAuditContext } from '@/src/application/utils/audit-middleware';
import { AuditLogger } from '@/src/application/utils/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const context = getAuditContext(request);
    
    // Perform operation
    const member = await createMember(data);
    
    // Log action
    await AuditLogger.logCreate(
      'member',
      member.id,
      context.userId,
      context.userName,
      context.userEmail,
      context.userRole,
      member,
      context.ipAddress,
      context.userAgent
    );
    
    return NextResponse.json(member);
  } catch (error) {
    const context = getAuditContext(request);
    
    await AuditLogger.logError(
      'create',
      'member',
      memberId,
      context.userId,
      context.userName,
      context.userEmail,
      context.userRole,
      error.message,
      { errorDetails: error.stack },
      context.ipAddress,
      context.userAgent
    );
    
    throw error;
  }
}
```

## Available Actions

- `create` - Create new entity
- `update` - Update existing entity
- `delete` - Delete entity
- `read` - Read/view entity
- `login` - User login
- `logout` - User logout
- `approve` - Approve request
- `reject` - Reject request
- `export` - Export data
- `import` - Import data
- `send` - Send email/notification
- `sign` - Sign document
- `convert` - Convert entity
- `cancel` - Cancel booking/appointment
- `reschedule` - Reschedule booking
- `book` - Book court/session
- `unbook` - Cancel booking
- `pay` - Process payment
- `refund` - Process refund
- `upload` - Upload file
- `download` - Download file
- `configure` - Configure system
- `reset` - Reset data

## Available Entity Types

- `member` - Member
- `trainer` - Trainer
- `court` - Court
- `booking` - Booking
- `trial_training` - Trial training
- `training_session` - Training session
- `hours_log` - Hours log
- `absence` - Absence
- `billing` - Billing
- `invoice` - Invoice
- `payment` - Payment
- `sepa_mandate` - SEPA mandate
- `fee_configuration` - Fee configuration
- `payment_settings` - Payment settings
- `system_settings` - System settings
- `email` - Email
- `notification` - Notification
- `report` - Report
- `user` - User
- `role` - Role
- `permission` - Permission

## Best Practices

1. **Always log important actions**: Create, update, delete operations should always be logged
2. **Include context**: Log IP address and user agent for security auditing
3. **Track changes**: For update operations, include the old and new values
4. **Handle errors**: Log failed operations with error messages
5. **Use appropriate actions**: Choose the most specific action type
6. **Include metadata**: Add relevant metadata for complex operations
7. **Don't block operations**: Audit logging should not block the main operation
8. **Handle logging failures gracefully**: Catch and log audit logging errors

## Security Considerations

- Audit logs contain sensitive information (user actions, IP addresses)
- Ensure audit log API endpoints are properly secured
- Implement appropriate access controls for viewing audit logs
- Consider implementing log retention policies
- Regularly review audit logs for suspicious activity

## Testing

```typescript
import { AuditLogger } from '@/src/application/utils/audit-logger';

describe('Audit Logging', () => {
  it('should log member creation', async () => {
    await AuditLogger.logCreate(
      'member',
      'member-1',
      'user-1',
      'Test User',
      'test@example.com',
      'admin',
      { name: 'Test User', email: 'test@example.com' }
    );
    
    // Verify log was created
    const logs = await auditLogService.getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('create');
    expect(logs[0].entityType).toBe('member');
  });
});
```

## Troubleshooting

### Audit logs not appearing
- Check that AuditLogger is being called correctly
- Verify audit log service is initialized
- Check for errors in console

### Missing user information
- Ensure user context is properly passed
- Check that headers are being set correctly
- Verify getAuditContext is being used

### Performance issues
- Audit logging is asynchronous and should not block
- Consider batching logs for high-volume operations
- Implement log cleanup for old entries
