// GET /api/seasons/[id]/billing — Billing preview
// PUT /api/seasons/[id]/billing — Update billing config

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { seasonBillingService } from '@/lib/billing/season-billing.service';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons } from '@/src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      if (!isAdmin) return forbiddenResponse('Nur Admins');

      const preview = await seasonBillingService.calculatePreview(seasonId);
      return NextResponse.json(preview);
    } catch (error) {
      console.error('GET billing preview error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Preview failed' },
        { status: 500 }
      );
    }
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      if (!isAdmin) return forbiddenResponse('Nur Admins');

      const body = await request.json();
      const config = await seasonBillingService.upsertConfig(seasonId, season.club_id, body);
      return NextResponse.json(config);
    } catch (error) {
      console.error('PUT billing config error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Config update failed' },
        { status: 500 }
      );
    }
  });
}
