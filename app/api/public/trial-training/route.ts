import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { trialTrainingService } from '@/src/application/services/trial-training-service.adapter';
import type { CreateTrialTrainingInput } from '@/src/domain/entities/trial-training.entity';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:public:trial-training');

const publicTrialTrainingSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().min(5, 'Telefonnummer erforderlich'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Geburtsdatum (YYYY-MM-DD)'),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum (YYYY-MM-DD)'),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ungültige Uhrzeit (HH:MM)'),
  experienceLevel: z.string().optional(),
  notes: z.string().max(2000).optional(),
  clubId: z.string().uuid('Ungültige Club-ID').optional(),
});

export async function POST(request: NextRequest) {
  // Rate limiting — public endpoint, protect against abuse
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.BOOKING);
  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const body = await request.json();

    const validation = publicTrialTrainingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validierung fehlgeschlagen',
          details: validation.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      preferredDate,
      preferredTime,
      experienceLevel,
      notes,
      clubId,
    } = validation.data;

    // Build notes with experience level if provided
    const combinedNotes = [experienceLevel ? `Spielstärke: ${experienceLevel}` : null, notes]
      .filter(Boolean)
      .join(' | ');

    const input: CreateTrialTrainingInput = {
      participant: {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
      },
      scheduledDate: preferredDate,
      scheduledTime: preferredTime,
      duration: 60, // Default 60 minutes for trial
      trainerId: '00000000-0000-0000-0000-000000000000', // Placeholder — admin assigns later
      courtId: '00000000-0000-0000-0000-000000000000', // Placeholder — admin assigns later
      ...(combinedNotes ? { notes: combinedNotes } : {}),
    };

    const trialTraining = await trialTrainingService.createPublicTrialTraining(input, clubId || '');

    // Notify club admins — fire-and-forget (don't block the response)
    trialTrainingService
      .notifyAdminsOfNewRequest(trialTraining, clubId || '')
      .catch((err) => log.error('Admin notification failed:', err));

    return NextResponse.json(
      {
        success: true,
        message:
          'Vielen Dank! Deine Probetraining-Anfrage wurde eingereicht. Wir melden uns in Kürze mit einer Bestätigung.',
        trialTrainingId: trialTraining.id,
      },
      { status: 201 }
    );
  } catch (error) {
    log.error('Public trial training creation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Interner Serverfehler',
      },
      { status: 500 }
    );
  }
}
