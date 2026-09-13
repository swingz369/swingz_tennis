/**
 * Probetraining-Teildomäne (Dritter und letzter Teil von "Mitglieder,
 * Probetraining, Gruppen", ADR-005 Domäne 3) — ein Repository statt
 * Drizzle-Direktzugriff, docs/ARCHIV/2026-09-13-architektur-analyse-
 * datenzugriff.md § 6.
 *
 * RLS-Fund: INSERT/UPDATE/SELECT auf trial_trainings erlaubten bisher nur
 * is_club_admin bzw. einem Trainer mit bereits zugewiesener trainer_id —
 * die Routes hier prüfen aber verifyRole(auth, 'trainer') für Anlegen/
 * Bearbeiten. Migration 20260914100000 weitet die drei Policies auf
 * is_club_admin OR is_club_trainer aus; die beiden "assigned"-Policies
 * sind dadurch vollständig subsumiert und wurden gelöscht.
 *
 * Nur tatsächlich aufgerufene Methoden migriert: findByTrainer, findUpcoming,
 * search, updateStatus, convertToMember hatten keinen Aufrufer außerhalb des
 * jetzt gelöschten Adapters (dessen eigene Wrapper dafür ebenfalls nie von
 * einer Route aufgerufen wurden).
 */
import 'server-only';
import { randomBytes } from 'crypto';
import type { AuthContext } from '@/lib/api-auth';
import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '@/domain/entities/trial-training.entity';
import type { Tables, TablesInsert } from '@/types/supabase';
import { parsePostgresError } from '@/lib/errors/database-errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:trial-training.repository');

type TrialTrainingRow = Tables<'trial_trainings'>;

/** Platzhalter-UUID für öffentliche Probetraining-Anfragen ohne Trainer/Platz. */
const UNASSIGNED_ID = '00000000-0000-0000-0000-000000000000';

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

