/**
 * Audit Service Interface
 * Domain layer interface for audit logging functionality
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'payment'
  | 'refund';

export type AuditEntityType =
  | 'member'
  | 'booking'
  | 'schedule'
  | 'court'
  | 'invoice'
  | 'payment'
  | 'sepa_mandate'
  | 'trainer'
  | 'absence'
  | 'trial_training'
  | 'club';

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  userId?: string;
  action?: AuditAction[];
  entityType?: AuditEntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Audit Service Interface
 * All audit logging must be done through this interface
 */
export interface IAuditService {
  /**
   * Log an audit entry
   */
  log(entry: AuditLogEntry): Promise<void>;

  /**
   * Query audit logs
   */
  query(query: AuditLogQuery): Promise<AuditLogResult[]>;

  /**
   * Get audit logs for a specific entity
   */
  getEntityAuditTrail(entityType: AuditEntityType, entityId: string): Promise<AuditLogResult[]>;

  /**
   * Get audit logs for a specific user
   */
  getUserAuditTrail(userId: string, limit?: number): Promise<AuditLogResult[]>;
}
