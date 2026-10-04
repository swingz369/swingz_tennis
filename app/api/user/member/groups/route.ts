import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { SeasonPlanService } from '@/application/services/season-plan.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:user:member:groups');

/**
 * GET /api/user/member/groups[?clubId=...]
 *
 * Die Trainingsgruppen des angemeldeten Mitglieds.
 *
 * Die Route las früher `training_group_memberships` — eine Tabelle, die die
 * Saisonplanung nie beschreibt (sie füllt `season_plan_entries.expected_participants`
 * und `bookings`). Sie lieferte deshalb für jedes Mitglied eine leere Liste, und
 * keine Oberfläche rief sie auf. Grundlage ist jetzt der Saisonplan, dieselbe
 * Quelle, aus der auch Trainer-Ansicht und Abrechnung lesen.
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // clubId ist optional: Für Mitglieder mit genau einem Verein steht er im
    // Auth-Kontext, ein Parameter ist dann überflüssig.
    const clubId = req.nextUrl.searchParams.get('clubId') ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }

    try {
      const groupList = await new SeasonPlanService(auth).memberGroups(clubId);

      return NextResponse.json({
        groups: groupList,
        // Rückwärtskompatibel: die alte Antwortform war eine reine ID-Liste.
        groupIds: groupList.map((g) => g.id).filter(Boolean),
      });
    } catch (error) {
      log.error('Gruppen des Mitglieds konnten nicht geladen werden', error);
      return NextResponse.json(
        { error: 'Gruppenmitgliedschaften konnten nicht geladen werden' },
        { status: 500 }
      );
    }
  });
}
