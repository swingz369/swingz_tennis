import { AuditLogService } from '@/src/application/services/audit-log.service';
import { AuditAction, EntityType } from '@/src/domain/entities/audit-log.entity';

export class AuditLogger {
  private static auditLogService: AuditLogService = new AuditLogService();

  static async log(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    changes?: any[];
    metadata?: Record<string, any>;
    status?: 'success' | 'failed' | 'partial';
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.auditLogService.logAction(params);
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }

  static async logCreate(
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    data?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'create',
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      metadata: data,
      ipAddress,
      userAgent
    });
  }

  static async logUpdate(
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    changes: any[],
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'update',
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      changes,
      ipAddress,
      userAgent
    });
  }

  static async logDelete(
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    data?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'delete',
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      metadata: data,
      ipAddress,
      userAgent
    });
  }

  static async logApprove(
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'approve',
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      metadata,
      ipAddress,
      userAgent
    });
  }

  static async logReject(
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'reject',
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      metadata: { reason },
      ipAddress,
      userAgent
    });
  }

  static async logLogin(
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'login',
      entityType: 'user',
      entityId: userId,
      userId,
      userName,
      userEmail,
      userRole,
      ipAddress,
      userAgent
    });
  }

  static async logLogout(
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'logout',
      entityType: 'user',
      entityId: userId,
      userId,
      userName,
      userEmail,
      userRole,
      ipAddress,
      userAgent
    });
  }

  static async logExport(
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    format: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action: 'export',
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      metadata: { format, ...metadata },
      ipAddress,
      userAgent
    });
  }

  static async logError(
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    errorMessage: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.log({
      action,
      entityType,
      entityId,
      userId,
      userName,
      userEmail,
      userRole,
      status: 'failed',
      errorMessage,
      metadata,
      ipAddress,
      userAgent
    });
  }
}
