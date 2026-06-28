/**
 * GET /api/admin/bookings — Admin booking list with filters
 * PATCH /api/admin/bookings — Admin booking actions (no_show, cancel)
 *
 * Requires admin or superadmin role.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import {
  unwrapJoin,
  DEFAULT_COURT,
  DEFAULT_USER,
  DEFAULT_TRAINER,
  type DefaultCourtShape,
  type DefaultUserShape,
  type DefaultTrainerShape,
} from '@/lib/typed-helpers';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:bookings');

// Row type aliases from generated Supabase types
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type CourtJoin = DefaultCourtShape;
type SessionJoin = {
  id: string;
  timeslot_start: string;
  timeslot_end: string;
  trainer_id: string | null;
  session_type: string | null;
  notes: string | null;
  schedule_id: string;
  max_participants: number | null;
  courts: CourtJoin | CourtJoin[] | null;
};
type UserJoin = DefaultUserShape;
type TrainerJoin = DefaultTrainerShape;
type BookingWithJoins = BookingRow & {
  courts: CourtJoin | CourtJoin[] | null;
  sessions: SessionJoin | SessionJoin[] | null;
  users: UserJoin | UserJoin[] | null;
};
type SessionWithJoins = Database['public']['Tables']['sessions']['Row'] & {
  schedules: { club_id: string } | { club_id: string }[] | null;
  courts: CourtJoin | CourtJoin[] | null;
  trainers: TrainerJoin | TrainerJoin[] | null;
};

// Flat response shape consumed by the admin UI
type AdminBookingEntry = {
  id: string;
  source: 'booking' | 'season_plan';
  status: string;
  session_start_time: string | null;
  start_time: string | null;
  end_time: string | null;
  payment_status: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  booked_at: string | null;
  court_id: string | null;
  court_name: string;
  court_surface: string | null;
  court_number: number | null;
  session_id: string | null;
  session_type: string;
  session_notes: string | null;
  session_trainer_id: string | null;
  session_max_participants: number | null;
  member_name: string;
  member_email: string;
  member_id: string;
  trainer_name: string | null;
  group_ids: string[] | null;
  week_number: number | null;
};

// ─── GET: List bookings ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const memberId = searchParams.get('memberId'); // filter by specific member (user_id)
    const status = searchParams.get('status'); // pending | confirmed | cancelled | no_show
    const courtId = searchParams.get('courtId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search'); // member name or email search
    const sort = searchParams.get('sort') || 'session_start_time';
    const order = searchParams.get('order') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const supabase = auth.supabase as SupabaseClient<Database>;

    // Build query with joins to courts and users for rich display data
    let query = supabase
      .from('bookings')
      .select(
        `
        id,
        status,
        member_id,
        court_id,
        session_id,
        session_start_time,
        start_time,
        end_time,
        payment_status,
        notes,
        cancelled_at,
        cancellation_reason,
        booked_at,
        courts(name, surface, number),
        sessions(
          id,
          timeslot_start,
          timeslot_end,
          trainer_id,
          session_type,
          notes,
          schedule_id,
          max_participants,
          courts(name)
        ),
        users(
          id,
          email,
          full_name
        )
      `,
        { count: 'exact' }
      )
      .eq('club_id', clubId);

    // Apply filters
    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    if (status) {
      query = query.eq('status', status);
    } else {
      // Default: exclude cancelled to keep list clean, but include on explicit filter
      query = query.neq('status', 'cancelled');
    }

    if (courtId) {
      query = query.eq('court_id', courtId);
    }

    if (dateFrom) {
      query = query.gte('session_start_time', dateFrom);
    }

    if (dateTo) {
      query = query.lte('session_start_time', `${dateTo}T23:59:59`);
    }

    // Apply sorting
    const allowedSorts = ['session_start_time', 'start_time', 'status', 'booked_at'] as const;
    type AllowedSort = (typeof allowedSorts)[number];
    const sortCol: AllowedSort = (allowedSorts as readonly string[]).includes(sort)
      ? (sort as AllowedSort)
      : 'session_start_time';
    const sortOrder = order === 'asc' ? true : false;
    query = query.order(sortCol, { ascending: sortOrder });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      log.error('Admin bookings fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the nested Supabase response into a flat, frontend-friendly shape
    const typedBookings = (bookings ?? []) as BookingWithJoins[];
    const flat: AdminBookingEntry[] = typedBookings.map((b) => {
      const court = unwrapJoin(b.courts) ?? DEFAULT_COURT;
      const joinedSession = unwrapJoin(b.sessions);
      // Fallback: derive a SessionJoin-shaped object from the booking's own time fields
      const session: SessionJoin = joinedSession ?? {
        id: b.session_id,
        timeslot_start: b.session_start_time,
        timeslot_end: b.end_time ?? b.session_start_time,
        trainer_id: null,
        session_type: 'training',
        notes: b.notes,
        schedule_id: b.schedule_id,
        max_participants: null,
        courts: null,
      };
      const member = unwrapJoin(b.users) ?? DEFAULT_USER;
      const sessionCourt = unwrapJoin(session.courts) ?? DEFAULT_COURT;

      return {
        id: b.id,
        source: 'booking' as const,
        status: b.status,
        session_start_time: b.session_start_time,
        start_time: b.start_time,
        end_time: b.end_time,
        payment_status: b.payment_status,
        notes: b.notes,
        cancelled_at: b.cancelled_at,
        cancellation_reason: b.cancellation_reason,
        booked_at: b.booked_at,
        // Court info
        court_id: b.court_id,
        court_name: court.name || sessionCourt.name || '—',
        court_surface: court.surface,
        court_number: court.number,
        // Session info
        session_id: b.session_id,
        session_type: session.session_type || 'training',
        session_notes: session.notes,
        session_trainer_id: session.trainer_id,
        session_max_participants: session.max_participants,
        // Member info
        member_name: member.full_name || member.email?.split('@')[0] || '—',
        member_email: member.email || '—',
        member_id: b.member_id,
        // Season plan fields (not applicable for bookings)
        trainer_name: null,
        group_ids: null,
        week_number: null,
      };
    });

    // ── Also fetch season plan sessions (sessions without bookings) ──────
    const bookedSessionIds = new Set(
      flat.map((b) => b.session_id).filter((id): id is string => Boolean(id))
    );
    let seasonPlanEntries: AdminBookingEntry[] = [];

    try {
      let sessionQuery = supabase
        .from('sessions')
        .select(
          `
          id,
          timeslot_start,
          timeslot_end,
          trainer_id,
          court_id,
          group_ids,
          max_participants,
          notes,
          created_at,
          week_number,
          schedules!inner(club_id),
          courts(name, surface, number),
          trainers(name)
        `,
          { count: 'exact' }
        )
        .eq('schedules.club_id', clubId);

      if (dateFrom) {
        sessionQuery = sessionQuery.gte('timeslot_start', dateFrom);
      }
      if (dateTo) {
        sessionQuery = sessionQuery.lte('timeslot_start', `${dateTo}T23:59:59`);
      }
      if (courtId) {
        sessionQuery = sessionQuery.eq('court_id', courtId);
      }

      const { data: rawSessions, error: sessionErr } = await sessionQuery;

      if (sessionErr) {
        log.error('Season sessions fetch error:', sessionErr);
      } else if (rawSessions) {
        const typedRawSessions = rawSessions as SessionWithJoins[];
        // Only include sessions that have no bookings (not already shown)
        seasonPlanEntries = typedRawSessions
          .filter((s) => !bookedSessionIds.has(s.id))
          .map((s) => {
            const court = unwrapJoin(s.courts) ?? DEFAULT_COURT;
            const trainer = unwrapJoin(s.trainers) ?? DEFAULT_TRAINER;
            const startTime = s.timeslot_start
              ? new Date(s.timeslot_start).toTimeString().substring(0, 5)
              : null;
            const endTime = s.timeslot_end
              ? new Date(s.timeslot_end).toTimeString().substring(0, 5)
              : null;

            return {
              id: s.id,
              source: 'season_plan' as const,
              status: 'scheduled',
              session_start_time: s.timeslot_start,
              start_time: startTime,
              end_time: endTime,
              payment_status: null,
              notes: s.notes,
              cancelled_at: null,
              cancellation_reason: null,
              booked_at: s.created_at,
              // Court info
              court_id: s.court_id,
              court_name: court.name || '—',
              court_surface: court.surface,
              court_number: court.number,
              // Session info
              session_id: s.id,
              session_type: 'training',
              session_notes: s.notes,
              session_trainer_id: s.trainer_id,
              session_max_participants: s.max_participants,
              // Member info (not applicable for season plan)
              member_name: '—',
              member_email: '—',
              member_id: '',
              // Season plan fields
              trainer_name: trainer.name || '—',
              group_ids: (s.group_ids as string[] | null) || [],
              week_number: s.week_number,
            };
          });
      }
    } catch (err) {
      log.error('Season sessions fetch exception:', err);
    }

    // Merge bookings and season plan entries
    const allEntries: AdminBookingEntry[] = [...flat, ...seasonPlanEntries];

    // Apply member search filter client-side (Supabase doesn't support cross-table text search easily)
    let filtered = allEntries;
    if (search) {
      const q = search.toLowerCase();
      filtered = allEntries.filter(
        (b) =>
          b.member_name.toLowerCase().includes(q) ||
          b.member_email.toLowerCase().includes(q) ||
          b.court_name.toLowerCase().includes(q) ||
          (b.trainer_name !== null && b.trainer_name.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({
      bookings: filtered,
      total: count ?? 0,
      filtered: filtered.length,
      seasonPlanCount: seasonPlanEntries.length,
    });
  });
}

// ─── PATCH: Admin booking actions ──────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const body = (await req.json().catch(() => null)) as {
      bookingId?: string;
      action?: string;
      reason?: string;
      newSessionId?: string;
    } | null;
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { bookingId, action, reason, newSessionId } = body;
    if (!bookingId || !action) {
      return NextResponse.json({ error: 'bookingId and action required' }, { status: 400 });
    }

    const validActions = ['cancel', 'no_show', 'confirm', 'reschedule'] as const;
    type ValidAction = (typeof validActions)[number];
    if (!(validActions as readonly string[]).includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const supabase = auth.supabase as SupabaseClient<Database>;
    const typedAction = action as ValidAction;

    // Handle reschedule separately — needs session lookup first
    if (typedAction === 'reschedule') {
      if (!newSessionId) {
        return NextResponse.json(
          { error: 'newSessionId required for reschedule' },
          { status: 400 }
        );
      }
      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .select('id, timeslot_start, timeslot_end')
        .eq('id', newSessionId)
        .single();
      if (sessErr || !session) {
        return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
      }
      const { error } = await supabase
        .from('bookings')
        .update({ session_id: newSessionId, session_start_time: session.timeslot_start })
        .eq('id', bookingId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, bookingId, action });
    }

    const updates: {
      status: string;
      cancelled_at?: string;
      cancellation_reason?: string;
    } = { status: '' };

    switch (typedAction) {
      case 'cancel':
        updates.status = 'cancelled';
        updates.cancelled_at = new Date().toISOString();
        updates.cancellation_reason = reason || 'admin_cancellation';
        break;
      case 'no_show':
        updates.status = 'no_show';
        break;
      case 'confirm':
        updates.status = 'confirmed';
        break;
    }

    const { error } = await supabase.from('bookings').update(updates).eq('id', bookingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookingId, action });
  });
}
