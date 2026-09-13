// GET  /api/seasons/[id]/billing — Billing preview
// PUT  /api/seasons/[id]/billing — Update billing config
// POST /api/seasons/[id]/billing — Generate invoices

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { SeasonBillingService } from '@/application/services/season-billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:billing');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      // Tenant isolation: verifyRole() alone checks only the caller's GLOBAL
      // role, not membership in THIS season's club — an admin of club A could
      // otherwise read club B's billing preview. authorizeSeasonAccess()
      // checks the caller's membership against season.club_id.
      const access = await authorizeSeasonAccess(auth, seasonId, { allowedRoles: ['admin'] });
      if (!access.ok) return access.response;

      const preview = await new SeasonBillingService(auth).calculatePreview(seasonId);
      return NextResponse.json(preview);
    } catch (error) {
      log.error('GET billing preview error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      const access = await authorizeSeasonAccess(auth, seasonId, { allowedRoles: ['admin'] });
      if (!access.ok) return access.response;

      const body = await request.json();
      const config = await new SeasonBillingService(auth).upsertConfig(
        seasonId,
        access.season.club_id,
        body
      );
      return NextResponse.json(config);
    } catch (error) {
      log.error('PUT billing config error:', error);
      return internalErrorResponse();
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      const access = await authorizeSeasonAccess(auth, seasonId, { allowedRoles: ['admin'] });
      if (!access.ok) return access.response;

      const result = await new SeasonBillingService(auth).generateInvoices(seasonId);
      return NextResponse.json(result);
    } catch (error) {
      log.error('POST generate invoices error:', error);
      return internalErrorResponse();
    }
  });
}
