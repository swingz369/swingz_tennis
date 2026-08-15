import type { IAuditService, AuditLogEntry } from '@/domain/services';
import { logAudit } from '@/lib/audit';

/**
 * IAuditService über den zentralen Schreibpfad `logAudit()` (lib/audit.ts).
 *
 * Vorher lag hier eine eigene Entity-/Repository-Kette mit zwei parallelen
 * Action-Enums und einer Übersetzung, die jedes `create` als
 * `booking_created` und jedes `delete` als `club_deleted` schrieb —
 * unabhängig vom entityType. Es gibt jetzt genau eine Schreibform:
 * action = das übergebene Verb, resource_type = entityType.
 */
export class AuditServiceImpl implements IAuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    await logAudit({
      actorId: entry.userId,
      action: entry.action,
      resourceType: entry.entityType,
      resourceId: entry.entityId,
      clubId: entry.clubId ?? null,
      details: { ...(entry.details ?? {}), ...(entry.metadata ?? {}) },
    });
  }
}
