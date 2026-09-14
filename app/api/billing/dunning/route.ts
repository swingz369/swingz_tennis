import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { getUserDb } from '@/infrastructure/db';
import { DunningService } from '@/application/services/dunning.service';

export const dynamic = 'force-dynamic';
const log = createLogger('api:billing:dunning');

/**
 * GET /api/billing/dunning?clubId=...
 *
 * Liefert Mahnläufe + Kennzahlen für die Mahnlauf-Dashboard-Komponente.
 *
 * Auth: nur Admin/Superadmin des Vereins — RLS auf dunning_records erlaubt
 * ohnehin nur Admins den vollen Mahnlauf-Überblick des Clubs.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    if (!clubId) {
      return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });
    }

    try {
      const service = new DunningService(getUserDb(auth));
      const { records, kpis } = await service.getDashboardData(clubId);
      return NextResponse.json({ records, kpis });
    } catch (error) {
      log.error('Mahnläufe konnten nicht geladen werden', {
        error: safeErrorMessage(error),
      });
      return internalErrorResponse();
    }
  });
}
