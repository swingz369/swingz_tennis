import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/infrastructure/persistence/db';
import { clubs } from '@/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';
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
    const hasAccess = auth.role === 'superadmin' || auth.clubId === (await params).id;
    if (!hasAccess) return forbiddenResponse('No access to this club');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { id } = await params;
      const result = await db
        .select({ features: clubs.features })
        .from(clubs)
        .where(eq(clubs.id, id))
        .limit(1);

      const row = result[0];
      if (!row) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }

      return NextResponse.json({ features: sanitizeFeatureFlags(row.features) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error getting club features:', error);
      return NextResponse.json({ error: message }, { status: 500 });
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
    const hasAccess = auth.role === 'superadmin' || auth.clubId === id;
    if (!isAdmin || !hasAccess) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    const parsed = PutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload — expected { [featureKey]: boolean }' },
        { status: 400 }
      );
    }

    const sanitized = sanitizeFeatureFlags(parsed.data);

    try {
      await db
        .update(clubs)
        .set({ features: sanitized, updated_at: new Date() })
        .where(eq(clubs.id, id));

      return NextResponse.json({ features: sanitized });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error updating club features:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
