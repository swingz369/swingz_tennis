import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { sanitizeFeatureFlags } from '@/lib/features';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]:features');

/**
 * GET /api/clubs/[id]/features
 * Returns the feature-flag map for the requested club.
 * Access: any authenticated member of the club.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const { id } = await params;
    if (!verifyClubAccess(auth, id)) return forbiddenResponse('Kein Zugriff auf diesen Verein');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { data } = await createServiceClient()
        .from('clubs')
        .select('features')
        .eq('id', id)
        .maybeSingle();

      if (!data) return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 });
      return NextResponse.json({
        features: sanitizeFeatureFlags(data.features as Record<string, unknown> | null | undefined),
      });
    } catch (error) {
      log.error('Error getting club features', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

const PutBodySchema = z.record(z.string(), z.boolean());

/**
 * PUT /api/clubs/[id]/features
 * Updates the feature-flag map for the requested club.
 * Access: club admin only. Core features cannot be disabled — the
 * server forces them back to true regardless of the payload.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const { id } = await params;
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin || !verifyClubAccess(auth, id)) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    const parsed = PutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültiger Payload — erwartet { [featureKey]: boolean }' },
        { status: 400 }
      );
    }

    const sanitized = sanitizeFeatureFlags(parsed.data);

    try {
      const { error } = await createServiceClient()
        .from('clubs')
        .update({ features: sanitized, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ features: sanitized });
    } catch (error) {
      log.error('Error updating club features', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}
