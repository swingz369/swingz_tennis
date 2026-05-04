import { AuditLog } from '@/domain/entities/audit-log';
import { Id } from '@/domain/value-objects/ids';
import type {
  IAuditService,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResult,
  AuditEntityType,
} from '@/domain/services';

// Lazy loader for repository to avoid DB initialization at module load
async function getRepo() {
  const { DrizzleAuditLogRepository } =
    await import('@/infrastructure/persistence/repositories/audit-log.repository');
  return new DrizzleAuditLogRepository();
}

/**
 * Audit service implementation that implements IAuditService interface
 */
export class AuditServiceImpl implements IAuditService {
  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    const log = AuditLog.create(
      Id.fromString(entry.userId),
      this.mapActionToAuditLogAction(entry.action),
      this.mapEntityTypeToResourceType(entry.entityType),
      Id.fromString(entry.entityId),
      entry.details || {},
      entry.ipAddress,
      entry.userAgent
    );

    const repo = await getRepo();
    await repo.save(log);
  }

  /**
   * Query audit logs
   */
  async query(query: AuditLogQuery): Promise<AuditLogResult[]> {
    const repo = await getRepo();

    if (query.entityType && query.entityId) {
      const logs = await repo.findByResource(query.entityType, query.entityId, query.limit || 100);
      return logs.map(this.mapAuditLogToResult);
    }

    if (query.userId) {
      const logs = await repo.findByActor(query.userId, query.limit || 100);
      return logs.map(this.mapAuditLogToResult);
    }

    if (query.startDate && query.endDate) {
      const logs = await repo.findByDateRange(query.startDate, query.endDate, query.limit || 100);
      return logs.map(this.mapAuditLogToResult);
    }

    const logs = await repo.findAll(query.limit || 100, query.offset || 0);
    return logs.map(this.mapAuditLogToResult);
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditTrail(
    entityType: AuditEntityType,
    entityId: string
  ): Promise<AuditLogResult[]> {
    const repo = await getRepo();
    const logs = await repo.findByResource(entityType, entityId, 100);
    return logs.map(this.mapAuditLogToResult);
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditTrail(userId: string, limit = 100): Promise<AuditLogResult[]> {
    const repo = await getRepo();
    const logs = await repo.findByActor(userId, limit);
    return logs.map(this.mapAuditLogToResult);
  }

  private mapAuditLogToResult(log: AuditLog): AuditLogResult {
    return {
      id: log.getId().getValue(),
      userId: log.getActorId().getValue(),
      action: this.mapAuditLogActionToAction(log.getAction()),
      entityType: this.mapResourceTypeToEntityType(log.getResourceType()),
      entityId: log.getResourceId().getValue(),
      details: log.getDetails(),
      ipAddress: log.getIpAddress(),
      userAgent: log.getUserAgent(),
      createdAt: log.getCreatedAt(),
    };
  }

  private mapActionToAuditLogAction(action: string): AuditLog['action'] {
    const mapping: Record<string, AuditLog['action']> = {
      create: 'booking_created',
      update: 'member_updated',
      delete: 'club_deleted',
    };
    return (mapping[action] as AuditLog['action']) || (action as AuditLog['action']);
  }

  private mapAuditLogActionToAction(action: AuditLog['action']): any {
    if (action.includes('created')) return 'create';
    if (action.includes('updated')) return 'update';
    if (action.includes('deleted')) return 'delete';
    if (action.includes('cancelled')) return 'cancel';
    return action;
  }

  private mapEntityTypeToResourceType(entityType: string): AuditLog['resourceType'] {
    return entityType as AuditLog['resourceType'];
  }

  private mapResourceTypeToEntityType(resourceType: AuditLog['resourceType']): AuditEntityType {
    return resourceType as AuditEntityType;
  }
}

/**
 * Legacy static AuditService for backward compatibility
 * TODO: Remove after all callers migrated to IAuditService
 */
export class AuditService {
  /**
   * Log a generic action.
   */
  static async log(
    actorId: string,
    action: AuditLog['action'],
    resourceType: AuditLog['resourceType'],
    resourceId: string,
    details?: Record<string, unknown>,
    request?: Request
  ): Promise<void> {
    const ipAddress = request ? this.extractIpAddress(request) : undefined;
    const userAgent = request ? this.extractUserAgent(request) : undefined;

    const log = AuditLog.create(
      Id.fromString(actorId),
      action,
      resourceType,
      Id.fromString(resourceId),
      details || {},
      ipAddress,
      userAgent
    );

    const repo = await getRepo();
    await repo.save(log);
  }

  /**
   * Quick helper: log booking created
   */
  static async logBookingCreated(
    actorId: string,
    bookingId: string,
    memberId: string,
    sessionId: string,
    request?: Request
  ): Promise<void> {
    await this.log(
      actorId,
      'booking_created',
      'booking',
      bookingId,
      { memberId, sessionId },
      request
    );
  }

  /**
   * Quick helper: log booking cancelled
   */
  static async logBookingCancelled(
    actorId: string,
    bookingId: string,
    reason: string,
    notes?: string,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'booking_cancelled', 'booking', bookingId, { reason, notes }, request);
  }

  /**
   * Quick helper: log booking status changed
   */
  static async logBookingStatusChanged(
    actorId: string,
    bookingId: string,
    oldStatus: string,
    newStatus: string,
    request?: Request
  ): Promise<void> {
    await this.log(
      actorId,
      'booking_status_changed',
      'booking',
      bookingId,
      { oldStatus, newStatus },
      request
    );
  }

  /**
   * Quick helper: log member activation/deactivation
   */
  static async logMemberStatusChange(
    actorId: string,
    memberId: string,
    isActive: boolean,
    request?: Request
  ): Promise<void> {
    await this.log(
      actorId,
      isActive ? 'member_activated' : 'member_deactivated',
      'member',
      memberId,
      { isActive },
      request
    );
  }

  /**
   * Quick helper: log member update
   */
  static async logMemberUpdated(
    actorId: string,
    memberId: string,
    changes: Record<string, unknown>,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'member_updated', 'member', memberId, { changes }, request);
  }

  /**
   * Quick helper: log member invited
   */
  static async logMemberInvited(
    actorId: string,
    memberId: string,
    clubId: string,
    role: string,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'member_invited', 'member', memberId, { clubId, role }, request);
  }

  /**
   * Quick helper: log club creation
   */
  static async logClubCreated(
    actorId: string,
    clubId: string,
    name: string,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'club_created', 'club', clubId, { name }, request);
  }

  /**
   * Quick helper: log club update
   */
  static async logClubUpdated(
    actorId: string,
    clubId: string,
    changes: Record<string, unknown>,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'club_updated', 'club', clubId, { changes }, request);
  }

  /**
   * Quick helper: log club deletion
   */
  static async logClubDeleted(actorId: string, clubId: string, request?: Request): Promise<void> {
    await this.log(actorId, 'club_deleted', 'club', clubId, {}, request);
  }

  /**
   * Quick helper: log role change
   */
  static async logRoleChange(
    actorId: string,
    memberId: string,
    oldRole: string,
    newRole: string,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'role_changed', 'member', memberId, { oldRole, newRole }, request);
  }

  /**
   * Quick helper: log subscription assigned
   */
  static async logSubscriptionAssigned(
    actorId: string,
    memberId: string,
    plan: string,
    request?: Request
  ): Promise<void> {
    await this.log(actorId, 'subscription_assigned', 'subscription', memberId, { plan }, request);
  }

  /**
   * Find logs by actor (user)
   */
  static async findByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    const repo = await getRepo();
    return repo.findByActor(actorId, limit);
  }

  /**
   * Find logs by resource
   */
  static async findByResource(
    resourceType: string,
    resourceId: string,
    limit = 100
  ): Promise<AuditLog[]> {
    const repo = await getRepo();
    return repo.findByResource(resourceType, resourceId, limit);
  }

  /**
   * Find logs by action type
   */
  static async findByAction(action: string, limit = 100): Promise<AuditLog[]> {
    const repo = await getRepo();
    return repo.findByAction(action, limit);
  }

  /**
   * Find logs within a date range
   */
  static async findByDateRange(startDate: Date, endDate: Date, limit = 100): Promise<AuditLog[]> {
    const repo = await getRepo();
    return repo.findByDateRange(startDate, endDate, limit);
  }

  /**
   * Get all logs (for admin dashboard)
   */
  static async getAll(limit = 100, offset = 0): Promise<AuditLog[]> {
    const repo = await getRepo();
    return repo.findAll(limit, offset);
  }

  /**
   * Count total logs
   */
  static async count(): Promise<number> {
    const repo = await getRepo();
    return repo.count();
  }

  private static extractIpAddress(request: Request): string | undefined {
    // Try to get IP from X-Forwarded-For header (for proxied requests)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    // Fallback to connection remote address (not available in Request)
    return undefined;
  }

  private static extractUserAgent(request: Request): string | undefined {
    return request.headers.get('user-agent') || undefined;
  }
}
