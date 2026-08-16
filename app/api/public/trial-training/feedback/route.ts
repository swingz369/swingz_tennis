import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:public:trial-training:feedback');

const feedbackSchema = z.object({
  participantId: z.string().uuid('Ungültige Teilnehmer-ID'),
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(2000).optional(),
  wouldRecommend: z.boolean(),
});

/**
 * Öffentliche Feedback-Abgabe nach einem Probetraining — kein Auth nötig,
 * der Zugriff läuft über die undurchsichtige `participant_id` aus dem
 * Follow-up-Link. Erlaubt ist Feedback nur für abgeschlossene/konvertierte
 * Probetrainings.
 */
export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
  if (rateLimitError) return rateLimitError;

  const body = await request.json().catch(() => null);
  const validation = feedbackSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
  }

  const { participantId, rating, comments, wouldRecommend } = validation.data;

  try {
    const svc = createServiceClient();
    const { data: trial, error: trialError } = await svc
      .from('trial_trainings')
      .select('id, status')
      .eq('participant_id', participantId)
      .maybeSingle();

    if (trialError || !trial) {
      return NextResponse.json({ error: 'Probetraining nicht gefunden' }, { status: 404 });
    }

    if (trial.status !== 'completed' && trial.status !== 'converted') {
      return NextResponse.json(
        { error: 'Feedback ist erst nach einem abgeschlossenen Probetraining möglich' },
        { status: 400 }
      );
    }

    const { error: updateError } = await svc
      .from('trial_trainings')
      .update({
        feedback_rating: rating,
        feedback_comments: comments?.trim() || null,
        feedback_would_recommend: wouldRecommend,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trial.id);

    if (updateError) {
      log.error('Trial feedback update error', updateError);
      return NextResponse.json(
        { error: 'Feedback konnte nicht gespeichert werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Trial feedback error', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
