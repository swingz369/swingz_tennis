/**
 * Trainer-Teildomäne "Anwesenheit" für ADR-005. Ein Repository, kein
 * Adapter, keine Interfaces. RLS-Policy-Korrektur: supabase/migrations/
 * 20260913190000_attendance_records_admin_access.sql (admin, nicht nur
 * superadmin).
 *
 * `getHoursSummaryForClub` filterte in der alten Drizzle-Implementierung
 * NICHT nach club_id (der Parameter hieß `_clubId` — ungenutzt!) und
 * aggregierte über ALLE Vereine hinweg. Jeder Admin, der
 * `?clubId=irgendwas` an /api/attendance-records/hours-summary schickte,
 * bekam Anwesenheitsdaten sämtlicher Mitglieder aller Vereine zurück — ein
 * echtes, sofort ausnutzbares Datenleck. attendance_records hat keine
 * eigene club_id-Spalte; die Zuordnung läuft über
 * session_id → sessions.schedule_id → schedules.club_id. Diese
 * Implementierung löst das Join explizit auf, bevor aggregiert wird.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:attendance-record.repository');

export type AttendanceRecord = Tables<'attendance_records'>;

export type AttendanceHoursSummary = {
  memberId: string;
  memberName: string;
  totalSessions: number;
  attendedSessions: number;
  missedSessions: number;
  excusedSessions: number;
  lateSessions: number;
  trainerConfirmedCount: number;
  memberConfirmedCount: number;
  disputedCount: number;
  pendingConfirmationCount: number;
  totalAttendedMinutes: number;
  totalScheduledMinutes: number;
  attendanceRate: number;
};

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

function summarize(memberId: string, records: AttendanceRecord[]): AttendanceHoursSummary {
  const count = (pred: (r: AttendanceRecord) => boolean) => records.filter(pred).length;
  const sumMinutes = (pred: (r: AttendanceRecord) => boolean) =>
    records.filter(pred).reduce((total, r) => total + (r.duration_minutes ?? 0), 0);

  const totalSessions = records.length;
  const attendedSessions = count((r) => r.status === 'present');
  const lateSessions = count((r) => r.status === 'late');

  return {
    memberId,
    memberName: '',
    totalSessions,
    attendedSessions,
    missedSessions: count((r) => r.status === 'absent'),
    excusedSessions: count((r) => r.status === 'excused'),
    lateSessions,
    trainerConfirmedCount: count((r) => r.trainer_confirmed === true),
    memberConfirmedCount: count((r) => r.member_status === 'confirmed'),
    disputedCount: count((r) => r.member_status === 'disputed'),
    pendingConfirmationCount: count((r) => r.member_status === 'pending'),
    totalAttendedMinutes: sumMinutes((r) => r.status === 'present' || r.status === 'late'),
    totalScheduledMinutes: records.reduce((total, r) => total + (r.duration_minutes ?? 0), 0),
    attendanceRate:
      totalSessions > 0
        ? Math.round(((attendedSessions + lateSessions) * 1000) / totalSessions) / 10
        : 0,
  };
}

export class AttendanceRecordRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: TablesInsert<'attendance_records'>): Promise<AttendanceRecord> {
    const { data, error } = await this.db
      .from('attendance_records')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Anlegen des Anwesenheitseintrags fehlgeschlagen');
    return data!;
  }

  async findById(id: string): Promise<AttendanceRecord | null> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select()
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen des Anwesenheitseintrags fehlgeschlagen');
    return data;
  }

  async findBySessionId(sessionId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select()
      .eq('session_id', sessionId)
      .order('date', { ascending: false });
    assertNoError(error, 'Lesen der Anwesenheitseinträge fehlgeschlagen');
    return data ?? [];
  }

  async findByTrainerId(trainerId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select()
      .eq('trainer_id', trainerId)
      .order('date', { ascending: false });
    assertNoError(error, 'Lesen der Anwesenheitseinträge fehlgeschlagen');
    return data ?? [];
  }

  async update(
    id: string,
    input: TablesUpdate<'attendance_records'>
  ): Promise<AttendanceRecord | null> {
    const { data, error } = await this.db
      .from('attendance_records')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren des Anwesenheitseintrags fehlgeschlagen');
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('attendance_records')
      .delete()
      .eq('id', id)
      .select('id');
    assertNoError(error, 'Löschen des Anwesenheitseintrags fehlgeschlagen');
    return (data ?? []).length > 0;
  }

  async batchConfirmByTrainer(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('attendance_records')
      .update({ trainer_confirmed: true, trainer_confirmed_at: now })
      .in('id', ids)
      .select('id');
    assertNoError(error, 'Sammel-Bestätigung fehlgeschlagen');
    return (data ?? []).length;
  }

  async memberConfirm(id: string, participantId: string): Promise<AttendanceRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('attendance_records')
      .update({ member_status: 'confirmed', member_confirmed_at: now })
      .eq('id', id)
      .eq('participant_id', participantId)
      .select()
      .maybeSingle();
    assertNoError(error, 'Bestätigen der Anwesenheit fehlgeschlagen');
    return data;
  }

  async memberDispute(
    id: string,
    participantId: string,
    reason: string
  ): Promise<AttendanceRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('attendance_records')
      .update({ member_status: 'disputed', member_confirmed_at: now, dispute_reason: reason })
      .eq('id', id)
      .eq('participant_id', participantId)
      .select()
      .maybeSingle();
    assertNoError(error, 'Einspruch gegen die Anwesenheit fehlgeschlagen');
    return data;
  }

  async resolveDispute(
    id: string,
    resolvedBy: string,
    resolution: 'confirmed' | 'absent'
  ): Promise<AttendanceRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('attendance_records')
      .update({
        member_status: resolution === 'confirmed' ? 'confirmed' : 'pending',
        dispute_resolved_at: now,
        dispute_resolved_by: resolvedBy,
        ...(resolution === 'absent' && { status: 'absent' }),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Klären des Einspruchs fehlgeschlagen');
    return data;
  }

  async getHoursSummaryForMember(memberId: string): Promise<AttendanceHoursSummary | null> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select()
      .eq('participant_id', memberId);
    assertNoError(error, 'Lesen der Anwesenheitsübersicht fehlgeschlagen');
    if (!data || data.length === 0) return null;
    return summarize(memberId, data);
  }

  /**
   * Vereinsweite Übersicht, EIN Eintrag pro Mitglied. Scoped über
   * session_id → sessions.schedule_id → schedules.club_id, da
   * attendance_records keine eigene club_id-Spalte hat.
   */
  async getHoursSummaryForClub(clubId: string): Promise<AttendanceHoursSummary[]> {
    const { data: schedules, error: scheduleError } = await this.db
      .from('schedules')
      .select('id')
      .eq('club_id', clubId);
    assertNoError(scheduleError, 'Lesen der Vereins-Zeitpläne fehlgeschlagen');
    const scheduleIds = (schedules ?? []).map((s) => s.id);
    if (scheduleIds.length === 0) return [];

    const { data: sessions, error: sessionError } = await this.db
      .from('sessions')
      .select('id')
      .in('schedule_id', scheduleIds);
    assertNoError(sessionError, 'Lesen der Vereins-Termine fehlgeschlagen');
    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const { data: records, error } = await this.db
      .from('attendance_records')
      .select()
      .in('session_id', sessionIds);
    assertNoError(error, 'Lesen der Anwesenheitsübersicht fehlgeschlagen');

    const byMember = new Map<string, AttendanceRecord[]>();
    for (const r of records ?? []) {
      const group = byMember.get(r.participant_id) ?? [];
      group.push(r);
      byMember.set(r.participant_id, group);
    }
    return [...byMember.entries()].map(([memberId, group]) => summarize(memberId, group));
  }
}
