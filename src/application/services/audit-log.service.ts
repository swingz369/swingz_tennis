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
    const now = Date.now();
    const m = (minutes: number) => new Date(now - minutes * 60000);

    const mockLogs: AuditLog[] = [
      // --- Recent actions (last 2 hours) ---
      { id: 'audit-1', action: 'create', entityType: 'member', entityId: 'member-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(30), changes: [{ field: 'name', oldValue: null, newValue: 'Max Mustermann', changeType: 'added' }, { field: 'email', oldValue: null, newValue: 'max@example.com', changeType: 'added' }], status: 'success' },
      { id: 'audit-2', action: 'update', entityType: 'member', entityId: 'member-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(25), changes: [{ field: 'status', oldValue: 'trial', newValue: 'active', changeType: 'modified' }], status: 'success' },
      { id: 'audit-3', action: 'create', entityType: 'trial_training', entityId: 'trial-1', userId: 'user-2', userName: 'Max Mustermann', userEmail: 'max@example.com', userRole: 'member', timestamp: m(20), status: 'success' },
      { id: 'audit-4', action: 'approve', entityType: 'hours_log', entityId: 'hours-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(15), status: 'success' },
      { id: 'audit-5', action: 'login', entityType: 'user', entityId: 'user-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(10), ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0', status: 'success' },
      { id: 'audit-6', action: 'export', entityType: 'report', entityId: 'report-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(5), metadata: { format: 'pdf', period: 'monthly' }, status: 'success' },
      { id: 'audit-7', action: 'create', entityType: 'booking', entityId: 'booking-1', userId: 'user-2', userName: 'Max Mustermann', userEmail: 'max@example.com', userRole: 'member', timestamp: m(2), status: 'success' },
      { id: 'audit-8', action: 'sign', entityType: 'sepa_mandate', entityId: 'sepa-1', userId: 'user-2', userName: 'Max Mustermann', userEmail: 'max@example.com', userRole: 'member', timestamp: m(1), status: 'success' },
      // --- Trainer actions ---
      { id: 'audit-9', action: 'create', entityType: 'absence', entityId: 'absence-3', userId: 'user-3', userName: 'Michael Bauer', userEmail: 'michael.bauer@swingz.app', userRole: 'trainer', timestamp: m(1440), changes: [{ field: 'type', oldValue: null, newValue: 'vacation', changeType: 'added' }], status: 'success' },
      { id: 'audit-10', action: 'create', entityType: 'trainer_availability', entityId: 'avail-1', userId: 'user-3', userName: 'Michael Bauer', userEmail: 'michael.bauer@swingz.app', userRole: 'trainer', timestamp: m(1500), status: 'success' },
      { id: 'audit-11', action: 'update', entityType: 'trainer_profile', entityId: 'trainer-3', userId: 'user-3', userName: 'Michael Bauer', userEmail: 'michael.bauer@swingz.app', userRole: 'trainer', timestamp: m(2880), changes: [{ field: 'bio', oldValue: '...', newValue: 'Ehemaliger Profi mit internationaler Erfahrung...', changeType: 'modified' }], status: 'success' },
      { id: 'audit-12', action: 'login', entityType: 'user', entityId: 'user-2', userId: 'user-2', userName: 'Julia Weber', userEmail: 'julia.weber@swingz.app', userRole: 'trainer', timestamp: m(120), ipAddress: '10.0.0.55', userAgent: 'Chrome/120.0', status: 'success' },
      // --- Admin management ---
      { id: 'audit-13', action: 'approve', entityType: 'absence', entityId: 'absence-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(3000), status: 'success' },
      { id: 'audit-14', action: 'approve', entityType: 'absence', entityId: 'absence-2', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(2800), status: 'success' },
      { id: 'audit-15', action: 'update', entityType: 'trainer_profile', entityId: 'trainer-7', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(64800), changes: [{ field: 'status', oldValue: 'active', newValue: 'inactive', changeType: 'modified' }], status: 'success' },
      { id: 'audit-16', action: 'create', entityType: 'training_group', entityId: 'group-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(7200), changes: [{ field: 'name', oldValue: null, newValue: 'Anfänger Gruppe A', changeType: 'added' }], status: 'success' },
      { id: 'audit-17', action: 'delete', entityType: 'training_group', entityId: 'group-old', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(10000), status: 'success' },
      // --- Failed / partial actions ---
      { id: 'audit-18', action: 'login', entityType: 'user', entityId: 'user-unknown', userId: '', userName: '', userEmail: 'hacker@example.com', userRole: 'guest', timestamp: m(45), ipAddress: '45.33.32.156', userAgent: 'curl/7.68', status: 'failed', errorMessage: 'Invalid credentials' },
      { id: 'audit-19', action: 'create', entityType: 'booking', entityId: '', userId: 'user-5', userName: 'Ahmed Al-Rashid', userEmail: 'ahmed.alrashid@swingz.app', userRole: 'trainer', timestamp: m(300), status: 'failed', errorMessage: 'Court already booked for this time slot' },
      { id: 'audit-20', action: 'export', entityType: 'report', entityId: 'report-2', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(4320), metadata: { format: 'csv', period: 'yearly' }, status: 'partial', errorMessage: 'Some records omitted due to data inconsistency' },
      // --- Older entries for historical view ---
      { id: 'audit-21', action: 'create', entityType: 'member', entityId: 'member-5', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(20160), changes: [{ field: 'name', oldValue: null, newValue: 'Lena Fischer', changeType: 'added' }], status: 'success' },
      { id: 'audit-22', action: 'update', entityType: 'fee_configuration', entityId: 'fee-1', userId: 'user-1', userName: 'Admin User', userEmail: 'admin@swingz.de', userRole: 'admin', timestamp: m(23000), changes: [{ field: 'hourly_rate', oldValue: '40', newValue: '45', changeType: 'modified' }], status: 'success' },
    ];

    mockLogs.forEach((log) => this.auditLogs.set(log.id, log));
  }
}
