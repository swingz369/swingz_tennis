/**
 * Trial Training Service Adapter
 *
 * Drizzle-based trial training operations.
 *
 * Usage:
 * ```typescript
 * import { trialTrainingService } from '@/application/services/trial-training-service.adapter';
 *
 * const sessions = await trialTrainingService.getAllTrialTrainings();
 * ```
 */

import { eq, and, or } from 'drizzle-orm';
import { db } from '@/infrastructure/persistence/db';
import { userClubMemberships, users, clubs } from '@/infrastructure/persistence/schema';
import { EmailService } from '@/src/application/services/email.service';
import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '@/domain/entities/trial-training.entity';
import { TrialTrainingService } from './trial-training.service';
import { DrizzleTrialTrainingRepository } from '@/infrastructure/persistence/repositories/trial-training.repository';

class TrialTrainingServiceAdapter {
  private trialTrainingRepo = new DrizzleTrialTrainingRepository();

  /**
   * Validate trial training input
   * Delegates to in-memory service for validation logic
   */
  validateTrialTrainingInput(input: CreateTrialTrainingInput): {
    valid: boolean;
    errors: string[];
  } {
    return TrialTrainingService.validateTrialTrainingInput(input);
  }

  /**
   * Create a new trial training session
   */
  async createTrialTraining(
    input: CreateTrialTrainingInput,
    clubId: string = ''
  ): Promise<TrialTraining> {
    const validation = this.validateTrialTrainingInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.trialTrainingRepo.create(input, clubId);
  }

  /**
   * Create a public trial training request (non-member booking)
   * Uses relaxed validation (no trainer/court required) and status 'requested'.
   * Admin must confirm and assign trainer/court later.
   */
  async createPublicTrialTraining(
    input: CreateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining> {
    const validation = TrialTrainingService.validatePublicTrialInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.trialTrainingRepo.createRequested(input, clubId);
  }

  /**
   * Get trial training by ID
   */
  async getTrialTrainingById(id: string, clubId: string = ''): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.findById(id, clubId);
  }

