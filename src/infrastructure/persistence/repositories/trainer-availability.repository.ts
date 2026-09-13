/**
 * Trainer-Teildomäne "Verfügbarkeit" für ADR-005. Ein Repository, kein
 * Adapter, keine Interfaces. `trainer_availabilities` hat keine `club_id`
 * (die Verfügbarkeit gehört dem Trainer als Person, nicht einem Verein) —
 * die RLS-Policies scopen stattdessen über die `trainer_club`-Zuordnung
 * (supabase/migrations/20260913170000_trainer_availabilities_admin_access.sql).
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:trainer-availability.repository');

export type TrainerAvailability = Tables<'trainer_availabilities'>;
export type AvailabilityStatus = 'available' | 'unavailable' | 'booked' | 'blocked';

export type AvailabilityQuery = {
  trainerId?: string;
  startDate?: string;
  endDate?: string;
  status?: AvailabilityStatus;
};

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class TrainerAvailabilityRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: TablesInsert<'trainer_availabilities'>): Promise<TrainerAvailability> {
    const { data, error } = await this.db
      .from('trainer_availabilities')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Anlegen der Trainer-Verfügbarkeit fehlgeschlagen');
    return data!;
  }

  async findById(id: string): Promise<TrainerAvailability | null> {
    const { data, error } = await this.db
      .from('trainer_availabilities')
      .select()
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen der Trainer-Verfügbarkeit fehlgeschlagen');
    return data;
  }

  async findByQuery(query: AvailabilityQuery): Promise<TrainerAvailability[]> {
    let q = this.db.from('trainer_availabilities').select();
    if (query.trainerId) q = q.eq('trainer_id', query.trainerId);
    if (query.startDate) q = q.gte('date', query.startDate);
    if (query.endDate) q = q.lte('date', query.endDate);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q.order('date', { ascending: false });
    assertNoError(error, 'Lesen der Trainer-Verfügbarkeiten fehlgeschlagen');
    return data ?? [];
  }

  async findByDateRange(
    trainerId: string | undefined,
    startDate: string,
    endDate: string
  ): Promise<TrainerAvailability[]> {
    let q = this.db
      .from('trainer_availabilities')
      .select()
      .gte('date', startDate)
      .lte('date', endDate);
    if (trainerId) q = q.eq('trainer_id', trainerId);
    const { data, error } = await q.order('date', { ascending: false });
    assertNoError(error, 'Lesen der Trainer-Verfügbarkeiten fehlgeschlagen');
    return data ?? [];
  }

  async update(
    id: string,
    input: TablesUpdate<'trainer_availabilities'>
  ): Promise<TrainerAvailability | null> {
    const { data, error } = await this.db
      .from('trainer_availabilities')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren der Trainer-Verfügbarkeit fehlgeschlagen');
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('trainer_availabilities').delete().eq('id', id);
    assertNoError(error, 'Löschen der Trainer-Verfügbarkeit fehlgeschlagen');
  }
}
