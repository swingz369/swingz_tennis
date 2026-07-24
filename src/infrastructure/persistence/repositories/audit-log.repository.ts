import { createServiceClient } from '@/lib/supabase/service';
import type { AuditLogRepository } from '@/domain/repositories/audit-log-repository.interface';
import { AuditLog } from '@/domain/entities/audit-log';
import { Id } from '@/domain/value-objects/ids';

type AuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  club_id: string | null;
};

// Uses Supabase REST (service client) instead of the Drizzle direct connection —
// direct postgres-js connections fail from this dev environment (see CLAUDE.md),
// which silently swallowed every audit-log write via the caller's try/catch.
export class DrizzleAuditLogRepository implements AuditLogRepository {
  async save(log: AuditLog): Promise<void> {
    const sb = createServiceClient();
    const clubId = log.getClubId();
    const values = {
      id: log.getId().getValue(),
      actor_id: log.getActorId().getValue(),
      action: log.getAction(),
      resource_type: log.getResourceType(),
      resource_id: log.getResourceId().getValue(),
      details: log.getDetails(),
      created_at: log.getCreatedAt().toISOString(),
      ...(log.getIpAddress() !== undefined ? { ip_address: log.getIpAddress() } : {}),
      ...(log.getUserAgent() !== undefined ? { user_agent: log.getUserAgent() } : {}),
      ...(clubId !== undefined ? { club_id: clubId.getValue() } : {}),
    };
    await sb.from('audit_logs').upsert(values, { onConflict: 'id' });
  }

  async findByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    const sb = createServiceClient();
    const { data } = await sb
      .from('audit_logs')
      .select('*')
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return ((data as AuditLogRow[]) ?? []).map(this.mapToDomain);
  }

  async findByResource(resourceType: string, resourceId: string, limit = 100): Promise<AuditLog[]> {
    const sb = createServiceClient();
    const { data } = await sb
      .from('audit_logs')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return ((data as AuditLogRow[]) ?? []).map(this.mapToDomain);
  }

  async findByAction(action: string, limit = 100): Promise<AuditLog[]> {
    const sb = createServiceClient();
    const { data } = await sb
      .from('audit_logs')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit);
    return ((data as AuditLogRow[]) ?? []).map(this.mapToDomain);
  }

  async findByDateRange(startDate: Date, endDate: Date, limit = 100): Promise<AuditLog[]> {
    const sb = createServiceClient();
    const { data } = await sb
      .from('audit_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    return ((data as AuditLogRow[]) ?? []).map(this.mapToDomain);
  }

  async findAll(limit = 100, offset = 0): Promise<AuditLog[]> {
    const sb = createServiceClient();
    const { data } = await sb
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return ((data as AuditLogRow[]) ?? []).map(this.mapToDomain);
  }

  async count(): Promise<number> {
    const sb = createServiceClient();
    const { count } = await sb.from('audit_logs').select('id', { count: 'exact', head: true });
    return count ?? 0;
  }

  private mapToDomain(row: AuditLogRow): AuditLog {
    return AuditLog.reconstitute(
      Id.fromString(row.id),
      Id.fromString(row.actor_id),
      row.action as AuditLog['action'],
      row.resource_type as AuditLog['resourceType'],
      Id.fromString(row.resource_id),
      (row.details as Record<string, unknown>) ?? {},
      new Date(row.created_at),
      row.ip_address ?? undefined,
      row.user_agent ?? undefined,
      row.club_id ? Id.fromString(row.club_id) : undefined
    );
  }
}
