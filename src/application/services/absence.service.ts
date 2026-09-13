import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import type { TablesUpdate } from '@/types/supabase';
import {
  AbsenceRepository,
  type Absence,
  type AbsenceType,
  type AbsenceStatus,
} from '@/infrastructure/persistence/repositories/absence.repository';

export type CreateAbsenceInput = {
  trainerId: string;
  trainerName: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  reason?: string;
  notes?: string;
};

export type UpdateAbsenceInput = Partial<{
  type: AbsenceType;
  startDate: string;
  endDate: string;
  status: AbsenceStatus;
  reason: string;
  notes: string;
}>;

/**
 * Sechste migrierte Domäne für ADR-005 (Trainer-Teildomäne: Abwesenheiten).
 * Ein Service, ein Repository, kein Adapter, keine Interfaces, keine
 * In-Memory-Stub-Implementierung.
 */
export class AbsenceService {
  private readonly repo: AbsenceRepository;

  constructor(auth: AuthContext) {
    this.repo = new AbsenceRepository(getUserDb(auth));
  }

  private async assertNoConflict(
    trainerId: string,
    startDate: string,
    endDate: string,
    clubId: string,
    excludeId?: string
  ): Promise<void> {
    const conflicts = await this.repo.findConflicting(
      trainerId,
      startDate,
      endDate,
      clubId,
      excludeId
    );
    if (conflicts.length > 0) {
      throw new ApiException(
        'CONFLICT',
        'Zeitraum überschneidet sich mit einer bereits genehmigten Abwesenheit'
      );
    }
  }

  async createAbsence(input: CreateAbsenceInput, clubId: string): Promise<Absence> {
    await this.assertNoConflict(input.trainerId, input.startDate, input.endDate, clubId);

    return this.repo.create({
      club_id: clubId,
      trainer_id: input.trainerId,
      trainer_name: input.trainerName,
      type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'pending',
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    });
  }

  async getAbsenceById(id: string, clubId: string): Promise<Absence> {
    const absence = await this.repo.findById(id, clubId);
    if (!absence) throw new ApiException('NOT_FOUND', 'Abwesenheit nicht gefunden');
    return absence;
  }

  async getAbsencesByTrainerId(trainerId: string, clubId: string): Promise<Absence[]> {
    return this.repo.findByTrainerId(trainerId, clubId);
  }

  async getAllAbsences(clubId: string): Promise<Absence[]> {
    return this.repo.findAll(clubId);
  }

  async getAbsencesByStatus(status: AbsenceStatus, clubId: string): Promise<Absence[]> {
    return this.repo.findByStatus(status, clubId);
  }

  async getAbsencesByType(type: AbsenceType, clubId: string): Promise<Absence[]> {
    return this.repo.findByType(type, clubId);
  }

  async getAbsencesByDateRange(
    startDate: string,
    endDate: string,
    clubId: string
  ): Promise<Absence[]> {
    return this.repo.findByDateRange(startDate, endDate, clubId);
  }

  async getActiveAbsencesForDate(date: string, clubId: string): Promise<Absence[]> {
    return this.repo.findActiveForDate(date, clubId);
  }

  async updateAbsence(id: string, input: UpdateAbsenceInput, clubId: string): Promise<Absence> {
    const existing = await this.repo.findById(id, clubId);
    if (!existing) throw new ApiException('NOT_FOUND', 'Abwesenheit nicht gefunden');

    if ((input.startDate || input.endDate) && input.status !== 'rejected') {
      const newStart = input.startDate ?? existing.start_date;
      const newEnd = input.endDate ?? existing.end_date;
      await this.assertNoConflict(existing.trainer_id, newStart, newEnd, clubId, id);
    }

    const update: TablesUpdate<'trainer_absences'> = {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.startDate !== undefined && { start_date: input.startDate }),
      ...(input.endDate !== undefined && { end_date: input.endDate }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.reason !== undefined && { reason: input.reason }),
      ...(input.notes !== undefined && { notes: input.notes }),
    };

    const updated = await this.repo.update(id, update, clubId);
    if (!updated) throw new ApiException('NOT_FOUND', 'Abwesenheit nicht gefunden');
    return updated;
  }

  async findSessionConflicts(
    trainerId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ id: string; date: string }>> {
    return this.repo.findSessionConflicts(trainerId, startDate, endDate);
  }

  async approveAbsence(id: string, approvedBy: string, clubId: string): Promise<Absence> {
    const updated = await this.repo.update(
      id,
      { status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() },
      clubId
    );
    if (!updated) throw new ApiException('NOT_FOUND', 'Abwesenheit nicht gefunden');
    return updated;
  }

  async rejectAbsence(
    id: string,
    rejectedBy: string,
    clubId: string,
    reason?: string
  ): Promise<Absence> {
    const updated = await this.repo.update(
      id,
      {
        status: 'rejected',
        approved_by: rejectedBy,
        approved_at: new Date().toISOString(),
        ...(reason !== undefined && { reason }),
      },
      clubId
    );
    if (!updated) throw new ApiException('NOT_FOUND', 'Abwesenheit nicht gefunden');
    return updated;
  }

  async deleteAbsence(id: string, clubId: string): Promise<void> {
    const deleted = await this.repo.delete(id, clubId);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Abwesenheit nicht gefunden');
  }
}