  /**
   * Get all trial trainings
   */
  async getAllTrialTrainings(clubId: string = ''): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findAll(clubId);
  }

  /**
   * Get trial trainings by status
   */
  async getTrialTrainingsByStatus(
    status: TrialTraining['status'],
    clubId: string = ''
  ): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findByStatus(status, clubId);
  }

  /**
   * Get trial trainings by participant email
   */
  async getTrialTrainingsByParticipantEmail(
    email: string,
    clubId: string = ''
  ): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findByParticipantEmail(email, clubId);
  }

  /**
   * Get trial trainings by date range
   */
  async getTrialTrainingsByDateRange(
    clubId: string = '',
    startDate: string,
    endDate: string
  ): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findByDateRange(clubId, startDate, endDate);
  }

  /**
   * Get upcoming trial trainings
   */
  async getUpcomingTrialTrainings(clubId: string = '', days: number = 7): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findUpcoming(clubId, days);
  }

  /**
   * Get trial trainings needing reminder
   */
  async getTrialTrainingsNeedingReminder(clubId: string = ''): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findUpcoming(clubId, 1);
  }

  /**
   * Search trial trainings
   */
  async searchTrialTrainings(query: string, clubId: string = ''): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.search(query, clubId);
  }

  /**
   * Get trial training statistics
   */
  async getTrialTrainingStats(
    clubId: string = '',
    startDate?: string,
    endDate?: string
  ): Promise<TrialTrainingStats> {
    return this.trialTrainingRepo.getStats(clubId, startDate, endDate);
  }

  /**
   * Update trial training
   */
  async updateTrialTraining(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.update(id, input, clubId);
  }

  /**
   * Update trial training status
   */
  async updateTrialTrainingStatus(
    id: string,
    status: TrialTraining['status'],
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.updateStatus(id, status, clubId);
  }

  /**
   * Add feedback to trial training
   */
  async addTrialTrainingFeedback(
    id: string,
    feedback: TrialTraining['feedback'],
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.update(id, { feedback }, clubId);
  }

  /**
   * Convert trial training to member
   */
  async convertTrialToMember(
    id: string,
    memberId: string,
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.convertToMember(id, memberId, clubId);
  }

  /**
   * Approve a requested trial training — assign trainer/court and set status to 'scheduled'.
   */
  async approveTrialTraining(
    id: string,
    trainerId: string,
    trainerName: string,
    courtId: string,
    courtName: string,
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.update(
      id,
      {
        status: 'scheduled',
        trainerId,
        trainerName,
        courtId,
        courtName,
      },
      clubId
    );
  }

  /**
   * Reject a requested trial training — set status to 'cancelled'.
   */
  async rejectTrialTraining(
    id: string,
    reason: string = '',
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.update(
      id,
      {
        status: 'cancelled',
        notes: reason ? `Abgelehnt: ${reason}` : 'Abgelehnt',
      },
      clubId
    );
  }

  /**
   * Delete trial training
   */
  async deleteTrialTraining(id: string, clubId: string = ''): Promise<boolean> {
    return this.trialTrainingRepo.delete(id, clubId);
  }

  /**
   * Notify club admins about a new trial training request from the public booking page.
   * Queries the DB for admin/superadmin emails in the given club and sends
   * a notification email to each of them.
   */
  async notifyAdminsOfNewRequest(trialTraining: TrialTraining, clubId: string): Promise<void> {
    if (!clubId) {
      console.warn('No clubId provided, skipping admin notification');
      return;
    }

    try {
      // Find admin and superadmin users for this club (filter in DB, not JS)
      const admins = await db
        .select({
          email: users.email,
          fullName: users.full_name,
        })
        .from(userClubMemberships)
        .innerJoin(users, eq(userClubMemberships.user_id, users.id))
        .where(
          and(
            eq(userClubMemberships.club_id, clubId),
            eq(userClubMemberships.is_active, true),
            or(eq(userClubMemberships.role, 'admin'), eq(userClubMemberships.role, 'superadmin'))
          )
        );

      if (admins.length === 0) {
        console.warn(`No admins found for club ${clubId}, skipping notification`);
        return;
      }

      // Fetch club name
      const clubResult = await db
        .select({ name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, clubId))
        .limit(1);

      const clubName = clubResult[0]?.name ?? 'SwingZ Tennis Club';

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://swingz.cloud';
      const adminDashboardUrl = `${baseUrl}/admin/trial-training`;

      const participant = trialTraining.participant;
      const participantName = `${participant.firstName} ${participant.lastName}`;

      // Extract experience level and notes from the combined notes field
      const notes = trialTraining.notes || '';
      const experienceMatch = notes.match(/Spielstärke:\s*(.+?)(?:\s*\|\s*|$)/);
      const experienceLevel = experienceMatch ? experienceMatch[1] : undefined;
      const cleanNotes = notes.replace(/Spielstärke:\s*.+?(?:\s*\|\s*)?/, '').trim() || undefined;

      // Send notification to each admin
      for (const admin of admins) {
        if (!admin.email) continue;

        await EmailService.sendNewTrialRequestNotification({
          adminEmail: admin.email,
          adminName: admin.fullName ?? 'Admin',
          participantName,
          participantEmail: participant.email,
          participantPhone: participant.phone,
          preferredDate: trialTraining.scheduledDate,
          preferredTime: trialTraining.scheduledTime,
          experienceLevel,
          notes: cleanNotes,
          clubName,
          adminDashboardUrl,
        });
      }

      // Trial request notification sent successfully
    } catch (error) {
      // Don't fail the request if notification fails — log and continue
      console.error('Failed to send trial request notification to admins:', error);
    }
  }
}

// Export singleton instance
export const trialTrainingService = new TrialTrainingServiceAdapter();
