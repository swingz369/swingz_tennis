/**
 * POST /api/bookings/check
 *
 * Vorprüfung für den Buchungsdialog: gleiche Regeln wie POST /api/bookings/direct, aber
 * ohne etwas anzulegen. Liefert Verbrauch (Tag/Woche/offen) und ob die Buchung durchgeht.
 * Die Buchung selbst prüft nochmals — diese Antwort ist Komfort, keine Freigabe.
 *
 * Body: { courtId, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), clubId, memberId? }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { loadBookingRules, checkBookingRules } from '@/lib/booking/booking-rules';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';
import { resolveEffectiveMemberId } from '@/lib/family/family-auth';
import { berlinDateTime } from '@/lib/berlin-time';

const BodySchema = z.object({
  courtId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  clubId: z.string().uuid(),
  memberId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
    const { courtId, date, startTime, endTime, clubId, memberId } = parsed.data;

    if (!verifyClubAccess(auth, clubId)) return forbiddenResponse('Kein Zugriff auf diesen Verein');

    const resolution = await resolveEffectiveMemberId(auth.user.id, memberId);
    if (resolution.error) return NextResponse.json({ error: resolution.error }, { status: 403 });

    const start = berlinDateTime(date, startTime);
    const end = berlinDateTime(date, endTime);
    if (end <= start) {
      return NextResponse.json({ allowed: false, error: 'Ungültiger Zeitraum' });
    }

    const db = createServiceClient();
    const [{ data: club }, { data: court }] = await Promise.all([
      db.from('clubs').select('opening_hours').eq('id', clubId).maybeSingle(),
      db.from('courts').select('id').eq('id', courtId).eq('club_id', clubId).maybeSingle(),
    ]);
    if (!court) return NextResponse.json({ error: 'Platz nicht gefunden' }, { status: 404 });
    if (isDayClosed(club?.opening_hours, start)) {
      return NextResponse.json({ allowed: false, error: CLOSED_DAY_ERROR });
    }

    const rules = await loadBookingRules(db, clubId);
    const check = await checkBookingRules({
      db,
      rules,
      clubId,
      memberId: resolution.effectiveMemberId,
      start,
      end,
      kind: 'court',
    });

    return NextResponse.json(
      check.ok
        ? {
            allowed: true,
            usage: check.usage,
            requiresApproval: check.requiresApproval,
            requiresPayment: check.requiresPayment,
          }
        : { allowed: false, error: check.error, usage: check.usage }
    );
  });
}
