/**
 * Trainer-Teildomäne "Stundenerfassung" für ADR-005. Ein Repository, kein
 * Adapter, keine Interfaces — Muster in docs/ARCHIV/2026-09-13-architektur-
 * analyse-datenzugriff.md § 6. RLS-Policy-Korrektur: supabase/migrations/
 * 20260913180000_hours_logs_admin_access.sql (admin, nicht nur superadmin).
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:hours-log.repository');

export type HoursLog = Tables<'hours_logs'>;
export type HoursLogType = 'training' | 'preparation' | 'meeting' | 'other';
export type HoursLogStatus = 'pending' | 'approved' | 'rejected';

export type HoursSummary = {
  trainerId: string;
  trainerName: string;
  totalHours: number;
  trainingHours: number;
  preparationHours: number;
  meetingHours: number;
  otherHours: number;
  pendingHours: number;
  approvedHours: number;
  rejectedHours: number;
};

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

export class HoursLogRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: Omit<TablesInsert<'hours_logs'>, 'duration' | 'status'>): Promise<HoursLog> {
    const duration = calculateDuration(input.start_time, input.end_time);
    const { data, error } = await this.db
      .from('hours_logs')
      .insert({ ...input, duration, status: 'pending' })
      .select()
      .single();
    assertNoError(error, 'Anlegen des Stundennachweises fehlgeschlagen');
    return data!;
  }

  async findById(id: string): Promise<HoursLog | null> {
    const { data, error } = await this.db.from('hours_logs').select().eq('id', id).maybeSingle();
    assertNoError(error, 'Lesen des Stundennachweises fehlgeschlagen');
    return data;
  }

  async findByTrainerId(trainerId: string): Promise<HoursLog[]> {
    const { data, error } = await this.db
      .from('hours_logs')
      .select()
      .eq('trainer_id', trainerId)
      .order('date', { ascending: false });
    assertNoError(error, 'Lesen der Stundennachweise fehlgeschlagen');
    return data ?? [];
  }

  /** Nur für vereinsübergreifende Aggregation (StatisticsService, systemDb). */
  async findAll(): Promise<HoursLog[]> {
    const { data, error } = await this.db
      .from('hours_logs')
      .select()
      .order('date', { ascending: false });
    assertNoError(error, 'Lesen der Stundennachweise fehlgeschlagen');
    return data ?? [];
  }

  async update(id: string, input: TablesUpdate<'hours_logs'>): Promise<HoursLog | null> {
    const update = { ...input };
    if (update.start_time || update.end_time) {
      const existing = await this.findById(id);
      if (existing) {
        const startTime = update.start_time ?? existing.start_time;
        const endTime = update.end_time ?? existing.end_time;
        update.duration = calculateDuration(startTime, endTime);
      }
    }
    const { data, error } = await this.db
      .from('hours_logs')
      .update(update)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren des Stundennachweises fehlgeschlagen');
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db.from('hours_logs').delete().eq('id', id).select('id');
    assertNoError(error, 'Löschen des Stundennachweises fehlgeschlagen');
    return (data ?? []).length > 0;
  }

  async getSummaryForTrainer(trainerId: string): Promise<HoursSummary> {
    const logs = await this.findByTrainerId(trainerId);
    const sum = (pred: (l: HoursLog) => boolean) =>
      logs.filter(pred).reduce((total, l) => total + l.duration, 0);

    return {
      trainerId,
      trainerName: logs.length > 0 ? logs[0].trainer_name : 'Unknown',
      totalHours: sum(() => true) / 60,
      trainingHours: sum((l) => l.type === 'training') / 60,
      preparationHours: sum((l) => l.type === 'preparation') / 60,
      meetingHours: sum((l) => l.type === 'meeting') / 60,
      otherHours: sum((l) => l.type === 'other') / 60,
      pendingHours: sum((l) => l.status === 'pending') / 60,
      approvedHours: sum((l) => l.status === 'approved') / 60,
      rejectedHours: sum((l) => l.status === 'rejected') / 60,
    };
  }
}
