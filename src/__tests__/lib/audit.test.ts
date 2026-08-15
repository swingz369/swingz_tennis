/**
 * Regression-Test für den zentralen Audit-Schreibpfad (lib/audit.ts).
 *
 * Hintergrund (Live-Probe 15.08.2026): `audit_logs` hatte 0 Zeilen, obwohl
 * ~15 Routen schrieben. Ursachen: Inserts über den RLS-User-Client (keine
 * INSERT-Policy), erfundene Spalten (`user_id`, `table_name`, `record_id`,
 * `performed_by`) und NOT-NULL-Verstöße (`resource_id` uuid, `actor_id` FK).
 * Dieser Test hält die Zeilenform gegen die echten Tabellenspalten fest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => ({ insert }) }),
}));

import { logAudit } from '@/lib/audit';

const ACTOR = '2ffa8277-9950-4132-a256-5f6a7194d45c';
const CLUB = '70bdc65f-d5f9-45ba-adeb-aeca46ebe30e';
const RESOURCE = 'a1b2c3d4-1111-2222-3333-444455556666';

/** Spalten, die die Tabelle wirklich hat. */
const COLUMNS = [
  'actor_id',
  'action',
  'resource_type',
  'resource_id',
  'club_id',
  'details',
  'ip_address',
  'user_agent',
];

const req = (h: Record<string, string>) => ({ headers: { get: (k: string) => h[k] ?? null } });

describe('logAudit', () => {
  beforeEach(() => insert.mockClear());

  it('schreibt genau die existierenden Spalten', async () => {
    await logAudit({
      actorId: ACTOR,
      action: 'member_deactivated',
      resourceType: 'membership',
      resourceId: RESOURCE,
      clubId: CLUB,
      details: { role: 'member' },
      request: req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'vitest' }),
    });

    const [rows] = insert.mock.calls[0];
    expect(Object.keys(rows[0]).sort()).toEqual([...COLUMNS].sort());
    expect(rows[0]).toMatchObject({
      actor_id: ACTOR,
      action: 'member_deactivated',
      resource_type: 'membership',
      resource_id: RESOURCE,
      club_id: CLUB,
      ip_address: '203.0.113.9',
      user_agent: 'vitest',
    });
  });

  it('fällt bei Nicht-UUID-resource_id auf die club_id zurück (Spalte ist uuid NOT NULL)', async () => {
    await logAudit({
      actorId: ACTOR,
      action: 'PII_READ',
      resourceType: 'member',
      resourceId: 'list:all',
      clubId: CLUB,
    });

    const [rows] = insert.mock.calls[0];
    expect(rows[0].resource_id).toBe(CLUB);
    expect(rows[0].details).toMatchObject({ resource_ref: 'list:all' });
  });

  it('verwirft Einträge ohne verwertbaren Akteur oder Anker statt sie zu schreiben', async () => {
    await logAudit({
      actorId: 'system',
      action: 'create',
      resourceType: 'booking',
      resourceId: RESOURCE,
    });
    await logAudit({ actorId: ACTOR, action: 'create', resourceType: 'booking', resourceId: null });
    expect(insert).not.toHaveBeenCalled();
  });

  it('kippt die auslösende Aktion nicht, wenn der Insert fehlschlägt', async () => {
    insert.mockRejectedValueOnce(new Error('boom'));
    await expect(
      logAudit({ actorId: ACTOR, action: 'update', resourceType: 'club', resourceId: CLUB })
    ).resolves.toBeUndefined();
  });
});
