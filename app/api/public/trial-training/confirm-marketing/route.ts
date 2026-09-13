import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrialTrainingService } from '@/application/services/trial-training.service';
import { systemDb } from '@/infrastructure/db';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';

const log = createLogger('api:public:trial-training:confirm-marketing');

/**
 * Public double opt-in (DOI) confirmation endpoint for marketing consent.
 * No auth — reached via a link in the DOI email sent after trial-training
 * signup. Confirms consent and invalidates the single-use token so it
 * cannot be replayed. Does not send or trigger any marketing email itself —
 * it only flips the confirmed-consent flag for future use.
 */
export async function GET(request: NextRequest) {
  // Rate limiting — public, unauthenticated endpoint, protect against token-guessing abuse
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
  if (rateLimitError) {
    return rateLimitError;
  }

  const baseUrl = appBaseUrl();

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${baseUrl}/trial-training?consent=invalid`);
  }

  try {
    const trialTrainingService = new TrialTrainingService(
      systemDb('öffentlicher DOI-Bestätigungslink, kein Login')
    );
    const confirmed = await trialTrainingService.confirmMarketingConsent(token);

    return NextResponse.redirect(
      `${baseUrl}/trial-training?consent=${confirmed ? 'confirmed' : 'invalid'}`
    );
  } catch (error) {
    log.error('Marketing consent confirmation error', error instanceof Error ? error : undefined);
    return NextResponse.redirect(`${baseUrl}/trial-training?consent=error`);
  }
}
