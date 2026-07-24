export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  changes?: AuditChange[];
  metadata?: Record<string, any>;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'read'
  | 'login'
  | 'logout'
  | 'approve'
  | 'reject'
  | 'export'
  | 'import'
  | 'send'
  | 'sign'
  | 'convert'
  | 'cancel'
  | 'reschedule'
  | 'book'
  | 'unbook'
  | 'pay'
  | 'refund'
  | 'upload'
  | 'download'
  | 'configure'
  | 'reset';

export type EntityType =
  | 'member'
  | 'trainer'
  | 'court'
  | 'booking'
  | 'trial_training'
  | 'training_session'
  | 'hours_log'
  | 'absence'
  | 'billing'
  | 'invoice'
  | 'payment'
  | 'sepa_mandate'
  | 'fee_configuration'
  | 'payment_settings'
  | 'system_settings'
  | 'email'
  | 'notification'
  | 'report'
  | 'user'
  | 'role'
  | 'permission'
  | 'membership'
  | 'trainer_availability'
  | 'trainer_profile'
  | 'training_group'
  | 'session';

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'added' | 'modified' | 'removed';
}

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
  action?: AuditAction[];
  entityType?: EntityType[];
  userId?: string[];
  userRole?: string[];
  status?: ('success' | 'failed' | 'partial')[];
  entityId?: string;
  searchTerm?: string;
}

export interface AuditLogSummary {
  totalLogs: number;
  logsByAction: Record<AuditAction, number>;
  logsByEntityType: Record<EntityType, number>;
  logsByUser: Record<string, number>;
  logsByStatus: Record<'success' | 'failed' | 'partial', number>;
  recentActivity: AuditLog[];
  topUsers: Array<{
    userId: string;
    userName: string;
    actionCount: number;
  }>;
}
