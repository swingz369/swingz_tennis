/**
 * Audit Service Interface
 * Domain layer interface for audit logging functionality
 *
 * Geschrieben wird ausschließlich über `lib/audit.ts` → Tabelle `audit_logs`.
 * Gelesen wird über die API-Routen (/api/audit-logs, /api/admin/audit-logs,
 * /api/owner/audit-logs) direkt per Supabase — dafür braucht es hier keine
 * Query-Methoden (die frühere `query`/`getEntityAuditTrail`/`getUserAuditTrail`
 * hatte nie einen Aufrufer und war durch ein `this`-Binding in `.map()` ohnehin
 * defekt).
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
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
  /** auth-User-ID; muss in `users` existieren (FK auf audit_logs.actor_id). */
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  clubId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Service Interface
 * All audit logging must be done through this interface
 */
export interface IAuditService {
  log(entry: AuditLogEntry): Promise<void>;
}
