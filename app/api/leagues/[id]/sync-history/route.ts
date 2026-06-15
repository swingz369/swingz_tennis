import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/leagues/[id]/sync-history — Get nuLiga sync history for a league
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const { id } = await params;

    // Parse optional limit from query string
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100);

    const { data: logs, error } = await (auth.supabase as any)
      .from('nuliga_sync_log')
      .select('*')
      .eq('league_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Sync History GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch sync history' }, { status: 500 });
    }

    return NextResponse.json({ logs: logs ?? [] });
  });
}
