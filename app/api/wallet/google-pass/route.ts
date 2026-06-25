import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { generateGoogleWalletUrl, isGoogleWalletConfigured } from '@/lib/wallet/google-pass';

/** GET /api/wallet/google-pass — Google Wallet Save-URL generieren */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!auth.user) return forbiddenResponse();

    if (!isGoogleWalletConfigured())
      return NextResponse.json(
        { error: 'Google Wallet nicht konfiguriert (GOOGLE_WALLET_* ENV fehlen)' },
        { status: 503 }
      );

    const clubId = new URL(request.url).searchParams.get('clubId') ?? auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });

    const sb = auth.supabase as any;
    const { data: m } = await sb
      .from('user_club_memberships')
      .select('id, created_at, role, clubs(name)')
      .eq('user_id', auth.user.id)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (!m) return NextResponse.json({ error: 'Keine aktive Mitgliedschaft' }, { status: 404 });

    const url = generateGoogleWalletUrl({
      memberName: auth.user.user_metadata?.full_name ?? auth.user.email ?? 'Mitglied',
      memberId: m.id,
      clubName: m.clubs?.name ?? 'Verein',
      memberSince: m.created_at,
      memberType: m.role === 'trainer' ? 'Trainer' : 'Aktiv',
    });

    return NextResponse.json({ url });
  });
}
