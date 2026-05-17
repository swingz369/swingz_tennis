import type {
  AuditLog,
  AuditLogFilter,
  AuditLogSummary,
  AuditAction,
  EntityType,
  AuditChange,
} from '../../domain/entities/audit-log.entity';

export class AuditLogService {
  private auditLogs: Map<string, AuditLog> = new Map();

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this.initializeMockData();
    }
  }

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
    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      userRole: params.userRole,
      timestamp: new Date(),
      changes: params.changes,
      metadata: params.metadata,
      status: params.status || 'success',
      errorMessage: params.errorMessage,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    };

    this.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  async getAuditLogs(filter?: AuditLogFilter): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());

    if (filter) {
      if (filter.startDate) {
        logs = logs.filter((log) => log.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        logs = logs.filter((log) => log.timestamp <= filter.endDate!);
      }
      if (filter.action && filter.action.length > 0) {
        logs = logs.filter((log) => filter.action!.includes(log.action));
      }
      if (filter.entityType && filter.entityType.length > 0) {
        logs = logs.filter((log) => filter.entityType!.includes(log.entityType));
      }
      if (filter.userId && filter.userId.length > 0) {
        logs = logs.filter((log) => filter.userId!.includes(log.userId));
      }
      if (filter.userRole && filter.userRole.length > 0) {
        logs = logs.filter((log) => filter.userRole!.includes(log.userRole));
      }
      if (filter.status && filter.status.length > 0) {
        logs = logs.filter((log) => filter.status!.includes(log.status));
      }
      if (filter.entityId) {
        logs = logs.filter((log) => log.entityId === filter.entityId);
      }
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        logs = logs.filter(
          (log) =>
            log.userName.toLowerCase().includes(term) ||
            log.userEmail.toLowerCase().includes(term) ||
            log.entityId.toLowerCase().includes(term) ||
            (log.errorMessage && log.errorMessage.toLowerCase().includes(term))
        );
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAuditLogById(id: string): Promise<AuditLog | null> {
    return this.auditLogs.get(id) || null;
  }

  async getAuditLogsByEntity(entityType: EntityType, entityId: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter((log) => log.entityType === entityType && log.entityId === entityId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAuditLogsByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getAuditLogSummary(startDate?: Date, endDate?: Date): Promise<AuditLogSummary> {
    let logs = Array.from(this.auditLogs.values());

    if (startDate) {
      logs = logs.filter((log) => log.timestamp >= startDate);
    }
    if (endDate) {
      logs = logs.filter((log) => log.timestamp <= endDate);
    }

    const logsByAction = logs.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<AuditAction, number>
    );

    const logsByEntityType = logs.reduce(
      (acc, log) => {
        acc[log.entityType] = (acc[log.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<EntityType, number>
    );

    const logsByUser = logs.reduce(
      (acc, log) => {
        acc[log.userId] = (acc[log.userId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const logsByStatus = logs.reduce(
      (acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      },
      {} as Record<'success' | 'failed' | 'partial', number>
    );

    const recentActivity = logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const topUsers = Object.entries(logsByUser)
      .map(([userId, actionCount]) => ({
        userId,
        userName: logs.find((l) => l.userId === userId)?.userName || userId,
        actionCount,
      }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 5);

    return {
      totalLogs: logs.length,
      logsByAction,
      logsByEntityType,
      logsByUser,
      logsByStatus,
      recentActivity,
      topUsers,
    };
  }

  async deleteAuditLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;
    for (const [id, log] of this.auditLogs) {
      if (log.timestamp < cutoffDate) {
        this.auditLogs.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async exportAuditLogs(filter?: AuditLogFilter, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.getAuditLogs(filter);

    if (format === 'csv') {
      const headers = [
        'ID',
        'Action',
        'Entity Type',
        'Entity ID',
        'User',
        'User Email',
        'User Role',
        'Timestamp',
        'Status',
        'IP Address',
        'Error Message',
      ];
      const rows = logs.map((log) => [
        log.id,
        log.action,
        log.entityType,
        log.entityId,
        log.userName,
        log.userEmail,
        log.userRole,
        log.timestamp.toISOString(),
        log.status,
        log.ipAddress || '',
        log.errorMessage || '',
      ]);
      return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }

  private initializeMockData(): void {
    const mockLogs: AuditLog[] = [
      {
        id: 'audit-1',
        action: 'create',
        entityType: 'member',
        entityId: 'member-1',
        userId: 'user-1',
        userName: 'Admin User',
        userEmail: 'admin@swingz.de',
        userRole: 'admin',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        changes: [
          { field: 'name', oldValue: null, newValue: 'Max Mustermann', changeType: 'added' },
          { field: 'email', oldValue: null, newValue: 'max@example.com', changeType: 'added' },
        ],
        status: 'success',
      },
      {
        id: 'audit-2',
        action: 'update',
        entityType: 'member',
        entityId: 'member-1',
        userId: 'user-1',
        userName: 'Admin User',
        userEmail: 'admin@swingz.de',
        userRole: 'admin',
        timestamp: new Date(Date.now() - 1000 * 60 * 25),
        changes: [
          { field: 'status', oldValue: 'trial', newValue: 'active', changeType: 'modified' },
        ],
        status: 'success',
      },
      {
        id: 'audit-3',
        action: 'create',
        entityType: 'trial_training',
        entityId: 'trial-1',
        userId: 'user-2',
        userName: 'Max Mustermann',
        userEmail: 'max@example.com',
        userRole: 'member',
        timestamp: new Date(Date.now() - 1000 * 60 * 20),
        status: 'success',
      },
      {
        id: 'audit-4',
        action: 'approve',
        entityType: 'hours_log',
        entityId: 'hours-1',
        userId: 'user-1',
        userName: 'Admin User',
        userEmail: 'admin@swingz.de',
        userRole: 'admin',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        status: 'success',
      },
      {
        id: 'audit-5',
        action: 'login',
        entityType: 'user',
        entityId: 'user-1',
        userId: 'user-1',
        userName: 'Admin User',
        userEmail: 'admin@swingz.de',
        userRole: 'admin',
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      },
      {
        id: 'audit-6',
        action: 'export',
        entityType: 'report',
        entityId: 'report-1',
        userId: 'user-1',
        userName: 'Admin User',
        userEmail: 'admin@swingz.de',
        userRole: 'admin',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        metadata: { format: 'pdf', period: 'monthly' },
        status: 'success',
      },
      {
        id: 'audit-7',
        action: 'create',
        entityType: 'booking',
        entityId: 'booking-1',
        userId: 'user-2',
        userName: 'Max Mustermann',
        userEmail: 'max@example.com',
        userRole: 'member',
        timestamp: new Date(Date.now() - 1000 * 60 * 2),
        status: 'success',
      },
      {
        id: 'audit-8',
        action: 'sign',
        entityType: 'sepa_mandate',
        entityId: 'sepa-1',
        userId: 'user-2',
        userName: 'Max Mustermann',
        userEmail: 'max@example.com',
        userRole: 'member',
        timestamp: new Date(Date.now() - 1000 * 60),
        status: 'success',
      },
    ];

    mockLogs.forEach((log) => this.auditLogs.set(log.id, log));
  }
}
