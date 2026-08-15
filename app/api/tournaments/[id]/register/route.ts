/**
 * POST /api/tournaments/[id]/register — register member for tournament
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:tournaments:[id]:register');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const { supabase, user } = auth;
    const { id: tournamentId } = await params;

    // Check tournament exists and is open for registration
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, status, max_participants, registration_deadline')
      .eq('id', tournamentId)
      .maybeSingle();

    if (!tournament) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 });
    }

    if (tournament.status !== 'registration') {
      return NextResponse.json(
        { error: 'Turnier nimmt keine Anmeldungen mehr an' },
        { status: 409 }
      );
    }

    if (tournament.registration_deadline) {
      const deadline = new Date(tournament.registration_deadline);
      deadline.setHours(23, 59, 59);
      if (new Date() > deadline) {
        return NextResponse.json({ error: 'Anmeldefrist abgelaufen' }, { status: 409 });
      }
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('tournament_registrations')
      .select('id, status')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Bereits für dieses Turnier angemeldet' }, { status: 409 });
    }

    // Check capacity
    const { count: registeredCount } = await supabase
      .from('tournament_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .in('status', ['registered', 'confirmed']);

    if (tournament.max_participants && (registeredCount ?? 0) >= tournament.max_participants) {
      return NextResponse.json({ error: 'Turnier ist ausgebucht' }, { status: 409 });
    }

    const { data: registration, error } = await supabase
      .from('tournament_registrations')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        status: 'registered',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      log.error('tournament register error:', error);
      return NextResponse.json({ error: 'Anmeldung fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json({ registration }, { status: 201 });
  });
}
