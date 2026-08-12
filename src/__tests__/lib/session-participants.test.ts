import { describe, it, expect } from 'vitest';
import { getSessionParticipants } from '@/lib/session-participants';

/**
 * Die Teilnehmerliste einer Einheit wird aus den Buchungen abgeleitet — nicht aus
 * `session_rsvps`. Genau diese Verwechslung führte dazu, dass die Traineransicht
 * „0 zugesagt" für eine Gruppe mit sechs zugeteilten Mitgliedern zeigte.
 */

type Rows = Record<string, unknown[]>;

/** Minimaler Supabase-Ersatz: liefert je Tabelle eine feste Zeilenmenge. */
function fakeClient(rows: Rows) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: rows[table] ?? [], error: null }),
        in: async () => ({ data: rows[table] ?? [], error: null }),
      }),
    }),
  };
}

const users = [
  { id: 'u1', full_name: 'Andrea Vogelsang' },
  { id: 'u2', full_name: 'Werner Alt' },
];

describe('getSessionParticipants', () => {
  it('zählt eingeteilte Mitglieder ohne RSVP als zugesagt', async () => {
    const client = fakeClient({
      bookings: [{ id: 'b1', member_id: 'u1', status: 'confirmed' }],
      session_rsvps: [],
      users,
    });

    const result = await getSessionParticipants(client, 's1');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('accepted');
    expect(result[0].user.fullName).toBe('Andrea Vogelsang');
  });

  it('wertet eine stornierte Buchung als Absage', async () => {
    const client = fakeClient({
      bookings: [{ id: 'b1', member_id: 'u1', status: 'cancelled' }],
      session_rsvps: [],
      users,
    });

    const result = await getSessionParticipants(client, 's1');

    expect(result[0].status).toBe('declined');
  });

  it('lässt eine ausdrückliche RSVP die Buchung überschreiben', async () => {
    const client = fakeClient({
      bookings: [{ id: 'b1', member_id: 'u1', status: 'confirmed' }],
      session_rsvps: [
        { id: 'r1', member_id: 'u1', status: 'declined', responded_at: '2026-08-13T10:00:00Z' },
      ],
      users,
    });

    const result = await getSessionParticipants(client, 's1');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('declined');
    expect(result[0].respondedAt).toBe('2026-08-13T10:00:00Z');
  });

  it('nimmt auch Mitglieder auf, die nur eine RSVP und keine Buchung haben', async () => {
    const client = fakeClient({
      bookings: [{ id: 'b1', member_id: 'u1', status: 'confirmed' }],
      session_rsvps: [{ id: 'r2', member_id: 'u2', status: 'maybe', responded_at: null }],
      users,
    });

    const result = await getSessionParticipants(client, 's1');

    expect(result.map((r) => r.memberId).sort()).toEqual(['u1', 'u2']);
    expect(result.find((r) => r.memberId === 'u2')?.status).toBe('maybe');
  });

  it('fällt auf "Mitglied" zurück, wenn kein Name sichtbar ist', async () => {
    const client = fakeClient({
      bookings: [{ id: 'b1', member_id: 'u9', status: 'confirmed' }],
      session_rsvps: [],
      users: [],
    });

    const result = await getSessionParticipants(client, 's1');

    expect(result[0].user.fullName).toBe('Mitglied');
  });
});
