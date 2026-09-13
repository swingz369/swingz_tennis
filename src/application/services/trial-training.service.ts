/**
 * Ersetzt die alte, rein In-Memory haltende TrialTrainingService-Klasse
 * (Daten nur im Prozessspeicher, nie produktiv genutzt — "API routes now
 * use the DB-backed adapter") und den gelöschten
 * trial-training-service.adapter.ts in einem Zug (ADR-005 Domäne 3,
 * Probetraining). Ein Service, ein Repository, kein Adapter.
 *
 * Der Konstruktor nimmt den Supabase-Client statt AuthContext entgegen,
 * weil zwei Aufrufstellen (öffentliches Probetraining-Formular, DOI-
 * Bestätigungslink) ohne Login laufen und daher systemDb() statt
 * getUserDb(auth) übergeben — anders als bei den bisher migrierten
 * Domänen gibt es hier keinen einheitlichen auth-Kontext.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import { TrialTrainingRepository } from '@/infrastructure/persistence/repositories/trial-training.repository';
import { EmailService } from '@/application/services/email.service';
import { createLogger } from '@/lib/logger';
import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '@/domain/entities/trial-training.entity';

const log = createLogger('trial-training-service');

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDate(dateString: string): boolean {
  return !isNaN(new Date(dateString).getTime());
}

function isValidTime(timeString: string): boolean {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString);
}

export class TrialTrainingService {
  private readonly repo: TrialTrainingRepository;

  constructor(private readonly db: AuthContext['supabase']) {
    this.repo = new TrialTrainingRepository(db);
  }

  validateTrialTrainingInput(input: CreateTrialTrainingInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (!input.participant.firstName || input.participant.firstName.trim().length < 2) {
      errors.push('Vorname muss mindestens 2 Zeichen lang sein');
    }
    if (!input.participant.lastName || input.participant.lastName.trim().length < 2) {
      errors.push('Nachname muss mindestens 2 Zeichen lang sein');
    }
    if (!input.participant.email || !isValidEmail(input.participant.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }
    if (!input.participant.phone || input.participant.phone.trim().length < 5) {
      errors.push('Telefonnummer muss mindestens 5 Zeichen lang sein');
    }
    if (!input.participant.dateOfBirth || !isValidDate(input.participant.dateOfBirth)) {
      errors.push('Ungültiges Geburtsdatum');
    }
    if (!input.scheduledDate || !isValidDate(input.scheduledDate)) {
      errors.push('Ungültiges Trainingsdatum');
    }
    if (!input.scheduledTime || !isValidTime(input.scheduledTime)) {
      errors.push('Ungültige Trainingszeit');
    }
    if (!input.duration || input.duration < 30 || input.duration > 180) {
      errors.push('Dauer muss zwischen 30 und 180 Minuten liegen');
    }
    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }
    if (!input.courtId || input.courtId.trim().length === 0) {
      errors.push('Platz-ID ist erforderlich');
    }
    return { valid: errors.length === 0, errors };
  }

  validatePublicTrialInput(input: CreateTrialTrainingInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!input.participant.firstName || input.participant.firstName.trim().length < 2) {
      errors.push('Vorname muss mindestens 2 Zeichen lang sein');
    }
    if (!input.participant.lastName || input.participant.lastName.trim().length < 2) {
      errors.push('Nachname muss mindestens 2 Zeichen lang sein');
    }
    if (!input.participant.email || !isValidEmail(input.participant.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }
    if (!input.participant.phone || input.participant.phone.trim().length < 5) {
      errors.push('Telefonnummer muss mindestens 5 Zeichen lang sein');
    }
    if (!input.participant.dateOfBirth || !isValidDate(input.participant.dateOfBirth)) {
      errors.push('Ungültiges Geburtsdatum');
    }
    if (!input.scheduledDate || !isValidDate(input.scheduledDate)) {
      errors.push('Ungültiges Trainingsdatum');
    }
    if (!input.scheduledTime || !isValidTime(input.scheduledTime)) {
      errors.push('Ungültige Trainingszeit');
    }
    if (!input.duration || input.duration < 30 || input.duration > 180) {
      errors.push('Dauer muss zwischen 30 und 180 Minuten liegen');
    }
    return { valid: errors.length === 0, errors };
  }

  async createTrialTraining(
    input: CreateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining> {
    const validation = this.validateTrialTrainingInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    return this.repo.create(input, clubId);
  }

  async createPublicTrialTraining(
    input: CreateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining> {
    const validation = this.validatePublicTrialInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    return this.repo.createRequested(input, clubId);
  }

  async getTrialTrainingById(id: string, clubId: string): Promise<TrialTraining | null> {
    return this.repo.findById(id, clubId);
  }

  async getAllTrialTrainings(clubId: string): Promise<TrialTraining[]> {
    return this.repo.findAll(clubId);
  }

  async getTrialTrainingsByStatus(
    status: TrialTraining['status'],
    clubId: string
  ): Promise<TrialTraining[]> {
    return this.repo.findByStatus(status, clubId);
  }

  async getTrialTrainingsByParticipantEmail(
    email: string,
    clubId: string
  ): Promise<TrialTraining[]> {
    return this.repo.findByParticipantEmail(email, clubId);
  }

  async getTrialTrainingsByDateRange(
    clubId: string,
    startDate: string,
    endDate: string
  ): Promise<TrialTraining[]> {
    return this.repo.findByDateRange(clubId, startDate, endDate);
  }

  async getTrialTrainingStats(
    clubId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TrialTrainingStats> {
    return this.repo.getStats(clubId, startDate, endDate);
  }

  async updateTrialTraining(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining | null> {
    return this.repo.update(id, input, clubId);
  }

  async deleteTrialTraining(id: string, clubId: string): Promise<boolean> {
    return this.repo.delete(id, clubId);
  }

  /** @returns true if a matching, unconfirmed token was found and confirmed */
  async confirmMarketingConsent(token: string): Promise<boolean> {
    return this.repo.confirmMarketingConsentByToken(token);
  }

  /**
   * Benachrichtigt Admins/Superadmins des Vereins über eine neue
   * Probetraining-Anfrage aus dem öffentlichen Formular. Läuft immer über
   * systemDb() (Aufrufer ist die unauthentifizierte Public-Route).
   */
  async notifyAdminsOfNewRequest(trialTraining: TrialTraining, clubId: string): Promise<void> {
    if (!clubId) {
      log.info('No clubId provided, skipping admin notification');
      return;
    }

    try {
      const { data: memberships } = await this.db
        .from('user_club_memberships')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .in('role', ['admin', 'superadmin']);

      const userIds = (memberships ?? []).map((m) => m.user_id);
      if (userIds.length === 0) {
        log.info('No admins found for club, skipping notification', { clubId });
        return;
      }

      const { data: admins } = await this.db
        .from('users')
        .select('email, full_name')
        .in('id', userIds);

      if (!admins || admins.length === 0) {
        log.info('No admins found for club, skipping notification', { clubId });
        return;
      }

      const { data: clubRow } = await this.db
        .from('clubs')
        .select('name')
        .eq('id', clubId)
        .maybeSingle();
      const clubName = clubRow?.name ?? 'SwingZ Tennis Club';

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://swingz.cloud';
      const adminDashboardUrl = `${baseUrl}/admin/trial-training`;

      const participant = trialTraining.participant;
      const participantName = `${participant.firstName} ${participant.lastName}`;

      const notes = trialTraining.notes || '';
      const experienceMatch = notes.match(/Spielstärke:\s*(.+?)(?:\s*\|\s*|$)/);
      const experienceLevel = experienceMatch ? experienceMatch[1] : undefined;
      const cleanNotes = notes.replace(/Spielstärke:\s*.+?(?:\s*\|\s*)?/, '').trim() || undefined;

      for (const admin of admins) {
        if (!admin.email) continue;

        await EmailService.sendNewTrialRequestNotification({
          adminEmail: admin.email,
          adminName: admin.full_name ?? 'Admin',
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

      log.info('Admin trial request notifications sent', { clubId, adminCount: admins.length });
    } catch (error) {
      log.error(
        'Failed to send trial request notification to admins',
        error instanceof Error ? error : undefined
      );
    }
  }

  async notifyParticipantOfTrialTraining(
    trialTraining: TrialTraining,
    clubId?: string
  ): Promise<void> {
    const participant = trialTraining.participant;

    try {
      let clubName = 'SwingZ Tennis Club';
      if (clubId) {
        const { data: clubRow } = await this.db
          .from('clubs')
          .select('name')
          .eq('id', clubId)
          .maybeSingle();
        if (clubRow?.name) clubName = clubRow.name;
      }

      const participantName = `${participant.firstName} ${participant.lastName}`;

      await EmailService.sendTrialRequestConfirmation({
        participantName,
        participantEmail: participant.email,
        preferredDate: trialTraining.scheduledDate,
        preferredTime: trialTraining.scheduledTime,
        clubName,
      });

      log.info('Participant trial request confirmation sent', { email: participant.email });
    } catch (error) {
      log.error(
        'Failed to send trial request confirmation to participant',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * DOI-Bestätigungsmail für Marketing-Einwilligung — no-op ohne Token
   * (kein Häkchen gesetzt, keine Mail nötig).
   */
  async sendMarketingConsentConfirmationIfNeeded(
    trialTraining: TrialTraining,
    clubId?: string
  ): Promise<void> {
    if (!trialTraining.marketingConsentToken) {
      return;
    }

    const participant = trialTraining.participant;

    try {
      let clubName = 'SwingZ Tennis Club';
      if (clubId) {
        const { data: clubRow } = await this.db
          .from('clubs')
          .select('name')
          .eq('id', clubId)
          .maybeSingle();
        if (clubRow?.name) clubName = clubRow.name;
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://swingz.cloud';
      const confirmUrl = `${baseUrl}/api/public/trial-training/confirm-marketing?token=${trialTraining.marketingConsentToken}`;

      await EmailService.sendMarketingConsentConfirmation({
        participantName: `${participant.firstName} ${participant.lastName}`,
        participantEmail: participant.email,
        clubName,
        confirmUrl,
      });

      log.info('Marketing consent DOI email sent', { email: participant.email });
    } catch (error) {
      log.error(
        'Failed to send marketing consent DOI email',
        error instanceof Error ? error : undefined
      );
    }
  }
}
