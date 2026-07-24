import { AuditLog } from '@/domain/entities/audit-log';
import { Id } from '@/domain/value-objects/ids';
import type {
  IAuditService,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResult,
  AuditEntityType,
  AuditAction,
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
      entry.userAgent,
      entry.clubId ? Id.fromString(entry.clubId) : undefined
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

  private mapAuditLogActionToAction(action: AuditLog['action']): AuditAction {
    if (action.includes('created')) return 'create';
    if (action.includes('updated')) return 'update';
    if (action.includes('deleted')) return 'delete';
    if (action.includes('cancelled')) return 'cancel';
    if (action.includes('login')) return 'login';
    if (action.includes('logout')) return 'logout';
    if (action.includes('approved')) return 'approve';
    if (action.includes('rejected')) return 'reject';
    if (action.includes('payment')) return 'payment';
    if (action.includes('refund')) return 'refund';
    return 'update'; // Safe fallback
  }

  private mapEntityTypeToResourceType(entityType: string): AuditLog['resourceType'] {
    return entityType as AuditLog['resourceType'];
  }

  private mapResourceTypeToEntityType(resourceType: AuditLog['resourceType']): AuditEntityType {
    return resourceType as AuditEntityType;
  }
}
