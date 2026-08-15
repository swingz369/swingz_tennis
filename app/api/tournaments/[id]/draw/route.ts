import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { drawKoBracket, drawRoundRobin } from '@/lib/tournament/draw';
import type { DrawEntry } from '@/lib/tournament/draw';

/**
 * POST /api/tournaments/[id]/draw
 * Generiert Bracket aus bestätigten Anmeldungen.
 * Body: { format: 'ko' | 'round_robin' }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin erforderlich');

    const { id: tournamentId } = await params;
    const { format = 'ko' } = await request.json();
    const sb = auth.supabase as any;

    const { data: tournament } = await sb
      .from('tournaments')
      .select('id, status')
      .eq('id', tournamentId)
      .eq('club_id', auth.clubId)
      .maybeSingle();
    if (!tournament) return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 });
    if (tournament.status === 'completed')
      return NextResponse.json({ error: 'Turnier bereits abgeschlossen' }, { status: 400 });

    const { data: regs, error } = await sb
      .from('tournament_registrations')
      .select('user_id, seed, users(full_name)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'confirmed')
      .order('seed', { ascending: true, nullsFirst: false });

    if (error) return internalErrorResponse();
    if (!regs || regs.length < 2)
      return NextResponse.json(
        { error: 'Mindestens 2 bestätigte Anmeldungen erforderlich' },
        { status: 400 }
      );

    const entries: DrawEntry[] = (regs as any[]).map((r) => ({
      id: r.user_id,
      name: r.users?.full_name ?? r.user_id,
      seed: r.seed ?? undefined,
    }));

    const matches = format === 'round_robin' ? drawRoundRobin(entries) : drawKoBracket(entries);

    await sb.from('tournament_matches').delete().eq('tournament_id', tournamentId);

    const rows = (matches as any[]).map((m, i) => ({
      tournament_id: tournamentId,
      round: m.round,
      position: m.position ?? i + 1,
      player1_id: m.player1?.id ?? null,
      player2_id: m.player2?.id ?? null,
      status: 'scheduled',
    }));

    const { error: insertErr } = await sb.from('tournament_matches').insert(rows);
    if (insertErr) return internalErrorResponse();

    await sb.from('tournaments').update({ status: 'in_progress' }).eq('id', tournamentId);

    return NextResponse.json({ success: true, matchCount: rows.length, format });
  });
}
