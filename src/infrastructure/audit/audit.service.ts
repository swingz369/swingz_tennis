import { DrizzleAuditLogRepository } from '@/infrastructure/persistence/repositories/audit-log.repository';
import { AuditLog } from '@/domain/entities/audit-log';
import { Id } from '@/domain/value-objects/ids';

const getRepo = () => new DrizzleAuditLogRepository();

/**
 * Audit service for logging important system actions.
 * Provides a simple API for recording audit events across the application.
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

    const repo = getRepo();
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
   * Find logs by actor (user)
   */
  static async findByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    const repo = getRepo();
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
    const repo = getRepo();
    return repo.findByResource(resourceType, resourceId, limit);
  }

  /**
   * Find logs by action type
   */
  static async findByAction(action: string, limit = 100): Promise<AuditLog[]> {
    const repo = getRepo();
    return repo.findByAction(action, limit);
  }

  /**
   * Find logs within a date range
   */
  static async findByDateRange(startDate: Date, endDate: Date, limit = 100): Promise<AuditLog[]> {
    const repo = getRepo();
    return repo.findByDateRange(startDate, endDate, limit);
  }

  /**
   * Get all logs (for admin dashboard)
   */
  static async getAll(limit = 100, offset = 0): Promise<AuditLog[]> {
    const repo = getRepo();
    return repo.findAll(limit, offset);
  }

  /**
   * Count total logs
   */
  static async count(): Promise<number> {
    const repo = getRepo();
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
