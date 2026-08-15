import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzlePricingRuleRepository } from '@/infrastructure/persistence/repositories/pricing-rule.repository';
import { ClubId, CourtId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pricing-rules:calculate');

const repo = new DrizzlePricingRuleRepository();

// GET /api/pricing-rules/calculate?clubId=...&courtId=...&startTime=...&dayOfWeek=...&bookingHours=...
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');
    const courtId = url.searchParams.get('courtId');
    const memberType = url.searchParams.get('memberType');
    const bookingHours = url.searchParams.get('bookingHours');
    const advanceDays = url.searchParams.get('advanceDays');
    const startTime = url.searchParams.get('startTime');
    const dayOfWeek = url.searchParams.get('dayOfWeek');
    const seasonId = url.searchParams.get('seasonId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    try {
      const result = await repo.calculatePrice(ClubId.fromString(clubId), {
        courtId: courtId ? CourtId.fromString(courtId) : undefined,
        memberType: memberType || undefined,
        bookingHours: bookingHours ? Number(bookingHours) : undefined,
        advanceDays: advanceDays ? Number(advanceDays) : undefined,
        startTime: startTime ? new Date(startTime) : undefined,
        dayOfWeek: dayOfWeek !== null ? Number(dayOfWeek) : undefined,
        seasonId: seasonId || undefined,
      });

      return NextResponse.json({
        pricePerHour: result.pricePerHour,
        multiplier: result.multiplier,
        effectivePricePerHour: +(result.pricePerHour * result.multiplier).toFixed(2),
        ruleId: result.ruleId,
        source: result.source,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error calculating price:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
