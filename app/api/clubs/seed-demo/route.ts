/**
 * POST /api/clubs/seed-demo — Creates "TC Demo" with season, courts, and groups.
 * Superadmin-only. Idempotent: returns existing club if already seeded.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:seed-demo');

const DEMO_CLUB_NAME = 'TC Demo';

const OPENING_HOURS = {
  monday: { open: '08:00', close: '22:00' },
  tuesday: { open: '08:00', close: '22:00' },
  wednesday: { open: '08:00', close: '22:00' },
  thursday: { open: '08:00', close: '22:00' },
  friday: { open: '08:00', close: '22:00' },
  saturday: { open: '08:00', close: '20:00' },
  sunday: { open: '09:00', close: '18:00' },
};

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'superadmin');
    if (!hasRole) return forbiddenResponse('Superadmin access required');

    const sb = createServiceClient();

    // Idempotent: return existing demo club if already seeded
    const { data: existing } = await sb
      .from('clubs')
      .select('id, name')
      .eq('name', DEMO_CLUB_NAME)
      .maybeSingle();

    if (existing) {
      log.info('Demo club already exists', { clubId: existing.id });
      return NextResponse.json({ clubId: existing.id, name: existing.name, created: false });
    }

    // 1. Create club
    const { data: club, error: clubErr } = await sb
      .from('clubs')
      .insert({
        name: DEMO_CLUB_NAME,
        slug: 'tc-demo',
        description: 'Demonstrationsverein für Sales-Demos und Tests.',
        max_members: 150,
        opening_hours: OPENING_HOURS,
        default_hourly_rate: '18.00',
        bundesland: 'Bayern',
        founding_date: '1985-04-12',
        status: 'active',
        features: {
          members: true,
          trainers: true,
          seasons: true,
          finance: true,
          shop: true,
          tournaments: true,
          trial_training: true,
          ai_matchmaking: true,
          weather_integration: true,
          league_lineup: false,
          work_duty: false,
        },
        setup_completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (clubErr || !club) {
      log.error('Failed to create demo club', clubErr instanceof Error ? clubErr : undefined);
      return NextResponse.json({ error: 'Fehler beim Anlegen des Demo-Vereins' }, { status: 500 });
    }

    const clubId = club.id;
    log.info('Demo club created', { clubId });

    // 2. Add superadmin as club admin
    await sb.from('user_club_memberships').upsert(
      {
        user_id: auth.user.id,
        club_id: clubId,
        role: 'superadmin',
        is_active: true,
        include_in_planning: false,
      },
      { onConflict: 'user_id,club_id' }
    );

    // 3. Create courts (4 outdoor clay, 2 indoor hard)
    const courtData = [
      { name: 'Platz 1', surface: 'clay', has_indoor: false, has_lighting: true, number: 1 },
      { name: 'Platz 2', surface: 'clay', has_indoor: false, has_lighting: true, number: 2 },
      { name: 'Platz 3', surface: 'clay', has_indoor: false, has_lighting: false, number: 3 },
      { name: 'Platz 4', surface: 'clay', has_indoor: false, has_lighting: false, number: 4 },
      { name: 'Halle 1', surface: 'hard', has_indoor: true, has_lighting: true, number: 5 },
      { name: 'Halle 2', surface: 'hard', has_indoor: true, has_lighting: true, number: 6 },
    ];
    await sb.from('courts').insert(courtData.map((c) => ({ ...c, club_id: clubId })));

    // 4. Create current season (Sommer 2026)
    const { data: season } = await sb
      .from('seasons')
      .insert({
        club_id: clubId,
        name: 'Sommer 2026',
        season_type: 'summer',
        year: 2026,
        start_date: '2026-05-01',
        end_date: '2026-09-30',
        planning_status: 'published',
        preferences_open: false,
      })
      .select('id')
      .single();

    if (season) {
      log.info('Demo season created', { seasonId: season.id });
    }

    // 5. Create training groups
    const groupData = [
      { name: 'Anfänger Gruppe 1', level: 'beginner', age_group: 'adult' },
      { name: 'Anfänger Gruppe 2', level: 'beginner', age_group: 'adult' },
      { name: 'Fortgeschrittene Gruppe 1', level: 'intermediate', age_group: 'adult' },
      { name: 'Fortgeschrittene Gruppe 2', level: 'intermediate', age_group: 'adult' },
      { name: 'Turnierspieler', level: 'advanced', age_group: 'adult' },
      { name: 'Kids Anfänger', level: 'beginner', age_group: 'kids' },
      { name: 'Kids Fortgeschrittene', level: 'intermediate', age_group: 'kids' },
    ];
    await sb.from('groups').insert(groupData.map((g) => ({ ...g, club_id: clubId })));

    log.info('Demo club seeded successfully', { clubId });
    return NextResponse.json({ clubId, name: DEMO_CLUB_NAME, created: true }, { status: 201 });
  });
}
