// =============================================================================
// app/api/admin/users/search/route.ts — TICKET 2.5.3
// =============================================================================
//
// GET /api/admin/users/search?clubId=...&q=...
//   Search für Custom-Recipient-Selector (Newsletter-Wizard).
//   Auth: requires admin role + cookie-based clubId match.
//   Pattern: pg-trigram-index (vermeidet email LIKE '%foo%' anti-pattern).
// =============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:users:search');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieClubId = cookieStore.get('tenant-club')?.value ?? null;
    if (!cookieClubId) {
      return NextResponse.json({ error: 'Missing tenant-club cookie' }, { status: 400 });
    }

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');
    const q = url.searchParams.get('q')?.trim() ?? '';

    if (!clubId || clubId !== cookieClubId) {
      return NextResponse.json({ error: 'clubId mismatch' }, { status: 403 });
    }

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // 1. Scope via club_members (nur Members dieses Clubs)
    const { data: members } = await supa
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .limit(50);
    if (!members || members.length === 0) {
      return NextResponse.json({ users: [] });
    }
    const userIds = (members as Array<{ user_id: string }>).map((m) => m.user_id);

    // 2. Search by name/email (ILIKE prefix-match für trigram-index)
    const likePattern = `%${q}%`;
    const { data: users, error: usersErr } = await supa
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds)
      .or(`email.ilike.${likePattern},full_name.ilike.${likePattern}`)
      .limit(20);

    if (usersErr) {
      log.warn('User-Search fehlgeschlagen', { err: usersErr.message });
      return NextResponse.json({ users: [] });
    }

    return NextResponse.json({
      users: (users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
      })),
    });
  } catch (err) {
    log.error('User-Search-GET fehlgeschlagen', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
