/**
 * Unit tests for AttendanceRecordRepository.getHoursSummaryForClub —
 * Regression für einen echten Datenleck-Fund (13.09.2026).
 *
 * Die alte Drizzle-Implementierung ignorierte den `clubId`-Parameter
 * komplett (er hieß `_clubId`) und aggregierte über ALLE Vereine — jeder
 * Admin, der `?clubId=irgendwas` an /api/attendance-records/hours-summary
 * schickte, bekam Anwesenheitsdaten sämtlicher Mitglieder aller Vereine.
 * Diese Tests bauen den vollständigen Mock-Client (schedules → sessions →
 * attendance_records) nach, um die tatsächliche Scoping-Logik zu prüfen,
 * nicht nur eine gemockte Service-Methode.
 */
import { describe, it, expect } from 'vitest';
import { AttendanceRecordRepository } from '@/infrastructure/persistence/repositories/attendance-record.repository';

type Row = Record<string, unknown>;

/**
 * Minimaler Supabase-Client-Stub, der `.from(table).select().eq(...).in(...)`
 * routet und die passende Fixture-Tabelle zurückgibt.
 */
function makeDbStub(tables: Record<string, Row[]>) {
  function builder(table: string, filters: Array<[string, unknown]> = []) {
    const rows = tables[table] ?? [];
    const applyFilters = (data: Row[]) =>
      filters.reduce((acc, [col, val]) => {
        if (Array.isArray(val)) return acc.filter((r) => val.includes(r[col]));
        return acc.filter((r) => r[col] === val);
      }, data);

    const chain: any = {
      select: () => chain,
      eq: (col: string, val: unknown) => builder(table, [...filters, [col, val]]),
      in: (col: string, val: unknown[]) => builder(table, [...filters, [col, val]]),
      then: (resolve: (v: { data: Row[]; error: null }) => void) =>
        resolve({ data: applyFilters(rows), error: null }),
    };
    return chain;
  }

  return { from: (table: string) => builder(table) } as any;
}

describe('AttendanceRecordRepository.getHoursSummaryForClub', () => {
  it('schließt Mitglieder eines anderen Vereins aus (Datenleck-Regression)', async () => {
    const db = makeDbStub({
      schedules: [
        { id: 'schedule-club-1', club_id: 'club-1' },
        { id: 'schedule-club-2', club_id: 'club-2' },
      ],
      sessions: [
        { id: 'session-club-1', schedule_id: 'schedule-club-1' },
        { id: 'session-club-2', schedule_id: 'schedule-club-2' },
      ],
      attendance_records: [
        {
          session_id: 'session-club-1',
          participant_id: 'member-club-1',
          status: 'present',
          trainer_confirmed: true,
          member_status: 'confirmed',
          duration_minutes: 60,
        },
        {
          session_id: 'session-club-2',
          participant_id: 'member-club-2',
          status: 'present',
          trainer_confirmed: true,
          member_status: 'confirmed',
          duration_minutes: 90,
        },
      ],
    });
    const repo = new AttendanceRecordRepository(db);

    const summaries = await repo.getHoursSummaryForClub('club-1');

    expect(summaries).toHaveLength(1);
    expect(summaries[0].memberId).toBe('member-club-1');
    expect(summaries.find((s) => s.memberId === 'member-club-2')).toBeUndefined();
  });

  it('gibt ein leeres Array zurück, wenn der Verein keine Zeitpläne hat', async () => {
    const db = makeDbStub({ schedules: [], sessions: [], attendance_records: [] });
    const repo = new AttendanceRecordRepository(db);

    const summaries = await repo.getHoursSummaryForClub('club-ohne-zeitplaene');

    expect(summaries).toEqual([]);
  });

  it('aggregiert korrekt über mehrere Einträge desselben Mitglieds', async () => {
    const db = makeDbStub({
      schedules: [{ id: 'schedule-1', club_id: 'club-1' }],
      sessions: [
        { id: 'session-a', schedule_id: 'schedule-1' },
        { id: 'session-b', schedule_id: 'schedule-1' },
      ],
      attendance_records: [
        {
          session_id: 'session-a',
          participant_id: 'member-1',
          status: 'present',
          trainer_confirmed: true,
          member_status: 'confirmed',
          duration_minutes: 60,
        },
        {
          session_id: 'session-b',
          participant_id: 'member-1',
          status: 'absent',
          trainer_confirmed: false,
          member_status: 'pending',
          duration_minutes: 60,
        },
      ],
    });
    const repo = new AttendanceRecordRepository(db);

    const summaries = await repo.getHoursSummaryForClub('club-1');

    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalSessions).toBe(2);
    expect(summaries[0].attendedSessions).toBe(1);
    expect(summaries[0].missedSessions).toBe(1);
    expect(summaries[0].attendanceRate).toBe(50);
  });
});
