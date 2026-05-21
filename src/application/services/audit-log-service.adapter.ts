/**
 * Audit Log Service Adapter
 *
 * Audit log operations via in-memory service.
 * TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
 *
 * Usage:
 * ```typescript
 * import { auditLogService } from '@/application/services/audit-log-service.adapter';
 *
 * const logs = await auditLogService.getAuditLogs();
 * ```
 */

import type {
  AuditLog,
  AuditLogFilter,
  AuditLogSummary,
  AuditAction,
  EntityType,
  AuditChange,
} from '@/domain/entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';
// import { DrizzleAuditLogRepository } from '@/infrastructure/persistence/repositories/audit-log.repository';

class AuditLogServiceAdapter {
  private auditLogService = new AuditLogService();
  // private _auditLogRepo = new DrizzleAuditLogRepository();

  /**
   * Log an action
   */
  async logAction(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    changes?: AuditChange[];
    metadata?: Record<string, unknown>;
    status?: 'success' | 'failed' | 'partial';
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.logAction(params);
  }

  /**
   * Get audit logs with optional filters
   */
  async getAuditLogs(filter?: AuditLogFilter): Promise<AuditLog[]> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.getAuditLogs(filter);
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.getAuditLogById(id);
  }

  /**
   * Get audit logs by entity
   */
  async getAuditLogsByEntity(entityType: EntityType, entityId: string): Promise<AuditLog[]> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.getAuditLogsByEntity(entityType, entityId);
  }

  /**
   * Get audit logs by user
   */
  async getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.getAuditLogsByUser(userId, limit);
  }

  /**
   * Get audit log summary
   */
  async getAuditLogSummary(startDate?: Date, endDate?: Date): Promise<AuditLogSummary> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.getAuditLogSummary(startDate, endDate);
  }

  /**
   * Delete audit logs older than specified days
   */
  async deleteAuditLogs(olderThanDays: number): Promise<number> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.deleteAuditLogs(olderThanDays);
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    filter?: AuditLogFilter,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    // TODO: Switch to Drizzle repository when AuditLog domain types are aligned.
    return this.auditLogService.exportAuditLogs(filter, format);
  }
}

// Export singleton instance
export const auditLogService = new AuditLogServiceAdapter();
