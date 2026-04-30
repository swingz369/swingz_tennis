import type { AuditLog } from '../entities/audit-log';

export interface AuditLogRepository {
  save(log: AuditLog): Promise<void>;
  findByActor(actorId: string, limit?: number): Promise<AuditLog[]>;
  findByResource(resourceType: string, resourceId: string, limit?: number): Promise<AuditLog[]>;
  findByAction(action: string, limit?: number): Promise<AuditLog[]>;
  findByDateRange(startDate: Date, endDate: Date, limit?: number): Promise<AuditLog[]>;
  findAll(limit?: number, offset?: number): Promise<AuditLog[]>;
  count(): Promise<number>;
}
