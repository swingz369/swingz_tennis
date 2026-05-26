import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../schema';
import type { AuditLogRepository } from '@/domain/repositories/audit-log-repository.interface';
import { AuditLog } from '@/domain/entities/audit-log';
import { Id } from '@/domain/value-objects/ids';

export class DrizzleAuditLogRepository implements AuditLogRepository {
  async save(log: AuditLog): Promise<void> {
    const baseValues = {
      id: log.getId().getValue(),
      actor_id: log.getActorId().getValue(),
      action: log.getAction(),
      resource_type: log.getResourceType(),
      resource_id: log.getResourceId().getValue(),
      details: log.getDetails(),
      created_at: log.getCreatedAt(),
    };

    const ipAddress = log.getIpAddress();
    const userAgent = log.getUserAgent();

    const values =
      ipAddress !== undefined || userAgent !== undefined
        ? {
            ...baseValues,
            ...(ipAddress !== undefined ? { ip_address: ipAddress } : {}),
            ...(userAgent !== undefined ? { user_agent: userAgent } : {}),
          }
        : baseValues;

    const existing = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, log.getId().getValue()))
      .limit(1);
    if (existing.length > 0) {
      await db.update(auditLogs).set(values).where(eq(auditLogs.id, log.getId().getValue()));
    } else {
      await db.insert(auditLogs).values(values);
    }
  }

  async findByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actor_id, actorId))
      .orderBy(desc(auditLogs.created_at))
      .limit(limit);
    return rows.map(this.mapToDomain);
  }

  async findByResource(resourceType: string, resourceId: string, limit = 100): Promise<AuditLog[]> {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resource_type, resourceType), eq(auditLogs.resource_id, resourceId)))
      .orderBy(desc(auditLogs.created_at))
      .limit(limit);
    return rows.map(this.mapToDomain);
  }

  async findByAction(action: string, limit = 100): Promise<AuditLog[]> {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, action))
      .orderBy(desc(auditLogs.created_at))
      .limit(limit);
    return rows.map(this.mapToDomain);
  }

  async findByDateRange(startDate: Date, endDate: Date, limit = 100): Promise<AuditLog[]> {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(gte(auditLogs.created_at, startDate), lte(auditLogs.created_at, endDate)))
      .orderBy(desc(auditLogs.created_at))
      .limit(limit);
    return rows.map(this.mapToDomain);
  }

  async findAll(limit = 100, offset = 0): Promise<AuditLog[]> {
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.created_at))
      .limit(limit)
      .offset(offset);
    return rows.map(this.mapToDomain);
  }

  async count(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
    return Number(result[0]?.count) || 0;
  }

  private mapToDomain(row: typeof auditLogs.$inferSelect): AuditLog {
    return AuditLog.reconstitute(
      Id.fromString(row.id),
      Id.fromString(row.actor_id),
      row.action as AuditLog['action'],
      row.resource_type as AuditLog['resourceType'],
      Id.fromString(row.resource_id),
      row.details as Record<string, unknown>,
      new Date(row.created_at),
      row.ip_address ?? undefined,
      row.user_agent ?? undefined
    );
  }
}
