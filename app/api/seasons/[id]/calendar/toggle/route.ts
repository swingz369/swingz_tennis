import { NextResponse, type NextRequest } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import {
  toggleGroupWeek,
  bulkToggleGroupWeeks,
} from '@/lib/season-planning/season-calendar.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:calendar:toggle');

export const dynamic = 'force-dynamic';

interface SingleBody {
  group_id?: string;
  week_monday?: string;
  is_active?: boolean;
  reason?: string | null;
}

interface BulkBody {
  group_id?: string;
  week_mondays?: string[];
  is_active?: boolean;
}

function validateIsoMonday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  // 1 = Monday
  return d.getUTCDay() === 1;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(request, context);
}

async function handle(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimit) return rateLimit;

  return withApiAuth(request, async (auth) => {
    if (!verifyRole(auth, 'admin')) {
      return forbiddenResponse('Nur Admins dürfen den Kalender ändern');
    }

    const { id: seasonId } = await context.params;
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id erforderlich' }, { status: 400 });
    }

    let body: SingleBody & BulkBody;
    try {
      body = (await request.json()) as SingleBody & BulkBody;
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
    }

    const isBulk = Array.isArray(body.week_mondays);
    const groupId = body.group_id;
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json({ error: 'group_id erforderlich' }, { status: 400 });
    }
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active (boolean) erforderlich' }, { status: 400 });
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    try {
      if (isBulk) {
        const mondays = (body.week_mondays ?? []).filter(
          (m): m is string => typeof m === 'string' && validateIsoMonday(m)
        );
        if (mondays.length === 0) {
          return NextResponse.json(
            { error: 'Keine gültigen week_mondays übergeben' },
            { status: 400 }
          );
        }
        const result = await bulkToggleGroupWeeks(
          auth.supabase as unknown as Parameters<typeof bulkToggleGroupWeeks>[0],
          seasonId,
          auth.clubId,
          {
            groupId,
            weekMondaYs: mondays,
            isActive: body.is_active,
          }
        );
        return NextResponse.json({ ok: result.ok, affected: result.affected });
      }

      if (!body.week_monday || !validateIsoMonday(body.week_monday)) {
        return NextResponse.json(
          { error: 'week_monday (ISO-Datum eines Montags) erforderlich' },
          { status: 400 }
        );
      }
      const result = await toggleGroupWeek(
        auth.supabase as unknown as Parameters<typeof toggleGroupWeek>[0],
        seasonId,
        auth.clubId,
        {
          groupId,
          weekMonday: body.week_monday,
          isActive: body.is_active,
          reason: body.reason ?? null,
        }
      );
      return NextResponse.json({
        ok: result.ok,
        created: result.created,
        status: result.status,
      });
    } catch (err) {
      log.error('Kalender-Toggle fehlgeschlagen', { err, seasonId, groupId });
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  });
}
