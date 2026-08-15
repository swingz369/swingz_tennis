/**
 * GET/PUT /api/dashboard/preferences
 *
 * Fetch or update the authenticated user's dashboard layout preferences.
 * Supports both 'superadmin' and 'club' dashboard types.
 *
 * GET  ?dashboardType=superadmin|club&clubId=xxx
 * PUT  { dashboardType, clubId?, layout: DashboardWidget[] }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { getDefaultLayout } from '@/lib/dashboard-widgets';
import type { DashboardLayout } from '@/lib/dashboard-widgets';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:dashboard:preferences');

// Supabase client type with the user_dashboard_preferences table.
// The table was added after the last type generation, so we extend inline.

type AnySupabase = any;

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(req.url);
    const dashboardType = searchParams.get('dashboardType') as 'superadmin' | 'club';
    const clubId = searchParams.get('clubId');

    if (!dashboardType || !['superadmin', 'club'].includes(dashboardType)) {
      return NextResponse.json(
        { error: 'dashboardType erforderlich (superadmin|club)' },
        { status: 400 }
      );
    }

    if (dashboardType === 'club' && !clubId) {
      return NextResponse.json(
        { error: 'clubId für Vereins-Dashboard erforderlich' },
        { status: 400 }
      );
    }

    const sb = auth.supabase as AnySupabase;

    const { data, error } = await sb
      .from('user_dashboard_preferences')
      .select('layout')
      .eq('user_id', auth.user.id)
      .eq('dashboard_type', dashboardType)
      .eq('club_id', dashboardType === 'club' ? clubId : null)
      .maybeSingle();

    if (error) {
      log.error('Dashboard preferences fetch error:', error);
      return NextResponse.json(
        { error: 'Präferenzen konnten nicht geladen werden' },
        { status: 500 }
      );
    }

    // Return stored layout or default
    const layout: DashboardLayout = data?.layout ?? getDefaultLayout(dashboardType);

    return NextResponse.json({ layout, dashboardType, clubId });
  });
}

export async function PUT(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const { dashboardType, clubId, layout } = body as {
      dashboardType: 'superadmin' | 'club';
      clubId?: string;
      layout: DashboardLayout;
    };

    if (!dashboardType || !['superadmin', 'club'].includes(dashboardType)) {
      return NextResponse.json(
        { error: 'dashboardType erforderlich (superadmin|club)' },
        { status: 400 }
      );
    }

    if (dashboardType === 'club' && !clubId) {
      return NextResponse.json(
        { error: 'clubId für Vereins-Dashboard erforderlich' },
        { status: 400 }
      );
    }

    if (!Array.isArray(layout)) {
      return NextResponse.json({ error: 'layout muss ein Array sein' }, { status: 400 });
    }

    const sb = auth.supabase as AnySupabase;

    // Upsert: insert or update on conflict (user_id, dashboard_type, club_id)
    const { data, error } = await sb
      .from('user_dashboard_preferences')
      .upsert(
        {
          user_id: auth.user.id,
          dashboard_type: dashboardType,
          club_id: dashboardType === 'club' ? clubId : null,
          layout,
        },
        { onConflict: 'user_id,dashboard_type,club_id' }
      )
      .select('layout')
      .single();

    if (error) {
      log.error('Dashboard preferences save error:', error);
      return NextResponse.json(
        { error: 'Präferenzen konnten nicht gespeichert werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({ layout: data.layout, saved: true });
  });
}