function mapToDomain(row: TrialTrainingRow): TrialTraining {
  return {
    id: row.id,
    participant: {
      id: row.participant_id,
      firstName: row.participant_first_name,
      lastName: row.participant_last_name,
      email: row.participant_email,
      phone: row.participant_phone,
      dateOfBirth: row.participant_date_of_birth,
    },
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    duration: row.duration,
    trainer: { id: row.trainer_id, name: row.trainer_name },
    court: { id: row.court_id, name: row.court_name },
    status: row.status as TrialTraining['status'],
    notes: row.notes ?? undefined,
    feedback: row.feedback_rating
      ? {
          rating: row.feedback_rating,
          comments: row.feedback_comments ?? '',
          wouldRecommend: row.feedback_would_recommend ?? false,
        }
      : undefined,
    convertedToMemberId: row.converted_to_member_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TrialTrainingRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: CreateTrialTrainingInput, clubId: string): Promise<TrialTraining> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .insert({
        club_id: clubId,
        participant_first_name: input.participant.firstName,
        participant_last_name: input.participant.lastName,
        participant_email: input.participant.email,
        participant_phone: input.participant.phone,
        participant_date_of_birth: input.participant.dateOfBirth,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        duration: input.duration,
        trainer_id: input.trainerId,
        trainer_name: 'Trainer',
        court_id: input.courtId,
        court_name: 'Court',
        status: 'scheduled',
        notes: input.notes,
      })
      .select()
      .single();
    if (error) throw parsePostgresError(error);
    return mapToDomain(data);
  }

  /**
   * Öffentliche Probetraining-Anfrage (kein Login) — Platzhalter-Trainer/
   * Platz statt echter Zuweisung, Admin/Trainer weist später zu. Kein
   * DB-Transaktionsblock (Supabase-JS unterstützt das nicht) — die beiden
   * Platzhalter-Upserts sind idempotent (ignoreDuplicates), eine echte
   * Transaktion war hier nie zum Schutz einer Invariante nötig, nur zum
   * Gruppieren dreier Statements.
   */
  async createRequested(input: CreateTrialTrainingInput, clubId: string): Promise<TrialTraining> {
    const marketingConsent = input.marketingConsent ?? false;
    const marketingConsentToken = marketingConsent ? randomBytes(32).toString('hex') : null;

    const { error: trainerError } = await this.db.from('trainers').upsert(
      {
        id: UNASSIGNED_ID,
        email: 'unassigned@placeholder.local',
        name: 'Noch nicht zugewiesen',
        specialties: [],
        max_hours_per_week: 0,
        is_active: false,
      } satisfies TablesInsert<'trainers'>,
      { onConflict: 'id', ignoreDuplicates: true }
    );
    assertNoError(trainerError, 'Anlegen des Platzhalter-Trainers fehlgeschlagen');

    const { error: courtError } = await this.db.from('courts').upsert(
      {
        id: UNASSIGNED_ID,
        club_id: clubId,
        name: 'Noch nicht zugewiesen',
        surface: 'hard',
        is_active: false,
      } satisfies TablesInsert<'courts'>,
      { onConflict: 'id', ignoreDuplicates: true }
    );
    assertNoError(courtError, 'Anlegen des Platzhalter-Platzes fehlgeschlagen');

    const { data, error } = await this.db
      .from('trial_trainings')
      .insert({
        club_id: clubId,
        participant_first_name: input.participant.firstName,
        participant_last_name: input.participant.lastName,
        participant_email: input.participant.email,
        participant_phone: input.participant.phone,
        participant_date_of_birth: input.participant.dateOfBirth,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        duration: input.duration,
        trainer_id: UNASSIGNED_ID,
        trainer_name: 'Noch nicht zugewiesen',
        court_id: UNASSIGNED_ID,
        court_name: 'Noch nicht zugewiesen',
        status: 'requested',
        notes: input.notes,
        marketing_consent: marketingConsent,
        marketing_consent_token: marketingConsentToken,
      })
      .select()
      .single();
    if (error) throw parsePostgresError(error);

    // Token nur hier zurückgeben, damit der Aufrufer die DOI-Mail verschicken
    // kann — mapToDomain liest ihn für alle anderen Aufrufer nie zurück.
    return {
      ...mapToDomain(data),
      ...(marketingConsentToken ? { marketingConsentToken } : {}),
    };
  }

  async findById(id: string, clubId: string): Promise<TrialTraining | null> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .select()
      .eq('id', id)
      .eq('club_id', clubId)
      .maybeSingle();
    assertNoError(error, 'Lesen des Probetrainings fehlgeschlagen');
    return data ? mapToDomain(data) : null;
  }

  async findAll(clubId: string): Promise<TrialTraining[]> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .select()
      .eq('club_id', clubId)
      .order('scheduled_date', { ascending: false });
    assertNoError(error, 'Lesen der Probetrainings fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  /**
   * Vereinsübergreifend, ohne club_id-Filter — nur für die Owner/Statistik-
   * Aggregation ohne Request-Kontext (systemDb()), analog HoursLogRepository.
   */
  async findAllAcrossClubs(): Promise<TrialTraining[]> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .select()
      .order('scheduled_date', { ascending: false });
    assertNoError(error, 'Lesen der Probetrainings fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  async findByStatus(status: TrialTraining['status'], clubId: string): Promise<TrialTraining[]> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .select()
      .eq('status', status)
      .eq('club_id', clubId)
      .order('scheduled_date', { ascending: false });
    assertNoError(error, 'Lesen der Probetrainings fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  async findByParticipantEmail(email: string, clubId: string): Promise<TrialTraining[]> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .select()
      .ilike('participant_email', email)
      .eq('club_id', clubId)
      .order('scheduled_date', { ascending: false });
    assertNoError(error, 'Lesen der Probetrainings fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  async findByDateRange(
    clubId: string,
    startDate: string,
    endDate: string
  ): Promise<TrialTraining[]> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .select()
      .eq('club_id', clubId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: false });
    assertNoError(error, 'Lesen der Probetrainings fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  async getStats(
    clubId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TrialTrainingStats> {
    const { data, error } = await this.db.rpc('get_trial_training_stats', {
      p_club_id: clubId,
      ...(startDate ? { p_start_date: startDate } : {}),
      ...(endDate ? { p_end_date: endDate } : {}),
    });
    assertNoError(error, 'Lesen der Probetraining-Statistik fehlgeschlagen');

    const row = data?.[0];
    if (!row) {
      return {
        total: 0,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        converted: 0,
        conversionRate: 0,
      };
    }
    return {
      total: row.total,
      scheduled: row.scheduled,
      completed: row.completed,
      cancelled: row.cancelled,
      noShow: row.no_show,
      converted: row.converted,
      conversionRate: row.conversion_rate,
    };
  }

  async update(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining | null> {
    const updateData: Partial<Tables<'trial_trainings'>> = {};
    if (input.status !== undefined) updateData.status = input.status;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.trainerId !== undefined) updateData.trainer_id = input.trainerId;
    if (input.trainerName !== undefined) updateData.trainer_name = input.trainerName;
    if (input.courtId !== undefined) updateData.court_id = input.courtId;
    if (input.courtName !== undefined) updateData.court_name = input.courtName;
    if (input.feedback !== undefined) {
      updateData.feedback_rating = input.feedback.rating;
      updateData.feedback_comments = input.feedback.comments;
      updateData.feedback_would_recommend = input.feedback.wouldRecommend;
    }
    if (input.convertedToMemberId !== undefined) {
      updateData.converted_to_member_id = input.convertedToMemberId;
    }

    const { data, error } = await this.db
      .from('trial_trainings')
      .update(updateData)
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .maybeSingle();
    if (error) throw parsePostgresError(error);
    return data ? mapToDomain(data) : null;
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
      .select('id');
    assertNoError(error, 'Löschen des Probetrainings fehlgeschlagen');
    return (data ?? []).length > 0;
  }

  /**
   * Bestätigung per Token, vereinsübergreifend gesucht — der öffentliche
   * DOI-Link trägt keinen Club-Kontext. Token ist Single-Use: wird beim
   * Bestätigen sofort geleert, damit er nicht wiederverwendet werden kann.
   */
  async confirmMarketingConsentByToken(token: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('trial_trainings')
      .update({
        marketing_consent_confirmed_at: new Date().toISOString(),
        marketing_consent_token: null,
      })
      .eq('marketing_consent_token', token)
      .select('id');
    if (error) throw parsePostgresError(error);
    return (data ?? []).length > 0;
  }
}
