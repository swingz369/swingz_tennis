/**
 * Fünfte migrierte Domäne für ADR-005 (Trainer-Teildomäne: Abwesenheiten).
 * Ein Repository, kein Adapter, keine Interfaces — Muster in docs/ARCHIV/
 * 2026-09-13-architektur-analyse-datenzugriff.md § 6.
 *
 * `user_id` wird nicht gesetzt: der Trigger `set_trainer_absence_user_id`
 * (SECURITY DEFINER) füllt ihn beim INSERT aus der Trainer-Tabelle, damit
 * die RLS-Policy `own_absences` für den betroffenen Trainer greift,
 * unabhängig davon, ob ein Admin die Abwesenheit angelegt hat.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:absence.repository');

export type Absence = Tables<'trainer_absences'>;
export type AbsenceType = 'sick' | 'vacation' | 'personal' | 'other';
export type AbsenceStatus = 'pending' | 'approved' | 'rejected';

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class AbsenceRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: TablesInsert<'trainer_absences'>): Promise<Absence> {
    const { data, error } = await this.db.from('trainer_absences').insert(input).select().single();
    assertNoError(error, 'Anlegen der Abwesenheit fehlgeschlagen');
    return data!;
  }

  async findById(id: string, clubId: string): Promise<Absence | null> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('id', id)
      .eq('club_id', clubId)
      .maybeSingle();
    assertNoError(error, 'Lesen der Abwesenheit fehlgeschlagen');
    return data;
  }

  async findByTrainerId(trainerId: string, clubId: string): Promise<Absence[]> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('trainer_id', trainerId)
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });
    assertNoError(error, 'Lesen der Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  async findAll(clubId: string): Promise<Absence[]> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });
    assertNoError(error, 'Lesen der Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  async findByStatus(status: AbsenceStatus, clubId: string): Promise<Absence[]> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('status', status)
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });
    assertNoError(error, 'Lesen der Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  async findByType(type: AbsenceType, clubId: string): Promise<Absence[]> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('type', type)
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });
    assertNoError(error, 'Lesen der Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  /** Überlappung: absence_start <= range_end AND absence_end >= range_start. */
  async findByDateRange(startDate: string, endDate: string, clubId: string): Promise<Absence[]> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('club_id', clubId)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date', { ascending: false });
    assertNoError(error, 'Lesen der Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  async findActiveForDate(date: string, clubId: string): Promise<Absence[]> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .select()
      .eq('club_id', clubId)
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date)
      .order('start_date', { ascending: false });
    assertNoError(error, 'Lesen der aktiven Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  async findConflicting(
    trainerId: string,
    startDate: string,
    endDate: string,
    clubId: string,
    excludeId?: string
  ): Promise<Absence[]> {
    let query = this.db
      .from('trainer_absences')
      .select()
      .eq('trainer_id', trainerId)
      .eq('club_id', clubId)
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.order('start_date', { ascending: false });
    assertNoError(error, 'Prüfen auf überlappende Abwesenheiten fehlgeschlagen');
    return data ?? [];
  }

  /** Geplante, nicht stornierte Sessions des Trainers im Abwesenheitszeitraum. */
  async findSessionConflicts(
    trainerId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ id: string; date: string }>> {
    const dayEnd = new Date(endDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await this.db
      .from('sessions')
      .select('id, timeslot_start')
      .eq('trainer_id', trainerId)
      .is('cancelled_at', null)
      .gte('timeslot_start', new Date(startDate).toISOString())
      .lte('timeslot_start', dayEnd.toISOString())
      .order('timeslot_start', { ascending: true });
    assertNoError(error, 'Prüfen auf Terminkonflikte fehlgeschlagen');
    return (data ?? []).map((row) => ({ id: row.id, date: row.timeslot_start }));
  }

  async update(
    id: string,
    input: TablesUpdate<'trainer_absences'>,
    clubId: string
  ): Promise<Absence | null> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .update(input)
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren der Abwesenheit fehlgeschlagen');
    return data;
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('trainer_absences')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
      .select('id');
    assertNoError(error, 'Löschen der Abwesenheit fehlgeschlagen');
    return (data ?? []).length > 0;
  }
}
