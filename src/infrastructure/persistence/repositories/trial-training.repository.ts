import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { trialTrainings } from '../schema';
import type { ITrialTrainingRepository } from '@/domain/repositories/trial-training-repository.interface';
import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '@/domain/entities/trial-training.entity';
import { parsePostgresError } from '@/lib/errors/database-errors';

/**
 * Drizzle ORM implementation of the Trial Training Repository
 * Manages trial sessions with conversion tracking
 */
export class DrizzleTrialTrainingRepository implements ITrialTrainingRepository {
  async create(input: CreateTrialTrainingInput, clubId: string): Promise<TrialTraining> {
    const db = getDb();
    const now = new Date();

    try {
      const result = await db
        .insert(trialTrainings)
        .values({
          club_id: clubId,
          participant_first_name: input.participant.firstName,
          participant_last_name: input.participant.lastName,
          participant_email: input.participant.email,
          participant_phone: input.participant.phone,
          participant_date_of_birth: new Date(input.participant.dateOfBirth),
          scheduled_date: new Date(input.scheduledDate),
          scheduled_time: input.scheduledTime,
          duration: input.duration,
          trainer_id: input.trainerId,
          trainer_name: 'Trainer', // Will be fetched via relation
          court_id: input.courtId,
          court_name: 'Court', // Will be fetched via relation
          status: 'scheduled',
          notes: input.notes,
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string, clubId: string): Promise<TrialTraining | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(trialTrainings)
      .where(and(eq(trialTrainings.id, id), eq(trialTrainings.club_id, clubId)))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findAll(clubId: string): Promise<TrialTraining[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trialTrainings)
      .where(eq(trialTrainings.club_id, clubId))
      .orderBy(desc(trialTrainings.scheduled_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByStatus(status: TrialTraining['status'], clubId: string): Promise<TrialTraining[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trialTrainings)
      .where(and(eq(trialTrainings.status, status), eq(trialTrainings.club_id, clubId)))
      .orderBy(desc(trialTrainings.scheduled_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByParticipantEmail(email: string, clubId: string): Promise<TrialTraining[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trialTrainings)
      .where(
        and(ilike(trialTrainings.participant_email, email), eq(trialTrainings.club_id, clubId))
      )
      .orderBy(desc(trialTrainings.scheduled_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByTrainer(trainerId: string, clubId: string): Promise<TrialTraining[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trialTrainings)
      .where(and(eq(trialTrainings.trainer_id, trainerId), eq(trialTrainings.club_id, clubId)))
      .orderBy(desc(trialTrainings.scheduled_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findUpcoming(clubId: string, days: number = 7): Promise<TrialTraining[]> {
    const db = getDb();

    // Use the PostgreSQL helper function
    const result = await db.execute<typeof trialTrainings.$inferSelect>(sql`
      SELECT *
      FROM get_upcoming_trial_trainings(
        ${clubId}::uuid,
        ${days}::integer
      )
    `);

    if (!result || result.length === 0) {
      return [];
    }

    return result.map((row) => this.mapToDomain(row));
  }

  async search(query: string, clubId: string): Promise<TrialTraining[]> {
    const db = getDb();
    const searchPattern = `%${query}%`;

    const result = await db
      .select()
      .from(trialTrainings)
      .where(
        and(
          eq(trialTrainings.club_id, clubId),
          or(
            ilike(trialTrainings.participant_first_name, searchPattern),
            ilike(trialTrainings.participant_last_name, searchPattern),
            ilike(trialTrainings.participant_email, searchPattern)
          )
        )
      )
      .orderBy(desc(trialTrainings.scheduled_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async getStats(
    clubId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TrialTrainingStats> {
    const db = getDb();

    // Use the PostgreSQL helper function
    const result = await db.execute<{
      total: string;
      scheduled: string;
      completed: string;
      cancelled: string;
      no_show: string;
      converted: string;
      conversion_rate: string;
    }>(sql`
      SELECT *
      FROM get_trial_training_stats(
        ${clubId}::uuid,
        ${startDate ? new Date(startDate) : null}::date,
        ${endDate ? new Date(endDate) : null}::date
      )
    `);

    if (!result || result.length === 0) {
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

    const row = result[0];
    return {
      total: parseInt(row.total),
      scheduled: parseInt(row.scheduled),
      completed: parseInt(row.completed),
      cancelled: parseInt(row.cancelled),
      noShow: parseInt(row.no_show),
      converted: parseInt(row.converted),
      conversionRate: parseFloat(row.conversion_rate),
    };
  }

  async update(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining | null> {
    const db = getDb();
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.feedback !== undefined) {
        updateData.feedback_rating = input.feedback.rating;
        updateData.feedback_comments = input.feedback.comments;
        updateData.feedback_would_recommend = input.feedback.wouldRecommend;
      }
      if (input.convertedToMemberId !== undefined) {
        updateData.converted_to_member_id = input.convertedToMemberId;
      }

      const result = await db
        .update(trialTrainings)
        .set(updateData)
        .where(and(eq(trialTrainings.id, id), eq(trialTrainings.club_id, clubId)))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async updateStatus(
    id: string,
    status: TrialTraining['status'],
    clubId: string
  ): Promise<TrialTraining | null> {
    return this.update(id, { status }, clubId);
  }

  async convertToMember(
    id: string,
    memberId: string,
    clubId: string
  ): Promise<TrialTraining | null> {
    return this.update(id, { status: 'converted', convertedToMemberId: memberId }, clubId);
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(trialTrainings)
      .where(and(eq(trialTrainings.id, id), eq(trialTrainings.club_id, clubId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: typeof trialTrainings.$inferSelect): TrialTraining {
    return {
      id: row.id,
      participant: {
        id: row.participant_id,
        firstName: row.participant_first_name,
        lastName: row.participant_last_name,
        email: row.participant_email,
        phone: row.participant_phone,
        dateOfBirth: this.formatDate(row.participant_date_of_birth),
      },
      scheduledDate: this.formatDate(row.scheduled_date),
      scheduledTime: row.scheduled_time,
      duration: row.duration,
      trainer: {
        id: row.trainer_id,
        name: row.trainer_name,
      },
      court: {
        id: row.court_id,
        name: row.court_name,
      },
      status: row.status as 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'converted',
      notes: row.notes ?? undefined,
      feedback: row.feedback_rating
        ? {
            rating: row.feedback_rating,
            comments: row.feedback_comments ?? '',
            wouldRecommend: row.feedback_would_recommend ?? false,
          }
        : undefined,
      convertedToMemberId: row.converted_to_member_id ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Format date to YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
