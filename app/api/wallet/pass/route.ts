import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { generateMemberPass, isAppleWalletConfigured } from '@/lib/wallet/apple-pass';
import { getClubFeatures, featureDisabledResponse } from '@/lib/require-feature';

/** GET /api/wallet/pass — Apple Wallet .pkpass herunterladen */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!auth.user) return forbiddenResponse();

    if (!isAppleWalletConfigured()) {
      return NextResponse.json(
        { error: 'Apple Wallet nicht konfiguriert (APPLE_WALLET_* ENV fehlen)' },
        { status: 503 }
      );
    }

    const clubId = new URL(request.url).searchParams.get('clubId') ?? auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });

    const features = await getClubFeatures(auth.supabase, clubId);
    if (!features.wallet_passes) return featureDisabledResponse('wallet_passes');

    const sb = auth.supabase;
    const { data: m } = await sb
      .from('user_club_memberships')
      .select('id, created_at, role, clubs(name)')
      .eq('user_id', auth.user.id)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (!m) return NextResponse.json({ error: 'Keine aktive Mitgliedschaft' }, { status: 404 });

    const buf = await generateMemberPass({
      memberName: auth.user.user_metadata?.full_name ?? auth.user.email ?? 'Mitglied',
      memberId: m.id,
      clubName: m.clubs?.name ?? 'Verein',
      memberSince: m.created_at,
      memberType: m.role === 'trainer' ? 'Trainer' : 'Aktiv',
    });

    return new NextResponse(buf as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="mitgliedskarte.pkpass"',
      },
    });
  });
}
