import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:work-duties:bulk');

/**
 * POST /api/work-duties/bulk
 *
 * Bulk-create work duties from a template over a date range.
 *
 * Body:
 *   template: { title, description?, duty_type, start_time?, end_time?, max_participants?, priority?, notes? }
 *   start_date: string (YYYY-MM-DD)
 *   end_date: string (YYYY-MM-DD)
 *   recurrence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'weekdays'
 *   weekdays?: number[] — 0=Sun, 1=Mon, … 6=Sat (required when recurrence='weekdays')
 *   exclude_dates?: string[] — dates to skip (holidays etc.)
 */
export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, {
      max: 10,
      windowMs: 3600000, // 10 per hour
    });
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const hasRole = await verifyRole(auth, 'admin');
      if (!hasRole) return forbiddenResponse('Admin access required');

      const clubId = auth.clubId;
      if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

      try {
        const body = await request.json();
        const { template, start_date, end_date, recurrence, weekdays, exclude_dates } = body as {
          template: {
            title: string;
            description?: string;
            duty_type: string;
            start_time?: string;
            end_time?: string;
            max_participants?: number;
            priority?: string;
            notes?: string;
          };
          start_date: string;
          end_date: string;
          recurrence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'weekdays';
          weekdays?: number[];
          exclude_dates?: string[];
        };

        // ── Validate ──
        if (!template?.title || !template?.duty_type) {
          return NextResponse.json(
            { error: 'Template title and duty_type required' },
            { status: 400 }
          );
        }
        if (!start_date || !end_date) {
          return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });
        }
        if (!recurrence) {
          return NextResponse.json({ error: 'recurrence required' }, { status: 400 });
        }
        if (recurrence === 'weekdays' && (!weekdays || weekdays.length === 0)) {
          return NextResponse.json(
            { error: 'weekdays array required for weekday recurrence' },
            { status: 400 }
          );
        }

        const start = new Date(start_date);
        const end = new Date(end_date);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }
        if (start > end) {
          return NextResponse.json(
            { error: 'start_date must be before end_date' },
            { status: 400 }
          );
        }

        // ── Generate dates ──
        const dates: string[] = [];
        const exclude = new Set(exclude_dates ?? []);
        const maxDuties = 365; // safety limit
        const d = new Date(start);

        while (d <= end && dates.length < maxDuties) {
          const dateStr = d.toISOString().split('T')[0];
          const dow = d.getDay(); // 0=Sun

          let include = false;
          switch (recurrence) {
            case 'daily':
              include = true;
              break;
            case 'weekly':
              include = dow === start.getDay();
              break;
            case 'biweekly':
              include = dow === start.getDay();
              break;
            case 'monthly':
              include = d.getDate() === start.getDate();
              break;
            case 'weekdays':
              include = weekdays!.includes(dow);
              break;
          }

          if (include && !exclude.has(dateStr)) {
            dates.push(dateStr);
          }

          // Advance: biweekly skips 14 days after a match, otherwise +1
          if (recurrence === 'biweekly' && include) {
            d.setDate(d.getDate() + 14);
          } else {
            d.setDate(d.getDate() + 1);
          }
        }

        if (dates.length === 0) {
          return NextResponse.json(
            { error: 'No dates generated — check your date range and recurrence settings' },
            { status: 400 }
          );
        }

        // ── Insert duties ──
        const rows = dates.map((date) => ({
          club_id: clubId,
          title: template.title,
          description: template.description ?? null,
          duty_type: template.duty_type,
          scheduled_date: date,
          start_time: template.start_time ?? null,
          end_time: template.end_time ?? null,
          max_participants: template.max_participants ?? 1,
          priority: template.priority ?? 'medium',
          notes: template.notes ?? null,
        }));

        const { data, error } = await (auth.supabase as any)
          .from('work_duties')
          .insert(rows)
          .select('id, scheduled_date');

        if (error) {
          log.error('[WorkDuties Bulk POST] Error:', error);
          return NextResponse.json({ error: 'Failed to create duties' }, { status: 500 });
        }

        return NextResponse.json(
          {
            created: data?.length ?? 0,
            dates: (data ?? []).map((r: { scheduled_date: string }) => r.scheduled_date),
          },
          { status: 201 }
        );
      } catch (err) {
        log.error('[WorkDuties Bulk POST] Error:', err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed' },
          { status: 500 }
        );
      }
    });
  });
}
