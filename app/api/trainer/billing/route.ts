/**
 * GET /api/trainer/billing — Honorarabrechnungen des angemeldeten Trainers.
 *
 * Bewusst ohne `trainerId`-Parameter: die Trainer-ID kommt aus der Session.
 * Der bestehende Admin-Endpoint `/api/billing/trainers` akzeptiert eine frei
 * wählbare `trainerId` und liefert ohne Parameter *alle* Abrechnungen — für
 * eine Self-Service-Ansicht ist er darum nicht verwendbar.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { resolveTrainerRecordId } from '@/lib/trainers/trainer-record';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer:billing');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      // Auflösung über `trainers.user_id` (siehe /api/trainer/me) — nicht über
      // die E-Mail-Adresse, die bei einer Adressänderung auseinanderläuft.
      const trainerId = await resolveTrainerRecordId(auth.user.id);
      if (!trainerId) {
        return NextResponse.json(
          { error: 'Kein Trainerprofil zu diesem Konto gefunden.' },
          { status: 404 }
        );
      }

      const trainerBillings = await new BillingService(auth).getTrainerBillingsByTrainerId(
        trainerId
      );
      return NextResponse.json({ trainerBillings });
    } catch (error) {
      log.error('Trainer billing fetch failed', error instanceof Error ? error : undefined);
      return NextResponse.json(
        { error: 'Abrechnung konnte nicht geladen werden.' },
        { status: 500 }
      );
    }
  });
}
