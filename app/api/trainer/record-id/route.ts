// GET /api/trainer/record-id
// Liefert die trainers.id des angemeldeten Nutzers — oder null, wenn er kein
// Trainer ist. Ersetzt den bisherigen direkten Supabase-Zugriff aus dem
// Platzkalender (ADR-005-Verstoß: Auflösung per E-Mail-Textvergleich statt ID,
// siehe docs/ARCHIV/2026-09-17-ux-analyse-und-sanierungsprompt.md § 2.3).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveTrainerRecordId } from '@/lib/trainers/trainer-record';
import { internalErrorResponse } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const trainerId = await resolveTrainerRecordId(auth.user.id);
      return NextResponse.json({ trainerId });
    } catch {
      return internalErrorResponse();
    }
  });
}
